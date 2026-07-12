import React from 'react';
import { BUILT_IN_FONTS, ReaderSettingsState } from '../../hooks/useReaderSettings';

interface ReaderColors {
  textMain: string;
  textMuted: string;
  headerBg?: string;
  border?: string;
  popoverBg?: string;
  cardBg?: string;
  accent: string;
}

interface ReaderSettingsProps {
  settings: ReaderSettingsState;
  onSettingChange: <K extends keyof ReaderSettingsState>(key: K, value: ReaderSettingsState[K]) => void;
  onOpenExtensionSettings?: () => void;
  colors: ReaderColors;
  lang: string;
}

/**
 * ReaderSettings — Settings panel for the reader.
 * Rendered inside the right sidebar or as a popover.
 * Manages font, line height, margins, pagination, vertical mode, furigana.
 */
export default function ReaderSettings({
  settings,
  onSettingChange,
  onOpenExtensionSettings,
  colors,
  lang,
}: ReaderSettingsProps) {
  const {
    fontSize, lineHeight, fontFamily,
    verticalPadding, horizontalPadding,
    vertical, paginated, showFurigana, disableCss,
  } = settings;

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: `1px solid ${colors.border}`,
    background: 'rgba(255,255,255,0.04)',
    color: colors.textMain,
    fontSize: '0.85rem',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  const sliderTrackStyle: React.CSSProperties = {
    width: '100%',
    appearance: 'none',
    height: '4px',
    borderRadius: '4px',
    background: `${colors.accent}30`,
    outline: 'none',
    cursor: 'pointer',
  };

  const checkboxGroupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: colors.textMain,
  };

  const segmentedStyle: React.CSSProperties = {
    display: 'flex',
    borderRadius: '8px',
    overflow: 'hidden',
    border: `1px solid ${colors.border}`,
  };

  const segBtnStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    border: 'none',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: isActive ? colors.accent : 'rgba(255,255,255,0.03)',
    color: isActive ? '#fff' : colors.textMuted,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* FLOW: Paged / Continuous */}
      <div>
        <label style={labelStyle}>{lang === 'es' ? 'FLUJO' : 'FLOW'}</label>
        <div style={segmentedStyle}>
          <button style={segBtnStyle(paginated)} onClick={() => onSettingChange('paginated', true)}>
            {lang === 'es' ? 'Paginado' : 'Paged'}
          </button>
          <button style={segBtnStyle(!paginated)} onClick={() => onSettingChange('paginated', false)}>
            {lang === 'es' ? 'Continuo' : 'Continuous'}
          </button>
        </div>
      </div>

      {/* DIRECTION: Auto / Vertical / Horizontal */}
      <div>
        <label style={labelStyle}>{lang === 'es' ? 'DIRECCIÓN' : 'DIRECTION'}</label>
        <div style={segmentedStyle}>
          <button style={segBtnStyle(!vertical)} onClick={() => onSettingChange('vertical', false)}>
            Horizontal
          </button>
          <button style={segBtnStyle(vertical)} onClick={() => onSettingChange('vertical', true)}>
            Vertical
          </button>
        </div>
      </div>

      {/* Font Family */}
      <div>
        <label style={labelStyle}>{lang === 'es' ? 'TIPOGRAFÍA' : 'FONT FAMILY'}</label>
        <select
          style={inputStyle}
          value={fontFamily || '__default__'}
          onChange={e => onSettingChange('fontFamily', e.target.value)}
        >
          {BUILT_IN_FONTS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label style={labelStyle}>{lang === 'es' ? 'TAMAÑO DE FUENTE' : 'FONT SIZE'}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            style={{ ...segBtnStyle(false), flex: 'none', width: '36px', borderRadius: '6px', border: `1px solid ${colors.border}` }}
            onClick={() => onSettingChange('fontSize', Math.max(10, fontSize - 1))}
          >−</button>
          <input
            type="number"
            min="10"
            max="60"
            value={fontSize}
            onChange={e => onSettingChange('fontSize', Number(e.target.value))}
            style={{ ...inputStyle, textAlign: 'center', flex: 1 }}
          />
          <button
            style={{ ...segBtnStyle(false), flex: 'none', width: '36px', borderRadius: '6px', border: `1px solid ${colors.border}` }}
            onClick={() => onSettingChange('fontSize', Math.min(60, fontSize + 1))}
          >+</button>
        </div>
      </div>

      {/* Line Height */}
      <div>
        <label style={labelStyle}>{lang === 'es' ? 'INTERLINEADO' : 'LINE HEIGHT'}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={lineHeight}
            onChange={e => onSettingChange('lineHeight', Number(e.target.value))}
            style={sliderTrackStyle}
          />
          <span style={{ fontSize: '0.8rem', color: colors.textMuted, minWidth: '28px', textAlign: 'right' }}>
            {lineHeight.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Vertical Padding */}
      <div>
        <label style={labelStyle}>{lang === 'es' ? 'MARGEN VERTICAL' : 'VERTICAL PADDING'}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={verticalPadding}
            onChange={e => onSettingChange('verticalPadding', Number(e.target.value))}
            style={sliderTrackStyle}
          />
          <span style={{ fontSize: '0.8rem', color: colors.textMuted, minWidth: '28px', textAlign: 'right' }}>
            {verticalPadding}%
          </span>
        </div>
      </div>

      {/* Horizontal Padding */}
      <div>
        <label style={labelStyle}>{lang === 'es' ? 'MARGEN HORIZONTAL' : 'HORIZONTAL PADDING'}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={horizontalPadding}
            onChange={e => onSettingChange('horizontalPadding', Number(e.target.value))}
            style={sliderTrackStyle}
          />
          <span style={{ fontSize: '0.8rem', color: colors.textMuted, minWidth: '28px', textAlign: 'right' }}>
            {horizontalPadding}%
          </span>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={checkboxGroupStyle} onClick={() => onSettingChange('showFurigana', !showFurigana)}>
          <ToggleSwitch active={showFurigana} color={colors.accent} />
          {lang === 'es' ? 'Mostrar Furigana' : 'Show Furigana'}
        </label>
        <label style={checkboxGroupStyle} onClick={() => onSettingChange('disableCss', !disableCss)}>
          <ToggleSwitch active={disableCss} color={colors.accent} />
          {lang === 'es' ? 'Desactivar CSS del libro' : 'Disable CSS Injection'}
        </label>
      </div>

      {/* Extension / Parse Settings */}
      {onOpenExtensionSettings && (
        <button
          onClick={onOpenExtensionSettings}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: `1px solid rgba(245, 158, 11, 0.3)`,
            background: 'rgba(245, 158, 11, 0.08)',
            color: '#f59e0b',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ⚙️ {lang === 'es' ? 'Ajustes de parseo / extensión' : 'Parse / Extension settings'}
        </button>
      )}
    </div>
  );
}

// Simple toggle switch component
interface ToggleSwitchProps {
  active: boolean;
  color: string;
}

function ToggleSwitch({ active, color }: ToggleSwitchProps) {
  return (
    <div style={{
      width: '36px',
      height: '20px',
      borderRadius: '12px',
      background: active ? color : 'rgba(255,255,255,0.12)',
      position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        top: '2px',
        left: active ? '18px' : '2px',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </div>
  );
}
