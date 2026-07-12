// Reader settings hook for Yoru Reader
// Inspired by Lumi Reader's createReaderSettings
// Persists to localStorage and reflects changes into CSS variables

import { useState, useCallback, useEffect } from 'react';

export interface ReaderSettingsState {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  verticalPadding: number;
  horizontalPadding: number;
  vertical: boolean;
  paginated: boolean;
  showFurigana: boolean;
  disableCss: boolean;
}

const LS_KEYS = {
  fontSize: 'reader:fontSize',
  lineHeight: 'reader:lineHeight',
  fontFamily: 'reader:fontFamily',
  verticalPadding: 'reader:verticalPadding',
  horizontalPadding: 'reader:horizontalPadding',
  vertical: 'reader:vertical',
  paginated: 'reader:paginated',
  showFurigana: 'reader:showFurigana',
  disableCss: 'reader:disableCss',
};

function getNumber(key: string, fallback: number): number {
  const v = localStorage.getItem(key);
  return v !== null ? Number(v) : fallback;
}

function getBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key);
  return v !== null ? v === 'true' : fallback;
}

function getString(key: string, fallback: string): string {
  const v = localStorage.getItem(key);
  return v !== null ? v : fallback;
}

export const BUILT_IN_FONTS = [
  { label: 'Default (System Font)', value: '__default__' },
  { label: 'Noto Sans JP', value: 'Noto Sans JP' },
  { label: 'Noto Serif JP', value: 'Noto Serif JP' },
  { label: 'KleeOne', value: 'KleeOne' },
  { label: 'Shippori Mincho', value: 'Shippori Mincho' },
];

function loadSettings(): ReaderSettingsState {
  return {
    fontSize: getNumber(LS_KEYS.fontSize, 20),
    lineHeight: getNumber(LS_KEYS.lineHeight, 1.8),
    fontFamily: getString(LS_KEYS.fontFamily, '__default__'),
    verticalPadding: getNumber(LS_KEYS.verticalPadding, 3),
    horizontalPadding: getNumber(LS_KEYS.horizontalPadding, 8),
    vertical: getBool(LS_KEYS.vertical, false),
    paginated: getBool(LS_KEYS.paginated, true),
    showFurigana: getBool(LS_KEYS.showFurigana, true),
    disableCss: getBool(LS_KEYS.disableCss, false),
  };
}

export function useReaderSettings(): [ReaderSettingsState, <K extends keyof ReaderSettingsState>(key: K, value: ReaderSettingsState[K]) => void] {
  const [settings, setSettingsState] = useState<ReaderSettingsState>(loadSettings);

  const setSetting = useCallback(<K extends keyof ReaderSettingsState>(key: K, value: ReaderSettingsState[K]) => {
    localStorage.setItem(LS_KEYS[key], String(value));
    setSettingsState(prev => ({ ...prev, [key]: value }));
  }, []);

  // Reflect font-family CSS variable whenever it changes
  useEffect(() => {
    if (settings.fontFamily && settings.fontFamily !== '__default__') {
      document.body.style.setProperty('--reader-font', `"${settings.fontFamily}"`);
    } else {
      document.body.style.removeProperty('--reader-font');
    }
  }, [settings.fontFamily]);

  // Reflect furigana visibility
  useEffect(() => {
    if (!settings.showFurigana) {
      document.body.classList.add('hide-furigana');
    } else {
      document.body.classList.remove('hide-furigana');
    }
  }, [settings.showFurigana]);

  return [settings, setSetting];
}
