import React, { useState } from 'react';
import { X, Search, Palette, Clock, Type, Target, Layers, FolderOpen, BookOpen, AlertTriangle, Info } from 'lucide-react';
import { t } from '../utils/i18n';
import packageJson from '../../package.json';
import { CHANGELOG } from '../utils/changelog';
const AnkiConfigModal = React.lazy(() => import('./AnkiConfigModal'));

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings = {}, 
  onSaveSettings, 
  mode = 'settings', 
  book, 
  onUpdateBookDetails,
  libraryViewProps, // Opcional, para controlar las tarjetas de la biblioteca
  onExportLibrary,
  onTriggerImportBackup
}) {
  if (!isOpen) return null;
  const [isAnkiConfigOpen, setIsAnkiConfigOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('text-style');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSubView, setMobileSubView] = useState('menu'); // 'menu' o 'content'
  
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

  // Estructura de menú idéntica al screenshot del usuario (con emojis)
  const menuStructure = [
    {
      category: 'GENERAL',
      items: [
        { id: 'theme', label: lang === 'es' ? 'Tema' : 'Theme', icon: <Palette size={16} /> },
        { id: 'display', label: lang === 'es' ? 'Pantalla' : 'Display', icon: <Clock size={16} /> },
        { id: 'about', label: lang === 'es' ? 'Acerca de / Versión' : 'About / Version', icon: <Info size={16} /> }
      ]
    },
    {
      category: lang === 'es' ? 'LECTOR' : 'READER',
      items: [
        { id: 'text-style', label: lang === 'es' ? 'Estilo de texto' : 'Text Style', icon: <Type size={16} /> },
        { id: 'rendering', label: lang === 'es' ? 'Resaltado' : 'Highlighting', icon: <Target size={16} /> }
      ]
    },
    {
      category: lang === 'es' ? 'INTEGRACIÓN' : 'INTEGRATION',
      items: [
        { id: 'sources', label: lang === 'es' ? 'Integración con Anki' : 'Anki Integration', icon: <Layers size={16} /> }
      ]
    },
    {
      category: lang === 'es' ? 'DATOS' : 'DATA',
      items: [
        { id: 'backups', label: lang === 'es' ? 'Copias de seguridad' : 'Backups', icon: <FolderOpen size={16} /> },
        { id: 'dictionaries', label: lang === 'es' ? 'Diccionarios' : 'Dictionaries', icon: <BookOpen size={16} /> },
        { id: 'danger-zone', label: lang === 'es' ? 'Zona de peligro' : 'Danger Zone', icon: <AlertTriangle size={16} />, color: '#f87171' }
      ]
    }
  ];

  // 1. GENERAL / Tema
  const renderThemeContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Tema' : 'Theme'}</h4>
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
      <h4 className="settings-panel-title">{lang === 'es' ? 'Pantalla' : 'Display'}</h4>
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
      <h4 className="settings-panel-title">{lang === 'es' ? 'Estilo de texto' : 'Text Style'}</h4>
      
      {/* Tamaño del texto (Zoom de lectura) */}
      <div className="migaku-row" style={{ marginBottom: '14px' }}>
        <span className="migaku-label">{lang === 'es' ? 'Zoom de lectura' : 'Reading Zoom'}</span>
        <select 
          value={getSliderVal()}
          onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
          className="migaku-select"
        >
          <option value="18">75%</option>
          <option value="24">100%</option>
          <option value="30">125%</option>
          <option value="36">150%</option>
          <option value="42">175%</option>
          <option value="48">200%</option>
        </select>
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

      {/* Si se proveen configuraciones de biblioteca (Library View Settings) */}
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
      <h4 className="settings-panel-title">{lang === 'es' ? 'Resaltado' : 'Highlighting'}</h4>
      
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
      <h4 className="settings-panel-title">{lang === 'es' ? 'Integración con Anki' : 'Anki Integration'}</h4>
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

  // 6. DATOS / Copias de seguridad
  const renderBackupsContent = () => {
    // Si la app corre con Google Drive, mostramos un resumen rápido del estado
    const gDriveActive = localStorage.getItem('yoru_gdrive_tokens') !== null;
    return (
      <div className="settings-panel-section">
        <h4 className="settings-panel-title">{lang === 'es' ? 'Copias de seguridad' : 'Backups'}</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Resumen Google Drive */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>GOOGLE DRIVE</span>
              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', background: gDriveActive ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', color: gDriveActive ? '#34d399' : 'rgba(255,255,255,0.4)' }}>
                {gDriveActive ? (lang === 'es' ? 'VINCULADO' : 'LINKED') : (lang === 'es' ? 'DESCONECTADO' : 'DISCONNECTED')}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px 0' }}>
              {lang === 'es' ? 'Sincroniza tus libros y progreso en la nube.' : 'Sync your books and progress in the cloud.'}
            </p>
          </div>

          {/* Exportación/Importación Local */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <span className="migaku-label" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
              {lang === 'es' ? 'Copias Locales (Archivo ZIP)' : 'Local Backups (ZIP File)'}
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  if (onExportLibrary) {
                    onExportLibrary();
                  } else if (window.electronAPI && window.electronAPI.exportLibrary) {
                    window.electronAPI.exportLibrary().then(res => {
                      if (res) alert(lang === 'es' ? 'Copia de seguridad guardada con éxito.' : 'Backup saved successfully.');
                    }).catch(e => alert(e.message));
                  } else {
                    alert(lang === 'es' ? 'La copia local no está disponible.' : 'Local backup is not available.');
                  }
                }}
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
              >
                💾 {lang === 'es' ? 'Exportar copia' : 'Export backup'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onTriggerImportBackup) {
                    onTriggerImportBackup();
                  } else {
                    alert(lang === 'es' ? 'La importación local no está disponible.' : 'Local import is not available.');
                  }
                }}
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
              >
                📂 {lang === 'es' ? 'Importar copia' : 'Import backup'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 7. DATOS / Diccionarios
  const renderDictionariesContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Diccionarios' : 'Dictionaries'}</h4>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lang === 'es' ? 'Japonés - Español' : 'Japanese - English'}</span>
          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,224,0,0.1)', color: 'var(--primary)' }}>{lang === 'es' ? 'ACTIVO' : 'ACTIVE'}</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          {lang === 'es' ? 'Base de datos Yomitan de diccionario integrada correctamente.' : 'Integrated Yomitan dictionary database loaded.'}
        </p>
      </div>
    </div>
  );

  // 8. DATOS / Zona de peligro
  const renderDangerZoneContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title" style={{ color: '#f87171', borderLeftColor: '#f87171' }}>{lang === 'es' ? 'Zona de peligro' : 'Danger Zone'}</h4>
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
              // Borrar IndexedDB de forma rápida
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

  // 9. GENERAL / Acerca de / Versión
  const renderAboutContent = () => (
    <div className="settings-panel-section">
      <h4 className="settings-panel-title">{lang === 'es' ? 'Acerca de / Versión' : 'About / Version'}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>
            Yoru Reader
          </div>
          <div style={{ fontSize: '0.88rem', color: '#fff', opacity: 0.8, marginBottom: '8px' }}>
            {lang === 'es' ? `Versión ${packageJson.version}` : `Version ${packageJson.version}`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {lang === 'es' ? 'Lector de novelas ligeras en japonés enfocado en inmersión' : 'Japanese light novel reader focused on immersion'}
          </div>
        </div>

        <div>
          <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
            {lang === 'es' ? 'Historial de versiones y cambios' : 'Version History & Changelog'}
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
            {CHANGELOG.map((item, index) => (
              <div key={item.version} style={{ borderBottom: index < CHANGELOG.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>v{item.version}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.date}</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  {(item.changes[lang] || item.changes['en']).map((change, cIdx) => (
                    <li key={cIdx} style={{ marginBottom: '4px' }}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
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
      case 'about':
        return renderAboutContent();
      case 'text-style':
        return renderTextStyleContent();
      case 'rendering':
        return renderRenderingContent();
      case 'sources':
        return renderSourcesContent();
      case 'backups':
        return renderBackupsContent();
      case 'dictionaries':
        return renderDictionariesContent();
      case 'danger-zone':
        return renderDangerZoneContent();
      default:
        return renderTextStyleContent();
    }
  };

  // Lógica de filtrado de búsqueda
  const allSettingsItems = [
    { id: 'theme', keywords: 'theme tema dark light sepia fondo background', render: renderThemeContent },
    { id: 'display', keywords: 'display visualizacion interfaz idioma language interfaces spanish english pantalla', render: renderDisplayContent },
    { id: 'about', keywords: 'about version changelog acerca de info info-version cambios novedades', render: renderAboutContent },
    { id: 'text-style', keywords: 'text style estilo texto fuente font size tamaño slider furigana tarjetas library covers', render: renderTextStyleContent },
    { id: 'rendering', keywords: 'rendering renderizado acento pitch learning status cursor hover resaltado', render: renderRenderingContent },
    { id: 'sources', keywords: 'sources fuentes anki anki-connect deck cards note integracion', render: renderSourcesContent },
    { id: 'backups', keywords: 'backups copias seguridad google drive cloud zip export backup local', render: renderBackupsContent },
    { id: 'dictionaries', keywords: 'dictionaries diccionarios yomitan deinflector words', render: renderDictionariesContent },
    { id: 'danger-zone', keywords: 'danger zone peligro reset clear delete database restablecer borrar', render: renderDangerZoneContent }
  ];

  const filteredItems = searchQuery.trim() 
    ? allSettingsItems.filter(item => item.keywords.includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`settings-sidebar-modal mobile-subview-${mobileSubView}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Panel Izquierdo: Sidebar Navigation */}
        <div className="settings-sidebar-left">
          <div className="settings-sidebar-title">
            <span>{lang === 'es' ? 'Configuración' : 'Settings'}</span>
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
                        onClick={() => {
                          setActiveSection(item.id);
                          setMobileSubView('content');
                        }}
                        className={`settings-menu-item-btn ${activeSection === item.id ? 'active' : ''}`}
                        style={{ color: item.color || 'rgba(255, 255, 255, 0.65)' }}
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
                  <span>{lang === 'es' ? 'Resultados' : 'Results'}</span>
                </div>
                <div className="settings-group-items">
                  {filteredItems.map(item => {
                    const labelObj = menuStructure.flatMap(g => g.items).find(i => i.id === item.id) || { label: item.id };
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setActiveSection(item.id); setSearchQuery(''); setMobileSubView('content'); }}
                        className="settings-menu-item-btn"
                      >
                        <span>🔍</span>
                        <span>{labelObj.label}</span>
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
            <button 
              className="settings-back-btn-mobile" 
              onClick={() => setMobileSubView('menu')}
              type="button"
            >
              ← {lang === 'es' ? 'Atrás' : 'Back'}
            </button>
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
