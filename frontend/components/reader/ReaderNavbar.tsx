import React from 'react';
import {
  ArrowLeft,
  List,
  Settings,
  Image,
} from 'lucide-react';

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
  onClose?: () => void;
  onBack: () => void;
  onToggleToc: () => void;
  onToggleBookmarks?: () => void;
  onToggleSession?: () => void;
  onToggleSettings: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  bookTitle: string;
  colors: ReaderColors;
  lang?: string;
  isBookCompleted?: boolean;
  onToggleFlagCompleted?: () => void;
  onOpenGallery?: () => void;
  onOpenJumpModal?: () => void;
  onMouseLeave?: () => void;
}

export default function ReaderNavbar({
  visible,
  onBack,
  onToggleToc,
  onToggleSettings,
  bookTitle,
  colors,
  lang = 'es',
  onOpenGallery,
  onMouseLeave,
}: ReaderNavbarProps) {
  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#e0e0ea',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    borderRadius: '50%',
    outline: 'none',
    transition: 'background 0.15s ease',
  };

  return (
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
        padding: 'max(8px, env(safe-area-inset-top, 0px)) 12px 8px 12px',
        background: 'rgba(14, 14, 18, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        transform: visible ? 'translateY(0)' : 'translateY(-110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
        pointerEvents: visible ? 'auto' : 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Left: Back button */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button style={btnStyle} onClick={onBack} title={lang === 'es' ? 'Volver' : 'Back'}>
          <ArrowLeft size={22} />
        </button>
      </div>

      {/* Center: Novel Title */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '0 12px',
        }}
      >
        <span
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: '#ffffff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            textAlign: 'center',
          }}
        >
          {bookTitle}
        </span>
      </div>

      {/* Right: Gallery, Chapters TOC, Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {onOpenGallery && (
          <button style={btnStyle} onClick={onOpenGallery} title={lang === 'es' ? 'Galería' : 'Gallery'}>
            <Image size={20} />
          </button>
        )}
        <button style={btnStyle} onClick={onToggleToc} title={lang === 'es' ? 'Capítulos' : 'Chapters'}>
          <List size={22} />
        </button>
        <button style={btnStyle} onClick={onToggleSettings} title={lang === 'es' ? 'Ajustes' : 'Settings'}>
          <Settings size={22} />
        </button>
      </div>
    </div>
  );
}
