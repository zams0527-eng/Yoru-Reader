import React, { useState, useRef } from 'react';
import { Camera, User, Globe } from 'lucide-react';
import { t } from '../utils/i18n';
import JSZip from 'jszip';
import { db } from '../utils/db';
import { googleDriveService } from '../utils/googleDriveService';

const PRESET_AVATARS = [
  { avatar: 'linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)', emoji: '🦊' }
];

export default function WelcomeScreen({ onCreateProfile, settings = {}, onSaveSettings }) {
  const lang = settings.appLanguage || 'en';
  const [name, setName] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef(null);

  const handleImportLocalBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      document.body.style.cursor = 'wait';
      let importData = null;
      let zip = null;
      const isZip = file.name.toLowerCase().endsWith('.zip');

      if (isZip) {
        zip = await JSZip.loadAsync(file);
        const metaFile = zip.file('metadata.json');
        if (!metaFile) {
          alert(lang === 'es' ? 'El archivo zip no contiene metadatos válidos de Yoru Reader.' : 'The zip file does not contain valid Yoru Reader metadata.');
          return;
        }
        const metaStr = await metaFile.async('text');
        importData = JSON.parse(metaStr);
      } else {
        // Legacy JSON backup support
        const text = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = (evt) => resolve(evt.target.result);
          r.onerror = (err) => reject(err);
          r.readAsText(file);
        });
        importData = JSON.parse(text);
      }

      if (!importData.books && !importData.profiles) {
        alert(lang === 'es' ? 'El archivo no tiene un formato de respaldo válido de Yoru Reader.' : 'The file does not have a valid Yoru Reader backup format.');
        return;
      }

      if (confirm(lang === 'es' ? 'Al restaurar la copia de seguridad se combinarán o sobrescribirán los datos. ¿Deseas continuar?' : 'Restoring the backup will merge or overwrite current data. Do you want to continue?')) {
        
        // 1. Restore active profile ID
        if (importData.activeProfileId) {
          localStorage.setItem('migaku_reader_active_profile_id', importData.activeProfileId);
        } else if (importData.profiles && importData.profiles.length > 0) {
          localStorage.setItem('migaku_reader_active_profile_id', importData.profiles[0].id);
        }

        // 2. Merge profiles
        if (importData.profiles) {
          db.saveProfiles(importData.profiles);
        }

        // 3. Merge books
        if (importData.books) {
          await db.saveBooks(importData.books);
        }
        
        // 4. Restore word statuses
        if (importData.wordStatuses) {
          db.saveWordStatuses(importData.wordStatuses);
        }

        // 5. Restore settings
        if (importData.settings) {
          db.saveSettings(importData.settings);
        }
        if (importData.ankiSettings) {
          localStorage.setItem('anki_settings', JSON.stringify(importData.ankiSettings));
        }
        if (importData.ankiSettingsV2) {
          localStorage.setItem('anki_settings_v2', JSON.stringify(importData.ankiSettingsV2));
        }

        // 6. Restore Yomitan dictionary metadata
        if (importData.dictionaries && importData.dictionaries.length > 0) {
          const { importAllDictionaryData } = await import('../utils/yomitanDB');
          await importAllDictionaryData({
            dictionaries: importData.dictionaries,
            terms: [],
            frequencies: []
          });
        }

        // 7. Load chunks of terms and frequencies from Zip if present
        if (isZip && zip) {
          const { importAllDictionaryData } = await import('../utils/yomitanDB');
          // Load terms chunks
          const termsInfoFile = zip.file('terms_info.json');
          if (termsInfoFile) {
            const termsInfo = JSON.parse(await termsInfoFile.async('text'));
            for (let c = 0; c < termsInfo.chunkCount; c++) {
              const chunkFile = zip.file(`terms_chunk_${c}.json`);
              if (chunkFile) {
                const chunkStr = await chunkFile.async('text');
                const chunkData = JSON.parse(chunkStr);
                await importAllDictionaryData({ dictionaries: [], terms: chunkData, frequencies: [] });
              }
            }
          }

          // Load frequencies chunks
          const freqsInfoFile = zip.file('freqs_info.json');
          if (freqsInfoFile) {
            const freqsInfo = JSON.parse(await freqsInfoFile.async('text'));
            for (let c = 0; c < freqsInfo.chunkCount; c++) {
              const chunkFile = zip.file(`freqs_chunk_${c}.json`);
              if (chunkFile) {
                const chunkStr = await chunkFile.async('text');
                const chunkData = JSON.parse(chunkStr);
                await importAllDictionaryData({ dictionaries: [], terms: [], frequencies: chunkData });
              }
            }
          }
        }

        alert(lang === 'es' ? 'Copia de seguridad restaurada con éxito. Reiniciando...' : 'Backup restored successfully. Restarting...');
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      alert((lang === 'es' ? 'Error al importar la biblioteca: ' : 'Error importing library: ') + e.message);
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const handleRestoreDriveBackup = async () => {
    const clientId = localStorage.getItem('gdrive_client_id') || prompt(lang === 'es' ? 'Ingresa tu Google Drive Client ID:' : 'Enter your Google Drive Client ID:');
    if (!clientId) return;
    localStorage.setItem('gdrive_client_id', clientId.trim());

    const clientSecret = localStorage.getItem('gdrive_client_secret') || prompt(lang === 'es' ? 'Ingresa tu Client Secret (deja vacío si no lo requieres):' : 'Enter your Client Secret (leave empty if not required):') || '';
    localStorage.setItem('gdrive_client_secret', clientSecret.trim());

    try {
      setIsSyncing(true);
      document.body.style.cursor = 'wait';

      if (!window.electronAPI || !window.electronAPI.startGoogleOauth) {
        alert(lang === 'es' ? 'El puente nativo de Electron no está disponible.' : 'The Electron native bridge is not available.');
        return;
      }

      // 1. Authenticate / get tokens
      const oauthResult = await window.electronAPI.startGoogleOauth(clientId.trim());
      if (!oauthResult || !oauthResult.code) {
        throw new Error('No authorization code returned from loopback server');
      }

      const tokens = await googleDriveService.exchangeCodeForTokens(
        oauthResult.code,
        oauthResult.redirectUri,
        clientId.trim(),
        clientSecret.trim(),
        oauthResult.codeVerifier
      );

      if (!tokens) {
        alert(lang === 'es' ? 'Error al conectar con Google Drive.' : 'Failed to connect to Google Drive.');
        return;
      }

      localStorage.setItem('gdrive_tokens', JSON.stringify(tokens));

      // Fetch connected user info
      const info = await googleDriveService.getUserInfo(tokens, clientId.trim(), clientSecret.trim());
      localStorage.setItem('gdrive_user_email', info.email);

      // 2. Download backup zip from Drive
      const zipBlob = await googleDriveService.downloadBlobFile(
        tokens,
        clientId.trim(),
        'yoru_reader_full_backup.zip',
        clientSecret.trim()
      );

      if (!zipBlob) {
        alert(lang === 'es'
          ? 'No se encontró ningún archivo de copia de seguridad (yoru_reader_full_backup.zip) en Google Drive.'
          : 'No backup file (yoru_reader_full_backup.zip) was found in your Google Drive.');
        return;
      }

      // Convert Blob to File object to reuse local import logic
      const fileObj = new File([zipBlob], 'yoru_reader_full_backup.zip', { type: 'application/zip' });
      await handleImportLocalBackup({ target: { files: [fileObj] } });

    } catch (e) {
      console.error(e);
      alert((lang === 'es' ? 'Error al restaurar desde Drive: ' : 'Error restoring from Drive: ') + e.message);
    } finally {
      setIsSyncing(false);
      document.body.style.cursor = 'default';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomAvatarUrl(event.target.result);
      setSelectedPresetIdx(-1);
    };
    reader.onerror = () => {
      alert(t('errorLoadImage', lang));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    let avatar = '';
    let emoji = '';

    if (customAvatarUrl) {
      avatar = customAvatarUrl;
    } else {
      avatar = PRESET_AVATARS[selectedPresetIdx].avatar;
      emoji = PRESET_AVATARS[selectedPresetIdx].emoji;
    }

    const newProfile = {
      id: `profile-${Date.now()}`,
      name: name.trim(),
      avatar: avatar,
      avatarEmoji: emoji
    };

    onCreateProfile(newProfile);
  };

  return (
    <div className="welcome-screen-container">
      <div className="welcome-card">
        {/* Language Switcher at Entry */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Globe size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <select 
            value={lang}
            onChange={(e) => onSaveSettings({ ...settings, appLanguage: e.target.value })}
            className="migaku-select"
            style={{ width: '130px', fontSize: '0.82rem', padding: '6px 10px', background: '#1c1c20', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', outline: 'none' }}
          >
            <option value="en">English (US)</option>
            <option value="es">Español</option>
          </select>
        </div>

        <div className="welcome-header">
          <h1 className="welcome-title">{t('welcomeTitle', lang)}</h1>
          <p className="welcome-subtitle">{t('welcomeSubtitle', lang)}</p>
        </div>

        <form onSubmit={handleSubmit} className="welcome-form">
          {/* Avatar Preview & Upload */}
          <div className="welcome-avatar-section">
            <div className="welcome-avatar-preview-wrapper">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              
              {customAvatarUrl ? (
                <div 
                  className="welcome-avatar-preview custom"
                  onClick={() => fileInputRef.current.click()}
                  title={lang === 'es' ? 'Cambiar foto de perfil' : 'Change profile photo'}
                >
                  <img src={customAvatarUrl} alt="Avatar" className="welcome-custom-img" />
                  <div className="welcome-avatar-overlay">
                    <Camera size={16} />
                  </div>
                </div>
              ) : (
                <div 
                  className="welcome-avatar-preview preset"
                  style={{ background: PRESET_AVATARS[selectedPresetIdx].avatar }}
                  onClick={() => fileInputRef.current.click()}
                  title={lang === 'es' ? 'Subir foto personalizada' : 'Upload custom photo'}
                >
                  <span className="welcome-avatar-emoji">
                    {PRESET_AVATARS[selectedPresetIdx].emoji}
                  </span>
                  <div className="welcome-avatar-overlay">
                    <Camera size={16} />
                  </div>
                </div>
              )}
            </div>
            <button 
              type="button" 
              className="welcome-upload-btn"
              onClick={() => fileInputRef.current.click()}
            >
              {t('uploadPhoto', lang)}
            </button>
          </div>

          {/* Preset Avatars Selection */}
          <div className="welcome-presets-section">
            <div className="welcome-presets-label">{t('chooseAvatar', lang)}</div>
            <div className="welcome-presets-grid">
              {PRESET_AVATARS.map((p, idx) => {
                const isSelected = selectedPresetIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`welcome-preset-item ${isSelected ? 'selected' : ''}`}
                    style={{ background: p.avatar }}
                    onClick={() => {
                      setSelectedPresetIdx(idx);
                      setCustomAvatarUrl(null);
                    }}
                  >
                    <span>{p.emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name Input */}
          <div className="welcome-input-group">
            <label className="welcome-input-label">{t('profileName', lang)}</label>
            <div className="welcome-input-wrapper">
              <User className="welcome-input-icon" size={16} />
              <input 
                type="text" 
                placeholder={t('namePlaceholder', lang)} 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="welcome-name-input"
                maxLength={20}
                required
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="welcome-submit-btn">
            {t('startReading', lang)}
          </button>
        </form>

        <div style={{ margin: '24px 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {lang === 'es' ? '¿Tienes una copia?' : 'Have a backup?'}
          </span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Restaurar Local */}
          <label 
            className="welcome-submit-btn" 
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              color: '#fff', 
              fontSize: '0.85rem', 
              padding: '10px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              textTransform: 'none',
              boxShadow: 'none'
            }}
          >
            💾 {lang === 'es' ? 'Importar respaldo local (.zip, .json)' : 'Import local backup (.zip, .json)'}
            <input 
              type="file" 
              accept=".json,.zip"
              onChange={handleImportLocalBackup}
              style={{ display: 'none' }}
            />
          </label>

          {/* Restaurar Google Drive */}
          <button 
            type="button"
            onClick={handleRestoreDriveBackup}
            disabled={isSyncing}
            className="welcome-submit-btn" 
            style={{ 
              background: 'rgba(52, 211, 153, 0.05)', 
              border: '1px solid rgba(52, 211, 153, 0.2)', 
              color: '#34d399', 
              fontSize: '0.85rem', 
              padding: '10px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              textTransform: 'none',
              boxShadow: 'none'
            }}
          >
            ☁️ {isSyncing 
              ? (lang === 'es' ? 'Sincronizando...' : 'Syncing...') 
              : (lang === 'es' ? 'Restaurar desde Google Drive' : 'Restore from Google Drive')}
          </button>
        </div>
      </div>
    </div>
  );
}
