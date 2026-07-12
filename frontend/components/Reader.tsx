import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ExternalLink, Plus, Volume2, X } from 'lucide-react';
import { tokenizeText } from '../utils/japanese';
import { lookupWord } from '../utils/dictionary';
import { db } from '../utils/db';
import html2canvas from 'html2canvas';
import { t } from '../utils/i18n';
import { synthesizeSpeechAzure } from '../utils/azureTtsService';

// Direct reader engine imports
import ReaderEngine from './reader/ReaderEngine';
import ReaderNavbar from './reader/ReaderNavbar';
import ReaderSidebar from './reader/ReaderSidebar';
import ReaderSettings from './reader/ReaderSettings';
import ReaderSettingsPopover from './reader/ReaderSettingsPopover';
import CharacterCounter from './reader/CharacterCounter';
import SelectionToolbar from './reader/SelectionToolbar';
import { useReaderSettings, ReaderSettingsState } from '../hooks/useReaderSettings';

// Hash a string ID to a positive 32-bit integer for ttu-reader compatibility
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Extract the sentence containing the selected text inside the iframe DOM
function getSentenceFromSelection(selection: Selection): string {
  const node = selection.anchorNode;
  if (!node) return '';
  
  let container: Node | null = node;
  while (container && container.nodeType !== Node.ELEMENT_NODE) {
    container = container.parentNode;
  }
  if (!container) return '';
  
  const text = container.textContent || '';
  const selectedText = selection.toString();
  
  const sentences = text.split(/(?<=[。！？\n])/g);
  const match = sentences.find(s => s.includes(selectedText));
  return match ? match.trim() : selectedText;
}

export function getUniqueFrequencies(frequencies: any[]): any[] {
  if (!frequencies || frequencies.length === 0) return [];
  
  const bestFreqs: Record<string, any> = {};
  frequencies.forEach(f => {
    const dict = f.dictionary;
    let numVal = Infinity;
    if (typeof f.value === 'number') {
      numVal = f.value;
    } else if (f.value) {
      const parsed = parseInt(String(f.value).replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed)) {
        numVal = parsed;
      }
    } else if (f.displayValue) {
      const parsed = parseInt(String(f.displayValue).replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed)) {
        numVal = parsed;
      }
    }
    
    if (!bestFreqs[dict]) {
      bestFreqs[dict] = { ...f, parsedValue: numVal };
    } else {
      if (numVal < bestFreqs[dict].parsedValue) {
        bestFreqs[dict] = { ...f, parsedValue: numVal };
      }
    }
  });
  
  const seenDicts = new Set<string>();
  const orderedResult: any[] = [];
  frequencies.forEach(f => {
    if (!seenDicts.has(f.dictionary)) {
      seenDicts.add(f.dictionary);
      if (bestFreqs[f.dictionary]) {
        orderedResult.push(bestFreqs[f.dictionary]);
      }
    }
  });
  
  return orderedResult;
}

interface ReaderProps {
  book: any;
  onBack: (targetTab?: string) => void;
  onUpdateProgress: (bookId: string, currentChapter: number, currentPage: number, percent: number) => void;
  onIncrementReadingStats: (bookId: string, chars: number, seconds: number) => void;
  wordStatuses: Record<string, string>;
  onSetWordStatus: (word: string, status: string, wordData?: any) => void;
  settings: any;
  onSaveSettings: (settings: any) => void;
  onUpdateBookDetails?: (bookId: string, data: any) => Promise<void>;
}

export default function Reader({ 
  book, 
  onBack, 
  onUpdateProgress, 
  onIncrementReadingStats,
  wordStatuses, 
  onSetWordStatus, 
  settings, 
  onSaveSettings,
  onUpdateBookDetails
}: ReaderProps) {
  const lang = settings.appLanguage || 'es';

  const handleBack = useCallback(() => {
    const updatedSettings = db.getSettings();
    db.saveSettings(updatedSettings);
    onSaveSettings(updatedSettings);
    onBack();
  }, [onSaveSettings, onBack]);

  const [readerSettings, rawSetReaderSetting] = useReaderSettings();
  const setReaderSetting = useCallback(<K extends keyof ReaderSettingsState>(key: K, value: ReaderSettingsState[K]) => {
    rawSetReaderSetting(key, value);
    if (key === 'theme' && (value === 'light' || value === 'sepia' || value === 'dark')) {
      if (settings.theme !== value) {
        onSaveSettings({ ...settings, theme: value });
      }
    }
  }, [rawSetReaderSetting, settings, onSaveSettings]);
  const [sidebarMode, setSidebarMode] = useState<'toc' | 'bookmarks' | 'session' | 'settings' | null>(null);
  const [bookmarks, setBookmarks] = useState<any[]>(book.bookmarks || []);
  const [currentProgress, setCurrentProgress] = useState({
    currChars: book.progress?.currentPage || 0,
    totalChars: 0,
    lastIndex: book.progress?.currentPage || 0,
    currSection: book.progress?.currentChapter || 0,
  });

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [jumpPosition, setJumpPosition] = useState(1);
  const [targetCharPosition, setTargetCharPosition] = useState<number | null>(null);
  const [isExtSettingsOpen, setIsExtSettingsOpen] = useState(false);
  const [extId, setExtId] = useState<string | null>(null);

  // Extract all images from book chapters
  const bookImages = useMemo<string[]>(() => {
    if (!book || !book.chapters) return [];
    const urls: string[] = [];
    book.chapters.forEach(chapter => {
      const lines = (chapter.content || '').split('\n');
      lines.forEach(line => {
        if (line.startsWith('{img:') && line.endsWith('}')) {
          const src = line.substring(5, line.length - 1);
          if (src) urls.push(src);
        } else {
          const regex = /\{img:([^{}]+)\}/gi;
          let match;
          while ((match = regex.exec(line)) !== null) {
            if (match[1]) urls.push(match[1]);
          }
        }
      });
    });
    return Array.from(new Set(urls));
  }, [book]);

  const [session, setSession] = useState({
    isActive: false,
    isPaused: false,
    readingTime: 0,
    charsRead: 0,
    speed: 0,
    initialChars: 0,
  });

  const [selection, setSelection] = useState<any | null>(null);
  const [navTargetSection, setNavTargetSection] = useState<number | null>(null);
  const [navTargetParagraphId, setNavTargetParagraphId] = useState<number | null>(null);

  const [selectedWord, setSelectedWord] = useState<any | null>(null);
  const [dictEntry, setDictEntry] = useState<any | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [ankiCardExists, setAnkiCardExists] = useState(false);
  const [srsCard, setSrsCard] = useState<any | null>(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsKeepAliveRef = useRef<any>(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0, anchorBottom: false });
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimerRef = useRef<any>(null);

  const showToast = useCallback((message: string, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  const handleToggleCompleted = useCallback(async () => {
    const isCompleted = book.status === 'completed';
    if (isCompleted) {
      if (onUpdateBookDetails) {
        await onUpdateBookDetails(book.id, { status: 'reading' });
      }
      showToast(lang === 'es' ? 'Libro marcado como en progreso' : 'Book marked as in progress', 'success');
    } else {
      if (onUpdateBookDetails) {
        await onUpdateBookDetails(book.id, { status: 'completed' });
        onUpdateProgress(book.id, currentProgress.currSection, currentProgress.lastIndex, 100);
      }
      showToast(lang === 'es' ? '¡Libro completado al 100%!' : 'Book marked as 100% completed!', 'success');
    }
  }, [book.id, book.status, onUpdateBookDetails, onUpdateProgress, currentProgress.currSection, currentProgress.lastIndex, lang, showToast]);

  const handleConfirmJump = useCallback(() => {
    if (jumpPosition < 0 || jumpPosition > currentProgress.totalChars) {
      showToast(lang === 'es' ? 'Posición no válida' : 'Invalid position', 'warning');
      return;
    }
    setTargetCharPosition(jumpPosition);
    setTimeout(() => setTargetCharPosition(null), 100);
    setIsJumpModalOpen(false);
    showToast(lang === 'es' ? `Saltando a posición ${jumpPosition}` : `Jumping to position ${jumpPosition}`, 'success');
  }, [jumpPosition, currentProgress.totalChars, lang, showToast]);

  useEffect(() => {
    // Automatically hide header after 1.5 seconds when entering reader mode
    const timer = setTimeout(() => {
      setIsHeaderVisible(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (settings.theme === 'light' || settings.theme === 'sepia' || settings.theme === 'dark') {
      if (readerSettings.theme !== settings.theme) {
        rawSetReaderSetting('theme', settings.theme);
      }
    }
  }, [settings.theme, readerSettings.theme, rawSetReaderSetting]);

  useEffect(() => {
    if (!isGalleryOpen || bookImages.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setGalleryIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setGalleryIndex(prev => Math.min(bookImages.length - 1, prev + 1));
      } else if (e.key === 'Escape') {
        setIsGalleryOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen, bookImages.length]);

  const triggerTtuKeyboardAction = useCallback((code: string, key: string) => {
    try {
      const downEvent = new KeyboardEvent('keydown', {
        code,
        key,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(downEvent);
      return true;
    } catch (e) {
      console.error('[Yoru] Keyboard action failed:', e);
      return false;
    }
  }, []);

  const handleOpenExtensionSettings = useCallback(async () => {
    let id = extId;
    if (!id && window.electronAPI?.getReaderExtId) {
      try {
        id = await window.electronAPI.getReaderExtId();
        setExtId(id);
      } catch (err) {
        console.error('Failed to get extension ID:', err);
      }
    }
    if (id) {
      setIsExtSettingsOpen(true);
    } else {
      if (window.electronAPI?.openReaderExtSettings) {
        window.electronAPI.openReaderExtSettings(readerSettings.theme);
      } else {
        alert('Solo disponible en la versión de escritorio de Windows.');
      }
    }
  }, [extId, readerSettings.theme]);

  const handleReaderKeydown = useCallback((e: KeyboardEvent) => {
    if (isExtSettingsOpen || isJumpModalOpen || isGalleryOpen) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const keybindings = settings.keybindings || {
      toggleFullscreen: 'f',
      nextPage: 'ArrowRight',
      prevPage: 'ArrowLeft',
      toggleMenu: 'Escape',
      readAloud: 't'
    };

    const matchKey = (boundKey: string, pressedEvent: KeyboardEvent) => {
      if (!boundKey) return false;
      const lowerBound = boundKey.toLowerCase();
      if (lowerBound === pressedEvent.key.toLowerCase()) return true;
      if (lowerBound === pressedEvent.code.toLowerCase()) return true;
      return false;
    };

    if (matchKey(keybindings.toggleFullscreen, e)) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    if (matchKey(keybindings.nextPage, e)) {
      e.preventDefault();
      triggerTtuKeyboardAction('ArrowRight', 'ArrowRight');
      return;
    }

    if (matchKey(keybindings.prevPage, e)) {
      e.preventDefault();
      triggerTtuKeyboardAction('ArrowLeft', 'ArrowLeft');
      return;
    }

    if (matchKey(keybindings.toggleMenu, e)) {
      e.preventDefault();
      setIsHeaderVisible(prev => !prev);
      return;
    }

    if (matchKey(keybindings.readAloud, e)) {
      e.preventDefault();
      if (isTtsPlaying) {
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
          ttsAudioRef.current = null;
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          clearInterval(ttsKeepAliveRef.current);
        }
        setIsTtsPlaying(false);
      } else if (selectedWord && selectedWord.surface) {
        reproducirTexto(selectedWord.surface);
      }
      return;
    }
  }, [settings.keybindings, toggleFullscreen, triggerTtuKeyboardAction, isTtsPlaying, selectedWord]);

  useEffect(() => {
    window.addEventListener('keydown', handleReaderKeydown);
    return () => {
      window.removeEventListener('keydown', handleReaderKeydown);
    };
  }, [handleReaderKeydown]);

  useEffect(() => {
    if (selectedWord && selectedWord.basicForm) {
      setSrsCard(db.getSrsCard(selectedWord.basicForm));
    } else {
      setSrsCard(null);
    }
  }, [selectedWord]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      clearInterval(ttsKeepAliveRef.current);
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const theme = settings.theme || 'dark';
    window.__yoruTheme = theme;
  }, [settings.theme]);

  const handleSelection = useCallback(async () => {
    const selectionObj = window.getSelection();
    if (!selectionObj) return;
    const selectedText = selectionObj.toString().trim();
    
    if (selectedText && selectedText.length > 0 && selectedText.length <= 12) {
      const sentenceText = getSentenceFromSelection(selectionObj);
      const range = selectionObj.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      const x = Math.max(10, Math.min(window.innerWidth - 390, rect.left));
      const top = rect.top;
      const bottom = rect.bottom;
      
      const anchorBottom = top > window.innerHeight / 2;
      const y = anchorBottom ? top - 6 : bottom + 6;
      
      setPopupPos({ x, y, anchorBottom });
      setDictLoading(true);
      setSelectedWord({
        surface: selectedText,
        basicForm: selectedText,
        reading: '',
        sentenceText
      });

      const entry = await lookupWord(selectedText);
      setDictEntry(entry);
      setDictLoading(false);
    }
  }, []);

  useEffect(() => {
    const contentArea = document.getElementById('reader-content');
    if (!contentArea) return;

    contentArea.addEventListener('mouseup', handleSelection);
    contentArea.addEventListener('touchend', handleSelection);

    const handleDblClick = () => {
      setTimeout(handleSelection, 80);
    };
    contentArea.addEventListener('dblclick', handleDblClick);

    return () => {
      contentArea.removeEventListener('mouseup', handleSelection);
      contentArea.removeEventListener('touchend', handleSelection);
      contentArea.removeEventListener('dblclick', handleDblClick);
    };
  }, [handleSelection]);

  const handleCopyText = useCallback(() => {
    if (!selection) return;
    navigator.clipboard.writeText(selection.text);
    showToast(lang === 'es' ? 'Texto copiado al portapapeles' : 'Text copied to clipboard', 'success');
    window.getSelection()?.removeAllRanges();
  }, [selection, lang]);

  const handleToggleBookmark = useCallback((paragraphId: number, content: string) => {
    let next;
    const exists = bookmarks.find(b => b.paragraphId === paragraphId);
    if (exists) {
      next = bookmarks.filter(b => b.paragraphId !== paragraphId);
      showToast(lang === 'es' ? 'Marcador eliminado' : 'Bookmark removed', 'success');
    } else {
      next = [...bookmarks, { paragraphId, content }];
      showToast(lang === 'es' ? 'Marcador guardado' : 'Bookmark saved', 'success');
    }
    setBookmarks(next);
    db.saveBookBookmarks(book.id, next);
  }, [bookmarks, book.id, lang]);

  const handleBookmarkSelection = useCallback(() => {
    if (!selection) return;
    handleToggleBookmark(selection.paragraphId, selection.text);
    window.getSelection()?.removeAllRanges();
  }, [selection, handleToggleBookmark]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selectionObj = window.getSelection();
      if (!selectionObj || selectionObj.isCollapsed || !selectionObj.rangeCount) {
        setSelection(null);
        return;
      }
      
      const text = selectionObj.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }

      if (text.length <= 12) {
        setSelection(null);
        return;
      }

      const anchorP = selectionObj.anchorNode?.parentElement?.closest('[index]');
      const focusP = selectionObj.focusNode?.parentElement?.closest('[index]');
      if (!anchorP || !focusP || anchorP !== focusP) {
        setSelection(null);
        return;
      }

      const paragraphId = parseInt(anchorP.getAttribute('index') || '0', 10);
      const range = selectionObj.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelection({
        visible: true,
        rect: { x: rect.left + rect.width / 2, y: rect.top },
        paragraphId,
        text
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Reading Session Timer
  useEffect(() => {
    let interval: any = null;
    if (session.isActive && !session.isPaused) {
      interval = setInterval(() => {
        setSession(prev => {
          const nextTime = prev.readingTime + 1;
          const nextSpeed = nextTime > 0 ? Math.ceil((prev.charsRead * 3600) / nextTime) : 0;
          return {
            ...prev,
            readingTime: nextTime,
            speed: nextSpeed
          };
        });
        onIncrementReadingStats(book.id, 0, 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.isActive, session.isPaused, book.id, onIncrementReadingStats]);

  // Sync charsRead to reading session
  useEffect(() => {
    if (session.isActive && !session.isPaused) {
      const diff = Math.max(0, currentProgress.currChars - session.initialChars);
      setSession(prev => {
        const nextSpeed = prev.readingTime > 0 ? Math.ceil((diff * 3600) / prev.readingTime) : 0;
        const addedChars = diff - prev.charsRead;
        if (addedChars > 0) {
          onIncrementReadingStats(book.id, addedChars, 0);
        }
        return {
          ...prev,
          charsRead: diff,
          speed: nextSpeed
        };
      });
    }
  }, [currentProgress.currChars, session.isActive, session.isPaused, session.initialChars, book.id, onIncrementReadingStats]);

  const handleToggleSession = useCallback(() => {
    setSession(prev => {
      if (!prev.isActive) {
        return {
          isActive: true,
          isPaused: false,
          readingTime: 0,
          charsRead: 0,
          speed: 0,
          initialChars: currentProgress.currChars
        };
      } else {
        return {
          ...prev,
          isPaused: !prev.isPaused
        };
      }
    });
  }, [currentProgress.currChars]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const popup = document.querySelector('.dict-popup');
      if (popup && !popup.contains(e.target as Node)) {
        setSelectedWord(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const checkAnkiCardExists = async (word: string) => {
    setAnkiCardExists(false);
    if (!word) return;

    const savedV2 = localStorage.getItem('anki_settings_v2');
    const ankiSettingsV2 = savedV2 ? JSON.parse(savedV2) : null;
    let host = 'http://127.0.0.1:8765';
    let noteType = 'Lapis';
    let fieldsConfig = { Expression: '{expression}' };

    if (ankiSettingsV2) {
      host = ankiSettingsV2.host || host;
      const config = ankiSettingsV2.expression || {};
      noteType = config.noteType || noteType;
      if (config.fields && Object.keys(config.fields).length > 0) {
        fieldsConfig = config.fields;
      }
    } else {
      const saved = localStorage.getItem('anki_settings');
      if (saved) {
        const legacy = JSON.parse(saved);
        host = legacy.host || host;
        noteType = legacy.noteType || noteType;
        fieldsConfig = { [legacy.wordField || 'Expression']: '{expression}' };
      }
    }

    const expressionField = Object.keys(fieldsConfig).find(k => (fieldsConfig as any)[k] === '{expression}') || 'Expression';

    try {
      const res = await fetch(host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'findNotes',
          version: 6,
          params: {
            query: `note:"${noteType}" "${expressionField}:${word}"`
          }
        })
      });
      const data = await res.json();
      if (data && data.result && data.result.length > 0) {
        setAnkiCardExists(true);
      }
    } catch (e) {
      console.warn('Could not check card existence in Anki:', e);
    }
  };

  useEffect(() => {
    if (selectedWord) {
      checkAnkiCardExists(selectedWord.basicForm);
    } else {
      setAnkiCardExists(false);
    }
  }, [selectedWord]);

  const handleOpenInAnki = async () => {
    if (!selectedWord) return;

    const savedV2 = localStorage.getItem('anki_settings_v2');
    const ankiSettingsV2 = savedV2 ? JSON.parse(savedV2) : null;
    let host = 'http://127.0.0.1:8765';
    if (ankiSettingsV2) {
      host = ankiSettingsV2.host || host;
    } else {
      const saved = localStorage.getItem('anki_settings');
      if (saved) {
        host = JSON.parse(saved).host || host;
      }
    }

    try {
      await fetch(host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'guiBrowse',
          version: 6,
          params: {
            query: `"${selectedWord.basicForm}"`
          }
        })
      });
    } catch (e) {
      console.error('Error opening Anki browser:', e);
      showToast(lang === 'es' ? 'No se pudo conectar con Anki. Asegúrate de tener Anki abierto.' : 'Could not connect to Anki. Make sure Anki is open.', 'error');
    }
  };

  const handleMineToAnki = async () => {
    if (!selectedWord) return;

    const uploadMediaToAnki = async (host: string, filename: string, base64Data: string) => {
      try {
        const res = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'storeMediaFile',
            version: 6,
            params: { filename, data: base64Data }
          })
        });
        return await res.json();
      } catch (e) {
        console.error('Error uploading media:', e);
        return null;
      }
    };

    const uploadMediaUrlToAnki = async (host: string, filename: string, downloadUrl: string) => {
      try {
        const res = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'storeMediaFile',
            version: 6,
            params: { filename, url: downloadUrl }
          })
        });
        return await res.json();
      } catch (e) {
        console.error('Error downloading media:', e);
        return null;
      }
    };

    const getAnkiFurigana = (token: any, keepLeadingSpace = false) => {
      if (!token) return '';
      if (!token.alignment) return token.surface || '';
      
      let result = '';
      token.alignment.forEach((part: any) => {
        if (part.type === 'kanji') {
          result += ` ${part.text}[${part.ruby}]`;
        } else {
          result += part.text;
        }
      });
      return keepLeadingSpace ? result : result.trim();
    };

    const getSentenceAnkiFurigana = (sentenceTokens: any[]) => {
      return sentenceTokens.map(tok => {
        if (tok.isIndentSpace) return '　';
        if (tok.isParagraphBreak || tok.isLineBreak) return ' ';
        if (!tok.isWord) return tok.surface || '';
        return getAnkiFurigana(tok, true);
      }).join('');
    };

    const savedV2 = localStorage.getItem('anki_settings_v2');
    const ankiSettingsV2 = savedV2 ? JSON.parse(savedV2) : null;

    let host = 'http://127.0.0.1:8765';
    let deck = 'sentence mining';
    let noteType = 'Lapis';
    let rawTags = 'yomitan';
    let fieldsConfig = {
      Expression: '{expression}',
      ExpressionFurigana: '{furigana}',
      ExpressionReading: '{reading}',
      ExpressionAudio: '{audio}',
      SelectionText: '{popup-selection-text}',
      MainDefinition: '{meaning}',
      DefinitionPicture: '',
      Sentence: '{sentence}',
      SentenceFurigana: '{sentence-furigana}',
      SentenceAudio: '',
      Picture: '{screenshot}',
    };

    if (ankiSettingsV2) {
      host = ankiSettingsV2.host || host;
      rawTags = ankiSettingsV2.tags || rawTags;
      const config = ankiSettingsV2.expression || {};
      deck = config.deck || deck;
      noteType = config.noteType || noteType;
      if (config.fields && Object.keys(config.fields).length > 0) {
        fieldsConfig = config.fields;
      }
    } else {
      const saved = localStorage.getItem('anki_settings');
      if (saved) {
        const legacy = JSON.parse(saved);
        host = legacy.host || host;
        deck = legacy.deck || deck;
        noteType = legacy.noteType || noteType;
        rawTags = legacy.tags || rawTags;
        fieldsConfig = {
          [legacy.wordField || 'Expression']: '{expression}',
          [legacy.readingField || 'Reading']: '{reading}',
          [legacy.meaningField || 'Meaning']: '{meaning}',
          [legacy.sentenceField || 'Sentence']: '{sentence}'
        } as any;
      }
    }

    const sentenceText = selectedWord.sentenceText || selectedWord.surface;
    const sentenceTokens = await tokenizeText(sentenceText);
    const wordTokens = await tokenizeText(selectedWord.basicForm);
    const activeWordToken = wordTokens[0] || selectedWord;

    const meaning = dictEntry && dictEntry.definitions ? dictEntry.definitions.join('<br>') : '';
    
    const isBilingual = (defText: string) => {
      const SPA_DIACRITICS = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/u;
      const SPA_WORDS = /\b(de|del|el|la|los|las|en|un|una|unos|unas|con|por|para|que|es|son|su|sus|se|al|como|más|no|si|lo|le|les|muy|también|pero|cuando|este|esta|estos|estas|fue|ser|hay|ya|porque|aunque|donde|mientras|entre)\b/i;
      const ENG_WORDS = /\b(the|of|to|and|a|in|is|for|on|with|as|by|at|an|be|this|that|from|it|are|or|if|but|after|before|during|while|have|has|had|not|also|can|will|its|was|were|been|one|two|three|four|five|used|made|when|which|who|what|where|how)\b/i;
      return SPA_DIACRITICS.test(defText) || SPA_WORDS.test(defText) || ENG_WORDS.test(defText);
    };

    const allDefs = dictEntry && dictEntry.definitions ? dictEntry.definitions : [];
    const bilingualDefs = allDefs.filter((d: string) => isBilingual(d));
    const monolingualDefs = allDefs.filter((d: string) => !isBilingual(d));

    const meaningBilingual = bilingualDefs.join('<br>') || meaning;
    const monolingualPrimary = monolingualDefs[0] || '';
    const monolingualExtra = monolingualDefs.slice(1).join('<br>') || '';

    const wordFurigana = getAnkiFurigana(activeWordToken);
    const sentenceFurigana = getSentenceAnkiFurigana(sentenceTokens);

    const fieldsConfigValues = Object.values(fieldsConfig);
    const hasScreenshot = fieldsConfigValues.includes('{screenshot}');
    const hasAudio = fieldsConfigValues.includes('{audio}');
    const hasSentenceAudio = fieldsConfigValues.includes('{sentence-audio}');

    let screenshotHTML = '';
    if (hasScreenshot && containerRef.current) {
      try {
        const popup = document.querySelector('.dict-popup') as HTMLElement;
        if (popup) popup.style.setProperty('display', 'none', 'important');
        await new Promise(r => setTimeout(r, 80));
        
        const bgColor = window.getComputedStyle(containerRef.current).backgroundColor;
        const canvas = await html2canvas(containerRef.current, {
          backgroundColor: bgColor || '#0d0d0f',
          logging: false,
          useCORS: true
        });
        
        if (popup) popup.style.display = '';
        
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        const filename = `yoru_snap_${Date.now()}.png`;
        await uploadMediaToAnki(host, filename, base64);
        screenshotHTML = `<img src="${filename}">`;
      } catch (e) {
        console.error('Screenshot generation failed:', e);
      }
    }

    let audioHTML = '';
    if (hasAudio) {
      try {
        const filename = `yoru_audio_${Date.now()}.mp3`;
        const downloadUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(selectedWord.basicForm || selectedWord.surface)}`;
        await uploadMediaUrlToAnki(host, filename, downloadUrl);
        audioHTML = `[sound:${filename}]`;
      } catch (e) {
        console.error('Audio generation failed:', e);
      }
    }

    let sentenceAudioHTML = '';
    if (hasSentenceAudio) {
      try {
        const filename = `yoru_sentence_audio_${Date.now()}.mp3`;
        const downloadUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(sentenceText)}`;
        await uploadMediaUrlToAnki(host, filename, downloadUrl);
        sentenceAudioHTML = `[sound:${filename}]`;
      } catch (e) {
        console.error('Sentence audio generation failed:', e);
      }
    }

    const fields: Record<string, string> = {};
    for (const [fieldName, tokenTemplate] of Object.entries(fieldsConfig)) {
      if (!tokenTemplate) {
        fields[fieldName] = '';
        continue;
      }
      
      let pitchPositions = '';
      let pitchCategories = '';
      let pitchGraphs = '';
      if (dictEntry && dictEntry.pitches && dictEntry.pitches.length > 0) {
        pitchPositions = dictEntry.pitches
          .flatMap((pEntry: any) => pEntry.pitches.map((p: any) => p.position))
          .join(', ');
          
        const getPitchCategoryName = (pos: number, r: string) => {
          const morae = (r || '').match(/[ぁ-んァ-ン][ゃゅょャュョ]*/g) || [];
          const count = morae.length;
          if (pos === 0) return '平板';
          if (pos === 1) return '頭高';
          if (pos > 1) {
            if (pos === count) return '尾高';
            return '中高';
          }
          return '';
        };

        const getPitchGraphHTML = (r: string, pos: number) => {
          const morae = (r || '').match(/[ぁ-んァ-ン][ゃゅょャュョ]*/g) || [];
          if (morae.length === 0) return r || '';
          
          let html = '<span style="display: inline-flex; padding: 2px 0; font-family: monospace;">';
          morae.forEach((mora, idx) => {
            const m = idx + 1;
            let isHigh = false;
            let hasDrop = false;

            if (pos === 0) {
              isHigh = m > 1;
            } else if (pos === 1) {
              isHigh = m === 1;
              hasDrop = m === 1;
            } else if (pos > 1) {
              isHigh = m >= 2 && m <= pos;
              hasDrop = m === pos;
            }

            const borderTop = isHigh ? '1px solid currentColor' : '1px solid transparent';
            const borderRight = hasDrop ? '1px solid currentColor' : '1px solid transparent';
            const paddingRight = hasDrop ? '1px' : '0px';

            html += `<span style="border-top: ${borderTop}; border-right: ${borderRight}; padding-right: ${paddingRight}; line-height: 1.2; display: inline-block;">${mora}</span>`;
          });
          html += '</span>';
          return html;
        };
        
        pitchCategories = dictEntry.pitches
          .flatMap((pEntry: any) => pEntry.pitches.map((p: any) => getPitchCategoryName(p.position, pEntry.reading || selectedWord.reading)))
          .filter(Boolean)
          .join(', ');

        pitchGraphs = dictEntry.pitches
          .flatMap((pEntry: any) => pEntry.pitches.map((p: any) => getPitchGraphHTML(pEntry.reading || selectedWord.reading || selectedWord.surface, p.position)))
          .join('<br>');
      }

      let frequencyRank = '';
      let frequenciesDetails = '';
      if (dictEntry && dictEntry.frequencies && dictEntry.frequencies.length > 0) {
        const uniqueFreqs = getUniqueFrequencies(dictEntry.frequencies);
        frequencyRank = uniqueFreqs.map(f => f.displayValue || String(f.value)).join(', ');
        frequenciesDetails = uniqueFreqs.map(f => `${f.dictionary}: ${f.displayValue || f.value}`).join(', ');
      }

      let clozePrefix = '';
      let clozeBody = selectedWord.surface || '';
      let clozeBodyKana = selectedWord.reading || '';
      let clozeSuffix = '';
      
      const parts = sentenceText.split(selectedWord.surface);
      clozePrefix = parts[0] || '';
      clozeSuffix = parts.slice(1).join(selectedWord.surface);
      const sentenceClozeHTML = `${clozePrefix}{{c1::${clozeBody}}}${clozeSuffix}`;

      const furiganaPlain = getAnkiFurigana(activeWordToken, false);
      const sentenceFuriganaPlain = sentenceTokens.map(tok => {
        if (tok.isIndentSpace) return '　';
        if (tok.isParagraphBreak || tok.isLineBreak) return ' ';
        if (!tok.isWord) return tok.surface || '';
        return getAnkiFurigana(tok, false);
      }).join('');

      const glossary = meaning;
      const glossaryFirst = dictEntry && dictEntry.definitions && dictEntry.definitions[0] ? dictEntry.definitions[0] : '';
      const glossaryBrief = glossaryFirst;
      const glossaryFirstBrief = glossaryFirst;
      const glossaryNoDict = meaning; 
      const glossaryPlain = meaning.replace(/<[^>]*>/g, '');
      const glossaryPlainNoDict = glossaryPlain;

      const partOfSpeechVal = dictEntry && dictEntry.partsOfSpeech ? dictEntry.partsOfSpeech.join(', ') : '';

      let pitchAccentsVal = '';
      if (dictEntry && dictEntry.pitches && dictEntry.pitches.length > 0) {
        pitchAccentsVal = dictEntry.pitches
          .flatMap((pEntry: any) => pEntry.pitches.map((p: any) => `${pEntry.reading || selectedWord.reading || ''}: [${p.position}]`))
          .join(', ');
      }

      let singleFreqBccwj = '';
      let singleFreqJpdb = '';
      let singleFreqJiten = '';
      let singleFreqVn = '';
      if (dictEntry && dictEntry.frequencies) {
        dictEntry.frequencies.forEach((f: any) => {
          const dictName = (f.dictionary || '').toLowerCase();
          const valStr = String(f.value);
          if (dictName.includes('bccwj')) singleFreqBccwj = valStr;
          else if (dictName.includes('jpdb')) singleFreqJpdb = valStr;
          else if (dictName.includes('jiten') || dictName.includes('anime')) singleFreqJiten = valStr;
          else if (dictName.includes('vn') || dictName.includes('novel')) singleFreqVn = valStr;
        });
      }

      const documentTitleVal = book.title || book.filename || '';
      const docUrlVal = `yoru://book/${book.id || 'local'}`;

      let val = tokenTemplate
        .replaceAll('{expression}', selectedWord.basicForm || selectedWord.surface)
        .replaceAll('{furigana}', wordFurigana)
        .replaceAll('{furigana-plain}', furiganaPlain)
        .replaceAll('{reading}', selectedWord.reading || '')
        .replaceAll('{audio}', audioHTML)
        .replaceAll('{popup-selection-text}', selectedWord.surface)
        .replaceAll('{sentence}', sentenceText)
        .replaceAll('{sentence-furigana}', sentenceFurigana)
        .replaceAll('{sentence-furigana-plain}', sentenceFuriganaPlain)
        .replaceAll('{sentence-audio}', sentenceAudioHTML)
        .replaceAll('{sentence-cloze}', sentenceClozeHTML)
        .replaceAll('{screenshot}', screenshotHTML)
        .replaceAll('{meaning}', meaning)
        .replaceAll('{glossary}', glossary)
        .replaceAll('{glossary-brief}', glossaryBrief)
        .replaceAll('{glossary-first}', glossaryFirst)
        .replaceAll('{glossary-first-brief}', glossaryFirstBrief)
        .replaceAll('{glossary-no-dictionary}', glossaryNoDict)
        .replaceAll('{glossary-plain}', glossaryPlain)
        .replaceAll('{glossary-plain-no-dictionary}', glossaryPlainNoDict)
        .replaceAll('{tags}', rawTags)
        .replaceAll('{pitch-accent-positions}', pitchPositions)
        .replaceAll('{pitch-accent-categories}', pitchCategories)
        .replaceAll('{pitch-accent-graphs}', pitchGraphs)
        .replaceAll('{pitch-accent-graphs-jj}', pitchGraphs)
        .replaceAll('{pitch-accents}', pitchAccentsVal)
        .replaceAll('{frequency-harmonic-rank}', frequencyRank)
        .replaceAll('{frequencies}', frequenciesDetails)
        .replaceAll('{single-frequency-number-bccwj}', singleFreqBccwj)
        .replaceAll('{single-frequency-number-jiten-anime}', singleFreqJiten)
        .replaceAll('{single-frequency-number-jpdb}', singleFreqJpdb)
        .replaceAll('{single-frequency-number-vn-freq}', singleFreqVn)
        .replaceAll('{cloze-prefix}', clozePrefix)
        .replaceAll('{cloze-body}', clozeBody)
        .replaceAll('{cloze-body-kana}', clozeBodyKana)
        .replaceAll('{cloze-suffix}', clozeSuffix)
        .replaceAll('{document-title}', documentTitleVal)
        .replaceAll('{search-query}', selectedWord.basicForm || selectedWord.surface)
        .replaceAll('{part-of-speech}', partOfSpeechVal)
        .replaceAll('{bilingual}', meaningBilingual)
        .replaceAll('{monolingual-primary}', monolingualPrimary)
        .replaceAll('{monolingual-extra}', monolingualExtra)
        .replaceAll('{clipboard-text}', selectedWord.surface)
        .replaceAll('{clipboard-image}', screenshotHTML)
        .replaceAll('{single-glossary-jmdict-spanish-2026-06-10}', glossary)
        .replaceAll('{url}', docUrlVal)
        .replaceAll('{url-plain}', docUrlVal);
      fields[fieldName] = val;
    }

    const tagsList = rawTags.split(/[\s,]+/).filter(t => t.trim().length > 0);
    if (!tagsList.includes('yoru_reader')) {
      tagsList.push('yoru_reader');
    }

    const note = {
      deckName: deck,
      modelName: noteType,
      fields: fields,
      options: { allowDuplicate: true, duplicateScope: "deck" },
      tags: tagsList
    };

    try {
      const response = await fetch(host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addNote', version: 6, params: { note } })
      });
      const result = await response.json();
      if (result.error) {
        showToast('Anki error: ' + result.error, 'error');
      } else {
        if (selectedWord && selectedWord.basicForm) {
          onSetWordStatus(selectedWord.basicForm, 'learning');
        }
        setAnkiCardExists(true);
        showToast(lang === 'es' ? '¡Tarjeta de Anki creada con éxito! La palabra fue marcada como "Estudiando".' : 'Anki card created successfully! The word was marked as "Learning".', 'success');
      }
    } catch (e) {
      showToast(lang === 'es' ? 'Error de conexión con AnkiConnect. Asegúrate de tener Anki abierto.' : 'Connection error with AnkiConnect. Make sure Anki is open.', 'error');
    }
  };

  const reproducirTexto = async (texto: string, vozSeleccionada?: string) => {
    if (!texto || !texto.trim()) return;

    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      clearInterval(ttsKeepAliveRef.current);
    }

    setIsTtsPlaying(true);

    const vozId = vozSeleccionada || settings.audioVoiceOption || 'Nanami';
    const speed = parseFloat(settings.audioSpeed || '1.0');

    if (window.electronAPI && window.electronAPI.speakText) {
      try {
        const azureVoiceName = 
          vozId === 'Mayu' ? 'ja-JP-MayuNeural' : 
          vozId === 'Keita' ? 'ja-JP-KeitaNeural' : 
          'ja-JP-NanamiNeural';

        const audioBuffer = await window.electronAPI.speakText({
          text: texto,
          voice: azureVoiceName,
          rate: speed
        });

        if (audioBuffer) {
          const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          ttsAudioRef.current = audio;
          audio.onended = () => { setIsTtsPlaying(false); ttsAudioRef.current = null; };
          audio.onerror = () => { setIsTtsPlaying(false); ttsAudioRef.current = null; };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Edge TTS failed, falling back:', err);
      }
    }

    if (settings.azureApiKey && settings.azureApiKey.trim()) {
      try {
        const azureVoiceName = 
          vozId === 'Mayu' ? 'ja-JP-MayuNeural' : 
          vozId === 'Keita' ? 'ja-JP-KeitaNeural' : 
          'ja-JP-NanamiNeural';

        const audioUrl = await synthesizeSpeechAzure(
          texto,
          azureVoiceName,
          settings.azureApiKey,
          settings.azureRegion || 'eastus',
          speed
        );

        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;
        audio.onended = () => { setIsTtsPlaying(false); ttsAudioRef.current = null; };
        audio.onerror = () => { setIsTtsPlaying(false); ttsAudioRef.current = null; };
        await audio.play();
        return;
      } catch (err) {
        console.warn('Azure TTS failed, falling back:', err);
      }
    }

    if ('speechSynthesis' in window) {
      const getVoicesAsync = () => new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) return resolve(voices);
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          resolve(window.speechSynthesis.getVoices());
        }, { once: true });
        setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
      });

      const voices = await getVoicesAsync();
      let matchedVoice: SpeechSynthesisVoice | null = null;

      const keyword = vozId.toLowerCase();
      matchedVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        return v.lang.startsWith('ja') && (name.includes(keyword) || name.includes('online') || name.includes('natural'));
      }) || null;

      if (!matchedVoice) {
        matchedVoice = voices.find(v => v.lang.startsWith('ja')) || null;
      }

      if (!matchedVoice) {
        try {
          const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(texto)}`;
          const audio = new Audio(googleTtsUrl);
          ttsAudioRef.current = audio;
          audio.playbackRate = Math.min(4, Math.max(0.25, speed));
          audio.onended = () => { setIsTtsPlaying(false); ttsAudioRef.current = null; };
          audio.onerror = () => { setIsTtsPlaying(false); ttsAudioRef.current = null; };
          await audio.play();
          return;
        } catch (e) {
          console.error('Google Translate TTS fallback failed:', e);
        }
      }

      if (matchedVoice) {
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'ja-JP';
        utterance.rate = speed;
        utterance.voice = matchedVoice;

        if (vozId === 'Keita' && matchedVoice && !matchedVoice.name.toLowerCase().includes('keita') && !matchedVoice.name.toLowerCase().includes('male')) {
          utterance.pitch = 0.72;
        } else {
          utterance.pitch = 1.0;
        }

        utterance.onstart = () => setIsTtsPlaying(true);
        utterance.onend = () => { setIsTtsPlaying(false); clearInterval(ttsKeepAliveRef.current); };
        utterance.onerror = () => { setIsTtsPlaying(false); clearInterval(ttsKeepAliveRef.current); };

        clearInterval(ttsKeepAliveRef.current);
        ttsKeepAliveRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            clearInterval(ttsKeepAliveRef.current);
          }
        }, 10000);

        window.speechSynthesis.speak(utterance);
      } else {
        setIsTtsPlaying(false);
      }
    } else {
      setIsTtsPlaying(false);
    }
  };

  const calculateSrsIntervals = (card: any) => {
    const c = card || { interval: 0, ease: 2.5, repetitions: 0, lapses: 0, state: 0 };
    const rep = c.repetitions || 0;
    const ease = c.ease || 2.5;
    const interval = c.interval || 0;
    
    let intervalHard = 1;
    if (rep > 0) {
      intervalHard = Math.ceil(interval * 1.2);
    }
    
    let intervalGood = 1;
    if (rep === 0) {
      intervalGood = 1;
    } else if (rep === 1) {
      intervalGood = 4; 
    } else {
      intervalGood = Math.ceil(interval * ease);
    }
    
    let intervalEasy = 1;
    if (rep === 0) {
      intervalEasy = 4;
    } else if (rep === 1) {
      intervalEasy = 8;
    } else {
      intervalEasy = Math.ceil(interval * ease * 1.3);
    }
    
    return {
      again: '10m',
      hard: intervalHard >= 1 ? `${intervalHard}d` : '12h',
      good: `${intervalGood}d`,
      easy: `${intervalEasy}d`,
      calculatedDays: {
        again: 0,
        hard: intervalHard,
        good: intervalGood,
        easy: intervalEasy
      }
    };
  };

  const handleSrsReview = (word: string, grade: number) => {
    const currentCard = db.getSrsCard(word) || { interval: 0, ease: 2.5, repetitions: 0, lapses: 0, state: 0 };
    const intervals = calculateSrsIntervals(currentCard);
    const now = new Date();
    
    let newRep = currentCard.repetitions || 0;
    let newEase = currentCard.ease || 2.5;
    let newInterval = 0;
    let newState = currentCard.state || 0;
    let newLapses = currentCard.lapses || 0;
    
    if (grade === 1) {
      newRep = 0;
      newInterval = 0;
      newEase = Math.max(1.3, newEase - 0.2);
      newState = 3; 
      newLapses += 1;
    } else {
      newInterval = (intervals.calculatedDays as any)[
        grade === 2 ? 'hard' : grade === 3 ? 'good' : 'easy'
      ];
      if (grade === 2) {
        newEase = Math.max(1.3, newEase - 0.15);
      } else if (grade === 4) {
        newEase = Math.min(3.0, newEase + 0.15);
      }
      newRep += 1;
      newState = 2; 
    }
    
    const dueDate = new Date();
    if (newInterval > 0) {
      dueDate.setDate(dueDate.getDate() + newInterval);
    } else {
      dueDate.setMinutes(dueDate.getMinutes() + 10);
    }
    
    const updatedCard = {
      interval: newInterval,
      ease: newEase,
      repetitions: newRep,
      dueDate: dueDate.toISOString(),
      lastReview: now.toISOString(),
      lapses: newLapses,
      state: newState
    };
    
    db.saveSrsCard(word, updatedCard);
    setSrsCard(updatedCard);
    
    if (wordStatuses[word] !== 'learning') {
      onSetWordStatus(word, 'learning');
    }
    
    const gradeName = grade === 1 ? 'Again' : grade === 2 ? 'Hard' : grade === 3 ? 'Good' : 'Easy';
    const nextText = grade === 1 ? '10m' : `${newInterval}d`;
    showToast(`SRS: ${gradeName} (${nextText})`, 'success');
  };

  const colors = useMemo(() => {
    const themeName = readerSettings.theme || 'dark';
    return {
      light: {
        bg: '#ffffff',
        headerBg: '#ffffff',
        border: 'rgba(0, 0, 0, 0.08)',
        textMain: '#000000',
        textMuted: '#8e8e93',
        cardBg: '#f6f6f6',
        accent: '#5c35db',
        popoverBg: '#ffffff',
      },
      sepia: {
        bg: '#fcfaf2',
        headerBg: '#fcfaf2',
        border: 'rgba(92, 75, 55, 0.15)',
        textMain: '#5c4b37',
        textMuted: 'rgba(92, 75, 55, 0.65)',
        cardBg: '#f4eedb',
        accent: '#8b5a2b',
        popoverBg: '#fcfaf2',
      },
      dark: {
        bg: '#08080a',
        headerBg: '#08080a',
        border: 'rgba(255, 255, 255, 0.12)',
        textMain: '#ffffff',
        textMuted: 'rgba(255, 255, 255, 0.45)',
        cardBg: 'rgba(255, 255, 255, 0.05)',
        accent: '#FFE000',
        popoverBg: '#050507',
      }
    }[themeName as 'light' | 'sepia' | 'dark'] || {
      bg: themeName === 'custom' ? (localStorage.getItem('reader:customBg') || '#08080a') : '#08080a',
      headerBg: themeName === 'custom' ? (localStorage.getItem('reader:customBg') || '#08080a') : '#08080a',
      border: 'rgba(255, 255, 255, 0.12)',
      textMain: themeName === 'custom' ? (localStorage.getItem('reader:customText') || '#ffffff') : '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.45)',
      cardBg: 'rgba(255, 255, 255, 0.05)',
      accent: '#FFE000',
      popoverBg: '#050507',
    };
  }, [readerSettings.theme]);

  const handleCharsUpdate = useCallback((payload: any) => {
    setCurrentProgress(payload);
    const percentage = payload.totalChars > 0 ? Math.min(100, Math.floor((payload.currChars / payload.totalChars) * 100)) : 0;
    onUpdateProgress(book.id, payload.currSection, payload.lastIndex, percentage);
  }, [book.id, onUpdateProgress]);

  const handleNavbarMouseLeave = useCallback(() => {
    if (!sidebarMode && !showSettingsPopover && !isJumpModalOpen && !isGalleryOpen) {
      setIsHeaderVisible(false);
    }
  }, [sidebarMode, showSettingsPopover, isJumpModalOpen, isGalleryOpen]);

  const handleEngineClick = useCallback(() => {
    setIsHeaderVisible(prev => !prev);
  }, []);

  return (
    <div 
      ref={containerRef}
      data-theme={readerSettings.theme || 'dark'}
      style={{
        width: '100%',
        height: '100vh',
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Top hover trigger zone to show navbar */}
      {!isHeaderVisible && (
        <div 
          onMouseEnter={() => setIsHeaderVisible(true)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '24px',
            zIndex: 9997,
            background: 'transparent',
          }}
        />
      )}

      <ReaderNavbar
        visible={isHeaderVisible}
        onClose={() => setIsHeaderVisible(false)}
        onBack={handleBack}
        onToggleToc={() => setSidebarMode('toc')}
        onToggleBookmarks={() => setSidebarMode('bookmarks')}
        onToggleSession={() => setSidebarMode('session')}
        onToggleSettings={() => setShowSettingsPopover(prev => !prev)}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={!!document.fullscreenElement}
        bookTitle={book?.title || ''}
        colors={colors}
        lang={lang}
        isBookCompleted={book.status === 'completed'}
        onToggleFlagCompleted={handleToggleCompleted}
        onOpenGallery={() => {
          if (bookImages.length === 0) {
            showToast(lang === 'es' ? 'Esta novela no contiene imágenes' : 'This novel contains no images', 'warning');
            return;
          }
          setGalleryIndex(0);
          setIsGalleryOpen(true);
        }}
        onOpenJumpModal={() => {
          setJumpPosition(currentProgress.currChars);
          setIsJumpModalOpen(true);
        }}
        onMouseLeave={handleNavbarMouseLeave}
      />

      {isHeaderVisible && showSettingsPopover && (
        <ReaderSettingsPopover
          settings={readerSettings}
          onSettingChange={setReaderSetting}
          onClose={() => setShowSettingsPopover(false)}
          onOpenFullSettings={() => {
            setShowSettingsPopover(false);
            setSidebarMode('settings');
          }}
          onOpenExtensionSettings={handleOpenExtensionSettings}
          lang={lang}
        />
      )}

      <ReaderEngine
        book={book}
        readerSettings={readerSettings}
        targetSection={navTargetSection}
        targetParagraphId={navTargetParagraphId}
        targetCharPosition={targetCharPosition}
        onCharsUpdate={handleCharsUpdate}
        onClick={handleEngineClick}
        colors={colors}
      />

      {/* Jump to Position Modal */}
      {isJumpModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 10020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: colors.popoverBg || '#0c0c0e',
            border: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`,
            borderRadius: '12px',
            padding: '24px',
            width: '320px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            color: colors.textMain,
            fontFamily: 'var(--font-ui), sans-serif',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>
              {lang === 'es' ? 'Ir a Posición' : 'Jump to Position'}
            </h3>
            <input
              type="number"
              value={jumpPosition}
              onChange={(e) => setJumpPosition(Number(e.target.value))}
              min={0}
              max={currentProgress.totalChars}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px',
                color: '#fff',
                fontSize: '1rem',
                marginBottom: '20px',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmJump();
                else if (e.key === 'Escape') setIsJumpModalOpen(false);
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setIsJumpModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  padding: '8px 16px',
                }}
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmJump}
                style={{
                  background: '#FFE000',
                  border: 'none',
                  color: '#000',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  padding: '8px 16px',
                }}
              >
                {lang === 'es' ? 'Confirmar' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Viewer Modal */}
      {isGalleryOpen && bookImages.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#08080a',
          zIndex: 10030,
          display: 'flex',
          color: '#fff',
          fontFamily: 'var(--font-ui), sans-serif',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <style>{`
            .gallery-sidebar::-webkit-scrollbar {
              width: 6px;
            }
            .gallery-sidebar::-webkit-scrollbar-track {
              background: transparent;
            }
            .gallery-sidebar::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.15);
              border-radius: 3px;
            }
            .gallery-sidebar::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.3);
            }
          `}</style>

          {/* Close button */}
          <button
            onClick={() => setIsGalleryOpen(false)}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              zIndex: 10035,
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>

          {/* Thumbnails Sidebar (Left) */}
          <div 
            className="gallery-sidebar"
            style={{
              width: '210px',
              background: '#0d0d0f',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '80px 16px 20px 16px',
              gap: '16px',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            {bookImages.map((src, idx) => (
              <div
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                style={{
                  cursor: 'pointer',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: galleryIndex === idx ? '2px solid #FFE000' : '2px solid transparent',
                  transition: 'border-color 0.15s',
                  background: '#131316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  aspectRatio: '3/4',
                  width: '100%',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={src}
                  alt={`Thumbnail ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Main View Area (Center/Right) */}
          <div style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 40px',
          }}>
            {/* Prev Arrow */}
            {galleryIndex > 0 && (
              <button
                onClick={() => setGalleryIndex(prev => prev - 1)}
                style={{
                  position: 'absolute',
                  left: '20px',
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '16px 12px',
                  borderRadius: '8px',
                  zIndex: 10032,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
            )}

            {/* Main Image */}
            <div style={{
              maxWidth: '95%',
              maxHeight: '92vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#000',
            }}>
              <img
                src={bookImages[galleryIndex]}
                alt={`Image ${galleryIndex + 1}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '92vh',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Next Arrow */}
            {galleryIndex < bookImages.length - 1 && (
              <button
                onClick={() => setGalleryIndex(prev => prev + 1)}
                style={{
                  position: 'absolute',
                  right: '20px',
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '16px 12px',
                  borderRadius: '8px',
                  zIndex: 10032,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            )}

            {/* Index Counter (Bottom) */}
            <div style={{
              marginTop: '12px',
              fontSize: '1rem',
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.6)',
              padding: '6px 16px',
              borderRadius: '20px',
              userSelect: 'none',
            }}>
              {galleryIndex + 1} / {bookImages.length}
            </div>
          </div>
        </div>
      )}

      {isExtSettingsOpen && extId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 10020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: colors.bg || '#0c0c0e',
            border: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`,
            borderRadius: '16px',
            width: '90%',
            maxWidth: '960px',
            height: '80%',
            maxHeight: '720px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`,
              background: colors.popoverBg || 'rgba(255,255,255,0.02)',
            }}>
              <h3 style={{ margin: 0, color: colors.textMain, fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-ui), sans-serif' }}>
                {lang === 'es' ? 'Ajustes de Parseo' : 'Parser Settings'}
              </h3>
              <button
                onClick={() => setIsExtSettingsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>
            {/* Modal Body (Iframe) */}
            <iframe
              src={`chrome-extension://${extId}/views/settings.html?theme=${readerSettings.theme}`}
              style={{
                flex: 1,
                border: 'none',
                width: '100%',
                height: '100%',
                background: 'transparent',
              }}
            />
          </div>
        </div>
      )}

      <CharacterCounter
        currChars={currentProgress.currChars}
        totalChars={currentProgress.totalChars}
        colors={colors}
      />

      {selection && selection.visible && (
        <SelectionToolbar
          visible={selection.visible}
          position={selection.rect}
          selectedText={selection.text}
          onCopy={handleCopyText}
          onBookmark={handleBookmarkSelection}
          colors={colors}
          lang={lang}
        />
      )}

      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(12, 12, 14, 0.95)',
          border: toast.type === 'error' ? '1px solid #ef4444' : `1px solid ${colors.accent}66`,
          color: '#fff',
          padding: '8px 18px',
          borderRadius: '20px',
          zIndex: 100000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          fontSize: '0.82rem',
          fontWeight: 600,
          backdropFilter: 'blur(16px)',
          letterSpacing: '0.02em',
        }}>
          {toast.message}
        </div>
      )}

      {sidebarMode === 'settings' ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: colors.bg || '#121214',
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: `1px solid ${colors.border || 'rgba(255,255,255,0.08)'}`,
            background: colors.popoverBg || '#1c1c1e',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setSidebarMode(null)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.accent || '#FFE000',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ← {lang === 'es' ? 'Volver al Lector' : 'Back to Reader'}
            </button>
            <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: colors.textMain || '#fff' }}>
              {lang === 'es' ? 'Ajustes del Lector' : 'Reader Settings'}
            </span>
            <div style={{ width: '80px' }} /> {/* Spacer */}
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 16px 40px 16px',
              display: 'flex',
              justifyContent: 'center',
              background: colors.bg || '#08080a',
            }}
          >
            <div style={{ width: '100%', maxWidth: '560px' }}>
              <ReaderSettings
                settings={readerSettings}
                onSettingChange={setReaderSetting}
                onOpenExtensionSettings={handleOpenExtensionSettings}
                colors={colors}
                lang={lang}
              />
            </div>
          </div>
        </div>
      ) : (
        <ReaderSidebar
          mode={sidebarMode}
          onClose={() => setSidebarMode(null)}
          sections={book.chapters.map((ch: any, idx: number) => ({ id: `chapter-${idx}`, title: ch.title, isFromToc: ch.isFromToc }))}
          currSection={currentProgress.currSection}
          onGoToSection={(idx: number) => {
            setNavTargetSection(idx);
            requestAnimationFrame(() => setNavTargetSection(null));
          }}
          bookmarks={bookmarks}
          onGoToBookmark={(bm: any) => {
            setNavTargetParagraphId(bm.paragraphId);
            requestAnimationFrame(() => setNavTargetParagraphId(null));
          }}
          readingSession={session}
          onToggleSession={handleToggleSession}
          colors={colors}
          lang={lang}
        />
      )}

      {selectedWord && (
        <div 
          className="dict-popup"
          style={{ 
            position: 'fixed',
            left: `${popupPos.x}px`, 
            top: `${popupPos.y}px`,
            zIndex: 99999,
            transform: popupPos.anchorBottom ? 'translateY(-100%)' : 'none',
            maxHeight: popupPos.anchorBottom 
              ? `${popupPos.y - 20}px` 
              : `${window.innerHeight - popupPos.y - 20}px`,
            width: '320px',
            background: colors.popoverBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            writingMode: 'horizontal-tb',
            WebkitWritingMode: 'horizontal-tb',
            textOrientation: 'mixed',
            direction: 'ltr',
            textAlign: 'left'
          }}
        >
          {(() => {
            const wordStatus = wordStatuses[selectedWord.basicForm] || 'new';
            const isLearning = wordStatus === 'learning';
            const isKnown = wordStatus === 'known';
            const isIgnored = wordStatus === 'ignored';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isKnown) {
                        onSetWordStatus(selectedWord.basicForm, 'new');
                      } else {
                        const wordData = {
                          reading: selectedWord.reading || selectedWord.surface,
                          meaning: dictEntry?.definitions?.slice(0, 3).join(' / ') || ''
                        };
                        onSetWordStatus(selectedWord.basicForm, 'known', wordData);
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: isKnown ? 'rgba(74, 117, 36, 0.22)' : 'rgba(255,255,255,0.02)',
                      border: isKnown ? '1.5px solid rgba(74, 117, 36, 0.7)' : '1px solid rgba(255,255,255,0.1)',
                      color: isKnown ? '#a3e635' : '#84cc16',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {lang === 'es' ? 'Nunca olvidar' : 'Never forget'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isIgnored) {
                        onSetWordStatus(selectedWord.basicForm, 'new');
                      } else {
                        onSetWordStatus(selectedWord.basicForm, 'ignored');
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: isIgnored ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                      border: isIgnored ? '1.5px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                      color: isIgnored ? '#fff' : '#a1a1aa',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Blacklist
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isLearning) {
                        onSetWordStatus(selectedWord.basicForm, 'new');
                      } else {
                        onSetWordStatus(selectedWord.basicForm, 'learning');
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: isLearning ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: isLearning ? '1.5px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                      color: isLearning ? '#60a5fa' : '#3b82f6',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isLearning ? 'Deck -' : 'Deck +'}
                  </button>
                </div>

                {isLearning && (() => {
                  const intervals = calculateSrsIntervals(srsCard);
                  return (
                    <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleSrsReview(selectedWord.basicForm, 1)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          background: 'rgba(239, 68, 68, 0.06)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        again <span style={{ opacity: 0.55, fontSize: '0.6rem' }}>({intervals.again})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSrsReview(selectedWord.basicForm, 2)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          background: 'rgba(249, 115, 22, 0.06)',
                          border: '1px solid rgba(249, 115, 22, 0.25)',
                          color: '#fb923c',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        hard <span style={{ opacity: 0.55, fontSize: '0.6rem' }}>({intervals.hard})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSrsReview(selectedWord.basicForm, 3)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          background: 'rgba(168, 85, 247, 0.06)',
                          border: '1px solid rgba(168, 85, 247, 0.25)',
                          color: '#c084fc',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        good <span style={{ opacity: 0.55, fontSize: '0.6rem' }}>({intervals.good})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSrsReview(selectedWord.basicForm, 4)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          background: 'rgba(34, 197, 94, 0.06)',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                          color: '#4ade80',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        easy <span style={{ opacity: 0.55, fontSize: '0.6rem' }}>({intervals.easy})</span>
                      </button>
                    </div>
                  );
                })()}

                {srsCard && (
                  <div style={{
                    fontSize: '0.68rem',
                    color: colors.textMuted,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    padding: '3px 6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '2px'
                  }}>
                    <span>Intervalo: {srsCard.interval}d</span>
                    <span>Ease: {srsCard.ease.toFixed(2)}</span>
                    <span>Reps: {srsCard.repetitions}</span>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: colors.textMain }}>
              {selectedWord.surface}
            </span>
            {selectedWord.reading && selectedWord.reading !== selectedWord.surface && (
              <span style={{ fontSize: '0.9rem', color: colors.textMuted }}>
                {selectedWord.reading}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {ankiCardExists ? (
              <button 
                onClick={handleOpenInAnki}
                style={{
                  flex: 1,
                  background: 'rgba(92, 53, 219, 0.2)',
                  border: '1px solid rgba(92, 53, 219, 0.5)',
                  color: '#a78bfa',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <ExternalLink size={12} />
                {lang === 'es' ? 'Ver en Anki' : 'View in Anki'}
              </button>
            ) : (
              <button 
                onClick={handleMineToAnki}
                style={{
                  flex: 1,
                  background: 'rgba(255, 224, 0, 0.1)',
                  border: '1px solid rgba(255, 224, 0, 0.3)',
                  color: '#FFE000',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={12} />
                {lang === 'es' ? 'Añadir a Anki' : 'Add to Anki'}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!dictLoading ? (
              dictEntry && dictEntry.definitions && dictEntry.definitions.length > 0 ? (
                dictEntry.definitions.map((def: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: '8px', fontSize: '0.85rem', lineHeight: '1.4', color: colors.textMain }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ 
                        fontSize: '0.68rem', 
                        background: 'rgba(255, 224, 0, 0.1)', 
                        color: '#FFE000', 
                        padding: '1px 5px', 
                        borderRadius: '3px',
                        fontWeight: 600
                      }}>
                        {def.dictionary || 'Glosario'}
                      </span>
                      {def.partsOfSpeech && def.partsOfSpeech.map((pos: string, pIdx: number) => (
                        <span key={pIdx} style={{ fontSize: '0.62rem', color: colors.textMuted, fontStyle: 'italic' }}>
                          {pos}
                        </span>
                      ))}
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: def.glossary }} />
                  </div>
                ))
              ) : (
                <p style={{ color: colors.textMuted, fontSize: '0.82rem' }}>
                  {t('dictNoDefinitions', lang)}
                </p>
              )
            ) : (
              <p style={{ color: colors.textMuted }}>{t('dictLoading', lang)}</p>
            )}
          </div>
        </div>
      )}

      {/* Thin bottom progress line */}
      {readerSettings.showProgressLine && currentProgress.totalChars > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            height: '3px',
            width: `${Math.min(100, (currentProgress.currChars / currentProgress.totalChars) * 100)}%`,
            background: colors.accent,
            transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 10000,
          }}
        />
      )}
    </div>
  );
}
