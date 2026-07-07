import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { t } from '../utils/i18n';
const AnkiConfigModal = React.lazy(() => import('./AnkiConfigModal'));

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings = {}, 
  onSaveSettings, 
  mode = 'settings', 
  book, 
  onUpdateBookDetails,
  libraryViewProps, // Props opcionales para la biblioteca
  gDriveProps // Props opcionales para Google Drive Sync
}) {
  if (!isOpen) return null;
  const [isAnkiConfigOpen, setIsAnkiConfigOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('sync-merge'); // Por defecto seleccionado en Sync & Merge como pidió el usuario
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

  // Menú con la sección de SEGUIMIENTO (con emojis exactos de Yatsu)
  const menuStructure = [
    {
      category: 'GENERAL',
      items: [
        { id: 'theme', label: 'Tema', icon: <span>🎨</span> },
        { id: 'display', label: 'Pantalla', icon: <span>🕒</span> }
      ]
    },
    {
      category: 'LECTOR',
      items: [
        { id: 'text-style', label: 'Estilo de texto', icon: <span>🎨</span> },
        { id: 'rendering', label: 'Resaltado', icon: <span>🎯</span> }
      ]
    },
    {
      category: 'INTEGRACIÓN',
      items: [
        { id: 'sources', label: 'Integración con Anki', icon: <span>🃏</span> }
      ]
    },
    {
      category: 'SEGUIMIENTO',
      items: [
        { id: 'stats-config', label: 'Estadísticas', icon: <span>📈</span> },
        { id: 'reading-day', label: 'Día de lectura', icon: <span>🕒</span> },
        { id: 'sync-merge', label: 'Sincronizar y combinar', icon: <span>☁️</span> }
      ]
    },
    {
      category: 'DATOS',
      items: [
        { id: 'backups', label: 'Copias de seguridad', icon: <span>💾</span> },
        { id: 'dictionaries', label: 'Diccionarios', icon: <span>🗄️</span> },
        { id: 'danger-zone', label: 'Zona de peligro', icon: <span>🔧</span>, color: '#f87171' }
      ]
    }
  ];

  // 1. GENERAL / Tema
  const renderThemeContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Tema</h4>
      <div className="migaku-row">
        <span className="migaku-label">{lang === 'es' ? 'Tema del lector' : 'Reader Theme'}</span>
        <select 
          value={settings.readerTheme || 'dark'}
          onChange={(e) => updateSetting('readerTheme', e.target.value)}
          className="migaku-select"
        >
          <option value="dark">{lang === 'es' ? 'Oscuro Yoru (por defecto)' : 'Dark Yoru (default)'}</option>
          <option value="sepia">{lang === 'es' ? 'Sepia Relajante' : 'Warm Sepia'}</option>
          <option value="light">{lang === 'es' ? 'Claro clásico' : 'Classic Light'}</option>
        </select>
      </div>
    </div>
  );

  // 2. GENERAL / Pantalla
  const renderDisplayContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Pantalla</h4>
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

  // 3. LECTOR / Estilo de texto
  const renderTextStyleContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Estilo de texto</h4>
      
      {/* Tamaño del texto */}
      <div className="migaku-slider-row" style={{ marginBottom: '14px' }}>
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

      {/* Furigana */}
      <div className="migaku-row" style={{ marginBottom: '14px' }}>
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

      {/* Si se proveen configuraciones de biblioteca */}
      {libraryViewProps && (
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {lang === 'es' ? 'Ajustes de Biblioteca' : 'Library Card Settings'}
          </div>

          {/* Tamaño de tarjetas */}
          <div className="drawer-section">
            <span className="migaku-label" style={{ fontSize: '0.85rem' }}>{lang === 'es' ? 'Ancho de tarjetas' : 'Card Width'} ({libraryViewProps.cardWidth}px)</span>
            <input 
              type="range" 
              min="120" 
              max="240" 
              step="8"
              value={libraryViewProps.cardWidth} 
              onChange={(e) => libraryViewProps.setCardWidth(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', marginTop: '6px' }}
            />
          </div>

          {/* Ajuste de portada */}
          <div className="migaku-row">
            <span className="migaku-label">{lang === 'es' ? 'Imagen de portada' : 'Cover Image'}</span>
            <select 
              value={libraryViewProps.coverFit}
              onChange={(e) => libraryViewProps.setCoverFit(e.target.value)}
              className="migaku-select"
            >
              <option value="cover">{lang === 'es' ? 'Rellenar' : 'Fill'}</option>
              <option value="contain">{lang === 'es' ? 'Ajustar' : 'Fit'}</option>
            </select>
          </div>

          {/* Checkboxes de detalles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <span className="migaku-label" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
              {lang === 'es' ? 'Detalles a mostrar:' : 'Details to display:'}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { key: 'title', label: lang === 'es' ? 'Título' : 'Title', value: libraryViewProps.showCardTitle, setter: libraryViewProps.setShowCardTitle },
                { key: 'series', label: lang === 'es' ? 'Serie' : 'Series', value: libraryViewProps.showCardSeries, setter: libraryViewProps.setShowCardSeries },
                { key: 'author', label: lang === 'es' ? 'Autor' : 'Author', value: libraryViewProps.showCardAuthor, setter: libraryViewProps.setShowCardAuthor },
                { key: 'tags', label: lang === 'es' ? 'Etiquetas' : 'Tags', value: libraryViewProps.showCardTags, setter: libraryViewProps.setShowCardTags },
                { key: 'progress', label: lang === 'es' ? 'Progreso' : 'Progress', value: libraryViewProps.showCardProgress, setter: libraryViewProps.setShowCardProgress },
                { key: 'status', label: lang === 'es' ? 'Estado' : 'Status', value: libraryViewProps.showCardStatus, setter: libraryViewProps.setShowCardStatus }
              ].map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={opt.value} 
                    onChange={(e) => opt.setter(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 4. LECTOR / Resaltado
  const renderRenderingContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Resaltado</h4>
      
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
    </div>
  );

  // 5. INTEGRACIÓN / Integración con Anki
  const renderSourcesContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Integración con Anki</h4>
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
          <span>🃏 {lang === 'es' ? 'Configurar AnkiConnect' : 'Configure AnkiConnect'}</span>
          <span style={{ fontSize: '0.9rem' }}>→</span>
        </button>
      </div>
    </div>
  );

  // 6. SEGUIMIENTO / Estadísticas
  const renderStatsConfigContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Estadísticas</h4>
      <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px 0' }}>
        {lang === 'es' ? 'Estadísticas de lectura almacenadas y accesos de seguimiento del lector.' : 'Stored reading statistics and reader tracking accesses.'}
      </p>

      {/* Activar estadísticas */}
      <div className="migaku-row">
        <span className="migaku-label">{lang === 'es' ? 'Activar estadísticas' : 'Enable Statistics'}</span>
        <label className="migaku-switch">
          <input 
            type="checkbox" 
            checked={settings.enableStatistics !== false}
            onChange={(e) => updateSetting('enableStatistics', e.target.checked)}
          />
          <span className="migaku-switch-slider"></span>
        </label>
      </div>

      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '10px' }}>
        {lang === 'es' ? 'Libros eliminados' : 'Deleted Books'}
      </div>

      {/* Conservar estadísticas al eliminar */}
      <div className="migaku-row">
        <span className="migaku-label">{lang === 'es' ? 'Conservar estadísticas al eliminar' : 'Keep Statistics on Deletion'}</span>
        <label className="migaku-switch">
          <input 
            type="checkbox" 
            checked={settings.keepStatsOnDelete !== false}
            onChange={(e) => updateSetting('keepStatsOnDelete', e.target.checked)}
          />
          <span className="migaku-switch-slider"></span>
        </label>
      </div>

      {/* Conservar anotaciones al eliminar */}
      <div className="migaku-row">
        <span className="migaku-label">{lang === 'es' ? 'Conservar resaltados, notas y marcadores al eliminar' : 'Keep Highlights, Notes, and Bookmarks on Deletion'}</span>
        <label className="migaku-switch">
          <input 
            type="checkbox" 
            checked={settings.keepAnnotationsOnDelete === true}
            onChange={(e) => updateSetting('keepAnnotationsOnDelete', e.target.checked)}
          />
          <span className="migaku-switch-slider"></span>
        </label>
      </div>

      {/* Acciones de limpieza */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button
          type="button"
          onClick={() => {
            const confirm = window.confirm(lang === 'es' ? '¿Limpiar estadísticas de libros ya eliminados?' : 'Clear stats for already deleted books?');
            if (confirm) alert(lang === 'es' ? 'Limpieza completada.' : 'Cleanup done.');
          }}
          style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
        >
          🧹 {lang === 'es' ? 'Estadísticas de libros eliminados' : 'Deleted-book statistics'}
        </button>
        <button
          type="button"
          onClick={() => {
            const confirm = window.confirm(lang === 'es' ? '¿Limpiar anotaciones de libros ya eliminados?' : 'Clear annotations for already deleted books?');
            if (confirm) alert(lang === 'es' ? 'Limpieza completada.' : 'Cleanup done.');
          }}
          style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
        >
          🧹 {lang === 'es' ? 'Anotaciones de libros eliminados' : 'Deleted-book annotations'}
        </button>
      </div>
    </div>
  );

  // 7. SEGUIMIENTO / Día de lectura
  const renderReadingDayContent = () => {
    const startHour = settings.startDayHour || 0;
    const formatHour = (h) => {
      return `${String(h).padStart(2, '0')}:00`;
    };
    return (
      <div className="settings-panel-section">
        <h4 className="settings-panel-title">Día de lectura</h4>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px 0' }}>
          {lang === 'es' ? 'Límites del día del calendario para las estadísticas de lectura.' : 'Calendar day boundaries for reading statistics.'}
        </p>

        <div className="drawer-section" style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span className="migaku-label" style={{ fontSize: '0.85rem' }}>{lang === 'es' ? 'Hora de inicio del día' : 'Start Day Hours'}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>{formatHour(startHour)}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="23" 
            step="1"
            value={startHour} 
            onChange={(e) => updateSetting('startDayHour', parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          <p style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.3)', marginTop: '8px', lineHeight: 1.3 }}>
            {lang === 'es' 
              ? 'Ajusta a qué hora comienza un nuevo día. Útil si lees después de medianoche y deseas que se contabilice en el día anterior.' 
              : 'Configure at what hour a new reading day starts. Useful for night readers.'}
          </p>
        </div>
      </div>
    );
  };

  // 8. SEGUIMIENTO / Sincronizar y combinar
  const renderSyncMergeContent = () => {
    const hasProps = !!gDriveProps;
    const isLinked = hasProps && gDriveProps.gDriveTokens;
    const syncStatus = hasProps ? gDriveProps.gDriveSyncStatus : 'disconnected';
    const lastSync = hasProps ? gDriveProps.lastSyncTime : null;

    return (
      <div className="settings-panel-section">
        <h4 className="settings-panel-title">Sincronizar y combinar</h4>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px 0' }}>
          {lang === 'es' ? 'Cómo se sincronizan y combinan las estadísticas de lectura a través de los orígenes de almacenamiento.' : 'How reading statistics sync and merge through storage sources.'}
        </p>

        {/* Orígenes de almacenamiento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === 'es' ? 'Destino de sincronización de almacenamiento' : 'Storage Sync Target'}</span>
            <span style={{ color: isLinked ? '#34d399' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              {isLinked ? 'Google Drive' : (lang === 'es' ? 'Ninguno seleccionado' : 'None selected')}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === 'es' ? 'Destino de sincronización de ajustes' : 'Settings Sync Target'}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              {lang === 'es' ? 'Perfil local' : 'Local Profile'}
            </span>
          </div>
        </div>

        {/* Lógica de Fusión/Conflicto */}
        <div className="migaku-row">
          <span className="migaku-label">{lang === 'es' ? 'Combinación de estadísticas' : 'Statistics Merge'}</span>
          <select 
            value={settings.statsMergeOption || 'merge'}
            onChange={(e) => updateSetting('statsMergeOption', e.target.value)}
            className="migaku-select"
          >
            <option value="merge">{lang === 'es' ? 'Combinar (Merge)' : 'Merge'}</option>
            <option value="replace">{lang === 'es' ? 'Reemplazar (Replace)' : 'Replace'}</option>
          </select>
        </div>

        <div className="migaku-row" style={{ marginBottom: '14px' }}>
          <span className="migaku-label">{lang === 'es' ? 'Combinación de objetivos' : 'Reading Goals Merge'}</span>
          <select 
            value={settings.goalsMergeOption || 'merge'}
            onChange={(e) => updateSetting('goalsMergeOption', e.target.value)}
            className="migaku-select"
          >
            <option value="merge">{lang === 'es' ? 'Combinar (Merge)' : 'Merge'}</option>
            <option value="replace">{lang === 'es' ? 'Reemplazar (Replace)' : 'Replace'}</option>
          </select>
        </div>

        {/* Controles interactivos de Google Drive */}
        {hasProps && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Si no hay tokens configurados, mostrar inputs */}
            {!isLinked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CLIENT ID</label>
                  <input 
                    type="password"
                    value={gDriveProps.gDriveClientId}
                    onChange={(e) => gDriveProps.setGDriveClientId(e.target.value)}
                    placeholder="Enter Client ID..."
                    className="migaku-select"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CLIENT SECRET (OPTIONAL)</label>
                  <input 
                    type="password"
                    value={gDriveProps.gDriveClientSecret}
                    onChange={(e) => gDriveProps.setGDriveClientSecret(e.target.value)}
                    placeholder="Enter Client Secret..."
                    className="migaku-select"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            {/* Botón conectar */}
            <button 
              type="button"
              onClick={gDriveProps.handleConnectGDrive}
              disabled={syncStatus === 'syncing'}
              style={{ width: '100%', padding: '10px', background: 'var(--primary)', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
            >
              🔑 {isLinked ? (lang === 'es' ? 'Re-conectar cuenta' : 'Re-connect account') : (lang === 'es' ? 'Vincular Google Drive' : 'Link Google Drive')}
            </button>

            {/* Acciones de sincronización si está vinculado */}
            {isLinked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={gDriveProps.handleUploadBackupToGDrive}
                    disabled={syncStatus === 'syncing'}
                    style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid #34d399', borderRadius: '6px', color: '#34d399', cursor: 'pointer' }}
                  >
                    📤 {lang === 'es' ? 'Subir copia' : 'Upload backup'}
                  </button>
                  <button
                    type="button"
                    onClick={gDriveProps.handleDownloadBackupFromGDrive}
                    disabled={syncStatus === 'syncing'}
                    style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24', borderRadius: '6px', color: '#fbbf24', cursor: 'pointer' }}
                  >
                    📥 {lang === 'es' ? 'Descargar' : 'Download'}
                  </button>
                </div>
                {lastSync && (
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    {lang === 'es' ? 'Última sincronización:' : 'Last sync:'} {lastSync}
                  </span>
                )}
              </div>
            )}

            {/* Sincronización automática checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', cursor: 'pointer', marginTop: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: '#fff' }}>
                {lang === 'es' ? 'Sincronización automática al iniciar' : 'Auto-Sync on startup'}
              </span>
              <input 
                type="checkbox"
                checked={gDriveProps.isAutoSyncEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  gDriveProps.setIsAutoSyncEnabled(val);
                  localStorage.setItem('gdrive_autosync_enabled', val ? 'true' : 'false');
                }}
                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
              />
            </label>

          </div>
        )}

      </div>
    );
  };

  // 9. DATOS / Copias de seguridad
  const renderBackupsContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Copias de seguridad</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span className="migaku-label" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
          {lang === 'es' ? 'Copias Locales (Archivo ZIP)' : 'Local Backups (ZIP File)'}
        </span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              if (window.electronAPI && window.electronAPI.exportLibrary) {
                window.electronAPI.exportLibrary().then(res => {
                  if (res) alert(lang === 'es' ? 'Copia de seguridad guardada con éxito.' : 'Backup saved successfully.');
                }).catch(e => alert(e.message));
              } else {
                alert(lang === 'es' ? 'La copia local solo está disponible en la versión de escritorio.' : 'Local backup is only available on desktop.');
              }
            }}
            style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
          >
            💾 {lang === 'es' ? 'Exportar copia local' : 'Export local backup'}
          </button>
        </div>
      </div>
    </div>
  );

  // 10. DATOS / Diccionarios
  const renderDictionariesContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">Diccionarios</h4>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Japonés - Español</span>
          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,224,0,0.1)', color: 'var(--primary)' }}>ACTIVO</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          {lang === 'es' ? 'Base de datos Yomitan de diccionario integrada correctamente.' : 'Integrated Yomitan dictionary database loaded.'}
        </p>
      </div>
    </div>
  );

  // 11. DATOS / Zona de peligro
  const renderDangerZoneContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title" style={{ color: '#f87171', borderLeftColor: '#f87171' }}>Zona de peligro</h4>
      <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.6)', margin: 0, lineHeight: 1.4 }}>
          {lang === 'es' ? 'Estas acciones son destructivas y no se pueden deshacer. Se borrarán tus estadísticas, libros importados y configuraciones.' : 'These actions are destructive and cannot be undone. Your stats, imported books, and settings will be permanently deleted.'}
        </p>
        <button
          type="button"
          onClick={() => {
            const confirm = window.confirm(lang === 'es' ? '¿Estás absolutamente seguro de que deseas restablecer TODOS los datos? Esta acción es irreversible.' : 'Are you absolutely sure you want to reset ALL data? This is irreversible.');
            if (confirm) {
              localStorage.clear();
              const req = indexedDB.deleteDatabase('yoru-reader-db');
              req.onsuccess = () => {
                alert(lang === 'es' ? 'Aplicación restablecida con éxito. Se reiniciará ahora.' : 'App reset successfully. Restarting now.');
                window.location.reload();
              };
              req.onerror = () => {
                window.location.reload();
              };
            }
          }}
          style={{ width: '100%', padding: '10px', fontSize: '0.8rem', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          🔧 {lang === 'es' ? 'Restablecer base de datos y ajustes' : 'Reset Database & Settings'}
        </button>
      </div>
    </div>
  );

  // Muestra el panel según la sección seleccionada
  const renderActiveContent = () => {
    switch (activeSection) {
      case 'theme':
        return renderThemeContent();
      case 'display':
        return renderDisplayContent();
      case 'text-style':
        return renderTextStyleContent();
      case 'rendering':
        return renderRenderingContent();
      case 'sources':
        return renderSourcesContent();
      case 'stats-config':
        return renderStatsConfigContent();
      case 'reading-day':
        return renderReadingDayContent();
      case 'sync-merge':
        return renderSyncMergeContent();
      case 'backups':
        return renderBackupsContent();
      case 'dictionaries':
        return renderDictionariesContent();
      case 'danger-zone':
        return renderDangerZoneContent();
      default:
        return renderSyncMergeContent();
    }
  };

  // Búsqueda keywords
  const allSettingsItems = [
    { id: 'theme', keywords: 'theme tema dark light sepia fondo background', render: renderThemeContent },
    { id: 'display', keywords: 'display visualizacion interfaz idioma language interfaces spanish english pantalla', render: renderDisplayContent },
    { id: 'text-style', keywords: 'text style estilo texto fuente font size tamaño slider furigana tarjetas library covers', render: renderTextStyleContent },
    { id: 'rendering', keywords: 'rendering renderizado acento pitch learning status cursor hover resaltado', render: renderRenderingContent },
    { id: 'sources', keywords: 'sources fuentes anki anki-connect deck cards note integracion', render: renderSourcesContent },
    { id: 'stats-config', keywords: 'stats config estadisticas tracking delete books annotations enabled tracker', render: renderStatsConfigContent },
    { id: 'reading-day', keywords: 'reading day dia lectura start hours limites horas nocturno', render: renderReadingDayContent },
    { id: 'sync-merge', keywords: 'sync merge sincronizar combinar conflicto storage sync settings gdrive drive cloud', render: renderSyncMergeContent },
    { id: 'backups', keywords: 'backups copias seguridad zip local export backup', render: renderBackupsContent },
    { id: 'dictionaries', keywords: 'dictionaries diccionarios yomitan deinflector words', render: renderDictionariesContent },
    { id: 'danger-zone', keywords: 'danger zone peligro reset clear delete database restablecer borrar', render: renderDangerZoneContent }
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
            <span>Configuración</span>
            <button className="settings-close-btn-mobile" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Buscador de Ajustes */}
          <div className="settings-search-box">
            <Search size={14} className="search-icon-prefix" />
            <input 
              type="text" 
              placeholder={lang === 'es' ? 'Buscar...' : 'Find...'} 
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
                    <span>{group.category}</span>
                  </div>
                  <div className="settings-group-items">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`settings-menu-item-btn ${activeSection === item.id ? 'active' : ''}`}
                        style={{ color: item.color || 'rgba(255, 255, 255, 0.65)' }}
                      >
                        {item.icon}
                        <span style={{ marginLeft: '4px' }}>{item.label}</span>
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
                  <span>{lang === 'es' ? 'Resultados' : 'Results'}</span>
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
                        <span style={{ marginLeft: '4px' }}>{labelObj.label}</span>
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', padding: '10px 14px', fontStyle: 'italic' }}>
                      {lang === 'es' ? 'Sin resultados' : 'No results found'}
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
              {lang === 'es' ? 'Ajustes Generales' : 'General Settings'}
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
