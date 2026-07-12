import React from 'react';
import { ArrowLeft, BookOpen, Bookmark, List, Clock, Maximize2, Minimize2, Settings } from 'lucide-react';

interface ReaderColors {
  textMain: string;
  textMuted: string;
  headerBg?: string;
  border?: string;
  popoverBg?: string;
  cardBg?: string;
  accent: string;
}

interface ReaderNavbarProps {
  visible: boolean;
  onClose: () => void;
  onBack: () => void;
  onToggleToc: () => void;
  onToggleBookmarks: () => void;
  onToggleSession: () => void;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  bookTitle: string;
  colors: ReaderColors;
  lang: string;
}

/**
 * ReaderNavbar — Top navigation bar for the reader.
 * Hidden by default; appears when user clicks top zone or presses Escape.
 */
export default function ReaderNavbar({
  visible,
  onClose,
  onBack,
  onToggleToc,
  onToggleBookmarks,
  onToggleSession,
  onToggleSettings,
  onToggleFullscreen,
  isFullscreen,
  bookTitle,
  colors,
  lang,
}: ReaderNavbarProps) {
  if (!visible) return null;

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: colors.textMain,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          background: 'transparent',
        }}
        onClick={onClose}
      />
      {/* Navbar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: colors.headerBg || 'rgba(12, 12, 14, 0.95)',
          borderBottom: `1px solid ${colors.border || 'rgba(255,255,255,0.06)'}`,
          backdropFilter: 'blur(16px)',
          animation: 'slideDown 0.2s ease-out',
        }}
      >
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button style={btnStyle} onClick={onBack} title={lang === 'es' ? 'Volver' : 'Back'}>
            <ArrowLeft size={20} />
          </button>
          <button style={btnStyle} onClick={onToggleToc} title={lang === 'es' ? 'Índice' : 'Table of Contents'}>
            <List size={20} />
          </button>
          <button style={btnStyle} onClick={onToggleBookmarks} title={lang === 'es' ? 'Marcadores' : 'Bookmarks'}>
            <Bookmark size={20} />
          </button>
          <button style={btnStyle} onClick={onToggleSession} title={lang === 'es' ? 'Sesión' : 'Session'}>
            <Clock size={20} />
          </button>
        </div>

        {/* Center — Book Title */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: colors.textMain,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 16px',
          opacity: 0.8,
        }}>
          {bookTitle}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button style={btnStyle} onClick={onToggleFullscreen} title={lang === 'es' ? 'Pantalla completa' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button style={btnStyle} onClick={onToggleSettings} title={lang === 'es' ? 'Ajustes' : 'Settings'}>
            <Settings size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
