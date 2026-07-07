import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import AnkiConfigModal from './AnkiConfigModal';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings, mode = 'settings', book, onUpdateBookDetails }) {
  if (!isOpen) return null;
  const [isAnkiConfigOpen, setIsAnkiConfigOpen] = useState(false);

  if (mode === 'info') {
    if (!book) return null;
    
    const getCharacterCount = (b) => {
      if (!b || !b.chapters) return 0;
      return b.chapters.reduce((sum, ch) => {
        if (typeof ch.content === 'string') {
          return sum + ch.content.length;
        }
        if (Array.isArray(ch.content)) {
          return sum + ch.content.reduce((pSum, p) => {
            return pSum + p.reduce((sSum, s) => {
              return sSum + (typeof s === 'string' ? s.length : (s.text ? s.text.length : 0));
            }, 0);
          }, 0);
        }
        return sum;
      }, 0);
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    };

    const charsCount = getCharacterCount(book);

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div 
          className="settings-modal migaku-style book-info-modal" 
          onClick={(e) => e.stopPropagation()} 
          style={{ 
            maxWidth: '420px', 
            padding: '24px',
            background: '#1c1c23',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}
        >
          <div className="modal-header" style={{ borderBottom: 'none', padding: '0 0 16px 0', display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <button 
              onClick={onClose} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#fff', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '1.1rem',
                fontWeight: 600,
                padding: '0'
              }}
            >
              <ChevronLeft size={20} /> Acciones del libro
            </button>
            <span style={{ flex: 1 }}></span>
            <button className="close-modal-btn" onClick={onClose} style={{ background: 'transparent', padding: '0' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: 'rgba(255,255,255,0.85)', fontSize: '0.92rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Autor</span>
              <span 
                style={{ fontWeight: 500, color: '#fff', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} 
                onClick={() => {
                  const a = prompt("Autor del libro:", book.author || '');
                  if (a !== null) onUpdateBookDetails(book.id, { author: a });
                }}
                title="Haz clic para editar"
              >
                {book.author || 'Desconocido'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Serie</span>
              <span 
                style={{ fontWeight: 500, color: '#fff', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} 
                onClick={() => {
                  const s = prompt("Nombre de la serie:", book.series || '');
                  if (s !== null) onUpdateBookDetails(book.id, { series: s });
                }}
                title="Haz clic para editar"
              >
                {book.series || '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Número de serie</span>
              <span 
                style={{ fontWeight: 500, color: '#fff', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} 
                onClick={() => {
                  const sn = prompt("Número de volumen/serie:", book.seriesNumber || '');
                  if (sn !== null) onUpdateBookDetails(book.id, { seriesNumber: sn });
                }}
                title="Haz clic para editar"
              >
                {book.seriesNumber || '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Caracteres</span>
              <span style={{ fontWeight: 500, color: '#fff' }}>{charsCount.toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Última lectura</span>
              <span style={{ fontWeight: 500, color: '#fff' }}>{formatDate(book.lastRead)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Añadido</span>
              <span style={{ fontWeight: 500, color: '#fff' }}>{formatDate(book.createdAt)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Última actualización</span>
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
          <button className="close-modal-btn" onClick={onClose} style={{ background: 'transparent' }}>
            <X size={20} />
          </button>
        </div>

        <div className="migaku-settings-content">
          <div className="migaku-section-title">AJUSTES DE PANTALLA</div>
          
          {/* Tamaño del texto */}
          <div className="migaku-slider-row">
            <span className="slider-label">Tamaño del texto</span>
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
            <span className="migaku-label">Estado de aprendizaje</span>
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
            <span className="migaku-label">Oración al pasar el cursor</span>
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
            <span className="migaku-label">Acento por color</span>
            <select 
              value={settings.pitchAccent || 'none'}
              onChange={(e) => updateSetting('pitchAccent', e.target.value)}
              className="migaku-select"
            >
              <option value="none">Ninguno</option>
              <option value="pitch-color">Color de tono</option>
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
              <option value="unknown-only">Palabras desconocidas</option>
              <option value="all">Todo</option>
              <option value="none">Ninguno</option>
            </select>
          </div>

          {/* Traducciones de palabras */}
          <div className="migaku-row">
            <span className="migaku-label">Traducciones de palabras <span style={{ opacity: 0.6 }} title="Ayuda">ⓘ</span></span>
            <select 
              value={settings.wordTranslation || 'none'}
              onChange={(e) => updateSetting('wordTranslation', e.target.value)}
              className="migaku-select"
            >
              <option value="none">Ninguna 🌐</option>
              <option value="en">Inglés 🇺🇸 (English)</option>
              <option value="es">Español 🇪🇸 (Spanish)</option>
            </select>
          </div>

          <div className="migaku-section-title" style={{ marginTop: '24px' }}>OPCIONES DE AUDIO</div>

          {/* Velocidad de reproducción */}
          <div className="migaku-row">
            <span className="migaku-label">Velocidad de reproducción</span>
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
            <span className="migaku-label">Género de voz</span>
            <select 
              value={settings.audioGender || 'male'}
              onChange={(e) => updateSetting('audioGender', e.target.value)}
              className="migaku-select"
            >
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
            </select>
          </div>

          {/* Opción de voz */}
          <div className="migaku-row">
            <span className="migaku-label">Opción de voz</span>
            <select 
              value={settings.audioVoiceOption || 'masaru'}
              onChange={(e) => updateSetting('audioVoiceOption', e.target.value)}
              className="migaku-select"
            >
              <option value="masaru">Masaru</option>
              <option value="haruka">Haruka</option>
            </select>
          </div>
          <div className="migaku-section-title" style={{ marginTop: '24px' }}>ANKI</div>
          <button
            className="anki-open-settings-btn"
            onClick={() => setIsAnkiConfigOpen(true)}
          >
            <span>🃏 Configuración de Anki</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <AnkiConfigModal isOpen={isAnkiConfigOpen} onClose={() => setIsAnkiConfigOpen(false)} />
    </div>
  );
}
