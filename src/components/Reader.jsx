import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Settings, Volume2, ExternalLink, BookOpen, Play, Plus, X, Square, Sliders } from 'lucide-react';
import { tokenizeText } from '../utils/japanese';
import { lookupWord } from '../utils/dictionary';
import SettingsModal from './SettingsModal';
import html2canvas from 'html2canvas';
import { t } from '../utils/i18n';
import { synthesizeSpeechAzure } from '../utils/azureTtsService';


export function chunkTokensIntoPages(tokenizedParagraphs, fontSize = 24) {
  // 1. Agrupar tokens en oraciones completas coherentes
  const sentences = [];
  let currentSentence = [];
  
  for (let pIdx = 0; pIdx < tokenizedParagraphs.length; pIdx++) {
    const paragraph = tokenizedParagraphs[pIdx];
    if (paragraph.length === 0) continue;
    
    // Añadimos sangría al inicio de cada párrafo
    currentSentence.push({ isIndentSpace: true });
    
    for (let tIdx = 0; tIdx < paragraph.length; tIdx++) {
      const token = paragraph[tIdx];
      currentSentence.push(token);
      
      // Identificar signos de puntuación final de oración en japonés y occidental
      if (token.surface === '。' || token.surface === '！' || token.surface === '？' || 
          token.surface === '.' || token.surface === '!' || token.surface === '?') {
        sentences.push(currentSentence);
        currentSentence = [];
      }
    }
    
    if (currentSentence.length > 0) {
      sentences.push(currentSentence);
      currentSentence = [];
    }
    
    // Insertar salto de párrafo si no es el último bloque del capítulo
    if (pIdx < tokenizedParagraphs.length - 1) {
      sentences.push([{ isParagraphBreak: true }]);
    }
  }
  
  const cleanSentences = sentences.filter(s => s.length > 0);
  
  // 2. Empaquetar oraciones completas en páginas respetando los límites físicos
  const pages = [];
  let currentPageTokens = [];
  
  const containerHeight = Math.min(520, window.innerHeight - 200);
  const availableHeight = Math.max(200, containerHeight - 40); // 40px de margen de seguridad
  
  const lineMultiplier = 1.9; // Coincide con index.css
  const estimatedLineHeight = fontSize * lineMultiplier;
  const maxLines = Math.max(2, Math.floor(availableHeight / estimatedLineHeight));
  
  const columnWidth = Math.min(800, window.innerWidth - 60);
  const charsPerLine = Math.max(8, Math.floor(columnWidth / fontSize));
  
  // Objetivo de caracteres por página: 190 (escalado por fuente para agregar una oración más por página)
  const charsPerPage = Math.max(80, Math.round(190 * (24 / fontSize)));
  
  let currentPageCharCount = 0;
  let currentPageLines = 0;
  
  for (let sIdx = 0; sIdx < cleanSentences.length; sIdx++) {
    const sentence = cleanSentences[sIdx];
    
    // Asignar el índice de oración a cada token para resaltado en hover
    sentence.forEach(tok => {
      tok.sentenceIdx = sIdx;
    });
    
    // Calcular peso de la oración
    const sentLength = sentence.filter(tok => tok.surface).reduce((sum, tok) => sum + tok.surface.length, 0);
    const sentLines = Math.ceil(sentLength / charsPerLine) || 0.5; // los saltos de párrafo ocupan media línea
    
    // Si agregar la oración excede la capacidad de la página y ya tenemos contenido, hacemos el corte
    if (currentPageTokens.length > 0 && (
      (currentPageLines + sentLines > maxLines) || 
      (currentPageCharCount + sentLength > charsPerPage)
    )) {
      pages.push(currentPageTokens);
      currentPageTokens = [];
      currentPageCharCount = 0;
      currentPageLines = 0;
    }
    
    currentPageTokens.push(...sentence);
    currentPageCharCount += sentLength;
    currentPageLines += sentLines;
  }
  
  if (currentPageTokens.length > 0) {
    pages.push(currentPageTokens);
  }
  
  return pages.length > 0 ? pages : [[]];
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
  const [currentChapter, setCurrentChapter] = useState(book.progress.currentChapter || 0);
  const [currentPage, setCurrentPage] = useState(book.progress.currentPage || 0);
  const [tokenizedParagraphs, setTokenizedParagraphs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & Popups
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modalMode, setModalMode] = useState('settings'); // 'settings' | 'info'
  const [selectedWord, setSelectedWord] = useState(null);
  const [dictEntry, setDictEntry] = useState(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [isComprehensionOpen, setIsComprehensionOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState(1);
  const [hoveredSentenceIdx, setHoveredSentenceIdx] = useState(null);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [isReaderSidebarOpen, setIsReaderSidebarOpen] = useState(false);

  const containerRef = useRef(null);
  const readerContentRef = useRef(null);
  const ttsAudioRef = useRef(null);
  const ttsKeepAliveRef = useRef(null);



  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);




  // Shortcut Q to toggle reader settings sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsReaderSidebarOpen(prev => !prev);
      }
      if (e.key === 'f' || e.key === 'F') {
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

  // 2. Calculo dinámico de páginas basado en tamaño de fuente
  const pages = useMemo(() => {
    if (tokenizedParagraphs.length === 0) return [[]];
    return chunkTokensIntoPages(tokenizedParagraphs, settings.fontSize);
  }, [tokenizedParagraphs, settings.fontSize, windowSize]);

  const totalPages = pages.length;
  const currentPageTokens = pages[currentPage] || [];

  // Estimación de páginas globales de todos los capítulos (basado en el nuevo target de 190 caracteres)
  const chapterPageCounts = useMemo(() => {
    return book.chapters.map((ch, idx) => {
      if (idx === currentChapter && tokenizedParagraphs.length > 0) {
        return totalPages;
      }
      const content = ch.content || "";
      return Math.max(1, Math.ceil(content.length / 190));
    });
  }, [book.chapters, currentChapter, totalPages, tokenizedParagraphs]);

  const globalTotalPages = useMemo(() => {
    return chapterPageCounts.reduce((sum, c) => sum + c, 0);
  }, [chapterPageCounts]);

  const globalCurrentPage = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < currentChapter; i++) {
      sum += chapterPageCounts[i] || 1;
    }
    return sum + currentPage + 1;
  }, [chapterPageCounts, currentChapter, currentPage]);

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

  const jumpToGlobalPage = (targetVal) => {
    let accumulated = 0;
    for (let cIdx = 0; cIdx < book.chapters.length; cIdx++) {
      const pCount = chapterPageCounts[cIdx] || 1;
      if (targetVal <= accumulated + pCount) {
        const subPage = targetVal - accumulated - 1;
        setCurrentChapter(cIdx);
        setCurrentPage(subPage);
        return;
      }
      accumulated += pCount;
    }
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
    if (tokenizedParagraphs.length === 0 || totalPages === 0) return;
    const chapterWeight = 1 / book.chapters.length;
    const currentProgress = currentChapter + (currentPage / totalPages);
    const percent = Math.min(100, Math.max(0, Math.round(currentProgress * chapterWeight * 100)));
    
    onUpdateProgress(book.id, currentChapter, currentPage, percent);
  }, [currentPage, currentChapter, totalPages]);

  // 5. Cerrar popup de diccionario al hacer click fuera
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (selectedWord && !e.target.closest('.dict-popup') && !e.target.closest('.word-token')) {
        setSelectedWord(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedWord]);

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
    
    // Position below the clicked word using screen-fixed coordinates (like Yomitan)
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 280;

    // Place below word, aligned to the word's left edge
    let x = rect.left;
    let y = rect.bottom + 6; // 6px gap below the word

    // Keep popup inside the viewport horizontally
    if (x + popupWidth > window.innerWidth - 10) x = window.innerWidth - popupWidth - 10;
    if (x < 10) x = 10;

    // Vertical: only go above if there is MORE space above than below
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      // Place above — anchor its bottom to just above the word
      y = Math.max(10, rect.top - 6);
      // We'll use CSS to pin it upwards via transform
      setPopupPos({ x, y, anchorBottom: true });
    } else {
      setPopupPos({ x, y, anchorBottom: false });
    }


    // Fetch dictionary entry
    const entry = await lookupWord(token.basicForm, token.reading);
    setDictEntry(entry);
    setDictLoading(false);
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

    const getFuriganaHTML = (token) => {
      if (!token) return '';
      if (!token.alignment) return token.surface || '';
      return token.alignment.map(part => {
        if (part.type === 'kanji') {
          return `<ruby>${part.text}<rt>${part.ruby}</rt></ruby>`;
        }
        return part.text;
      }).join('');
    };

    const getSentenceFuriganaHTML = (sentenceTokens) => {
      return sentenceTokens.map(tok => {
        if (tok.isIndentSpace) return '　';
        if (tok.isParagraphBreak || tok.isLineBreak) return '<br>';
        return getFuriganaHTML(tok);
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
    const wordFurigana = getFuriganaHTML(selectedWord);
    const sentenceFurigana = getSentenceFuriganaHTML(sentenceTokens);

    // Dynamic checks
    const fieldsConfigValues = Object.values(fieldsConfig);
    const hasScreenshot = fieldsConfigValues.includes('{screenshot}');
    const hasAudio = fieldsConfigValues.includes('{audio}');

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

    // 3. Map tokens to fields
    const fields = {};
    for (const [fieldName, tokenTemplate] of Object.entries(fieldsConfig)) {
      if (!tokenTemplate) {
        fields[fieldName] = '';
        continue;
      }
      let val = tokenTemplate
        .replace('{expression}', selectedWord.basicForm || selectedWord.surface)
        .replace('{furigana}', wordFurigana)
        .replace('{reading}', selectedWord.reading || '')
        .replace('{audio}', audioHTML)
        .replace('{popup-selection-text}', selectedWord.surface)
        .replace('{sentence}', sentenceText)
        .replace('{sentence-furigana}', sentenceFurigana)
        .replace('{screenshot}', screenshotHTML)
        .replace('{meaning}', meaning)
        .replace('{tags}', rawTags);
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
      options: { allowDuplicate: false, duplicateScope: "deck" },
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
        alert('Anki error: ' + result.error);
      } else {
        // Auto-mark the word as "Estudiando" when card is created
        if (selectedWord && selectedWord.basicForm) {
          onSetWordStatus(selectedWord.basicForm, 'learning');
        }
        alert(lang === 'es' ? '¡Tarjeta de Anki creada con éxito! La palabra fue marcada como "Estudiando".' : 'Anki card created successfully! The word was marked as "Learning".');
      }
    } catch (e) {
      alert(lang === 'es' ? 'Error de conexión con AnkiConnect. Asegúrate de tener Anki abierto.' : 'Connection error with AnkiConnect. Make sure Anki is open.');
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

                  return (
                    <span 
                      key={tokIdx}
                      className={`word-token ${getWordStatusClass(token)} ${hoveredSentenceIdx === token.sentenceIdx ? 'sentence-highlight' : ''}`}
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
                  width: '280px',
                  zIndex: 9999,
                  transform: popupPos.anchorBottom ? 'translateY(-100%)' : 'none'
                }}
              >
                <div className="yomitan-header-row">
                  <div>
                    <div className="yomitan-reading">{selectedWord.reading || selectedWord.surface}</div>
                    <div className="yomitan-term">{selectedWord.surface}</div>
                  </div>
                  <div className="yomitan-actions">
                    <button 
                      className="yomitan-action-btn yomitan-add-btn"
                      onClick={handleMineToAnki}
                      title={t('mineToAnki', lang)}
                    >
                      <Plus size={20} />
                    </button>
                    <button 
                      className="yomitan-action-btn yomitan-audio-btn"
                      onClick={() => reproducirTexto(selectedWord.surface)}
                      title={t('listenPronunciation', lang)}
                    >
                      <Volume2 size={20} />
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
                  {dictEntry && dictEntry.frequencies && dictEntry.frequencies.map((freq, i) => (
                    <span key={`freq-${i}`} className="yomi-tag yomi-tag-green">
                      {freq.dictionary} {freq.displayValue}
                    </span>
                  ))}
                  {wordStatuses[selectedWord.basicForm] === 'known' && (
                    <div className="yomi-freq-group">
                      <span className="yomi-freq-label">★</span>
                      <span className="yomi-freq-value">Conocida</span>
                    </div>
                  )}
                </div>

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
                      onSetWordStatus(selectedWord.basicForm, 'known');
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
                      ) : (
                        dictEntry.definitions.map((def, idx) => {
                          let cleanDef = def;
                          let dictTag = '';
                          const tagMatch = def.match(/^\[(.*?)\] (.*)/);
                          if (tagMatch) {
                            dictTag = tagMatch[1];
                            cleanDef = tagMatch[2];
                          }
                          
                          return (
                            <div key={idx} className="yomitan-definition-entry">
                              {dictTag && <span className="yomitan-dict-name">[{dictTag}]</span>}
                              <span className="yomitan-definition-text">{cleanDef}</span>
                            </div>
                          );
                        })
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

      {/* Settings & Info Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={onSaveSettings}
        mode={modalMode}
      />

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
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600 }}>
                {lang === 'es' ? 'Zoom de lectura' : 'Reading Zoom'}
              </span>
              <select 
                value={settings.fontSize || 36}
                onChange={(e) => onSaveSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                className="drawer-select"
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', outline: 'none' }}
              >
                <option value="18">75%</option>
                <option value="24">100%</option>
                <option value="30">125%</option>
                <option value="36">150%</option>
                <option value="42">175%</option>
                <option value="48">200%</option>
              </select>
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
    </div>
  );
}
