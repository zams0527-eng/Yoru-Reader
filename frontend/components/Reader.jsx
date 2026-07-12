import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, ExternalLink, BookOpen, Plus, Settings, List, Flag, Bookmark, Maximize2, BarChart2, Image, TrendingUp, X } from 'lucide-react';
import { tokenizeText } from '../utils/japanese';
import { lookupWord } from '../utils/dictionary';
import { searchYomitanDB } from '../utils/yomitanDB';
import { db } from '../utils/db';
import html2canvas from 'html2canvas';
import { t } from '../utils/i18n';

// Direct reader engine imports
import ReaderEngine from './reader/ReaderEngine';
import ReaderNavbar from './reader/ReaderNavbar';
import ReaderSidebar from './reader/ReaderSidebar';
import ReaderSettings from './reader/ReaderSettings';
import CharacterCounter from './reader/CharacterCounter';
import SelectionToolbar from './reader/SelectionToolbar';
import { useReaderSettings } from '../hooks/useReaderSettings';

// Hash a string ID to a positive 32-bit integer for ttu-reader compatibility
function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Extract the sentence containing the selected text inside the iframe DOM
function getSentenceFromSelection(selection) {
  const node = selection.anchorNode;
  if (!node) return '';
  
  let container = node;
  while (container && container.nodeType !== Node.ELEMENT_NODE) {
    container = container.parentNode;
  }
  if (!container) return '';
  
  const text = container.textContent || '';
  const selectedText = selection.toString();
  
  // Split Japanese sentences by typical punctuation
  const sentences = text.split(/(?<=[。！？\n])/g);
  const match = sentences.find(s => s.includes(selectedText));
  return match ? match.trim() : selectedText;
}

export function getUniqueFrequencies(frequencies) {
  if (!frequencies || frequencies.length === 0) return [];
  
  const bestFreqs = {};
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
  
  const seenDicts = new Set();
  const orderedResult = [];
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

export default function Reader({ 
  book, 
  onBack, 
  onUpdateProgress, 
  onIncrementReadingStats,
  wordStatuses, 
  onSetWordStatus, 
  settings, 
  onSaveSettings 
}) {
  const lang = settings.appLanguage || 'es';

  const handleBack = useCallback(() => {
    const updatedSettings = db.getSettings();
    db.saveSettings(updatedSettings);
    onSaveSettings(updatedSettings);
    onBack();
  }, [onSaveSettings, onBack]);

  // Direct reader engine settings and states
  const [readerSettings, setReaderSetting] = useReaderSettings();
  const [sidebarMode, setSidebarMode] = useState(null); // 'toc' | 'bookmarks' | 'session' | 'settings' | null
  const [bookmarks, setBookmarks] = useState(book.bookmarks || []);
  const [currentProgress, setCurrentProgress] = useState({
    currChars: book.progress?.currentPage || 0, // Fallback to progress mapping
    totalChars: 0,
    lastIndex: book.progress?.currentPage || 0,
    currSection: book.progress?.currentChapter || 0,
  });

  const [session, setSession] = useState({
    isActive: false,
    isPaused: false,
    readingTime: 0,
    charsRead: 0,
    speed: 0,
    initialChars: 0,
  });

  const [selection, setSelection] = useState(null);
  const [navTargetSection, setNavTargetSection] = useState(null);
  const [navTargetParagraphId, setNavTargetParagraphId] = useState(null);

  const cacheBusterRef = useRef(Date.now());
  const [selectedWord, setSelectedWord] = useState(null);
  const [dictEntry, setDictEntry] = useState(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [ankiCardExists, setAnkiCardExists] = useState(false);
  const [srsCard, setSrsCard] = useState(null);
  const [isTtuLoaded, setIsTtuLoaded] = useState(true);
  const [ttuNumericId, setTtuNumericId] = useState(1);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const clickedWordRectRef = useRef(null);
  const ttsAudioRef = useRef(null);
  const ttsKeepAliveRef = useRef(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
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
      document.exitFullscreen();
    }
  }, []);

  // Programmatically trigger a keyboard action in ttu-reader (faster & extremely reliable)
  const triggerTtuKeyboardAction = useCallback((code, key) => {
    const iframe = iframeRef.current;
    if (!iframe) return false;
    try {
      const iframeWin = iframe.contentWindow;
      if (!iframeWin) return false;

      // Dispatch Keydown
      const downEvent = new KeyboardEvent('keydown', {
        code,
        key,
        bubbles: true,
        cancelable: true
      });
      iframeWin.dispatchEvent(downEvent);

      // Dispatch Keyup
      const upEvent = new KeyboardEvent('keyup', {
        code,
        key,
        bubbles: true,
        cancelable: true
      });
      iframeWin.dispatchEvent(upEvent);
      return true;
    } catch (e) {
      console.error('[Yoru] Keyboard action failed:', e);
      return false;
    }
  }, []);

  const syncSettingWithSvelte = useCallback((key, value) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const iframeWin = iframe.contentWindow;
      if (iframeWin) {
        let svelteKey = key;
        let svelteVal = value;
        
        if (key === 'theme') {
          svelteKey = 'theme';
          svelteVal = value === 'light' ? 'light-theme' : (value === 'sepia' ? 'ecru-theme' : 'black-theme');
        } else if (key === 'fontSize') {
          svelteKey = 'fontSize';
          svelteVal = String(value);
        } else if (key === 'lineHeight') {
          svelteKey = 'lineHeight';
          svelteVal = String(value);
        } else if (key === 'firstDimensionMargin') {
          svelteKey = 'firstDimensionMargin';
          svelteVal = String(value);
        } else if (key === 'textMarginValue') {
          svelteKey = 'textMarginValue';
          svelteVal = String(value);
        } else if (key === 'showFooterProgress') {
          iframeWin.localStorage.setItem('showFooterChapterPercentage', value ? 'true' : 'false');
          iframeWin.localStorage.setItem('showFooterChapterCharacterCounter', value ? 'true' : 'false');
          if (iframeWin.__yoruReaderBridge?.updateReaderSetting) {
            iframeWin.__yoruReaderBridge.updateReaderSetting('showFooterProgress', value);
          }
          return;
        } else if (key === 'trackerAutoPause') {
          svelteKey = 'trackerAutoPause';
          svelteVal = value;
        } else if (key === 'trackerIdleTime') {
          svelteKey = 'trackerIdleTime';
          svelteVal = String(value);
        }
        
        iframeWin.localStorage.setItem(svelteKey, svelteVal);
        
        if (iframeWin.__yoruReaderBridge?.updateReaderSetting) {
          iframeWin.__yoruReaderBridge.updateReaderSetting(key, value);
        }
      }
    } catch (e) {
      console.warn('[Yoru] Failed to sync setting with Svelte:', e);
    }
  }, []);

  const openSvelteSettingsPopover = useCallback(() => {
    setShowSettingsPopover(prev => !prev);
  }, []);

  const handleReaderKeydown = useCallback((e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    // Read keybindings from settings or fallback to defaults
    const keybindings = settings.keybindings || {
      toggleFullscreen: 'f',
      nextPage: 'ArrowRight',
      prevPage: 'ArrowLeft',
      toggleMenu: 'Escape',
      readAloud: 't'
    };

    const matchKey = (boundKey, pressedEvent) => {
      if (!boundKey) return false;
      const lowerBound = boundKey.toLowerCase();
      if (lowerBound === pressedEvent.key.toLowerCase()) return true;
      if (lowerBound === pressedEvent.code.toLowerCase()) return true;
      return false;
    };

    // 1. Toggle Fullscreen
    if (matchKey(keybindings.toggleFullscreen, e)) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    // 2. Next Page
    if (matchKey(keybindings.nextPage, e)) {
      e.preventDefault();
      triggerTtuKeyboardAction('ArrowRight', 'ArrowRight');
      return;
    }

    // 3. Previous Page
    if (matchKey(keybindings.prevPage, e)) {
      e.preventDefault();
      triggerTtuKeyboardAction('ArrowLeft', 'ArrowLeft');
      return;
    }

    // 4. Toggle Menu
    if (matchKey(keybindings.toggleMenu, e)) {
      e.preventDefault();
      setIsHeaderVisible(prev => !prev);
      return;
    }

    // 5. Read Aloud (TTS)
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

  const handleKeydownRef = useRef(handleReaderKeydown);
  useEffect(() => {
    handleKeydownRef.current = handleReaderKeydown;
  }, [handleReaderKeydown]);

  // Window keydown listener
  useEffect(() => {
    window.addEventListener('keydown', handleReaderKeydown);
    return () => {
      window.removeEventListener('keydown', handleReaderKeydown);
    };
  }, [handleReaderKeydown]);

  // Sync SRS card data on word change
  useEffect(() => {
    if (selectedWord && selectedWord.basicForm) {
      setSrsCard(db.getSrsCard(selectedWord.basicForm));
    } else {
      setSrsCard(null);
    }
  }, [selectedWord]);

  // Clean up timers & speech Synthesis on unmount
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

  // Re-inject iframe theme styles when app theme changes
  useEffect(() => {
    const theme = settings.theme || 'dark';
    window.__yoruTheme = theme;
    // If the iframe is already loaded, re-inject with new theme
    const iframe = iframeRef.current;
    if (!iframe || !iframeTargetLoadedRef.current) return;
    try {
      const iframeWin = iframe.contentWindow;
      if (iframeWin && iframeWin.__yoruReaderBridge?.setTheme) {
        iframeWin.__yoruReaderBridge.setTheme(theme);
      }

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;
      // Remove existing injected style so handleIframeLoad re-injects with the new theme
      const existing = iframeDoc.getElementById('yoru-custom-styles');
      if (existing) existing.remove();
      // Re-trigger the injection by calling handleIframeLoad logic directly
      // We do this by dispatching a synthetic load event is not reliable, so call it inline:
      handleIframeLoad();
    } catch (e) {
      // cross-origin guard (shouldn't happen in Electron)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme]);

  // Sync Yoru Reader book data to ttu-reader books-db IndexedDB
  useEffect(() => {
    // Helper to delete database if it was created with incorrect schema in previous attempts
    const checkAndFixDatabaseSchema = () => {
      return new Promise((resolve) => {
        try {
          const testReq = indexedDB.open('books');
          testReq.onsuccess = (e) => {
            const testDb = e.target.result;
            let isMalformed = false;
            
            // If lastItem was mistakenly created with keyPath, it is malformed
            if (testDb.objectStoreNames.contains('lastItem')) {
              try {
                const tx = testDb.transaction('lastItem', 'readonly');
                const store = tx.objectStore('lastItem');
                if (store.keyPath !== null) {
                  isMalformed = true;
                }
              } catch (err) {
                // ignore
              }
            }
            testDb.close();
            
            if (isMalformed) {
              console.warn("Malformed books database detected. Deleting to recreate with correct schema...");
              const deleteReq = indexedDB.deleteDatabase('books');
              deleteReq.onsuccess = () => {
                console.log("Malformed books database deleted successfully.");
                resolve();
              };
              deleteReq.onerror = () => {
                console.error("Failed to delete malformed books database.");
                resolve();
              };
            } else {
              resolve();
            }
          };
          testReq.onerror = () => {
            resolve();
          };
        } catch (err) {
          resolve();
        }
      });
    };

    const buildAndSaveBookWithDb = (idb, bookToSave, numericIdToSave) => {
      try {
        let elementHtml = '';
        const sections = [];
        let currentCharOffset = 0;

        (bookToSave.chapters || []).forEach((chapter, index) => {
          const lines = (chapter.content || '').split('\n');
          const linesHtml = lines.map(line => {
            if (line.startsWith('{h1:') && line.endsWith('}')) {
              const text = line.substring(4, line.length - 1);
              const processed = text.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
              return `<h1 class="chapter-content-h1">${processed}</h1>`;
            }
            if (line.startsWith('{h2:') && line.endsWith('}')) {
              const text = line.substring(4, line.length - 1);
              const processed = text.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
              return `<h2 class="chapter-content-h2">${processed}</h2>`;
            }
            if (line.startsWith('{h3:') && line.endsWith('}')) {
              const text = line.substring(4, line.length - 1);
              const processed = text.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
              return `<h3 class="chapter-content-h3">${processed}</h3>`;
            }
            if (line.startsWith('{img:') && line.endsWith('}')) {
              const src = line.substring(5, line.length - 1);
              return `<img src="${src}" style="max-width:100%; max-height:85vh; object-fit:contain; display:block; margin: 1em auto; break-after:column; page-break-after:always;" />`;
            }
            
            // Standard paragraph
            const processed = line
              .replace(/\{img:([^{}]+)\}/gi, '<img src="$1" style="max-width:100%; max-height:85vh; object-fit:contain; display:block; margin: 1em auto; break-after:column; page-break-after:always;" />')
              .replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
            return `<p class="chapter-content">${processed}</p>`;
          }).join('');
            
          const isBookTitle = chapter.title && bookToSave.title && 
            chapter.title.toLowerCase().trim() === bookToSave.title.toLowerCase().trim();

          const showTitle = chapter.title &&
            !isBookTitle &&
            !chapter.title.startsWith('Capítulo') &&
            !chapter.title.startsWith('Chapter') &&
            chapter.title !== 'Portada' &&
            chapter.title !== 'Cover' &&
            chapter.title !== 'Preface' &&
            chapter.title !== 'Ilustración';

          const chapterHtml = `
            <section id="chapter-${index}" class="ttu-chapter">
              ${showTitle ? `<h1 class="chapter-title">${chapter.title}</h1>` : ''}
              ${linesHtml}
            </section>
          `;
          
          elementHtml += chapterHtml;
          
          const cleanText = (chapter.content || '')
            .replace(/\{img:[^{}]*\}/gi, '')
            .replace(/\{h[1-6]:([^{}]+)\}/gi, '$1')
            .replace(/\{([^|{}]+)\|[^{}]*\}/g, '$1');
          const sectionLength = cleanText.length;
          
          // Determine if it should be a main chapter or grouped under a parent chapter
          let currentMainChapterId = 'chapter-0';
          if (index > 0) {
            // Find active main chapter by traversing backwards
            for (let j = index - 1; j >= 0; j--) {
              const prevCh = bookToSave.chapters[j];
              if (prevCh.isFromToc || j === 0) {
                currentMainChapterId = `chapter-${j}`;
                break;
              }
            }
          }

          if (chapter.isFromToc || index === 0) {
            // It's a main chapter
            sections.push({
              reference: `chapter-${index}`,
              charactersWeight: sectionLength,
              label: index === 0 ? (chapter.title || 'Preface') : chapter.title,
              startCharacter: currentCharOffset,
              characters: sectionLength
            });
          } else {
            // It's a sub-chapter
            sections.push({
              reference: `chapter-${index}`,
              charactersWeight: sectionLength,
              parentChapter: currentMainChapterId
            });
            // Accumulate characters count in the parent chapter
            const mainSec = sections.find(s => s.reference === currentMainChapterId);
            if (mainSec) {
              mainSec.characters += sectionLength;
            }
          }
          
          currentCharOffset += sectionLength;
        });

        const bookData = {
          id: numericIdToSave,
          title: bookToSave.title,
          language: 'ja',
          styleSheet: `
            .ttu-chapter { padding: 2em; }
            .chapter-title { font-size: 1.8em; font-weight: bold; margin-bottom: 1.5em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5em; }
            .chapter-content { margin-bottom: 1.2em; line-height: 1.8; text-indent: 1em; }
            img, svg, .ttu-img-parent { max-width: 100%; max-height: 85vh; object-fit: contain; break-after: column; page-break-after: always; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
          `,
          elementHtml: elementHtml,
          blobs: {},
          coverImage: bookToSave.cover || '',
          hasThumb: false,
          characters: currentCharOffset,
          sections: sections,
          lastBookModified: Date.now(),
          lastBookOpen: Date.now()
        };

        const tx = idb.transaction(['data', 'lastItem'], 'readwrite');
        tx.objectStore('data').put(bookData);
        tx.objectStore('lastItem').put({ dataId: numericIdToSave }, 0);
        
        tx.oncomplete = () => {
          idb.close();
          setIsTtuLoaded(true);
        };
        tx.onerror = (e) => {
          console.error("tx error:", e);
          idb.close();
          setIsTtuLoaded(true);
        };
      } catch (err) {
        console.error("buildAndSaveBookWithDb error:", err);
        try { idb.close(); } catch (_) {}
        setIsTtuLoaded(true);
      }
    };

    const syncBookToTtuDb = async () => {
      try {
        await checkAndFixDatabaseSchema();

        const numericId = hashStringToInt(book.id);
        setTtuNumericId(numericId);

        const openRequest = indexedDB.open('books', 6);
        openRequest.onupgradeneeded = (event) => {
          const idb = event.target.result;
          
          if (!idb.objectStoreNames.contains('data')) {
            const dataStore = idb.createObjectStore('data', {
              keyPath: 'id',
              autoIncrement: true
            });
            dataStore.createIndex('title', 'title');
          }
          
          if (!idb.objectStoreNames.contains('bookmark')) {
            idb.createObjectStore('bookmark', {
              keyPath: 'dataId'
            });
          }
          
          if (!idb.objectStoreNames.contains('lastItem')) {
            idb.createObjectStore('lastItem'); // keyless out-of-line store
          }
          
          if (!idb.objectStoreNames.contains('storageSource')) {
            idb.createObjectStore('storageSource', {
              keyPath: 'name'
            });
          }
          
          if (!idb.objectStoreNames.contains('statistic')) {
            const statisticsStore = idb.createObjectStore('statistic', {
              keyPath: ['title', 'dateKey']
            });
            statisticsStore.createIndex('dateKey', 'dateKey');
            statisticsStore.createIndex('completedBook', ['completedBook', 'title']);
          }
          
          if (!idb.objectStoreNames.contains('readingGoal')) {
            const readingGoalsStore = idb.createObjectStore('readingGoal', {
              keyPath: 'goalStartDate'
            });
            readingGoalsStore.createIndex('goalEndDate', 'goalEndDate');
          }
          
          if (!idb.objectStoreNames.contains('lastModified')) {
            idb.createObjectStore('lastModified', {
              keyPath: ['title', 'dataType']
            });
          }
          
          if (!idb.objectStoreNames.contains('audioBook')) {
            idb.createObjectStore('audioBook', { keyPath: 'title' });
          }
          
          if (!idb.objectStoreNames.contains('subtitle')) {
            idb.createObjectStore('subtitle', { keyPath: 'title' });
          }
          
          if (!idb.objectStoreNames.contains('handle')) {
            idb.createObjectStore('handle', { keyPath: ['title', 'dataType'] });
          }
        };

        openRequest.onsuccess = (event) => {
          const idb = event.target.result;
          buildAndSaveBookWithDb(idb, book, numericId);
        };

        openRequest.onerror = (e) => {
          console.error("Could not open books database:", e);
          setIsTtuLoaded(true);
        };

      } catch (err) {
        console.error("Failed to sync book to ttu IndexedDB:", err);
        setIsTtuLoaded(true);
      }
    };

    syncBookToTtuDb();
  }, [book]);

  // Handle word lookup from direct document selection (for short words <= 12 characters)
  const handleSelection = useCallback(async () => {
    const selectionObj = window.getSelection();
    if (!selectionObj) return;
    const selectedText = selectionObj.toString().trim();
    
    // Only lookup in Yomitan if text is short (1 to 12 chars)
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

      // Fetch local Yomitan entries
      const entry = await lookupWord(selectedText);
      setDictEntry(entry);
      setDictLoading(false);
    }
  }, []);

  // Listen for mouseup and touchend in the main reader content area
  useEffect(() => {
    const contentArea = document.getElementById('reader-content');
    if (!contentArea) return;

    contentArea.addEventListener('mouseup', handleSelection);
    contentArea.addEventListener('touchend', handleSelection);

    // Double click to lookup
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

  // Handle Copy / Bookmark from selection toolbar
  const handleCopyText = useCallback(() => {
    if (!selection) return;
    navigator.clipboard.writeText(selection.text);
    showToast(lang === 'es' ? 'Texto copiado al portapapeles' : 'Text copied to clipboard', 'success');
    window.getSelection()?.removeAllRanges();
  }, [selection, lang]);

  const handleToggleBookmark = useCallback((paragraphId, content) => {
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

  // Handle selection toolbar visibility and coordinates (for long selections > 12 characters)
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

      // Check if it is a long text selection (longer than 12 chars)
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
    let interval = null;
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

  const handleIframeLoad = () => {};

  // Close popup if clicking on the parent window
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const popup = document.querySelector('.dict-popup');
      if (popup && !popup.contains(e.target)) {
        setSelectedWord(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const checkAnkiCardExists = async (word) => {
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

    const expressionField = Object.keys(fieldsConfig).find(k => fieldsConfig[k] === '{expression}') || 'Expression';

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

    const blobToBase64 = (blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const uploadMediaToAnki = async (host, filename, base64Data) => {
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

    const uploadMediaUrlToAnki = async (host, filename, downloadUrl) => {
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

    const getAnkiFurigana = (token, keepLeadingSpace = false) => {
      if (!token) return '';
      if (!token.alignment) return token.surface || '';
      
      let result = '';
      token.alignment.forEach((part) => {
        if (part.type === 'kanji') {
          result += ` ${part.text}[${part.ruby}]`;
        } else {
          result += part.text;
        }
      });
      return keepLeadingSpace ? result : result.trim();
    };

    const getSentenceAnkiFurigana = (sentenceTokens) => {
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
        };
      }
    }

    // Tokenize target sentence and word on-the-fly for clean furigana
    const sentenceText = selectedWord.sentenceText || selectedWord.surface;
    const sentenceTokens = await tokenizeText(sentenceText);
    const wordTokens = await tokenizeText(selectedWord.basicForm);
    const activeWordToken = wordTokens[0] || selectedWord;

    const meaning = dictEntry && dictEntry.definitions ? dictEntry.definitions.join('<br>') : '';
    
    const isBilingual = (defText) => {
      const SPA_DIACRITICS = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/u;
      const SPA_WORDS = /\b(de|del|el|la|los|las|en|un|una|unos|unas|con|por|para|que|es|son|su|sus|se|al|como|más|no|si|lo|le|les|muy|también|pero|cuando|este|esta|estos|estas|fue|ser|hay|ya|porque|aunque|donde|mientras|entre)\b/i;
      const ENG_WORDS = /\b(the|of|to|and|a|in|is|for|on|with|as|by|at|an|be|this|that|from|it|are|or|if|but|after|before|during|while|have|has|had|not|also|can|will|its|was|were|been|one|two|three|four|five|used|made|when|which|who|what|where|how)\b/i;
      return SPA_DIACRITICS.test(defText) || SPA_WORDS.test(defText) || ENG_WORDS.test(defText);
    };

    const allDefs = dictEntry && dictEntry.definitions ? dictEntry.definitions : [];
    const bilingualDefs = allDefs.filter(d => isBilingual(d));
    const monolingualDefs = allDefs.filter(d => !isBilingual(d));

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
        const popup = document.querySelector('.dict-popup');
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

    const fields = {};
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
          .flatMap(pEntry => pEntry.pitches.map(p => p.position))
          .join(', ');
          
        const getPitchCategoryName = (pos, r) => {
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

        const getPitchGraphHTML = (r, pos) => {
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
          .flatMap(pEntry => pEntry.pitches.map(p => getPitchCategoryName(p.position, pEntry.reading || selectedWord.reading)))
          .filter(Boolean)
          .join(', ');

        pitchGraphs = dictEntry.pitches
          .flatMap(pEntry => pEntry.pitches.map(p => getPitchGraphHTML(pEntry.reading || selectedWord.reading || selectedWord.surface, p.position)))
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
          .flatMap(pEntry => pEntry.pitches.map(p => `${pEntry.reading || selectedWord.reading || ''}: [${p.position}]`))
          .join(', ');
      }

      let singleFreqBccwj = '';
      let singleFreqJpdb = '';
      let singleFreqJiten = '';
      let singleFreqVn = '';
      if (dictEntry && dictEntry.frequencies) {
        dictEntry.frequencies.forEach(f => {
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

  const reproducirTexto = async (texto, vozSeleccionada) => {
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
      const getVoicesAsync = () => new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) return resolve(voices);
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          resolve(window.speechSynthesis.getVoices());
        }, { once: true });
        setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
      });

      const voices = await getVoicesAsync();
      let matchedVoice = null;

      const keyword = vozId.toLowerCase();
      matchedVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        return v.lang.startsWith('ja') && (name.includes(keyword) || name.includes('online') || name.includes('natural'));
      });

      if (!matchedVoice) {
        matchedVoice = voices.find(v => v.lang.startsWith('ja'));
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

  const calculateSrsIntervals = (card) => {
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

  const handleSrsReview = (word, grade) => {
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
      newInterval = intervals.calculatedDays[
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
        border: 'rgba(0, 0, 0, 0.08)',
        textMain: '#000000',
        textMuted: '#8e8e93',
        cardBg: '#f6f6f6',
        accent: '#5c35db',
        popoverBg: '#ffffff',
      },
      sepia: {
        bg: '#fcfaf2',
        border: 'rgba(92, 75, 55, 0.15)',
        textMain: '#5c4b37',
        textMuted: 'rgba(92, 75, 55, 0.65)',
        cardBg: '#f4eedb',
        accent: '#8b5a2b',
        popoverBg: '#fcfaf2',
      },
      dark: {
        bg: '#18181c',
        border: 'rgba(255, 255, 255, 0.12)',
        textMain: '#ffffff',
        textMuted: 'rgba(255, 255, 255, 0.45)',
        cardBg: 'rgba(255, 255, 255, 0.05)',
        accent: '#FFE000',
        popoverBg: '#0c0c0e',
      }
    }[themeName];
  }, [readerSettings.theme]);

  return (
    <div 
      ref={containerRef}
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
      {/* Top Navbar */}
      <ReaderNavbar
        visible={isHeaderVisible}
        onClose={() => setIsHeaderVisible(false)}
        onBack={handleBack}
        onToggleToc={() => setSidebarMode('toc')}
        onToggleBookmarks={() => setSidebarMode('bookmarks')}
        onToggleSession={() => setSidebarMode('session')}
        onToggleSettings={() => setSidebarMode('settings')}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={!!document.fullscreenElement}
        bookTitle={book?.title || ''}
        colors={colors}
        lang={lang}
      />

      {/* Main Direct Render Engine */}
      <ReaderEngine
        book={book}
        readerSettings={readerSettings}
        targetSection={navTargetSection}
        targetParagraphId={navTargetParagraphId}
        onCharsUpdate={(payload) => {
          setCurrentProgress(payload);
          // Sync reading progress
          const percentage = payload.totalChars > 0 ? Math.min(100, Math.floor((payload.currChars / payload.totalChars) * 100)) : 0;
          onUpdateProgress(book.id, payload.currSection, payload.lastIndex, percentage);
        }}
        onClick={() => setIsHeaderVisible(prev => !prev)}
      />

      {/* Floating Counter */}
      <CharacterCounter
        currChars={currentProgress.currChars}
        totalChars={currentProgress.totalChars}
        colors={colors}
      />

      {/* Selection Toolbar */}
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

      {/* Toast notifications */}
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

      {/* Sidebar TOC / Bookmarks / Session / Settings */}
      {sidebarMode === 'settings' ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '340px',
            maxWidth: '85vw',
            height: '100vh',
            background: colors.popoverBg,
            borderLeft: `1px solid ${colors.border}`,
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.25s ease-out',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: colors.textMain }}>
              {lang === 'es' ? 'Ajustes del Lector' : 'Reader Settings'}
            </h3>
            <button
              onClick={() => setSidebarMode(null)}
              style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <ReaderSettings
              settings={readerSettings}
              onSettingChange={setReaderSetting}
              onOpenExtensionSettings={() => {
                if (window.electronAPI?.openReaderExtSettings) {
                  window.electronAPI.openReaderExtSettings();
                } else {
                  alert('Solo disponible en la versión de escritorio de Windows.');
                }
              }}
              colors={colors}
              lang={lang}
            />
          </div>
        </div>
      ) : (
        <ReaderSidebar
          mode={sidebarMode}
          onClose={() => setSidebarMode(null)}
          sections={book.chapters.map((ch, idx) => ({ id: `chapter-${idx}`, title: ch.title, isFromToc: ch.isFromToc }))}
          currSection={currentProgress.currSection}
          onGoToSection={(idx) => {
            setNavTargetSection(idx);
            // Reset after a frame so clicks can re-trigger navigation
            requestAnimationFrame(() => setNavTargetSection(null));
          }}
          bookmarks={bookmarks}
          onGoToBookmark={(bm) => {
            setNavTargetParagraphId(bm.paragraphId);
            requestAnimationFrame(() => setNavTargetParagraphId(null));
          }}
          readingSession={session}
          onToggleSession={handleToggleSession}
          colors={colors}
          lang={lang}
        />
      )}

      {/* Yoru Reader Floating Dictionary Tooltip */}
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
          {/* Status Toggle & SRS Review System */}
          {(() => {
            const wordStatus = wordStatuses[selectedWord.basicForm] || 'new';
            const isLearning = wordStatus === 'learning';
            const isKnown = wordStatus === 'known';
            const isIgnored = wordStatus === 'ignored';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                {/* Row 1: Statuses / Actions */}
                <div style={{ display: 'flex', gap: '5px' }}>
                  {/* Never Forget (Known) */}
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

                  {/* Blacklist (Ignored) */}
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

                  {/* Deck + / Deck - */}
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

                {/* Row 2: SRS Review Grading (only shown if learning state is active) */}
                {isLearning && (() => {
                  const intervals = calculateSrsIntervals(srsCard);
                  return (
                    <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                      {/* Again */}
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

                      {/* Hard */}
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

                      {/* Good */}
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

                      {/* Easy */}
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

                {/* Row 3: SRS card info label */}
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

          {/* Word / Reading Title */}
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

          {/* Action Row: Mine to Anki, Open in Anki */}
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

          {/* Dictionary Definitions List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!dictLoading ? (
              dictEntry && dictEntry.definitions && dictEntry.definitions.length > 0 ? (
                dictEntry.definitions.map((def, idx) => (
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
                      {def.partsOfSpeech && def.partsOfSpeech.map((pos, pIdx) => (
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
    </div>
  );
}