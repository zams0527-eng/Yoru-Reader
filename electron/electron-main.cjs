const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let oauthServer = null;

function createWindow() {
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

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Load the compiled index.html (moved up one folder)
  win.loadFile(path.join(__dirname, '../dist/index.html'));
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

    const port = 49876;
    // Desktop app type requires 127.0.0.1 (not localhost) for loopback redirect
    const redirectUri = `http://127.0.0.1:${port}`;

    // --- PKCE: code_verifier + code_challenge ---
    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = base64url(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file')}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256` +
      `&access_type=offline` +
      `&prompt=consent`;

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

    oauthServer.listen(port, '127.0.0.1', () => {
      shell.openExternal(authUrl);
    });

    oauthServer.on('error', (err) => {
      reject(err);
    });
  });
});


app.whenReady().then(createWindow);





app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
