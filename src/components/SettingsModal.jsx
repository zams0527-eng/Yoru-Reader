import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { t } from '../utils/i18n';
const AnkiConfigModal = React.lazy(() => import('./AnkiConfigModal'));

export default function SettingsModal({ isOpen, onClose, settings = {}, onSaveSettings, mode = 'settings', book, onUpdateBookDetails }) {
  if (!isOpen) return null;
  const [isAnkiConfigOpen, setIsAnkiConfigOpen] = useState(false);
  const lang = settings.appLanguage || 'es';

  if (mode === 'info') {
    if (!book) return null;
    const charsCount = (book.chapters || []).reduce((acc, c) => acc + (c.content || '').length, 0);
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="settings-modal migaku-style" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
          <div className="modal-header" style={{ paddingBottom: '0.2rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
              {t('editInfo', lang).toUpperCase()}
            </h3>
            <button className="close-modal-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div className="migaku-settings-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('title', lang)}</span>
              <span 
                style={{ fontWeight: 600, color: '#fff', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }}
                onClick={() => {
                  const title = prompt(lang === 'es' ? "Título del libro:" : "Book title:", book.title || '');
                  if (title !== null && title.trim()) onUpdateBookDetails(book.id, { title: title.trim() });
                }}
                title={lang === 'es' ? "Haz clic para editar" : "Click to edit"}
              >
                {book.title}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('author', lang)}</span>
              <span 
                style={{ fontWeight: 500, color: '#fff', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }}
                onClick={() => {
                  const author = prompt(lang === 'es' ? "Autor del libro:" : "Book author:", book.author || '');
                  if (author !== null) onUpdateBookDetails(book.id, { author: author.trim() });
                }}
                title={lang === 'es' ? "Haz clic para editar" : "Click to edit"}
              >
                {book.author || '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('series', lang)}</span>
              <span 
                style={{ fontWeight: 500, color: '#fff', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} 
                onClick={() => {
                  const s = prompt(lang === 'es' ? "Nombre de la serie:" : "Series name:", book.series || '');
                  if (s !== null) onUpdateBookDetails(book.id, { series: s });
                }}
                title={lang === 'es' ? "Haz clic para editar" : "Click to edit"}
              >
                {book.series || '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('volumeNumber', lang)}</span>
              <span 
                style={{ fontWeight: 500, color: '#fff', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} 
                onClick={() => {
                  const sn = prompt(lang === 'es' ? "Número de volumen/serie:" : "Volume/Series number:", book.seriesNumber || '');
                  if (sn !== null) onUpdateBookDetails(book.id, { seriesNumber: sn });
                }}
                title={lang === 'es' ? "Haz clic para editar" : "Click to edit"}
              >
                {book.seriesNumber || '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === 'es' ? 'Caracteres' : 'Characters'}</span>
              <span style={{ fontWeight: 500, color: '#fff' }}>{charsCount.toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('lastRead', lang)}</span>
              <span style={{ fontWeight: 500, color: '#fff' }}>{formatDate(book.lastRead)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === 'es' ? 'Añadido' : 'Added'}</span>
              <span style={{ fontWeight: 500, color: '#fff' }}>{formatDate(book.createdAt)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === 'es' ? 'Última actualización' : 'Last update'}</span>
              <span style={{ fontWeight: 500, color: '#fff' }}>{formatDate(book.updatedAt || book.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const updateSetting = (key, value) => {
    onSaveSettings({
      ...settings,
      [key]: value
    });
  };

  const getSliderVal = () => {
    return settings.fontSize || 36;
  };

  const handleSliderChange = (val) => {
    updateSetting('fontSize', val);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal migaku-style" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ paddingBottom: '0.2rem', marginBottom: '0.5rem' }}>
          <span style={{ flex: 1 }}></span>
          <button className="close-modal-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="migaku-settings-content">
          <div className="migaku-section-title">{t('displaySettings', lang)}</div>
          
          {/* Tamaño del texto */}
          <div className="migaku-slider-row">
            <span className="slider-label">{t('readerFontSize', lang)}</span>
            <div className="migaku-slider-container">
              <span className="slider-icon-small">A</span>
              <div className="slider-wrapper">
                <input 
                  type="range" 
                  min="18" 
                  max="48" 
                  step="2"
                  value={getSliderVal()} 
                  onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                  className="migaku-slider"
                />
                <div className="slider-ticks">
                  <span className={getSliderVal() >= 18 ? 'active' : ''}></span>
                  <span className={getSliderVal() >= 28 ? 'active' : ''}></span>
                  <span className={getSliderVal() >= 38 ? 'active' : ''}></span>
                  <span className={getSliderVal() >= 48 ? 'active' : ''}></span>
                </div>
              </div>
              <span className="slider-icon-large">A</span>
            </div>
          </div>

          {/* Estado de aprendizaje */}
          <div className="migaku-row">
            <span className="migaku-label">{lang === 'es' ? 'Estado de aprendizaje' : 'Learning Status'}</span>
            <label className="migaku-switch">
              <input 
                type="checkbox" 
                checked={settings.showLearningStatus !== false}
                onChange={(e) => updateSetting('showLearningStatus', e.target.checked)}
              />
              <span className="migaku-switch-slider"></span>
            </label>
          </div>

          {/* Oración al pasar el cursor */}
          <div className="migaku-row">
            <span className="migaku-label">{lang === 'es' ? 'Oración al pasar el cursor' : 'Sentence hover info'}</span>
            <label className="migaku-switch">
              <input 
                type="checkbox" 
                checked={settings.sentenceHover === true}
                onChange={(e) => updateSetting('sentenceHover', e.target.checked)}
              />
              <span className="migaku-switch-slider"></span>
            </label>
          </div>

          {/* Acento por color */}
          <div className="migaku-row">
            <span className="migaku-label">{lang === 'es' ? 'Acento por color' : 'Pitch accent by color'}</span>
            <select 
              value={settings.pitchAccent || 'none'}
              onChange={(e) => updateSetting('pitchAccent', e.target.value)}
              className="migaku-select"
            >
              <option value="none">{t('pitchNone', lang)}</option>
              <option value="pitch-color">{t('pitchColor', lang)}</option>
            </select>
          </div>

          {/* Furigana */}
          <div className="migaku-row">
            <span className="migaku-label">Furigana</span>
            <select 
              value={settings.showFurigana || 'unknown-only'}
              onChange={(e) => updateSetting('showFurigana', e.target.value)}
              className="migaku-select"
            >
              <option value="unknown-only">{lang === 'es' ? 'Palabras desconocidas' : 'Unknown words only'}</option>
              <option value="all">{lang === 'es' ? 'Todo' : 'All'}</option>
              <option value="none">{t('pitchNone', lang)}</option>
            </select>
          </div>

          {/* Idioma de la interfaz */}
          <div className="migaku-row">
            <span className="migaku-label">{t('interfaceLanguage', lang)}</span>
            <select 
              value={settings.appLanguage || 'es'}
              onChange={(e) => updateSetting('appLanguage', e.target.value)}
              className="migaku-select"
            >
              <option value="es">Español 🇪🇸</option>
              <option value="en">English 🇺🇸</option>
            </select>
          </div>

          <div className="migaku-section-title" style={{ marginTop: '24px' }}>{t('audioOptions', lang)}</div>

          {/* Velocidad de reproducción */}
          <div className="migaku-row">
            <span className="migaku-label">{t('playbackSpeed', lang)}</span>
            <select 
              value={settings.audioSpeed || '1.0'}
              onChange={(e) => updateSetting('audioSpeed', e.target.value)}
              className="migaku-select"
            >
              <option value="1.0">Normal</option>
              <option value="0.75">0.75x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
            </select>
          </div>

          {/* Género de voz */}

          <div className="migaku-row">
            <span className="migaku-label">{t('voiceGender', lang)}</span>
            <select 
              value={settings.audioGender || 'female'}
              onChange={(e) => updateSetting('audioGender', e.target.value)}
              className="migaku-select"
            >
              <option value="female">{t('genderFemale', lang)}</option>
              <option value="male">{t('genderMale', lang)}</option>
            </select>
          </div>

          {/* Opción de voz neuronal */}
          <div className="migaku-row">
            <span className="migaku-label">{lang === 'es' ? 'Voz de reproducción' : 'Playback Voice'}</span>
            <select 
              value={settings.audioVoiceOption || 'Nanami'}
              onChange={(e) => updateSetting('audioVoiceOption', e.target.value)}
              className="migaku-select"
            >
              <option value="Nanami">Nanami (Femenina)</option>
              <option value="Mayu">Mayu (Femenina Joven)</option>
              <option value="Keita">Keita (Masculina)</option>
            </select>
          </div>

          {/* Azure TTS API Key */}
          <div className="migaku-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
            <span className="migaku-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Azure TTS API Key</span>
            <input 
              type="password"
              placeholder="Azure Key (dejar vacío para usar voz gratis local)"
              value={settings.azureApiKey || ''}
              onChange={(e) => updateSetting('azureApiKey', e.target.value)}
              className="migaku-select"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Azure TTS Region */}
          <div className="migaku-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
            <span className="migaku-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Azure TTS Region</span>
            <input 
              type="text"
              placeholder="eastus (ej: japaneast, eastus, etc.)"
              value={settings.azureRegion || ''}
              onChange={(e) => updateSetting('azureRegion', e.target.value)}
              className="migaku-select"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            />
          </div>




          
          <div className="migaku-section-title" style={{ marginTop: '24px' }}>ANKI</div>
          <button
            className="anki-open-settings-btn"
            onClick={() => setIsAnkiConfigOpen(true)}
            type="button"
          >
            <span>🃏 {lang === 'es' ? 'Configuración de Anki' : 'Anki Configuration'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <React.Suspense fallback={null}>
        {isAnkiConfigOpen && (
          <AnkiConfigModal isOpen={isAnkiConfigOpen} onClose={() => setIsAnkiConfigOpen(false)} />
        )}
      </React.Suspense>
    </div>
  );
}
