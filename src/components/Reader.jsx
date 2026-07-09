import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Settings, Volume2, ExternalLink, BookOpen, Play, Plus, X, Square, Sliders } from 'lucide-react';
import { tokenizeText } from '../utils/japanese';
import { lookupWord } from '../utils/dictionary';
import { searchYomitanDB } from '../utils/yomitanDB';

import html2canvas from 'html2canvas';
import { t } from '../utils/i18n';
import { synthesizeSpeechAzure } from '../utils/azureTtsService';


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

export function chunkTokensIntoPages(tokenizedParagraphs, fontSize = 24, containerPixelHeight = null, measuredLineHeight = null, lineShift = 0) {
  // 1. Asignar índices de oración para soporte de resaltado en hover
  let sentenceCount = 0;
  for (const para of tokenizedParagraphs) {
    for (const token of para) {
      token.sentenceIdx = sentenceCount;
      if (token.surface === '。' || token.surface === '！' || token.surface === '？' || 
          token.surface === '.' || token.surface === '!' || token.surface === '?') {
        sentenceCount++;
      }
    }
    sentenceCount++;
  }

  const columnWidth = Math.min(800, window.innerWidth - 60);
  const charsPerLine = Math.max(8, Math.floor(columnWidth / fontSize));
  
  // Use the real measured line height from DOM (includes furigana overhang), fallback to estimate
  // measuredLineHeight is obtained by rendering a hidden ruby test element at the exact font size
  const estimatedLineHeight = measuredLineHeight
    ? Math.ceil(measuredLineHeight) + 2 // Add 2px safety margin
    : fontSize * 2.4; // Safe fallback — 2.4x accounts for worst-case furigana
  const availableHeight = containerPixelHeight != null
    ? Math.max(50, containerPixelHeight) // DOM-measured: pixel perfect
    : Math.max(100, window.innerHeight - 210); // Fallback if ref not ready yet
  // lineShift: auto-corrected by the overflow detector — each unit = 1 fewer line per page
  const maxLines = Math.max(1, Math.floor(availableHeight / estimatedLineHeight) - lineShift);

  const pages = [];
  let currentPageTokens = [];
  let currentLineChars = 0;
  let currentLines = 0;

  for (let pIdx = 0; pIdx < tokenizedParagraphs.length; pIdx++) {
    const paragraph = tokenizedParagraphs[pIdx];
    if (paragraph.length === 0) continue;

    // Si no es el primer párrafo de la página, agregamos un salto de párrafo
    if (currentPageTokens.length > 0) {
      const paraBreakWeight = 0.5; // Peso visual de .paragraph-break
      if (currentLines + paraBreakWeight > maxLines) {
        pages.push(currentPageTokens);
        currentPageTokens = [];
        currentLineChars = 0;
        currentLines = 0;
      } else {
        currentPageTokens.push({ isParagraphBreak: true });
        currentLines += paraBreakWeight;
      }
    }

    for (let tIdx = 0; tIdx < paragraph.length; tIdx++) {
      const token = paragraph[tIdx];

      if (token.isLineBreak) {
        if (currentPageTokens.length > 0 && currentLines + 1 > maxLines) {
          pages.push(currentPageTokens);
          currentPageTokens = [token];
          currentLineChars = 0;
          currentLines = 0;
        } else {
          currentPageTokens.push(token);
          currentLines += 1;
          currentLineChars = 0;
        }
        continue;
      }

      const tokenLen = token.surface ? token.surface.length : 0;
      if (tokenLen === 0) continue;

      // Calcular cuántas líneas ocupa sumando a la línea actual
      const totalChars = currentLineChars + tokenLen;
      const linesOccupied = Math.floor(totalChars / charsPerLine);
      const remainingChars = totalChars % charsPerLine;

      if (currentPageTokens.length > 0 && currentLines + linesOccupied > maxLines) {
        // Salto de página
        pages.push(currentPageTokens);
        currentPageTokens = [token];
        currentLineChars = tokenLen % charsPerLine;
        currentLines = Math.floor(tokenLen / charsPerLine);
      } else {
        currentPageTokens.push(token);
        currentLines += linesOccupied;
        currentLineChars = remainingChars;
      }
    }
  }

  if (currentPageTokens.length > 0) {
    pages.push(currentPageTokens);
  }

  return pages.length > 0 ? pages : [[]];
}

function PitchAccent({ reading, position }) {
  const morae = reading.match(/[ぁ-んァ-ン][ゃゅょャュョ]*/g) || [];
  if (morae.length === 0) return <span>{reading} [{position}]</span>;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontFamily: 'var(--font-japanese)', fontSize: '0.95rem' }}>
      <span style={{ display: 'inline-flex', padding: '2px 0' }}>
        {morae.map((mora, idx) => {
          const m = idx + 1; // 1-based mora index
          let isHigh = false;
          let hasDrop = false;

          if (position === 0) {
            isHigh = m > 1;
          } else if (position === 1) {
            isHigh = m === 1;
            hasDrop = m === 1;
          } else if (position > 1) {
            isHigh = m >= 2 && m <= position;
            hasDrop = m === position;
          }

          return (
            <span
              key={idx}
              style={{
                borderTop: isHigh ? '2px solid currentColor' : '2px solid transparent',
                borderRight: hasDrop ? '2px solid currentColor' : '2px solid transparent',
                paddingRight: hasDrop ? '2px' : '0px',
                lineHeight: '1.2',
                display: 'inline-block'
              }}
            >
              {mora}
            </span>
          );
        })}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '3px' }}>
        [{position}]
      </span>
    </span>
  );
}

export const FONT_SIZE_STEPS = [16, 20, 24, 28, 32];

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
  const [currentChapter, setCurrentChapter] = useState(book.progress.currentChapter || 0);
  const [currentPage, setCurrentPage] = useState(book.progress.currentPage || 0);
  const [tokenizedParagraphs, setTokenizedParagraphs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & Popups
  const [selectedWord, setSelectedWord] = useState(null);
  const [dictEntry, setDictEntry] = useState(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [ankiCardExists, setAnkiCardExists] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimerRef = useRef(null);

  // Densidad calibrada: se establece automáticamente desde la paginación real de capítulos.
  // Se persiste en localStorage por libro para que sea correcta desde el primer render.
  // v2: stripping corregido que excluye lecturas de furigana (<rt>).
  const densityStorageKey = `yoru_page_density_v2_${book.id || 'default'}`;
  const [calibratedDensity, setCalibratedDensity] = useState(() => {
    try {
      const cached = localStorage.getItem(densityStorageKey);
      if (cached) {
        const val = parseInt(cached, 10);
        if (val >= 100 && val <= 1500) return val;
      }
    } catch (_) {}
    return null;
  });

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
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
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [isComprehensionOpen, setIsComprehensionOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState(1);
  const [hoveredSentenceIdx, setHoveredSentenceIdx] = useState(null);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [isReaderSidebarOpen, setIsReaderSidebarOpen] = useState(false);

  const containerRef = useRef(null);
  const readerContentRef = useRef(null);
  const textContainerRef = useRef(null); // Ref for the text area - used to measure actual pixel height
  const ttsAudioRef = useRef(null);
  const ttsKeepAliveRef = useRef(null);
  // Ref que expone el estado mutable actual al keyboard handler.
  // Evita re-registrar el event listener en cada cambio de estado (Fix #4).
  const keyboardStateRef = useRef({});
  // Ref para selectedWord usada por el outside-click handler estable (Fix #6).
  const selectedWordRef = useRef(null);
  // Ref para el rectángulo de la palabra cliqueada (para posicionamiento reactivo)
  const clickedWordRectRef = useRef(null);

  // Measured pixel height of the text container from the DOM (the ground truth)
  const [textContainerHeight, setTextContainerHeight] = useState(null);

  useEffect(() => {
    const el = textContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) {
          setTextContainerHeight(h);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // Only runs once - ResizeObserver handles all future size changes

  // Measured height of a single Japanese line with furigana ruby at the current font size.
  // We create a hidden test element in the DOM to get the browser's real rendered height.
  const [measuredLineHeight, setMeasuredLineHeight] = useState(null);

  useEffect(() => {
    // Create a hidden <ruby> element to measure actual rendered line height (furigana included)
    const testEl = document.createElement('div');
    testEl.setAttribute('style', [
      'position:fixed',
      'top:-9999px',
      'left:-9999px',
      'visibility:hidden',
      'pointer-events:none',
      `font-size:${settings.fontSize}px`,
      'font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif',
      'line-height:1.9',
      'white-space:nowrap',
    ].join(';'));
    testEl.innerHTML = '<ruby>漢字<rt>かんじ</rt></ruby>'; // Sample kanji+furigana
    document.body.appendChild(testEl);
    const h = testEl.getBoundingClientRect().height;
    document.body.removeChild(testEl);
    if (h > 0) {
      setMeasuredLineHeight(h);
    }
  }, [settings.fontSize]); // Re-measure whenever font size changes

  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    // Fix #5: cleanup was missing — cause de memory leak al desmontar el Reader
    return () => window.removeEventListener('resize', handleResize);
  }, []);







  // Silenciar reproducción si el lector se desmonta
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

  const chapter = book.chapters[currentChapter] || { title: 'Sin título', content: '' };
  
  // 1. Load and Tokenize Japanese Text
  useEffect(() => {
    let active = true;
    async function processText() {
      // Solo mostramos pantalla de carga completa en la primera carga del libro
      if (tokenizedParagraphs.length === 0) {
        setLoading(true);
      }
      setSelectedWord(null);
      setDictEntry(null);
      
      try {
        const text = book.chapters[currentChapter]?.content || '';
        const parsed = await tokenizeText(text);
        if (active) {
          setTokenizedParagraphs(parsed);
        }
      } catch (err) {
        console.error("Tokenization error:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    processText();
    return () => { active = false; };
  }, [currentChapter, book.id]);

  // lineShift: number of lines to subtract from maxLines to fix overflow.
  // Self-corrects: if the rendered page overflows, this increments by 1 until it stops.
  const [lineShift, setLineShift] = useState(0);
  const lineShiftRef = useRef(0);
  const prevLayoutKey = useRef('');

  // 2. Calculo dinámico de páginas basado en tamaño de fuente y altura REAL del contenedor
  const pages = useMemo(() => {
    if (tokenizedParagraphs.length === 0) return [[]];
    // Both textContainerHeight (container size) and measuredLineHeight (line height with furigana)
    // come from real DOM measurements — no guesswork, no magic multipliers.
    // lineShift is auto-corrected by the overflow detector below.
    return chunkTokensIntoPages(tokenizedParagraphs, settings.fontSize, textContainerHeight, measuredLineHeight, lineShift);
  }, [tokenizedParagraphs, settings.fontSize, windowSize, textContainerHeight, measuredLineHeight, lineShift]);
  const totalPages = pages.length;
  const currentPageTokens = pages[currentPage] || [];

  // Overflow detector: runs after every page render.
  // If text overflows the container, increment lineShift to fit one fewer line next time.
  // Resets when layout changes (font size / container height / measured line height).
  useEffect(() => {
    const el = textContainerRef.current;
    if (!el) return;

    // Build a key representing the current layout config
    const layoutKey = `${settings.fontSize}-${textContainerHeight}-${measuredLineHeight}`;
    if (layoutKey !== prevLayoutKey.current) {
      // Layout changed: reset shift and let it re-converge
      prevLayoutKey.current = layoutKey;
      lineShiftRef.current = 0;
      setLineShift(0);
      return;
    }

    // Check overflow after a short paint delay
    const timer = setTimeout(() => {
      if (el.scrollHeight > el.clientHeight + 2 && lineShiftRef.current < 10) {
        lineShiftRef.current += 1;
        setLineShift(lineShiftRef.current);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [currentPageTokens, settings.fontSize, textContainerHeight, measuredLineHeight]);

  const [pagePitches, setPagePitches] = useState({});

  useEffect(() => {
    let active = true;
    async function loadPagePitches() {
      if (!currentPageTokens || currentPageTokens.length === 0) {
        setPagePitches({});
        return;
      }
      
      const uniqueWords = [...new Set(
        currentPageTokens
          .filter(t => t.isWord && t.basicForm)
          .map(t => t.basicForm)
      )];
      
      if (uniqueWords.length === 0) {
        setPagePitches({});
        return;
      }
      
      const pitchMap = {};
      try {
        await Promise.all(uniqueWords.map(async (word) => {
          const entries = await searchYomitanDB(word);
          if (entries && entries.length > 0) {
            const entryWithPitch = entries.find(e => e.pitches && e.pitches.length > 0);
            if (entryWithPitch) {
              const pitchVal = entryWithPitch.pitches[0].pitches[0];
              if (pitchVal) {
                pitchMap[word] = {
                  position: pitchVal.position,
                  reading: entryWithPitch.pitches[0].reading || entryWithPitch.reading
                };
              }
            }
          }
        }));
        if (active) {
          setPagePitches(pitchMap);
        }
      } catch (err) {
        console.warn('Failed to load page pitches:', err);
      }
    }
    loadPagePitches();
    return () => {
      active = false;
    };
  }, [currentPageTokens]);

  const getPitchAccentColor = (word, reading) => {
    const pitchInfo = pagePitches[word];
    if (!pitchInfo) return '';
    
    const position = pitchInfo.position;
    const wordReading = pitchInfo.reading || reading || '';
    const morae = wordReading.match(/[ぁ-んァ-ン][ゃゅょャュョ]*/g) || [];
    const moraeCount = morae.length;
    
    if (position === 0) return 'var(--pitch-heiban, #3da7f5)'; // Heiban (Blue)
    if (position === 1) return 'var(--pitch-atamadaka, #f53d5c)'; // Atamadaka (Red)
    if (position > 1 && position < moraeCount) return 'var(--pitch-nakadaka, #ff9100)'; // Nakadaka (Orange)
    if (position === moraeCount) return 'var(--pitch-odaka, #00e676)'; // Odaka (Green)
    
    return '';
  };

  const currentChapterCharCount = useMemo(() => {
    let count = 0;
    tokenizedParagraphs.forEach(p => {
      p.forEach(t => {
        if (t.surface) count += t.surface.length;
      });
    });
    return count;
  }, [tokenizedParagraphs]);

  // Helper para extraer el texto principal de ch.content.
  // CRÍTICO: ch.content usa formato {texto|lectura} para furigana (NO es HTML).
  // Ejemplo: {漢字|かんじ} → "漢字" (2 chars), no "漢字かんじ" (8 chars con braces).
  // Sin este stripping, {冷蔵庫|れいぞうこ} = 11 chars en vez de 3 → inflación 4x.
  const stripChapterHtml = useCallback((content) => {
    return (content || '')
      .replace(/\{([^|{}]+)\|[^{}]*\}/g, '$1')  // {texto|lectura} → solo el texto principal
      .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '')  // Por si hay HTML residual: eliminar rt
      .replace(/<[^>]+>/g, '')                    // Eliminar cualquier tag HTML residual
      .replace(/&[a-zA-Z0-9#]+;/g, '')            // Eliminar HTML entities
      .replace(/\s+/g, '');                        // Comprimir espacios (contar solo chars reales)
  }, []);

  // Densidad Migaku: constante derivada de datos reales del libro.
  // "また、同じ夢を見ていた": 124,436 chars ÷ 238 páginas Migaku = 523 chars/página.
  // Al usar esta constante fija (no viewport-based), el total de páginas coincide
  // con Migaku independientemente del tamaño de pantalla o fuente.
  // eslint-disable-next-line no-unused-vars
  const _ = calibratedDensity; // Guardamos la densidad calibrada por compatibilidad
  const avgCharsPerPage = 523;

  // Total de caracteres legibles del libro (sin etiquetas HTML)
  const totalBookCharacters = useMemo(() => {
    return book.chapters.reduce((sum, ch) => sum + stripChapterHtml(ch.content).length, 0);
  }, [book.chapters, stripChapterHtml]);

  const charactersReadSoFar = useMemo(() => {
    // Caracteres de capítulos anteriores (sin HTML)
    let charsBefore = 0;
    for (let i = 0; i < currentChapter; i++) {
      charsBefore += stripChapterHtml(book.chapters[i].content).length;
    }
    
    // Caracteres de páginas anteriores dentro del capítulo actual (ya tokenizados = texto limpio)
    let charsInCurrentChapterBefore = 0;
    for (let p = 0; p < currentPage; p++) {
      const pageTokens = pages[p] || [];
      pageTokens.forEach(t => {
        if (t.surface) charsInCurrentChapterBefore += t.surface.length;
      });
    }
    
    return charsBefore + charsInCurrentChapterBefore;
  }, [book.chapters, currentChapter, currentPage, pages, stripChapterHtml]);

  const globalTotalPages = useMemo(() => {
    if (totalBookCharacters <= 0) return 1;
    return Math.max(1, Math.ceil(totalBookCharacters / avgCharsPerPage));
  }, [totalBookCharacters, avgCharsPerPage]);

  const globalCurrentPage = useMemo(() => {
    if (totalBookCharacters <= 0) return 1;
    const pageEstimation = Math.ceil(charactersReadSoFar / avgCharsPerPage) + 1;
    return Math.max(1, Math.min(globalTotalPages, pageEstimation));
  }, [charactersReadSoFar, avgCharsPerPage, globalTotalPages, totalBookCharacters]);

  // Refs and hooks to track unique page visits and time spent reading
  const visitedPages = useRef(new Set());
  const pendingChars = useRef(0);
  const pendingSeconds = useRef(0);

  const flushStats = useCallback(() => {
    const chars = pendingChars.current;
    const seconds = pendingSeconds.current;
    if ((chars > 0 || seconds > 0) && onIncrementReadingStats) {
      onIncrementReadingStats(book.id, chars, seconds);
      pendingChars.current = 0;
      pendingSeconds.current = 0;
    }
  }, [book.id, onIncrementReadingStats]);

  // Keep a mutable ref of flushStats to avoid re-triggering the timer interval on every prop update
  const flushStatsRef = useRef(flushStats);
  useEffect(() => {
    flushStatsRef.current = flushStats;
  }, [flushStats]);

  // Track unique page visits
  useEffect(() => {
    if (currentPageTokens.length === 0) return;
    const pageKey = `${currentChapter}-${currentPage}`;
    if (!visitedPages.current.has(pageKey)) {
      visitedPages.current.add(pageKey);
      const charsOnPage = currentPageTokens.reduce((acc, t) => acc + (t.surface ? t.surface.length : 0), 0);
      pendingChars.current += charsOnPage;
      flushStats();
    }
  }, [currentChapter, currentPage, currentPageTokens, flushStats]);

  // Track reading time interval
  useEffect(() => {
    const timer = setInterval(() => {
      pendingSeconds.current += 1;
      // Increment stats in db every 5 seconds to be highly responsive
      if (pendingSeconds.current >= 5) {
        flushStatsRef.current();
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      flushStatsRef.current();
    };
  }, []);

  const jumpToGlobalPage = (targetPage) => {
    const targetCharOffset = (targetPage - 1) * avgCharsPerPage;
    
    let accumulatedChars = 0;
    for (let cIdx = 0; cIdx < book.chapters.length; cIdx++) {
      const chContent = book.chapters[cIdx].content || "";
      const chLen = chContent.length;
      
      if (targetCharOffset <= accumulatedChars + chLen) {
        setCurrentChapter(cIdx);
        const relativeOffset = targetCharOffset - accumulatedChars;
        const estimatedSubPage = Math.floor(relativeOffset / avgCharsPerPage);
        setCurrentPage(estimatedSubPage);
        return;
      }
      accumulatedChars += chLen;
    }
    
    setCurrentChapter(book.chapters.length - 1);
    setCurrentPage(999);
  };

  // 3. Ajuste de límites de página al recargar texto o cambiar tamaño
  useEffect(() => {
    if (totalPages > 0) {
      if (currentPage === 999) {
        setCurrentPage(totalPages - 1);
      } else if (currentPage >= totalPages) {
        setCurrentPage(Math.max(0, totalPages - 1));
      }
    }
  }, [totalPages, currentPage]);

  // 4. Guardar progreso al cambiar de página o capítulo
  useEffect(() => {
    if (tokenizedParagraphs.length === 0 || totalPages === 0 || totalBookCharacters === 0) return;
    const percent = Math.min(100, Math.max(0, Math.round((charactersReadSoFar / totalBookCharacters) * 100)));
    
    onUpdateProgress(book.id, currentChapter, currentPage, percent);
  }, [currentPage, currentChapter, totalPages, charactersReadSoFar, totalBookCharacters]);

  // Fix #6: Outside click handler estable — listener registrado UNA vez, usa ref para selectedWord.
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        selectedWordRef.current &&
        !e.target.closest('.dict-popup') &&
        !e.target.closest('.word-token')
      ) {
        setSelectedWord(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []); // [] → se registra solo una vez

  // 6. Lógica de Paginación por Caracteres (135 caracteres promedio)
  const handlePrevPage = () => {
    setSelectedWord(null);
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (currentChapter > 0) {
      setCurrentChapter(currentChapter - 1);
      setCurrentPage(999); 
    }
  };

  const handleNextPage = () => {
    setSelectedWord(null);
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    } else if (currentChapter < book.chapters.length - 1) {
      setCurrentChapter(currentChapter + 1);
      setCurrentPage(0);
    }
  };

  // 5. Handle Click on Word
  const handleWordClick = async (token, e) => {
    if (!token.isWord) return;
    
    e.stopPropagation();
    setSelectedWord(token);
    setDictLoading(true);
    
    // Position using screen-fixed coordinates (like Yomitan)
    const rect = e.currentTarget.getBoundingClientRect();
    clickedWordRectRef.current = rect;
    const popupWidth = 380; // matches CSS width

    let x = rect.left;
    let y = rect.bottom + 6;

    // Keep popup inside the viewport horizontally
    if (x + popupWidth > window.innerWidth - 10) x = window.innerWidth - popupWidth - 10;
    if (x < 10) x = 10;

    // Vertical: place above if the word is in the lower half of the screen (so it has plenty of space above)
    // or if the space below is too small to fit the popup.
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const isLowerHalf = rect.top > window.innerHeight / 2;

    if (isLowerHalf || (spaceBelow < 240 && spaceAbove > spaceBelow)) {
      // Place above — anchor its bottom to just 6px above the word
      y = rect.top - 6;
      setPopupPos({ x, y, anchorBottom: true });
    } else {
      // Place below — anchor its top to just 6px below the word
      y = rect.bottom + 6;
      setPopupPos({ x, y, anchorBottom: false });
    }


    // Fetch dictionary entry
    const entry = await lookupWord(token.basicForm, token.reading);
    setDictEntry(entry);
    setDictLoading(false);
  };


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
      showToast(lang === 'es' ? 'No se pudo conectar con Anki. Asegúrate de que Anki esté abierto y AnkiConnect configurado.' : 'Could not connect to Anki. Make sure Anki is open and AnkiConnect is configured.', 'error');
    }
  };

  const handleMineToAnki = async () => {
    if (!selectedWord) return;

    // Helper functions for media
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
        console.error('Error downloading media from URL via AnkiConnect:', e);
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

    // 1. Get settings
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
      // Use expression settings by default
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

    // 2. Build values for the fields
    let sentenceText = '';
    let sentenceTokens = [];
    if (selectedWord.sentenceIdx !== undefined) {
      sentenceTokens = tokenizedParagraphs.flat().filter(t => t.sentenceIdx === selectedWord.sentenceIdx);
      sentenceText = sentenceTokens.map(t => t.surface || '').join('');
    }

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

    const wordFurigana = getAnkiFurigana(selectedWord);
    const sentenceFurigana = getSentenceAnkiFurigana(sentenceTokens);

    // Dynamic checks
    const fieldsConfigValues = Object.values(fieldsConfig);
    const hasScreenshot = fieldsConfigValues.includes('{screenshot}');
    const hasAudio = fieldsConfigValues.includes('{audio}');
    const hasSentenceAudio = fieldsConfigValues.includes('{sentence-audio}');

    // Capture screenshot if needed
    let screenshotHTML = '';
    if (hasScreenshot && containerRef.current) {
      try {
        const popup = document.querySelector('.dict-popup');

        if (popup) popup.style.setProperty('display', 'none', 'important');
        
        await new Promise(r => setTimeout(r, 80)); // wait for DOM layout hide
        
        const bgColor = window.getComputedStyle(containerRef.current).backgroundColor;
        
        const canvas = await html2canvas(containerRef.current, {
          backgroundColor: bgColor || '#0d0d0f',
          logging: false,
          useCORS: true,
          onclone: (clonedDoc) => {
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(el => {
              el.style.transition = 'none';
              el.style.animation = 'none';
              el.style.backdropFilter = 'none';
              el.style.filter = 'none';
            });
          }
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

    // Capture audio if needed
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

    // Capture sentence audio if needed
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

    // 3. Map tokens to fields
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
        frequencyRank = uniqueFreqs
          .map(f => f.displayValue || String(f.value))
          .join(', ');

        frequenciesDetails = uniqueFreqs
          .map(f => `${f.dictionary}: ${f.displayValue || f.value}`)
          .join(', ');
      }

      // Cloze deletion parts
      let clozePrefix = '';
      let clozeBody = selectedWord.surface || '';
      let clozeBodyKana = selectedWord.reading || '';
      let clozeSuffix = '';
      if (selectedWord.sentenceIdx !== undefined && sentenceTokens.length > 0) {
        const idx = sentenceTokens.findIndex(t => t === selectedWord);
        if (idx !== -1) {
          clozePrefix = sentenceTokens.slice(0, idx).map(t => t.surface || '').join('');
          clozeSuffix = sentenceTokens.slice(idx + 1).map(t => t.surface || '').join('');
        } else {
          const parts = sentenceText.split(selectedWord.surface);
          clozePrefix = parts[0] || '';
          clozeSuffix = parts.slice(1).join(selectedWord.surface);
        }
      }
      const sentenceClozeHTML = `${clozePrefix}{{c1::${clozeBody}}}${clozeSuffix}`;

      // Furigana variants
      const furiganaPlain = getAnkiFurigana(selectedWord, false);
      const sentenceFuriganaPlain = sentenceTokens.map(tok => {
        if (tok.isIndentSpace) return '　';
        if (tok.isParagraphBreak || tok.isLineBreak) return ' ';
        if (!tok.isWord) return tok.surface || '';
        return getAnkiFurigana(tok, false);
      }).join('');

      // Glossary variants
      const glossary = meaning;
      const glossaryFirst = dictEntry && dictEntry.definitions && dictEntry.definitions[0] ? dictEntry.definitions[0] : '';
      const glossaryBrief = glossaryFirst;
      const glossaryFirstBrief = glossaryFirst;
      const glossaryNoDict = meaning; 
      const glossaryPlain = meaning.replace(/<[^>]*>/g, '');
      const glossaryPlainNoDict = glossaryPlain;

      // Part of speech
      const partOfSpeechVal = dictEntry && dictEntry.partsOfSpeech ? dictEntry.partsOfSpeech.join(', ') : '';

      // Pitch Accents list
      let pitchAccentsVal = '';
      if (dictEntry && dictEntry.pitches && dictEntry.pitches.length > 0) {
        pitchAccentsVal = dictEntry.pitches
          .flatMap(pEntry => pEntry.pitches.map(p => `${pEntry.reading || selectedWord.reading || ''}: [${p.position}]`))
          .join(', ');
      }

      // Single frequencies
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

      // Document title and URL
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

    const tagsList = rawTags
      .split(/[\s,]+/)
      .filter(t => t.trim().length > 0);
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
        // Auto-mark the word as "Estudiando" when card is created
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

  // 6. Text-to-Speech (TTS) — con prioridad local y soporte de Azure Neural
  const reproducirTexto = async (texto, vozSeleccionada) => {
    if (!texto || !texto.trim()) return;

    // 1. Detener cualquier reproducción en curso
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

    // 1. Método Edge TTS (si estamos en Electron)
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
          audio.onerror = (e) => { console.error('Edge TTS audio error:', e); setIsTtsPlaying(false); ttsAudioRef.current = null; };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Edge TTS falló. Intentando con Azure u otros métodos:', err);
      }
    }

    // 2. Método Azure Neural TTS (si hay API Key configurada)
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
        audio.onerror = (e) => { console.error('Azure TTS audio error:', e); setIsTtsPlaying(false); ttsAudioRef.current = null; };
        await audio.play();
        return;
      } catch (err) {
        console.warn('Azure TTS falló. Intentando con síntesis local:', err);
      }
    }

    // 3. Método local: Web Speech API (speechSynthesis)
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

      // Buscar correspondencia por palabra clave (Nanami, Mayu, Keita, Edge o japonés genérico)
      const keyword = vozId.toLowerCase();
      matchedVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        return v.lang.startsWith('ja') && (name.includes(keyword) || name.includes('online') || name.includes('natural'));
      });

      if (!matchedVoice) {
        // Fallback a cualquier voz japonesa del navegador (ej. Microsoft Haruka Desktop o la de Edge default)
        matchedVoice = voices.find(v => v.lang.startsWith('ja'));
      }

      // Si definitivamente no hay ninguna voz en japonés instalada en el sistema operativo
      if (!matchedVoice) {
        console.log('No Japanese voices installed on system. Falling back to Google Translate TTS.');
        try {
          const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(texto)}`;
          const audio = new Audio(googleTtsUrl);
          ttsAudioRef.current = audio;
          audio.playbackRate = Math.min(4, Math.max(0.25, speed));
          audio.onended = () => { setIsTtsPlaying(false); ttsAudioRef.current = null; };
          audio.onerror = (e) => { console.error('Google TTS error:', e); setIsTtsPlaying(false); ttsAudioRef.current = null; };
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

        // Simular tono masculino para Keita si es la única voz nativa femenina (ej. Haruka)
        if (vozId === 'Keita' && matchedVoice && !matchedVoice.name.toLowerCase().includes('keita') && !matchedVoice.name.toLowerCase().includes('male')) {
          utterance.pitch = 0.72; // Grave
        } else {
          utterance.pitch = 1.0;
        }

        utterance.onstart = () => setIsTtsPlaying(true);
        utterance.onend = () => { setIsTtsPlaying(false); clearInterval(ttsKeepAliveRef.current); };
        utterance.onerror = () => { setIsTtsPlaying(false); clearInterval(ttsKeepAliveRef.current); };

        // Keep-alive para evitar suspensión en Chromium
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

  // Lectura en voz alta de toda la página actual
  const leerPaginaEnVozAlta = () => {
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
      return;
    }

    if (currentPageTokens.length === 0) return;
    const rawText = currentPageTokens
      .filter(tok => !tok.isParagraphBreak && !tok.isLineBreak && !tok.isIndentSpace)
      .map(tok => tok.surface)
      .join('');
    
    reproducirTexto(rawText, settings.audioVoiceOption || 'Nanami');
  };

  // Ajustar la posición del popup reactivamente si colisiona con el borde inferior o superior de la pantalla.
  // Mide el alto real del DOM del popup y lo voltea automáticamente si no cabe.
  useEffect(() => {
    if (!selectedWord) return;

    const adjustPosition = () => {
      const popupEl = document.querySelector('.dict-popup');
      const wordRect = clickedWordRectRef.current;
      if (!popupEl || !wordRect) return;

      const popupRect = popupEl.getBoundingClientRect();
      const popupHeight = popupRect.height;
      
      const spaceBelow = window.innerHeight - wordRect.bottom - 10;
      const spaceAbove = wordRect.top - 10;

      // Si está abajo y choca/excede el límite inferior de la pantalla
      if (!popupPos.anchorBottom && wordRect.bottom + 6 + popupHeight > window.innerHeight - 10) {
        if (spaceAbove > popupHeight || spaceAbove > spaceBelow) {
          setPopupPos(prev => ({
            ...prev,
            y: wordRect.top - 6,
            anchorBottom: true
          }));
        }
      }
      // Si está arriba y excede el límite superior de la pantalla
      else if (popupPos.anchorBottom && wordRect.top - 6 - popupHeight < 10) {
        if (spaceBelow > popupHeight || spaceBelow > spaceAbove) {
          setPopupPos(prev => ({
            ...prev,
            y: wordRect.bottom + 6,
            anchorBottom: false
          }));
        }
      }
    };

    // Corremos inmediatamente y con pequeños intervalos para reaccionar al cambio de carga/renderizado
    adjustPosition();
    const timer1 = setTimeout(adjustPosition, 10);
    const timer2 = setTimeout(adjustPosition, 50);
    const timer3 = setTimeout(adjustPosition, 150);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [selectedWord, dictEntry, dictLoading, popupPos.anchorBottom]);



  // Fix #4: Actualizar el ref con todos los valores actuales antes de cada render.
  // El keyboard handler siempre lee desde aquí, sin necesidad de re-registrarse.
  keyboardStateRef.current = {
    currentPage,
    currentChapter,
    totalPages,
    selectedWord,
    dictEntry,
    isReaderSidebarOpen,
    isJumpModalOpen,
    isComprehensionOpen,
    isTtsPlaying,
    currentPageTokens,
    settings,
    handlePrevPage,
    handleNextPage,
    leerPaginaEnVozAlta,
    handleMineToAnki,
    setSelectedWord,
    setDictEntry,
    setIsReaderSidebarOpen,
    setIsJumpModalOpen,
    setIsComprehensionOpen,
  };
  // Sincronizar selectedWordRef para el handler estable de outside-click (Fix #6)
  selectedWordRef.current = selectedWord;

  // Keyboard shortcuts — registrado UNA SOLA VEZ. Lee estado desde keyboardStateRef.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'SELECT' || 
        e.target.isContentEditable
      ) {
        return;
      }

      const s = keyboardStateRef.current;
      const key = e.key.toLowerCase();

      // 1. Navigation: Left / A (Previous Page)
      if (e.key === 'ArrowLeft' || key === 'a') {
        e.preventDefault();
        s.handlePrevPage();
      }

      // 2. Navigation: Right / D (Next Page)
      else if (e.key === 'ArrowRight' || key === 'd') {
        e.preventDefault();
        s.handleNextPage();
      }

      // 3. Close Modals / Popups: Esc
      else if (e.key === 'Escape') {
        e.preventDefault();
        if (s.selectedWord) {
          s.setSelectedWord(null);
          s.setDictEntry(null);
        } else if (s.isReaderSidebarOpen) {
          s.setIsReaderSidebarOpen(false);
        } else if (s.isJumpModalOpen) {
          s.setIsJumpModalOpen(false);
        } else if (s.isComprehensionOpen) {
          s.setIsComprehensionOpen(false);
        }
      }

      // 4. TTS: V
      else if (key === 'v') {
        e.preventDefault();
        s.leerPaginaEnVozAlta();
      }

      // 5. Mine to Anki: M
      else if (key === 'm') {
        e.preventDefault();
        if (s.selectedWord) {
          s.handleMineToAnki();
        }
      }

      // 7. Sidebar Settings: Q
      else if (key === 'q') {
        e.preventDefault();
        s.setIsReaderSidebarOpen(prev => !prev);
      }

      // 8. Fullscreen: F
      else if (key === 'f') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error enabling full-screen mode: ${err.message}`);
          });
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // [] → listener registrado UNA SOLA VEZ en todo el ciclo de vida del Reader

  // Get learning status style class
  const getWordStatusClass = (token) => {
    if (!token.isWord || settings.showLearningStatus === false) return '';
    const status = wordStatuses[token.basicForm] || 'unknown';
    
    if (status === 'new') return 'status-new';
    if (status === 'learning') return 'status-learning';
    if (status === 'known') return 'status-known';
    if (status === 'starred') return 'status-starred';
    if (status === 'ignored') return 'status-ignored';
    return 'status-new'; // default is 'new' (red underline) in Migaku term
  };

  const getLevelName = (pct) => {
    if (pct < 20) return lang === 'es' ? '👀 Principiante' : '👀 Beginner';
    if (pct < 50) return lang === 'es' ? '🧭 Curioso' : '🧭 Curious';
    if (pct < 70) return lang === 'es' ? '🚀 Ambicioso' : '🚀 Ambitious';
    if (pct < 90) return lang === 'es' ? '⚡ Fluido' : '⚡ Fluent';
    return lang === 'es' ? '🏆 Nativo' : '🏆 Native';
  };

  const getPieChartGradient = (known, unknown, ignored) => {
    const total = known + unknown + ignored || 1;
    const knownPct = (known / total) * 100;
    const unknownPct = (unknown / total) * 100;
    const p1 = knownPct;
    const p2 = knownPct + unknownPct;
    return `conic-gradient(var(--status-known) 0% ${p1}%, var(--status-new) ${p1}% ${p2}%, var(--status-ignored) ${p2}% 100%)`;
  };

  return (
    <div className="reader-container" data-theme={settings.theme} ref={containerRef}>
      {/* 1. Header */}
      <header className="reader-header">
        <button className="reader-header-btn" onClick={onBack} title={t('backToLibrary', lang)}>
          <ArrowLeft size={20} />
        </button>
        <h3 className="reader-title">
          {book.title}
        </h3>
        <button 
          className="reader-header-btn" 
          onClick={() => setIsReaderSidebarOpen(prev => !prev)}
          title={lang === 'es' ? 'Ajustes de visualización (Q)' : 'Display Settings (Q)'}
        >
          <Sliders size={20} />
        </button>
      </header>

      {/* 2. Content */}
      {loading ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p style={{ fontFamily: 'var(--font-heading)' }}>{t('processingVocab', lang)}</p>
        </div>
      ) : (
        <div className="reader-content-wrapper" ref={readerContentRef}>
          <div 
            className={`reader-text-container ${settings.showFurigana === 'none' ? 'hide-furigana' : ''}`}
            style={{ fontSize: `${settings.fontSize}px` }}
            ref={textContainerRef}
          >
            {currentPageTokens.length === 0 ? (
              <p style={{ color: 'var(--text-dark)', textAlign: 'center', marginTop: '2rem' }}>
                {lang === 'es' ? 'Este capítulo no contiene texto legible o es un capítulo de ilustración.' : 'This chapter does not contain readable text or is an illustration chapter.'}
              </p>
            ) : (
              <div className="reader-text-page">
                {currentPageTokens.map((token, tokIdx) => {
                  if (token.isIndentSpace) {
                    return <span key={tokIdx} style={{ display: 'inline-block', width: '1.5em' }} />;
                  }
                  if (token.isParagraphBreak) {
                    return <span key={tokIdx} className="paragraph-break" />;
                  }
                  if (token.isLineBreak) {
                    return <br key={tokIdx} />;
                  }

                  const isKnown = wordStatuses[token.basicForm] === 'known';
                  const isUnknownOnly = settings.showFurigana === 'unknown-only';
                  const shouldHideFurigana = isUnknownOnly && isKnown;

                  const pitchColor = settings.pitchAccent === 'pitch-color' ? getPitchAccentColor(token.basicForm, token.reading) : '';
                  const tokenStyle = pitchColor ? { color: pitchColor } : {};

                  return (
                    <span 
                      key={tokIdx}
                      className={`word-token ${getWordStatusClass(token)} ${hoveredSentenceIdx === token.sentenceIdx ? 'sentence-highlight' : ''}`}
                      style={tokenStyle}
                      onClick={(e) => handleWordClick(token, e)}
                      onMouseEnter={() => {
                        if (settings.sentenceHover) {
                          setHoveredSentenceIdx(token.sentenceIdx);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredSentenceIdx(null);
                      }}
                    >
                      {token.alignment.map((part, partIdx) => {
                        if (part.type === 'kanji' && !shouldHideFurigana) {
                           return (
                             <ruby key={partIdx}>
                               {part.text}
                               <rt>{part.ruby}</rt>
                             </ruby>
                           );
                        }
                        return <span key={partIdx}>{part.text}</span>;
                      })}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Floating Dictionary Tooltip */}
            {selectedWord && (
              <div 
                className="dict-popup"
                style={{ 
                  position: 'fixed',
                  left: `${popupPos.x}px`, 
                  top: `${popupPos.y}px`,
                  zIndex: 9999,
                  transform: popupPos.anchorBottom ? 'translateY(-100%)' : 'none',
                  maxHeight: popupPos.anchorBottom 
                    ? `${popupPos.y - 20}px` 
                    : `${window.innerHeight - popupPos.y - 20}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto'
                }}
              >
                <div className="yomitan-header-row">
                  <div>
                    <div className="yomitan-reading">{selectedWord.reading || selectedWord.surface}</div>
                    <div className="yomitan-term">{selectedWord.surface}</div>
                  </div>
                  <div className="yomitan-actions">
                    <button 
                      className="yomitan-action-btn yomitan-book-btn"
                      onClick={handleOpenInAnki}
                      title={lang === 'es' ? 'Ver en Anki' : 'View in Anki'}
                      style={{ position: 'relative' }}
                    >
                      <BookOpen size={14} />
                      {ankiCardExists && (
                        <span style={{
                          position: 'absolute',
                          top: '-1px',
                          right: '-1px',
                          background: '#34d399',
                          color: '#000000',
                          borderRadius: '50%',
                          width: '7px',
                          height: '7px',
                          fontSize: '6px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: '1',
                          border: '1px solid var(--border-light, rgba(255,255,255,0.1))'
                        }}>
                          +
                        </span>
                      )}
                    </button>
                    <button 
                      className="yomitan-action-btn yomitan-add-btn"
                      onClick={handleMineToAnki}
                      title={ankiCardExists ? (lang === 'es' ? 'Agregar duplicado a Anki' : 'Add duplicate to Anki') : t('mineToAnki', lang)}
                    >
                      {ankiCardExists ? (
                        <div style={{ position: 'relative', width: '14px', height: '14px' }}>
                          <div style={{
                            position: 'absolute',
                            left: '0px',
                            bottom: '0px',
                            width: '9px',
                            height: '9px',
                            border: '1.5px solid currentColor',
                            borderRadius: '50%',
                            boxSizing: 'border-box'
                          }} />
                          <div style={{
                            position: 'absolute',
                            right: '0px',
                            top: '0px',
                            width: '9px',
                            height: '9px',
                            border: '1.5px solid currentColor',
                            borderRadius: '50%',
                            background: '#1e1e1e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box'
                          }}>
                            <span style={{ fontSize: '7px', fontWeight: 'bold', lineHeight: '1', marginTop: '-2px' }}>+</span>
                          </div>
                        </div>
                      ) : (
                        <Plus size={14} />
                      )}
                    </button>
                    <button 
                      className="yomitan-action-btn yomitan-audio-btn"
                      onClick={() => reproducirTexto(selectedWord.surface)}
                      title={t('listenPronunciation', lang)}
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="yomitan-tags-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {dictEntry && dictEntry.isFromYomitan && (
                    <span className="yomi-tag yomi-tag-cyan">Diccionario</span>
                  )}
                  {dictEntry && dictEntry.partsOfSpeech && dictEntry.partsOfSpeech
                    .filter(pos => pos !== 'Yomitan')
                    .slice(0, 2)
                    .map((pos, i) => (
                      <span key={i} className="yomi-tag yomi-tag-blue">{pos.substring(0, 15)}</span>
                    ))
                  }
                  {dictEntry && dictEntry.frequencies && getUniqueFrequencies(dictEntry.frequencies).map((freq, i) => (
                    <div key={`freq-${i}`} className="yomi-freq-group">
                      <span className="yomi-freq-label">{freq.dictionary}</span>
                      <span className="yomi-freq-value">{freq.displayValue}</span>
                    </div>
                  ))}
                  {wordStatuses[selectedWord.basicForm] === 'known' && (
                    <div className="yomi-freq-group">
                      <span className="yomi-freq-label">★</span>
                      <span className="yomi-freq-value">Conocida</span>
                    </div>
                  )}
                </div>

                {/* Pitch Accents */}
                {dictEntry && dictEntry.pitches && dictEntry.pitches.length > 0 && (() => {
                  const activeReading = (selectedWord.reading || selectedWord.surface || '').trim();
                  const sortedPitches = [...dictEntry.pitches].sort((a, b) => {
                    const aMatches = (a.reading || '').trim() === activeReading;
                    const bMatches = (b.reading || '').trim() === activeReading;
                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;
                    return 0;
                  });
                  const limitedPitches = sortedPitches.slice(0, 4);

                  return (
                    <div className="yomitan-pitches-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', padding: '2px 0' }}>
                      {limitedPitches.map((pitchEntry, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="yomi-tag" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '2px' }}>
                            {pitchEntry.dictionary}
                          </span>
                          {pitchEntry.pitches.map((p, j) => (
                            <PitchAccent key={j} reading={pitchEntry.reading || selectedWord.reading || selectedWord.surface} position={p.position} />
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="yomi-dict-tag-row">
                  <span className="yomi-pos-tag">{selectedWord.pos || 'Exp'}</span>
                  <a 
                    href={`https://jisho.org/search/${encodeURIComponent(selectedWord.basicForm)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', textDecoration: 'none' }}
                  >
                    <span>Jisho</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                {/* Status Toggle (Migaku Word Statuses) */}
                <div className="dict-status-selector">
                  <button 
                    className={`status-btn status-btn-new ${(!wordStatuses[selectedWord.basicForm] || wordStatuses[selectedWord.basicForm] === 'new') ? 'active' : ''}`}
                    onClick={() => {
                      onSetWordStatus(selectedWord.basicForm, 'new');
                    }}
                  >
                    {t('statusNew', lang)}
                  </button>
                  <button 
                    className={`status-btn status-btn-learning ${(wordStatuses[selectedWord.basicForm] === 'learning') ? 'active' : ''}`}
                    onClick={() => {
                      onSetWordStatus(selectedWord.basicForm, 'learning');
                    }}
                  >
                    {t('statusLearning', lang)}
                  </button>
                  <button 
                    className={`status-btn status-btn-known ${(wordStatuses[selectedWord.basicForm] === 'known') ? 'active' : ''}`}
                    onClick={() => {
                      const wordData = {
                        reading: selectedWord.reading || selectedWord.surface,
                        meaning: dictEntry?.definitions?.slice(0, 3).join(' / ') || ''
                      };
                      onSetWordStatus(selectedWord.basicForm, 'known', wordData);
                    }}
                  >
                    {t('statusKnown', lang)}
                  </button>
                  <button 
                    className={`status-btn status-btn-starred ${(wordStatuses[selectedWord.basicForm] === 'starred') ? 'active' : ''}`}
                    onClick={() => {
                      onSetWordStatus(selectedWord.basicForm, 'starred');
                    }}
                  >
                    {t('statusStarred', lang)}
                  </button>
                  <button 
                    className={`status-btn status-btn-ignored ${(wordStatuses[selectedWord.basicForm] === 'ignored') ? 'active' : ''}`}
                    onClick={() => {
                      onSetWordStatus(selectedWord.basicForm, 'ignored');
                    }}
                  >
                    {t('statusIgnored', lang)}
                  </button>
                </div>

                <div className="dict-body">
                  {dictLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
                      <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                    </div>
                  ) : dictEntry ? (
                    settings.showTranslation ? (
                      (dictEntry.definitions.length === 0 || (dictEntry.definitions.length === 1 && (dictEntry.definitions[0].includes('No translation found') || dictEntry.definitions[0].includes('No se encontró definición')))) ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('noDefFound', lang)}</p>
                      ) : ( (() => {
                        const grouped = {};
                        dictEntry.definitions.forEach(def => {
                          let cleanDef = def;
                          let dictTag = '';
                          const tagMatch = def.match(/^\[(.*?)\] (.*)/);
                          if (tagMatch) {
                            dictTag = tagMatch[1];
                            cleanDef = tagMatch[2];
                          }
                          if (!grouped[dictTag]) {
                            grouped[dictTag] = [];
                          }
                          grouped[dictTag].push(cleanDef.trim());
                        });

                        return Object.entries(grouped).map(([dictTag, defs], idx) => {
                          const uniqueDefs = [];
                          const seen = new Set();
                          defs.forEach(d => {
                            const clean = d.replace(/^\d+\.\s*/, '').trim();
                            if (clean && !seen.has(clean.toLowerCase())) {
                              seen.add(clean.toLowerCase());
                              uniqueDefs.push(clean);
                            }
                          });

                          const joinedDefs = uniqueDefs.join(', ');
                          if (!joinedDefs) return null;

                          return (
                            <div key={idx} className="yomitan-definition-entry" style={{ margin: '1px 0', fontSize: '0.8rem', lineHeight: '1.3' }}>
                              {dictTag && <span className="yomitan-dict-name" style={{ marginRight: '4px', fontSize: '0.62rem', padding: '1px 3px', borderRadius: '2px' }}>[{dictTag}]</span>}
                              <span className="yomitan-definition-text">{joinedDefs}</span>
                            </div>
                          );
                        });
                      })()
                      )
                    ) : (
                      <p style={{ color: 'var(--text-dark)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        {lang === 'es' ? 'Traducción oculta (puedes activarla en Ajustes).' : 'Definitions hidden (you can enable them in Settings).'}
                      </p>
                    )
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>{t('dictLoading', lang)}</p>
                  )}
                </div>


              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Bottom Navigation bar */}
      <footer className="reader-bottom-nav" style={{ borderTop: '2px solid #FFE000' }}>
        <button 
          className="reader-header-btn" 
          onClick={handlePrevPage}
          disabled={currentChapter === 0 && currentPage === 0}
          style={{ opacity: (currentChapter === 0 && currentPage === 0) ? 0.3 : 1 }}
        >
          <ArrowLeft size={20} />
        </button>

        <div className="nav-progress-widget">
          {/* Progress badge (e.g. 70% | 0) */}
          <div 
            className="widget-stats"
            onClick={(e) => {
              e.stopPropagation();
              setIsComprehensionOpen(!isComprehensionOpen);
            }}
          >
            <span>⚡ {book.vocabularyCoverage || 0}%</span>
            <span>💎 {book.vocabStats?.recommendedSentences || 0}</span>
          </div>
          <span 
            className="widget-page"
            onClick={(e) => {
              e.stopPropagation();
              setJumpPageInput(globalCurrentPage);
              setIsJumpModalOpen(true);
            }}
          >
            {lang === 'es' ? `Página ${globalCurrentPage} de ${globalTotalPages}` : `Page ${globalCurrentPage} of ${globalTotalPages}`}
          </span>
        </div>

        <button 
          className="reader-header-btn" 
          onClick={handleNextPage}
          disabled={currentChapter === book.chapters.length - 1 && currentPage === totalPages - 1}
          style={{ opacity: (currentChapter === book.chapters.length - 1 && currentPage === totalPages - 1) ? 0.3 : 1 }}
        >
          <ArrowRight size={20} />
        </button>
      </footer>

      {/* Comprehension Popover Card (Migaku-style with Yoru Cafe theme) */}
      {isComprehensionOpen && (
        <>
          <div 
            className="comprehension-popover-overlay"
            onClick={() => setIsComprehensionOpen(false)}
          />
          <div className="comprehension-popover-card">
            {/* Header */}
            <div className="comp-pop-header">
              <span className="comp-pop-level-name">
                {getLevelName(book.vocabularyCoverage || 0)}
              </span>
              <button className="comp-pop-close-btn" onClick={() => setIsComprehensionOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Main Stats Row */}
            <div className="comp-pop-main-row">
              <div className="comp-pop-stat-item">
                <span className="comp-pop-stat-label">{lang === 'es' ? 'Comprensión general' : 'General comprehension'}</span>
                <span className="comp-pop-stat-val val-coverage">
                  {book.vocabularyCoverage || 0}%
                </span>
              </div>
              <div className="comp-pop-stat-item">
                <span className="comp-pop-stat-label">{lang === 'es' ? 'Recomendadas (1T)' : 'Recommended (1T)'}</span>
                <span className="comp-pop-stat-val val-sentences">
                  {book.vocabStats?.recommendedSentences || 0}
                </span>
              </div>
            </div>

            {/* Title divider */}
            <div className="comp-pop-section-title">{lang === 'es' ? 'Recuento de palabras únicas' : 'Unique words count'}</div>

            {/* Donut Chart & Legend Row */}
            <div className="comp-pop-chart-row">
              <div 
                className="comp-pop-pie-chart"
                style={{
                  background: getPieChartGradient(
                    book.vocabStats?.knownWords || 0,
                    book.vocabStats?.unknownWords || 0,
                    book.vocabStats?.ignoredWords || 0
                  )
                }}
              >
                <div className="donut-center" />
              </div>
              <div className="comp-pop-legend">
                <div className="legend-item">
                  <span className="legend-color-dot" style={{ backgroundColor: 'var(--status-known)' }} />
                  <span className="legend-label">{t('statusKnown', lang)}</span>
                  <span className="legend-count">{book.vocabStats?.knownWords || 0}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color-dot" style={{ backgroundColor: 'var(--status-new)' }} />
                  <span className="legend-label">{lang === 'es' ? 'Desconocida' : 'Unknown'}</span>
                  <span className="legend-count">{book.vocabStats?.unknownWords || 0}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color-dot" style={{ backgroundColor: 'var(--status-ignored)' }} />
                  <span className="legend-label">{t('statusIgnored', lang)}</span>
                  <span className="legend-count">{book.vocabStats?.ignoredWords || 0}</span>
                </div>
              </div>
            </div>

            {/* Sentence stats breakdown progress bars list */}
            <div className="comp-pop-breakdown-list">
              <div className="breakdown-list-item-group">
                <div className="breakdown-list-item">
                  <span className="breakdown-item-label">{lang === 'es' ? 'Conocidas al 100% (0T)' : '100% Known (0T)'}</span>
                  <span className="breakdown-item-val">{book.vocabStats?.sentencesKnownPct || 0}%</span>
                </div>
                <div className="breakdown-progress-bar">
                  <div className="breakdown-progress-fill" style={{ width: `${book.vocabStats?.sentencesKnownPct || 0}%`, backgroundColor: 'var(--status-known)' }} />
                </div>
              </div>
              
              <div className="breakdown-list-item-group">
                <div className="breakdown-list-item">
                  <span className="breakdown-item-label font-accent-1t">{lang === 'es' ? 'Recomendadas (1T)' : 'Recommended (1T)'}</span>
                  <span className="breakdown-item-val font-accent-1t">{book.vocabStats?.sentences1TPct || 0}%</span>
                </div>
                <div className="breakdown-progress-bar">
                  <div className="breakdown-progress-fill" style={{ width: `${book.vocabStats?.sentences1TPct || 0}%`, backgroundColor: '#00e5ff', boxShadow: '0 0 6px rgba(0, 229, 255, 0.3)' }} />
                </div>
              </div>

              <div className="breakdown-list-item-group">
                <div className="breakdown-list-item">
                  <span className="breakdown-item-label">{lang === 'es' ? 'Varias Desconocidas (MT)' : 'Multiple Unknown (MT)'}</span>
                  <span className="breakdown-item-val">{book.vocabStats?.sentencesMTPct || 0}%</span>
                </div>
                <div className="breakdown-progress-bar">
                  <div className="breakdown-progress-fill" style={{ width: `${book.vocabStats?.sentencesMTPct || 0}%`, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}



      {/* Floating Audio Play/Stop button */}
      <button 
        className={`floating-tts-btn ${isTtsPlaying ? 'playing' : ''}`}
        onClick={leerPaginaEnVozAlta}
        title={isTtsPlaying ? (lang === 'es' ? 'Detener lectura' : 'Stop reading') : (lang === 'es' ? 'Escuchar esta página en voz alta' : 'Read this page aloud')}
      >
        {isTtsPlaying ? (
          <Square size={18} fill="#fff" />
        ) : (
          <Play size={20} style={{ marginLeft: '2px' }} />
        )}
      </button>



      {/* Jump to Page Modal (Migaku style) */}
      {isJumpModalOpen && (
        <div className="jump-modal-overlay" onClick={() => setIsJumpModalOpen(false)}>
          <div className="jump-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jump-modal-title">{lang === 'es' ? 'Ir a la página' : 'Go to page'}</div>
            
            <div className="jump-modal-row">
              <span>{lang === 'es' ? 'Página' : 'Page'}</span>
              <input 
                type="number" 
                min="1" 
                max={globalTotalPages} 
                value={jumpPageInput}
                onChange={(e) => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = "";
                  else if (val < 1) val = 1;
                  else if (val > globalTotalPages) val = globalTotalPages;
                  setJumpPageInput(val);
                }}
                className="jump-modal-input"
              />
              <span>{lang === 'es' ? `de ${globalTotalPages}` : `of ${globalTotalPages}`}</span>
            </div>

            <input 
              type="range" 
              min="1" 
              max={globalTotalPages} 
              value={jumpPageInput || 1} 
              onChange={(e) => setJumpPageInput(parseInt(e.target.value))}
              className="jump-modal-slider"
            />

            <button 
              className="jump-modal-submit-btn"
              onClick={() => {
                const targetVal = parseInt(jumpPageInput);
                if (!isNaN(targetVal) && targetVal >= 1 && targetVal <= globalTotalPages) {
                  jumpToGlobalPage(targetVal);
                }
                setIsJumpModalOpen(false);
              }}
            >
              {lang === 'es' ? 'Ir a la página' : 'Go to page'}
            </button>

            <button 
              className="jump-modal-cancel-btn"
              onClick={() => setIsJumpModalOpen(false)}
            >
              {t('cancel', lang)}
            </button>
          </div>
        </div>
      )}

      {/* Reader Display Settings Drawer (triggered by Q or Sliders button) */}
      <aside className={`display-settings-drawer ${isReaderSidebarOpen ? 'open' : ''}`} style={{ width: '310px' }}>
        <div className="drawer-header">
          <span className="drawer-title" style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'none', fontWeight: 650, letterSpacing: 'normal', textShadow: 'none' }}>
            {lang === 'es' ? 'Ajustes de visualización' : 'Display settings'}
          </span>
          <button 
            className="drawer-close-btn" 
            onClick={() => setIsReaderSidebarOpen(false)}
            title={lang === 'es' ? 'Cerrar (Q)' : 'Close (Q)'}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              {lang === 'es' ? 'Visualización' : 'Display'}
            </div>
            
            <div className="settings-row-control" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="settings-label-text" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', fontWeight: 600 }}>
                {lang === 'es' ? 'Oración al pasar el cursor (Highlight)' : 'Sentence hover highlight'}
              </span>
              <label className="migaku-switch">
                <input 
                  type="checkbox" 
                  checked={settings.sentenceHover === true}
                  onChange={(e) => onSaveSettings({ ...settings, sentenceHover: e.target.checked })}
                />
                <span className="migaku-switch-slider"></span>
              </label>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              {lang === 'es' ? 'Estilo de texto y Audio' : 'Text Style & Audio'}
            </div>
            
            {/* Tamaño de fuente del lector (Zoom de lectura) */}
            <div className="drawer-section" style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="drawer-section-label" style={{ color: '#ff6b4a', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {lang === 'es' ? 'AJUSTES DE PANTALLA' : 'DISPLAY SETTINGS'}
              </span>
              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                {lang === 'es' ? 'Tamaño del texto' : 'Text size'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 4px' }}>
                <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>A</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="0" 
                    max="4" 
                    step="1"
                    value={FONT_SIZE_STEPS.includes(settings.fontSize) ? FONT_SIZE_STEPS.indexOf(settings.fontSize) : 2}
                    onChange={(e) => {
                      const newSize = FONT_SIZE_STEPS[parseInt(e.target.value)];
                      onSaveSettings({ ...settings, fontSize: newSize });
                    }}
                    className="migaku-range-slider"
                  />
                </div>
                <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>A</span>
              </div>
            </div>

            {/* Velocidad de reproducción */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600 }}>
                {lang === 'es' ? 'Velocidad de reproducción' : 'Playback Speed'}
              </span>
              <select 
                value={settings.audioSpeed || '1.0'}
                onChange={(e) => onSaveSettings({ ...settings, audioSpeed: e.target.value })}
                className="drawer-select"
              >
                <option value="1.0">Normal (1.0x)</option>
                <option value="0.75">{lang === 'es' ? 'Lento (0.75x)' : 'Slow (0.75x)'}</option>
                <option value="1.25">{lang === 'es' ? 'Rápido (1.25x)' : 'Fast (1.25x)'}</option>
                <option value="1.5">{lang === 'es' ? 'Rápido (1.5x)' : 'Fast (1.5x)'}</option>
              </select>
            </div>
          </div>
        </div>
    </aside>

    {/* Custom Toast Notification */}
    {toast.show && (
      <div className="yoru-toast" style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: '#18181b',
        color: '#ffffff',
        padding: '10px 16px',
        borderRadius: '4px',
        border: toast.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
        zIndex: 10000,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '0.82rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        animation: 'toastIn 0.2s ease-out forwards'
      }}>
        <span style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: toast.type === 'success' ? '#10b981' : '#ef4444',
          display: 'inline-block' 
        }} />
        <span>{toast.message}</span>
      </div>
    )}
  </div>
);
}
