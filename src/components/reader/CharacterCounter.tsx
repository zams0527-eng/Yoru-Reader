import React, { useState } from 'react';

interface ReaderColors {
  textMain: string;
  textMuted: string;
  headerBg?: string;
  border?: string;
  popoverBg?: string;
  cardBg?: string;
  accent: string;
}

interface CharacterCounterProps {
  currChars: number;
  totalChars: number;
  colors: ReaderColors;
}

/**
 * CharacterCounter — Floating widget showing reading progress.
 * Shows current/total characters and percentage.
 * Toggles visibility on click.
 */
export default function CharacterCounter({ currChars, totalChars, colors }: CharacterCounterProps) {
  const [visible, setVisible] = useState(true);

  const percentage = totalChars > 0 ? ((currChars / totalChars) * 100).toFixed(2) : '0.00';

  return (
    <span
      onClick={() => setVisible(v => !v)}
      style={{
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        zIndex: 50,
        fontSize: '0.72rem',
        cursor: 'pointer',
        color: colors.textMuted,
        background: 'rgba(0,0,0,0.3)',
        padding: visible ? '4px 10px' : '4px 8px',
        borderRadius: '12px',
        backdropFilter: 'blur(8px)',
        transition: 'opacity 0.2s',
        userSelect: 'none',
      }}
    >
      {visible
        ? `${currChars.toLocaleString()} / ${totalChars.toLocaleString()} (${percentage}%)`
        : <span style={{ opacity: 0.3 }}>📖</span>
      }
    </span>
  );
}
