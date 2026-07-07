import React, { useState, useRef } from 'react';
import { Camera, User, Globe } from 'lucide-react';
import { t } from '../utils/i18n';

const PRESET_AVATARS = [
  { avatar: 'linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)', emoji: '🦊' }
];

export default function WelcomeScreen({ onCreateProfile, settings = {}, onSaveSettings }) {
  const lang = settings.appLanguage || 'en';
  const [name, setName] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null);
  const fileInputRef = useRef(null);

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
      </div>
    </div>
  );
}
