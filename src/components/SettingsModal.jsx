import React, { useState } from 'react';
import { 
  X, Search, Palette, Eye, BookOpen, Type, Keyboard, Layout, 
  TrendingUp, Database, Cloud, Settings, AlertTriangle, 
  Cpu, Sliders, ShieldAlert, BarChart2, Bell, Shield, 
  Volume2, Heart
} from 'lucide-react';
import { t } from '../utils/i18n';
const AnkiConfigModal = React.lazy(() => import('./AnkiConfigModal'));

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings = {}, 
  onSaveSettings, 
  mode = 'settings', 
  book, 
  onUpdateBookDetails 
}) {
  if (!isOpen) return null;
  const [isAnkiConfigOpen, setIsAnkiConfigOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('text-style');
  const [searchQuery, setSearchQuery] = useState('');
  
  const lang = settings.appLanguage || 'es';

  // Modal de información del libro (mode === 'info')
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

  // Definición de las opciones de menú en el sidebar
  const menuStructure = [
    {
      category: lang === 'es' ? 'General' : 'General',
      icon: <Sliders size={14} />,
      items: [
        { id: 'display', label: lang === 'es' ? 'Visualización' : 'Display', icon: <Eye size={14} /> }
      ]
    },
    {
      category: lang === 'es' ? 'Lector' : 'Reader',
      icon: <BookOpen size={14} />,
      items: [
        { id: 'text-style', label: lang === 'es' ? 'Estilo de Texto' : 'Text Style', icon: <Type size={14} /> },
        { id: 'writing', label: lang === 'es' ? 'Escritura' : 'Writing', icon: <Keyboard size={14} /> },
        { id: 'rendering', label: lang === 'es' ? 'Renderizado' : 'Rendering', icon: <Palette size={14} /> }
      ]
    },
    {
      category: lang === 'es' ? 'Datos' : 'Data',
      icon: <Database size={14} />,
      items: [
        { id: 'sources', label: lang === 'es' ? 'Fuentes (Anki)' : 'Sources (Anki)', icon: <Database size={14} /> }
      ]
    },
    {
      category: lang === 'es' ? 'Avanzado' : 'Advanced',
      icon: <Cpu size={14} />,
      items: [
        { id: 'experimental', label: lang === 'es' ? 'Experimental (TTS)' : 'Experimental (TTS)', icon: <Volume2 size={14} /> }
      ]
    }
  ];

  // Renderiza el control para el tamaño de la fuente
  const renderTextStyleContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Estilo de Texto' : 'Text Style'}</h4>
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
              onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
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
    </div>
  );

  // Renderiza el control para el idioma de la app
  const renderDisplayContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Visualización' : 'Display'}</h4>
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
    </div>
  );

  // Renderiza los controles de escritura (Furigana)
  const renderWritingContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Escritura' : 'Writing'}</h4>
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
    </div>
  );

  // Renderiza los controles de renderizado (Interruptores, acento tonal, etc.)
  const renderRenderingContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Renderizado' : 'Rendering'}</h4>
      
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
    </div>
  );

  // Renderiza la configuración de Anki
  const renderSourcesContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Fuentes de Datos' : 'Data Sources'}</h4>
      <div className="migaku-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {lang === 'es' ? 'Configura la conexión con tu cliente de AnkiConnect para minar vocabulario instantáneamente.' : 'Configure connection to AnkiConnect client for mining vocabulary on the fly.'}
        </span>
        <button
          className="anki-open-settings-btn"
          onClick={() => setIsAnkiConfigOpen(true)}
          type="button"
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
        >
          <span>🃏 {lang === 'es' ? 'Configuración de Anki' : 'Anki Configuration'}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // Renderiza la configuración Experimental / Azure TTS
  const renderExperimentalContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Configuración de Audio (Microsoft / Azure)' : 'Audio Configuration (Microsoft / Azure)'}</h4>
      
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

      <div className="migaku-row">
        <span className="migaku-label">{t('playbackSpeed', lang)}</span>
        <select 
          value={settings.audioSpeed || '1.0'}
          onChange={(e) => updateSetting('audioSpeed', e.target.value)}
          className="migaku-select"
        >
          <option value="1.0">Normal (1.0x)</option>
          <option value="0.75">0.75x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
        </select>
      </div>

      <div className="migaku-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', marginTop: '10px' }}>
        <span className="migaku-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Azure TTS API Key</span>
        <input 
          type="password"
          placeholder="Azure Key (dejar vacío para usar voz gratis local)"
          value={settings.azureApiKey || ''}
          onChange={(e) => updateSetting('azureApiKey', e.target.value)}
          className="migaku-select"
          style={{ padding: '8px 12px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div className="migaku-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
        <span className="migaku-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Azure TTS Region</span>
        <input 
          type="text"
          placeholder="eastus (ej: japaneast, eastus, etc.)"
          value={settings.azureRegion || ''}
          onChange={(e) => updateSetting('azureRegion', e.target.value)}
          className="migaku-select"
          style={{ padding: '8px 12px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );

  // Muestra el panel según la sección seleccionada
  const renderActiveContent = () => {
    switch (activeSection) {
      case 'display':
        return renderDisplayContent();
      case 'text-style':
        return renderTextStyleContent();
      case 'writing':
        return renderWritingContent();
      case 'rendering':
        return renderRenderingContent();
      case 'sources':
        return renderSourcesContent();
      case 'experimental':
        return renderExperimentalContent();
      default:
        return renderTextStyleContent();
    }
  };

  // Lógica de filtrado de búsqueda
  const allSettingsItems = [
    { id: 'display', keywords: 'display visualizacion interfaz idioma language interfaces spanish english', render: renderDisplayContent },
    { id: 'text-style', keywords: 'text style estilo texto fuente font size tamaño slider', render: renderTextStyleContent },
    { id: 'writing', keywords: 'writing escritura furigana kanji rt ruby', render: renderWritingContent },
    { id: 'rendering', keywords: 'rendering renderizado acento pitch learning status cursor hover', render: renderRenderingContent },
    { id: 'sources', keywords: 'sources fuentes anki anki-connect deck cards note', render: renderSourcesContent },
    { id: 'experimental', keywords: 'experimental audio tts azure voice voz nanami mayu keita region key speed rate', render: renderExperimentalContent },
  ];

  const filteredItems = searchQuery.trim() 
    ? allSettingsItems.filter(item => item.keywords.includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-sidebar-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Panel Izquierdo: Sidebar Navigation */}
        <div className="settings-sidebar-left">
          <div className="settings-sidebar-title">
            <span>Settings</span>
            <button className="settings-close-btn-mobile" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Buscador de Ajustes */}
          <div className="settings-search-box">
            <Search size={14} className="search-icon-prefix" />
            <input 
              type="text" 
              placeholder="Find..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="settings-search-input"
            />
            <span className="search-shortcut-badge">CTRL F</span>
          </div>

          {/* Menú de categorías */}
          {!searchQuery.trim() && (
            <div className="settings-sidebar-menu-list">
              {menuStructure.map((group, idx) => (
                <div key={idx} className="settings-menu-group">
                  <div className="settings-group-header">
                    {group.icon}
                    <span>{group.category}</span>
                  </div>
                  <div className="settings-group-items">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`settings-menu-item-btn ${activeSection === item.id ? 'active' : ''}`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchQuery.trim() && (
            <div className="settings-sidebar-menu-list">
              <div className="settings-menu-group">
                <div className="settings-group-header">
                  <Sliders size={14} />
                  <span>{lang === 'es' ? 'Resultados de búsqueda' : 'Search Results'}</span>
                </div>
                <div className="settings-group-items">
                  {filteredItems.map(item => {
                    const labelObj = menuStructure.flatMap(g => g.items).find(i => i.id === item.id) || { label: item.id };
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setActiveSection(item.id); setSearchQuery(''); }}
                        className="settings-menu-item-btn"
                      >
                        <span>🔍</span>
                        <span>{labelObj.label}</span>
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', padding: '10px 14px', fontStyle: 'italic' }}>
                      {lang === 'es' ? 'No se encontraron resultados' : 'No results found'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel Derecho: Contenido de Ajustes */}
        <div className="settings-sidebar-right">
          <div className="settings-right-header">
            <span className="settings-header-label">
              {lang === 'es' ? 'Ajustes de Lector' : 'Reader Settings'}
            </span>
            <button className="settings-close-x-btn" onClick={onClose} title={lang === 'es' ? 'Cerrar' : 'Close'}>
              <X size={18} />
            </button>
          </div>

          <div className="settings-right-content-viewport">
            {searchQuery.trim() && filteredItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {filteredItems.map((item, idx) => (
                  <div key={item.id}>
                    {item.render()}
                    {idx < filteredItems.length - 1 && <hr style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: '24px' }} />}
                  </div>
                ))}
              </div>
            ) : (
              renderActiveContent()
            )}
          </div>
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

// Icono ChevronRight auxiliar para submenús
function ChevronRight({ size = 16 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
