const { app, BrowserWindow, shell, ipcMain, session, protocol, net, webContents } = require('electron');
const path = require('path');
const http = require('http');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const { synthesizeEdgeTts } = require('./edgeTts.cjs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'yoru-reader-ext', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Override console.log and console.error to write to a log file
let logPath;
try {
  logPath = app.isPackaged 
    ? path.join(app.getPath('userData'), 'electron_debug.log') 
    : path.join(__dirname, '../electron_debug.log');
  fs.writeFileSync(logPath, '--- Electron Debug Log Start ---\n');
} catch (e) {
  console.warn("Could not initialize log file path:", e);
}

const originalLog = console.log;
const originalError = console.error;
console.log = function(...args) {
  originalLog.apply(console, args);
  if (logPath) {
    try {
      fs.appendFileSync(logPath, args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n');
    } catch (e) {}
  }
};
console.error = function(...args) {
  originalError.apply(console, args);
  if (logPath) {
    try {
      fs.appendFileSync(logPath, '[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n');
    } catch (e) {}
  }
};

let oauthServer = null;
let mainWindow = null;

function createWindow() {
  // Clear HTTP cache on startup to ensure we don't load old compiled reader assets
  if (session && session.defaultSession) {
    session.defaultSession.clearCache().catch(e => console.error("Failed to clear cache:", e));
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true,
    title: "Yoru Reader"
  });
  mainWindow = win;

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    if (url.startsWith('chrome-extension://')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 900,
          height: 700,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const sourceFile = (sourceId && typeof sourceId === 'string') ? path.basename(sourceId) : 'unknown';
    console.log(`[RENDERER CONSOLE] (${sourceFile}:${line}): ${message}`);
  });

function getExtensionPath() {
  const possiblePaths = [
    path.join(__dirname, 'reader-ext'),
    path.join(__dirname, '../reader-ext'),
    path.join(app.getAppPath(), 'backend/reader-ext'),
    path.join(app.getAppPath(), 'reader-ext')
  ];
  for (const p of possiblePaths) {
    let cleanP = p;
    if (cleanP.includes('app.asar')) {
      cleanP = cleanP.replace('app.asar', 'app.asar.unpacked');
    }
    if (fs.existsSync(cleanP)) return cleanP;
  }
  return path.join(__dirname, 'reader-ext');
}

function getAjbPath() {
  const extDir = getExtensionPath();
  return path.join(extDir, 'js/ajb.js');
}

  win.webContents.on('did-finish-load', () => {
    try {
      const ajbPath = getAjbPath();
      if (fs.existsSync(ajbPath)) {
        const scriptCode = fs.readFileSync(ajbPath, 'utf8');
        win.webContents.executeJavaScript(scriptCode).catch(() => {});
        console.log('[main] Injected Yoru Reader Extension content script into window from:', ajbPath);
      } else {
        console.warn('[main] ajb.js not found at:', ajbPath);
      }
    } catch (e) {
      console.warn('[main] Content script injection warning:', e);
    }
  });

  // Load the compiled index.html (from built-in app bundle first, then OTA if applicable)
  const defaultIndex = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(defaultIndex)) {
    console.log('[main] Loading built-in frontend bundle from:', defaultIndex);
    win.loadFile(defaultIndex);
  } else {
    const otaDistDir = path.join(app.getPath('userData'), 'ota_dist');
    const otaIndex = path.join(otaDistDir, 'index.html');
    if (fs.existsSync(otaIndex)) {
      console.log('[OTA] Loading updated frontend bundle from:', otaIndex);
      win.loadFile(otaIndex);
    } else {
      win.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }
  }
}

const crypto = require('crypto');

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

ipcMain.handle('start-google-oauth', async (event, clientId) => {
  return new Promise((resolve, reject) => {
    if (oauthServer) {
      try { oauthServer.close(); } catch(e) {}
    }

    // --- PKCE: code_verifier + code_challenge ---
    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = base64url(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );

    oauthServer = http.createServer(async (req, res) => {
      const reqUrl = url.parse(req.url, true);
      if (reqUrl.pathname === '/') {
        const code = reqUrl.query.code;
        const error = reqUrl.query.error;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#121214;color:#fff;">
            <h1 style="color:#f87171;">Error de autorización</h1>
            <p>${error}</p><p>Puedes cerrar esta ventana.</p></body></html>`);
          oauthServer.close();
          oauthServer = null;
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#121214;color:#fff;">
            <h1 style="color:#818cf8;">¡Conexión exitosa!</h1>
            <p>Tu cuenta de Google fue conectada. Puedes cerrar esta ventana y volver a Yoru Reader.</p>
            </body></html>`);

          req.socket.destroy();
          const assignedPort = oauthServer.address().port;
          const redirectUri = `http://127.0.0.1:${assignedPort}`;
          oauthServer.close();
          oauthServer = null;

          resolve({ code, redirectUri, codeVerifier });
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('Error: No authorization code received.');
          reject(new Error('No authorization code received'));
        }
      }
    });

    oauthServer.listen(0, '127.0.0.1', () => {
      const assignedPort = oauthServer.address().port;
      const redirectUri = `http://127.0.0.1:${assignedPort}`;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email')}` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}` +
        `&code_challenge_method=S256` +
        `&access_type=offline` +
        `&prompt=consent`;

      shell.openExternal(authUrl);
    });

    oauthServer.on('error', (err) => {
      reject(err);
    });
  });
});

const https = require('https');

ipcMain.handle('download-google-drive', async (event, { urlString, id }) => {
  console.log('[download-google-drive] Requested download URL:', urlString);
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };

    function downloadFileDirect(urlStringDirect) {
      console.log('[download-google-drive] Downloading direct file from:', urlStringDirect);
      https.get(urlStringDirect, options, (res) => {
        console.log('[download-google-drive] Direct response status:', res.statusCode);
        
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log('[download-google-drive] Redirecting direct download to:', res.headers.location);
          downloadFileDirect(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP status code ${res.statusCode}`));
          return;
        }

        const totalLength = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedLength = 0;
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          downloadedLength += chunk.length;
          if (totalLength > 0) {
            const percent = Math.round((downloadedLength / totalLength) * 100);
            event.sender.send('download-progress-event', { id, percent, downloadedBytes: downloadedLength });
          } else {
            event.sender.send('download-progress-event', { id, percent: -1, downloadedBytes: downloadedLength });
          }
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log('[download-google-drive] Bypassed download completed. Total bytes:', buffer.length);
          resolve(buffer);
        });
      }).on('error', (err) => {
        console.error('[download-google-drive] Direct request error:', err);
        reject(err);
      });
    }

    function download(url) {
      console.log('[download-google-drive] Fetching URL:', url);
      https.get(url, options, (res) => {
        console.log('[download-google-drive] Response status:', res.statusCode);
        
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log('[download-google-drive] Redirecting to:', res.headers.location);
          download(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP status code ${res.statusCode}`));
          return;
        }

        const totalLength = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedLength = 0;
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          downloadedLength += chunk.length;
          if (totalLength > 0) {
            const percent = Math.round((downloadedLength / totalLength) * 100);
            event.sender.send('download-progress-event', { id, percent, downloadedBytes: downloadedLength });
          } else {
            event.sender.send('download-progress-event', { id, percent: -1, downloadedBytes: downloadedLength });
          }
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const firstBytesStr = buffer.toString('utf8', 0, Math.min(buffer.length, 500));
          
          if (firstBytesStr.includes('Google Drive - Virus scan warning') || firstBytesStr.includes('can\'t scan this file for viruses')) {
            console.log('[download-google-drive] Virus scan warning page detected. Bypassing...');
            
            const html = buffer.toString('utf8');
            
            // Extract form action URL
            const formActionMatch = html.match(/<form[^>]+action="([^"]+)"/);
            if (!formActionMatch) {
              reject(new Error('Failed to parse download form from warning page'));
              return;
            }
            const actionUrl = formActionMatch[1];
            
            // Extract hidden inputs
            const inputRegex = /<input[^>]+type="hidden"[^>]*>/g;
            const inputs = html.match(inputRegex);
            if (!inputs) {
              reject(new Error('Failed to parse form inputs from warning page'));
              return;
            }
            
            const params = [];
            inputs.forEach(input => {
              const nameMatch = input.match(/name="([^"]+)"/);
              const valueMatch = input.match(/value="([^"]+)"/);
              if (nameMatch && valueMatch) {
                params.push(`${encodeURIComponent(nameMatch[1])}=${encodeURIComponent(valueMatch[1])}`);
              }
            });
            
            if (params.length === 0) {
              reject(new Error('No parameters extracted from warning page form'));
              return;
            }
            
            const bypassUrl = `${actionUrl}?${params.join('&')}`;
            console.log('[download-google-drive] Bypassing with URL:', bypassUrl);
            
            // Download the actual file now
            downloadFileDirect(bypassUrl);
          } else {
            console.log('[download-google-drive] Downloaded file directly. Total bytes:', buffer.length);
            resolve(buffer);
          }
        });
      }).on('error', (err) => {
        console.error('[download-google-drive] Request error:', err);
        reject(err);
      });
    }
    
    download(urlString);
  });
});

ipcMain.handle('download-and-install-update', async (event, { urlString }) => {
  console.log('[update-downloader] Starting in-app update download from:', urlString);
  const installerPath = path.join(app.getPath('temp'), 'Yoru-Reader-Update-Setup.exe');
  
  // Clean up existing installer if it exists
  try {
    if (fs.existsSync(installerPath)) {
      fs.unlinkSync(installerPath);
    }
  } catch (e) {
    console.error('[update-downloader] Error unlinking existing installer:', e);
  }

  return new Promise((resolve, reject) => {
    let fileStream = null;
    let redirectCount = 0;
    const maxRedirects = 10;
    
    function download(urlToDownload) {
      if (redirectCount > maxRedirects) {
        reject(new Error('Demasiadas redirecciones al descargar la actualización.'));
        return;
      }

      const client = urlToDownload.startsWith('http:') ? http : https;
      const options = {
        headers: {
          'User-Agent': 'Yoru-Reader-Updater/1.1.4'
        }
      };
      
      client.get(urlToDownload, options, (res) => {
        console.log('[update-downloader] Response status:', res.statusCode);
        
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
            // Relative redirect
            const parsedBase = new URL(urlToDownload);
            redirectUrl = new URL(redirectUrl, parsedBase.origin).toString();
          }
          console.log('[update-downloader] Redirecting to:', redirectUrl);
          download(redirectUrl);
          return;
        }
        
        if (res.statusCode !== 200) {
          if (res.statusCode === 404) {
            if (urlToDownload.includes('/download/yorureader/')) {
              const fallbackUrl = urlToDownload.replace('/download/yorureader/', '/download/v1.1.4/');
              console.log('[update-downloader] 404 on yorureader tag, retrying with v1.1.4 tag:', fallbackUrl);
              download(fallbackUrl);
              return;
            }
            if (urlToDownload.includes('.Setup.')) {
              const fallbackUrl = urlToDownload.replace('.Setup.', '%20Setup%20');
              console.log('[update-downloader] 404 encountered, trying fallback URL:', fallbackUrl);
              download(fallbackUrl);
              return;
            }
          }
          reject(new Error(`HTTP ${res.statusCode} al descargar la actualización.`));
          return;
        }
        
        const totalLength = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedLength = 0;
        
        fileStream = fs.createWriteStream(installerPath);
        
        fileStream.on('error', (err) => {
          console.error('[update-downloader] Write stream error:', err);
          try { fs.unlinkSync(installerPath); } catch (_) {}
          reject(err);
        });

        res.on('data', (chunk) => {
          downloadedLength += chunk.length;
          if (totalLength > 0) {
            const percent = Math.min(99, Math.round((downloadedLength / totalLength) * 100));
            event.sender.send('update-download-progress', { percent, downloadedBytes: downloadedLength, totalBytes: totalLength, status: 'downloading' });
          } else {
            event.sender.send('update-download-progress', { percent: -1, downloadedBytes: downloadedLength, totalBytes: -1, status: 'downloading' });
          }
        });

        res.pipe(fileStream);
        
        fileStream.on('finish', () => {
          console.log('[update-downloader] Download completed. Installer saved to:', installerPath);
          event.sender.send('update-download-progress', { percent: 100, status: 'installing' });
          
          try {
            console.log('[update-downloader] Executing installer...');
            const { spawn } = require('child_process');
            const child = spawn(installerPath, [], {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            
            // Quit current app instance so installer can write new files
            setTimeout(() => {
              app.quit();
            }, 800);
            
            resolve({ success: true });
          } catch (spawnErr) {
            console.error('[update-downloader] Error launching installer:', spawnErr);
            shell.openPath(installerPath);
            setTimeout(() => { app.quit(); }, 800);
            resolve({ success: true });
          }
        });
        
      }).on('error', (err) => {
        console.error('[update-downloader] Request error:', err);
        if (fileStream) {
          fileStream.end();
        }
        reject(err);
      });
    }
    
    download(urlString);
  });
});

ipcMain.handle('reload-app', () => {
  if (mainWindow) {
    const otaDistDir = path.join(app.getPath('userData'), 'ota_dist');
    const otaIndex = path.join(otaDistDir, 'index.html');
    if (fs.existsSync(otaIndex)) {
      mainWindow.loadFile(otaIndex);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }
  return true;
});

ipcMain.handle('clear-ota-cache', () => {
  try {
    const otaDistDir = path.join(app.getPath('userData'), 'ota_dist');
    if (fs.existsSync(otaDistDir)) {
      fs.rmSync(otaDistDir, { recursive: true, force: true });
    }
  } catch (e) {}
  return true;
});

ipcMain.handle('check-hot-update', async (event) => {
  console.log('[OTA] Checking for frontend hot updates...');
  const otaDistDir = path.join(app.getPath('userData'), 'ota_dist');
  const otaManifestFile = path.join(otaDistDir, 'ota_manifest.json');
  
  let currentHotVersion = '0.0.0';
  try {
    if (fs.existsSync(otaManifestFile)) {
      const data = JSON.parse(fs.readFileSync(otaManifestFile, 'utf8'));
      if (data.hotUpdateVersion) currentHotVersion = data.hotUpdateVersion;
    }
  } catch (_) {}

  // Fetch stable.json
  const urls = [
    'https://raw.githubusercontent.com/zams0527-eng/Yoru-Reader/main/stable.json',
    'https://raw.githubusercontent.com/zams0527-eng/Yoru-Reader/master/stable.json'
  ];

  let remoteManifest = null;
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (res.ok) {
        remoteManifest = await res.json();
        break;
      }
    } catch (_) {}
  }

  if (!remoteManifest || !remoteManifest.hotUpdateVersion) {
    return { available: false, currentVersion: currentHotVersion };
  }

  const remoteHotVersion = remoteManifest.hotUpdateVersion;
  const isNewer = (remoteVer, localVer) => {
    const rParts = (remoteVer || '').split('.').map(n => parseInt(n, 10) || 0);
    const lParts = (localVer || '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
      const rv = rParts[i] || 0;
      const lv = lParts[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  };

  if (!isNewer(remoteHotVersion, currentHotVersion)) {
    return { available: false, currentVersion: currentHotVersion, latestVersion: remoteHotVersion };
  }

  console.log(`[OTA] New hot update detected: ${remoteHotVersion} (Current: ${currentHotVersion}). Downloading bundle...`);
  
  const distUrl = remoteManifest.hotUpdateUrl || `https://github.com/zams0527-eng/Yoru-Reader/releases/download/v${remoteManifest.appVersion || '1.1.4'}/dist.zip`;
  
  try {
    const JSZip = require('jszip');
    const res = await fetch(distUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status || res.statusCode} al descargar dist.zip`);
    }
    const arrayBuf = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(Buffer.from(arrayBuf));

    const stagingDir = path.join(app.getPath('userData'), 'ota_dist_staging');
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stagingDir, { recursive: true });

    for (const [filename, fileObj] of Object.entries(zip.files)) {
      const destPath = path.join(stagingDir, filename);
      if (fileObj.dir) {
        fs.mkdirSync(destPath, { recursive: true });
      } else {
        const parent = path.dirname(destPath);
        if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
        const content = await fileObj.async('nodebuffer');
        fs.writeFileSync(destPath, content);
      }
    }

    if (!fs.existsSync(path.join(stagingDir, 'index.html'))) {
      throw new Error('El archivo dist.zip no contiene un index.html válido.');
    }

    fs.writeFileSync(path.join(stagingDir, 'ota_manifest.json'), JSON.stringify({
      hotUpdateVersion: remoteHotVersion,
      updatedAt: new Date().toISOString()
    }, null, 2));

    if (fs.existsSync(otaDistDir)) {
      fs.rmSync(otaDistDir, { recursive: true, force: true });
    }
    fs.renameSync(stagingDir, otaDistDir);

    console.log(`[OTA] Hot update ${remoteHotVersion} successfully installed!`);
    return {
      available: true,
      updated: true,
      version: remoteHotVersion,
      description: remoteManifest.description
    };
  } catch (err) {
    console.error('[OTA] Error applying hot update:', err);
    return { available: true, updated: false, error: err.message };
  }
});

ipcMain.handle('speak-text', async (event, { text, voice, rate }) => {
  console.log('[speak-text] Requesting Edge TTS. Voice:', voice, 'Rate:', rate);
  try {
    const audioBuffer = await synthesizeEdgeTts(text, voice, rate);
    return audioBuffer;
  } catch (error) {
    console.error('[speak-text] Edge TTS error:', error);
    throw error;
  }
});

ipcMain.handle('anki-request', async (event, { host, body }) => {
  try {
    const response = await fetch(host, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[anki-request] Proxy error:', error);
    throw error;
  }
});

const READER_EXT_SHARED_API_KEY = "ak_CXDEL1S6z4jy998v1Qx_HdaU9laoTILD8mwJp5p3VjA";
let readerExtensionId = null;

ipcMain.handle('get-reader-extension-id', () => {
  return readerExtensionId;
});

ipcMain.handle('open-reader-extension-settings', (event, theme) => {
  try {
    console.log(`[main] open-reader-extension-settings invoked. Extension ID: ${readerExtensionId}, Theme: ${theme}`);
    if (!readerExtensionId) {
      console.error("[main] readerExtensionId is null!");
      return false;
    }
    const settingsUrl = `chrome-extension://${readerExtensionId}/views/settings.html?theme=${theme || 'dark'}`;
    console.log(`[main] Loading settings URL: ${settingsUrl}`);
    
    const settingsWin = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      autoHideMenuBar: true,
      title: "Ajustes de la Extensión Yoru Reader"
    });
    
    settingsWin.loadURL(settingsUrl);
    return true;
  } catch (err) {
    console.error("[main] Error opening extension settings window:", err);
    return false;
  }
});

ipcMain.handle('read-local-file', async (event, filePath) => {
  try {
    console.log(`[main] read-local-file invoked for path: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const data = fs.readFileSync(filePath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } catch (err) {
    console.error("[main] Error reading local file:", err);
    throw err;
  }
});


let extWordMap = {};
const pendingParses = new Map();
let parseRequestCounter = 0;

ipcMain.on('reply-parse-text', (event, { requestId, result, error }) => {
  const pending = pendingParses.get(requestId);
  if (pending) {
    if (error) {
      console.error(`[main] parse-text error for request ${requestId}:`, error);
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
    pendingParses.delete(requestId);
  }
});

function queryLocalWordStatuses(words) {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve({});
      return;
    }
    const replyChannel = 'reply-query-word-statuses';
    const listener = (event, statuses) => {
      ipcMain.off(replyChannel, listener);
      resolve(statuses);
    };
    ipcMain.on(replyChannel, listener);
    mainWindow.webContents.send('query-word-statuses', words);
  });
}

function saveWordToLocalSrs(wordData) {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve();
      return;
    }
    const replyChannel = 'reply-save-word-to-srs';
    const listener = () => {
      ipcMain.off(replyChannel, listener);
      resolve();
    };
    ipcMain.on(replyChannel, listener);
    mainWindow.webContents.send('save-word-to-srs', wordData);
  });
}

function updateWordStatusInApp(data) {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve();
      return;
    }
    const replyChannel = 'reply-update-word-status';
    const listener = () => {
      ipcMain.off(replyChannel, listener);
      resolve();
    };
    ipcMain.on(replyChannel, listener);
    mainWindow.webContents.send('update-word-status', data);
  });
}

// Start local HTTP server for extension requests
let localExtServer = null;

function startLocalExtServer() {
  localExtServer = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    let pathName = reqUrl.pathname;
    // Normalize path by stripping /api/ prefix if present
    if (pathName.startsWith('/api/')) {
      pathName = pathName.slice(5);
    } else if (pathName.startsWith('/')) {
      pathName = pathName.slice(1);
    }

    console.log(`[local-ext-server] Request path: ${pathName}`);

    // Read POST body
    let bodyText = '';
    await new Promise((resolve) => {
      req.on('data', chunk => { bodyText += chunk; });
      req.on('end', resolve);
    });

    let payload = {};
    try {
      if (bodyText) payload = JSON.parse(bodyText);
    } catch (e) {}

    res.setHeader('Content-Type', 'application/json');

    try {
      if (pathName === 'reader/ping' || pathName === 'ping' || pathName === 'api/ping') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }
      
      if (pathName === 'reader/parse' || pathName === 'parse' || pathName === 'api/parse') {
        if (!mainWindow) throw new Error("Main window not available");
        
        const requestId = ++parseRequestCounter;
        const resultPromise = new Promise((resolve, reject) => {
          pendingParses.set(requestId, { resolve, reject });
          setTimeout(() => {
            if (pendingParses.has(requestId)) {
              pendingParses.delete(requestId);
              reject(new Error("Parse request timed out"));
            }
          }, 20000);
        });
        
        mainWindow.webContents.send('parse-text-request', { requestId, paragraphs: payload.text });
        const data = await resultPromise;
        
        if (data && Array.isArray(data.vocabulary)) {
          data.vocabulary.forEach(v => {
            extWordMap[v.wordId] = v.spelling;
          });
        }
        res.writeHead(200);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathName === 'reader/lookup-vocabulary' || pathName === 'lookup-vocabulary' || pathName === 'api/lookup-vocabulary') {
        const results = [];
        const deckIds = [];
        const wordsList = [];

        if (payload.words && Array.isArray(payload.words)) {
          payload.words.forEach(([wordId, readingIndex]) => {
            const spelling = extWordMap[wordId] || '';
            wordsList.push(spelling);
          });

          const localStatuses = await queryLocalWordStatuses(wordsList);

          payload.words.forEach(([wordId, readingIndex]) => {
            const spelling = extWordMap[wordId];
            const status = localStatuses[spelling];
            
            let state = [0]; // New
            if (status === 'known') state = [2]; // Mature
            else if (status === 'learning') state = [1]; // Young
            
            results.push(state);
            deckIds.push([1]);
          });
        }

        res.writeHead(200);
        res.end(JSON.stringify({ result: results, decks: deckIds }));
        return;
      }

      if (pathName === 'srs/reader-study-decks' || pathName === 'reader-study-decks') {
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          result: [{ id: 1, name: "Yoru Local SRS", wordCount: 0 }]
        }));
        return;
      }

      if (pathName === 'srs/set-vocabulary-state' || pathName === 'set-vocabulary-state') {
        const wordIdStr = String(payload.wordId || '');
        let spelling = payload.spelling || payload.word;
        if (!spelling && wordIdStr.includes(':')) {
          spelling = wordIdStr.split(':')[0];
        }
        if (!spelling && payload.wordId) {
          spelling = extWordMap[payload.wordId];
        }

        if (spelling) {
          await updateWordStatusInApp({
            word: spelling,
            state: payload.state
          });
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (pathName.startsWith('srs/study-decks/') || pathName.startsWith('study-decks/')) {
        const wordIdStr = String(payload.wordId || '');
        let spelling = payload.spelling || payload.word;
        if (!spelling && wordIdStr.includes(':')) {
          spelling = wordIdStr.split(':')[0];
        }
        if (!spelling && payload.wordId) {
          spelling = extWordMap[payload.wordId];
        }

        let reading = payload.reading || '';
        if (!reading && wordIdStr.includes(':')) {
          reading = wordIdStr.split(':')[1];
        }

        if (spelling) {
          await saveWordToLocalSrs({
            word: spelling,
            reading: reading,
            sentence: payload.sentence || '',
            source: payload.source || ''
          });
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      console.error(`[local-ext-server] Error handling ${pathName}:`, err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  localExtServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn('[local-ext-server] Port 23280 is already in use by another instance, skipping listener.');
    } else {
      console.error('[local-ext-server] Server error:', err);
    }
  });

  localExtServer.listen(23280, '127.0.0.1', () => {
    console.log('[local-ext-server] Listening on http://127.0.0.1:23280');
  });
}

app.whenReady().then(async () => {
  startLocalExtServer();
  // Register custom protocol handler for yoru-reader-ext
  protocol.handle('yoru-reader-ext', async (request) => {
    const url = new URL(request.url);
    const pathName = url.pathname.slice(1);
    console.log(`[yoru-reader-ext] Intercepted path: ${pathName}`);

    if (pathName === 'reader/ping' || pathName === 'ping') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (pathName === 'reader/parse' || pathName === 'parse') {
      try {
        const bodyText = await request.text();
        const payload = JSON.parse(bodyText);
        
        if (!mainWindow) {
          throw new Error("Main window not available");
        }
        
        const requestId = ++parseRequestCounter;
        const resultPromise = new Promise((resolve, reject) => {
          pendingParses.set(requestId, { resolve, reject });
          setTimeout(() => {
            if (pendingParses.has(requestId)) {
              pendingParses.delete(requestId);
              reject(new Error("Parse request timed out"));
            }
          }, 20000);
        });
        
        mainWindow.webContents.send('parse-text-request', { requestId, paragraphs: payload.text });
        
        const data = await resultPromise;
        
        if (data && Array.isArray(data.vocabulary)) {
          data.vocabulary.forEach(v => {
            extWordMap[v.wordId] = v.spelling;
          });
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('[yoru-reader-ext] Error during native reader/parse:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    if (pathName === 'reader/lookup-vocabulary' || pathName === 'lookup-vocabulary') {
      try {
        const bodyText = await request.text();
        const payload = JSON.parse(bodyText);
        
        const results = [];
        const deckIds = [];
        const wordsList = [];

        payload.words.forEach(([wordId, readingIndex]) => {
          const spelling = extWordMap[wordId] || '';
          wordsList.push(spelling);
        });

        const localStatuses = await queryLocalWordStatuses(wordsList);

        payload.words.forEach(([wordId, readingIndex]) => {
          const spelling = extWordMap[wordId];
          const status = localStatuses[spelling];
          
          let state = [0]; // New
          if (status === 'known') state = [2]; // Mature
          else if (status === 'learning') state = [1]; // Young
          
          results.push(state);
          deckIds.push([1]); // Mock deck ID
        });

        return new Response(JSON.stringify({ result: results, decks: deckIds }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('[yoru-reader-ext] Error during lookup-vocabulary:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    if (pathName === 'srs/reader-study-decks' || pathName === 'reader-study-decks') {
      return new Response(JSON.stringify({
        success: true,
        result: [{ id: 1, name: "Yoru Local SRS", wordCount: 0 }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (pathName === 'srs/set-vocabulary-state' || pathName === 'set-vocabulary-state') {
      try {
        const bodyText = await request.text();
        const payload = JSON.parse(bodyText);
        const wordIdStr = String(payload.wordId || '');
        let spelling = payload.spelling || payload.word;
        if (!spelling && wordIdStr.includes(':')) {
          spelling = wordIdStr.split(':')[0];
        }
        if (!spelling && payload.wordId) {
          spelling = extWordMap[payload.wordId];
        }

        if (spelling) {
          await updateWordStatusInApp({
            word: spelling,
            state: payload.state
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('[yoru-reader-ext] Error during set-vocabulary-state:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    if (pathName.startsWith('srs/study-decks/') || pathName.startsWith('study-decks/')) {
      try {
        const bodyText = await request.text();
        const payload = JSON.parse(bodyText);
        const wordIdStr = String(payload.wordId || '');
        let spelling = payload.spelling || payload.word;
        if (!spelling && wordIdStr.includes(':')) {
          spelling = wordIdStr.split(':')[0];
        }
        if (!spelling && payload.wordId) {
          spelling = extWordMap[payload.wordId];
        }

        let reading = payload.reading || '';
        if (!reading && wordIdStr.includes(':')) {
          reading = wordIdStr.split(':')[1];
        }

        if (spelling) {
          await saveWordToLocalSrs({
            word: spelling,
            reading: reading,
            sentence: payload.sentence || '',
            source: payload.source || ''
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('[yoru-reader-ext] Error during study-decks words add:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  try {
    try {
      await session.defaultSession.clearStorageData({ storages: ['serviceworkers'] });
      console.log('[main] Cleared service worker cache.');
    } catch (e) {
      console.warn('[main] Failed to clear service worker cache:', e);
    }
    const extensionPath = getExtensionPath();
    const ext = await session.defaultSession.loadExtension(extensionPath, { allowFileAccess: true });
    readerExtensionId = ext.id;
    console.log(`[main] Loaded Yoru Reader Extension natively from ${extensionPath}: ${ext.name} (${ext.id})`);

    // Auto-inject shared API key into extension storage
    try {
      const allWebContents = webContents.getAllWebContents();
      const extWebContents = allWebContents.find(wc => 
        wc.getURL().startsWith(`chrome-extension://${readerExtensionId}`)
      );
      if (extWebContents) {
        await extWebContents.executeJavaScript(`chrome.storage.local.set({ yoruApiKey: "${READER_EXT_SHARED_API_KEY}", yoruApiEndpoint: "http://127.0.0.1:23280/api" })`);
        console.log('[main] Auto-configured extension with shared key.');
      } else {
        const tempWin = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });
        await tempWin.loadURL(`chrome-extension://${readerExtensionId}/views/settings.html`);
        await tempWin.webContents.executeJavaScript(`chrome.storage.local.set({ yoruApiKey: "${READER_EXT_SHARED_API_KEY}", yoruApiEndpoint: "http://127.0.0.1:23280/api" })`);
        tempWin.close();
        console.log('[main] Pre-configured extension via temp window.');
      }
    } catch (e) {
      console.warn('[main] Failed to auto-configure extension:', e);
    }
  } catch (err) {
    console.error('[main] Failed to load Yoru Reader Extension natively:', err);
  }
  createWindow();
});





app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Discord Rich Presence (IPC Named Pipe)
let discordRpcSocket = null;
let discordRpcClientId = '1326462719280054363'; // Registered Client ID for Yoru Reader
let discordRpcActivePresence = null;

let isDiscordConnecting = false;

function connectDiscordRpc() {
  if (discordRpcSocket) return Promise.resolve(discordRpcSocket);
  if (isDiscordConnecting) return Promise.resolve(null);

  isDiscordConnecting = true;

  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    let index = 0;

    function tryConnect() {
      if (index > 9) {
        console.error('[Discord RPC] Failed to connect to any Discord IPC pipes (0-9)');
        isDiscordConnecting = false;
        reject(new Error('All pipes failed'));
        return;
      }

      const pipePath = isWin 
        ? `\\\\?\\pipe\\discord-ipc-${index}` 
        : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp'}/discord-ipc-${index}`;

      console.log(`[Discord RPC] Trying to connect to socket at: ${pipePath}`);
      const client = net.createConnection(pipePath);
      let hasFinished = false;

      const timeoutId = setTimeout(() => {
        if (hasFinished) return;
        hasFinished = true;
        console.error(`[Discord RPC] Pipe ${index} connection timed out.`);
        client.destroy();
        index++;
        tryConnect();
      }, 1000);

      client.on('connect', () => {
        if (hasFinished) return;
        hasFinished = true;
        clearTimeout(timeoutId);
        console.log(`[Discord RPC] Connected successfully to ${pipePath}. Performing handshake...`);
        isDiscordConnecting = false;
        
        const handshake = JSON.stringify({
          v: 1,
          client_id: discordRpcClientId
        });
        sendDiscordRpcFrame(client, 0, handshake);
        discordRpcSocket = client;

        client.on('close', () => {
          console.log('[Discord RPC] Connection closed.');
          if (discordRpcSocket === client) {
            discordRpcSocket = null;
          }
        });

        client.on('error', (err) => {
          console.error('[Discord RPC] Connected socket error:', err.message);
        });

        client.on('data', (data) => {
          // Consume data
        });
        
        if (discordRpcActivePresence) {
          setTimeout(() => {
            updateDiscordRpcPresence(discordRpcActivePresence);
          }, 1000);
        }
        resolve(client);
      });

      client.on('error', (err) => {
        if (hasFinished) return;
        hasFinished = true;
        clearTimeout(timeoutId);
        console.error(`[Discord RPC] Pipe ${index} connection failed:`, err.message);
        client.destroy();
        index++;
        tryConnect();
      });
    }

    tryConnect();
  });
}

function sendDiscordRpcFrame(socket, opcode, jsonPayload) {
  try {
    const payloadBuffer = Buffer.from(jsonPayload, 'utf8');
    const headerBuffer = Buffer.alloc(8);
    headerBuffer.writeUInt32LE(opcode, 0);
    headerBuffer.writeUInt32LE(payloadBuffer.length, 4);

    socket.write(headerBuffer);
    socket.write(payloadBuffer);
  } catch (err) {
    console.error('[Discord RPC] Failed to write socket frame:', err);
  }
}

function updateDiscordRpcPresence(presence) {
  discordRpcActivePresence = presence;

  let targetClientId = '1326462719280054363'; // Yoru Reader default
  if (presence && presence.assets && presence.assets.large_image) {
    const img = presence.assets.large_image;
    if (img === 'gsm_cute' || img === 'gsm_jacked' || img === 'gsm_cursed') {
      targetClientId = '1441571345942052935'; // GSM Client ID
    }
  }

  if (discordRpcClientId !== targetClientId) {
    console.log(`[Discord RPC] Switching client ID from ${discordRpcClientId} to ${targetClientId}`);
    discordRpcClientId = targetClientId;
    if (discordRpcSocket) {
      discordRpcSocket.destroy();
      discordRpcSocket = null;
    }
  }

  if (!discordRpcSocket) {
    connectDiscordRpc().catch(() => {});
    return;
  }

  const nonce = Math.random().toString(36).substring(2, 15);
  const payload = JSON.stringify({
    cmd: 'SET_ACTIVITY',
    args: {
      pid: process.pid,
      activity: presence
    },
    nonce: nonce
  });

  sendDiscordRpcFrame(discordRpcSocket, 1, payload);
}

function clearDiscordRpcPresence() {
  discordRpcActivePresence = null;
  if (discordRpcSocket) {
    const nonce = Math.random().toString(36).substring(2, 15);
    const payload = JSON.stringify({
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null
      },
      nonce: nonce
    });
    sendDiscordRpcFrame(discordRpcSocket, 1, payload);
  }
}

ipcMain.handle('update-discord-presence', (event, presence) => {
  if (presence) {
    updateDiscordRpcPresence(presence);
  } else {
    clearDiscordRpcPresence();
  }
});
