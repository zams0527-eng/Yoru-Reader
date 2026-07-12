import React from 'react';
import { ArrowLeft, BookOpen, Bookmark, List, Clock, Maximize2, Minimize2, Settings, Flag, Hash, Image } from 'lucide-react';

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
  isBookCompleted: boolean;
  onToggleFlagCompleted: () => void;
  onOpenGallery: () => void;
  onOpenJumpModal: () => void;
  onMouseLeave?: () => void;
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
  isBookCompleted,
  onToggleFlagCompleted,
  onOpenGallery,
  onOpenJumpModal,
  onMouseLeave,
}: ReaderNavbarProps) {
  // Remove instant unmounting so transitions can play
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
    transition: 'background 0.15s, color 0.15s',
  };

  return (
    <>
      {/* Backdrop */}
      {visible && (
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
      )}
      {/* Navbar */}
      <div
        onMouseLeave={onMouseLeave}
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
          background: colors.headerBg ? (colors.headerBg.startsWith('#') && colors.headerBg.length === 7 ? `${colors.headerBg}cc` : colors.headerBg) : 'rgba(12, 12, 14, 0.75)',
          borderBottom: `2px solid ${colors.accent || '#FFE000'}`,
          boxShadow: visible ? `0 2px 12px ${colors.accent === '#5c35db' ? 'rgba(92, 53, 219, 0.4)' : colors.accent === '#8b5a2b' ? 'rgba(139, 90, 43, 0.3)' : 'rgba(255, 224, 0, 0.4)'}` : 'none',
          backdropFilter: 'blur(16px)',
          transform: visible ? 'translateY(0)' : 'translateY(-110%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease, box-shadow 0.35s ease',
          pointerEvents: visible ? 'auto' : 'none',
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '0 16px',
        }}>
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 600,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: colors.textMuted,
            opacity: 0.6,
            marginBottom: '1px',
          }}>
            {lang === 'es' ? 'Leyendo' : 'Reading'}
          </span>
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: colors.textMain,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            opacity: 0.9,
          }}>
            {bookTitle}
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Flag Button (Toggle 100% Completed) */}
          <button 
            style={{ ...btnStyle, color: isBookCompleted ? '#FFE000' : colors.textMain }} 
            onClick={onToggleFlagCompleted} 
            title={lang === 'es' ? 'Completado 100%' : '100% Completed'}
          >
            <Flag size={20} fill={isBookCompleted ? '#FFE000' : 'none'} />
          </button>

          {/* Hash Button (Jump to Position) */}
          <button 
            style={btnStyle} 
            onClick={onOpenJumpModal} 
            title={lang === 'es' ? 'Saltar a posición' : 'Jump to position'}
          >
            <Hash size={20} />
          </button>

          {/* Image Button (Open Gallery Viewer) */}
          <button 
            style={btnStyle} 
            onClick={onOpenGallery} 
            title={lang === 'es' ? 'Ver todas las imágenes' : 'View all images'}
          >
            <Image size={20} />
          </button>

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


