import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, Eye, Clock, LogOut, Menu, Undo2, Ban, Star, Settings, ChevronDown, Columns } from 'lucide-react';
import { db } from '../utils/db';
import { lookupWord } from '../utils/dictionary';
import { updateDiscordReview, clearDiscordPresence } from '../utils/discordRpc';
import { FSRS6, Rating } from '../utils/fsrs';

// Extract morae helper
const getMorae = (reading: string): string[] => {
  if (!reading) return [];
  const clean = reading.replace(/[\s.]/g, '');
  const morae: string[] = [];
  const smallChars = new Set([
    'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ',
    'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ'
  ]);
  
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (smallChars.has(char) && morae.length > 0) {
      morae[morae.length - 1] += char;
    } else {
      morae.push(char);
    }
  }
  return morae;
};

interface PitchAccentGraphProps {
  reading: string;
  position: number;
}

// Beautiful Interactive SVG Pitch Accent Graph
function PitchAccentGraph({ reading, position }: PitchAccentGraphProps) {
  const morae = getMorae(reading);
  if (morae.length === 0) return null;

  const nodeSpacing = 30;
  const height = 50;
  const padding = 12;
  const width = morae.length * nodeSpacing + padding * 2;

  const getLevel = (idx: number) => {
    const moraNum = idx + 1; // 1-based index
    if (position === 0) {
      return moraNum === 1 ? 0 : 1; // Low, then High...
    } else if (position === 1) {
      return moraNum === 1 ? 1 : 0; // High, then Low...
    } else {
      if (moraNum === 1) return 0;
      if (moraNum <= position) return 1;
      return 0;
    }
  };

  const points = morae.map((mora, idx) => {
    const x = padding + idx * nodeSpacing;
    const level = getLevel(idx);
    const y = level === 1 ? 12 : 28; // High node at 12, Low node at 28
    return { x, y, mora, idx, level };
  });

  let dropLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (position > 0 && position <= morae.length) {
    const lastHighPoint = points[position - 1];
    const nextX = lastHighPoint.x + nodeSpacing / 2;
    const dropY = 28; // Drop to low level (28)
    dropLine = { x1: lastHighPoint.x, y1: lastHighPoint.y, x2: nextX, y2: dropY };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', margin: '14px 0' }}>
      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pitch accent</span>
      <div style={{ overflowX: 'auto', maxWidth: '100%', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          {points.map((pt, idx) => {
            if (idx === 0) return null;
            const prev = points[idx - 1];
            return (
              <line
                key={`line-${idx}`}
                x1={prev.x}
                y1={prev.y}
                x2={pt.x}
                y2={pt.y}
                stroke="#38bdf8"
                strokeWidth="2"
              />
            );
          })}

          {dropLine && (
            <>
              <line
                x1={dropLine.x1}
                y1={dropLine.y1}
                x2={dropLine.x2}
                y2={dropLine.y2}
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="2 2"
              />
              <circle
                cx={dropLine.x2}
                cy={dropLine.y2}
                r="3.5"
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.5"
              />
            </>
          )}

          {points.map((pt) => (
            <g key={`node-${pt.idx}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4.5"
                fill={pt.level === 1 ? '#38bdf8' : '#1e293b'}
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <text
                x={pt.x}
                y={height - 4} // Always align text at the bottom
                textAnchor="middle"
                fill="#ffffff"
                style={{ fontSize: '0.72rem', fontFamily: 'var(--font-japanese)', fontWeight: 600 }}
              >
                {pt.mora}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// FSRS 6 scheduler calculations
const calculateSrsIntervals = (card: any, fsrs: FSRS6) => {
  const c = card ? { ...card } : fsrs.createEmptyCard();
  const repeats = fsrs.repeat(c, new Date());
  
  const formatInterval = (days: number) => {
    if (days === 0) return '10m';
    if (days >= 30) {
      return `${Math.round(days / 30)}mo`;
    }
    return `${days}d`;
  };

  return {
    again: repeats[Rating.Again].scheduled_days === 0 ? '10m' : formatInterval(repeats[Rating.Again].scheduled_days),
    hard: repeats[Rating.Hard].scheduled_days === 0 ? '12h' : formatInterval(repeats[Rating.Hard].scheduled_days),
    good: formatInterval(repeats[Rating.Good].scheduled_days),
    easy: formatInterval(repeats[Rating.Easy].scheduled_days),
    repeats,
  };
};

interface SrsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterDeck?: string | null;
}

interface HistoryEntry {
  cardWord: string;
  cardState: any;
  prevDueCards: string[];
  prevIndex: number;
  prevStats: { correct: number; incorrect: number };
  prevShowAnswer: boolean;
}

export default function SrsReviewModal({ isOpen, onClose, filterDeck = null }: SrsReviewModalProps) {
  const rawSettings = (() => { try { return JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('reader_settings')) || '') || '{}'); } catch { return {}; } })();
  const lang = rawSettings.appLanguage || 'es';

  const fsrsRetentionRate = rawSettings.fsrsRetentionRate !== undefined ? Number(rawSettings.fsrsRetentionRate) : 0.90;
  const fsrsMaxInterval = rawSettings.fsrsMaxInterval !== undefined ? Number(rawSettings.fsrsMaxInterval) : 36500;
  const fsrsEnableFuzz = rawSettings.fsrsEnableFuzz !== undefined ? Boolean(rawSettings.fsrsEnableFuzz) : true;

  const fsrs = React.useMemo(() => {
    return new FSRS6({
      request_retention: fsrsRetentionRate,
      maximum_interval: fsrsMaxInterval,
      enable_fuzz: fsrsEnableFuzz,
    });
  }, [fsrsRetentionRate, fsrsMaxInterval, fsrsEnableFuzz]);
  
  const [dueCards, setDueCards] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<any>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Undo History & Display Settings
  const [historyStack, setHistoryStack] = useState<HistoryEntry[]>([]);
  const [fontSizeMode, setFontSizeMode] = useState<'S' | 'M' | 'L'>('M');
  const [isTimerVisible, setIsTimerVisible] = useState(true);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Load reviews list
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      initSession();
    } else {
      document.body.style.overflow = '';
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
    }
  }, [isOpen]);

  // Discord Rich Presence Integration
  useEffect(() => {
    if (isOpen) {
      updateDiscordReview(rawSettings);
    } else {
      clearDiscordPresence();
    }
    return () => {
      clearDiscordPresence();
    };
  }, [isOpen]);

  // Session timer effect
  useEffect(() => {
    if (!isOpen || isFinished || dueCards.length === 0) return;
    const interval = setInterval(() => {
      setTimerSeconds(s => {
        const next = s + 1;
        try {
          const ymd = new Date().toISOString().slice(0, 10);
          const key = `yoru_reader_srs_study_time_${ymd}`;
          const current = Number(localStorage.getItem(key) || 0);
          localStorage.setItem(key, String(current + 1));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isFinished, dueCards]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initSession = () => {
    const statuses = db.getWordStatuses();
    const srsData = db.getSrsData();
    const now = new Date();
    
    // Find learning cards
    let learningWords = Object.keys(statuses).filter(w => statuses[w] === 'learning');
    
    if (filterDeck) {
      learningWords = learningWords.filter(word => {
        const card = srsData[word];
        const deckName = card?.source || 'Yoru Reader';
        return deckName === filterDeck;
      });
    }
    
    let due = learningWords.filter(word => {
      const card = srsData[word];
      if (!card || !card.dueDate) return true;
      return new Date(card.dueDate) <= now;
    });

    // Fallback: If no cards are due, load all cards for study ahead / cram session
    const isCramSession = due.length === 0 && learningWords.length > 0;
    if (isCramSession) {
      due = learningWords;
    }

    const shuffled = due.sort(() => Math.random() - 0.5);
    setDueCards(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
    setIsFinished(false);
    setSessionCount(shuffled.length);
    setSessionStats({ correct: 0, incorrect: 0 });
    setTimerSeconds(0);
    setHistoryStack([]);
  };

  // Load dictionary item
  useEffect(() => {
    if (dueCards.length > 0 && currentIndex < dueCards.length) {
      const word = dueCards[currentIndex];
      setLoadingEntry(true);
      setShowAnswer(false);
      lookupWord(word)
        .then(entry => {
          setCurrentEntry(entry);
          setLoadingEntry(false);
          if (rawSettings.autoTTS) {
            playWordTts(word, entry?.reading);
          }
        })
        .catch(err => {
          console.error(err);
          setLoadingEntry(false);
        });
    }
  }, [currentIndex, dueCards]);

  const pushHistory = (word: string, currentCard: any) => {
    const prevCardState = currentCard ? JSON.parse(JSON.stringify(currentCard)) : null;
    setHistoryStack(prev => [...prev, {
      cardWord: word,
      cardState: prevCardState,
      prevDueCards: [...dueCards],
      prevIndex: currentIndex,
      prevStats: { ...sessionStats },
      prevShowAnswer: showAnswer
    }]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const last = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));

    // Restore database card state
    if (last.cardState) {
      db.saveSrsCard(last.cardWord, last.cardState);
      const statusBefore = last.cardState.state !== undefined ? 'learning' : 'new';
      db.setWordStatus(last.cardWord, statusBefore);
    } else {
      db.saveSrsCard(last.cardWord, null);
      db.setWordStatus(last.cardWord, 'new');
    }

    // Restore component states
    setDueCards(last.prevDueCards);
    setCurrentIndex(last.prevIndex);
    setSessionStats(last.prevStats);
    setShowAnswer(last.prevShowAnswer);
    setIsFinished(false);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen || isFinished || dueCards.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!showAnswer) {
          setShowAnswer(true);
        } else {
          submitGrade(3); // Default to Good
        }
      } else if (key === '1') {
        if (showAnswer) submitGrade(1);
      } else if (key === '2') {
        if (showAnswer) submitGrade(2);
      } else if (key === '3') {
        if (showAnswer) submitGrade(3);
      } else if (key === '4') {
        if (showAnswer) submitGrade(4);
      } else if (key === 'b') {
        handleToggleBlacklist();
      } else if (key === 'm') {
        handleToggleMaster();
      } else if (key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showAnswer, currentIndex, dueCards, isFinished, historyStack, sessionStats]);

  const playWordTts = (word: string, reading?: string) => {
    if (!word) return;
    const textToSpeak = reading || word;
    
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
    }

    setIsTtsPlaying(true);
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85;
      utterance.onend = () => setIsTtsPlaying(false);
      utterance.onerror = () => setIsTtsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsTtsPlaying(false);
    }
  };

  const handleToggleBlacklist = () => {
    if (currentIndex >= dueCards.length) return;
    const word = dueCards[currentIndex];
    const currentCard = db.getSrsCard(word);
    pushHistory(word, currentCard);
    
    db.setWordStatus(word, 'ignored');
    
    setDueCards(prev => prev.filter(w => w !== word));
    if (currentIndex >= dueCards.length - 1) {
      setIsFinished(true);
    }
  };

  const handleToggleMaster = () => {
    if (currentIndex >= dueCards.length) return;
    const word = dueCards[currentIndex];
    const currentCard = db.getSrsCard(word);
    pushHistory(word, currentCard);
    
    db.setWordStatus(word, 'known');
    db.saveSrsCard(word, null);

    setDueCards(prev => prev.filter(w => w !== word));
    if (currentIndex >= dueCards.length - 1) {
      setIsFinished(true);
    }
  };

  const submitGrade = (grade: number) => {
    if (currentIndex >= dueCards.length) return;
    const word = dueCards[currentIndex];
    const currentCard = db.getSrsCard(word);
    pushHistory(word, currentCard);

    const intervals = calculateSrsIntervals(currentCard, fsrs);
    const updatedCard = (intervals.repeats as any)[grade];

    if (grade === 1) {
      setSessionStats(s => ({ ...s, incorrect: s.incorrect + 1 }));
    } else {
      setSessionStats(s => ({ ...s, correct: s.correct + 1 }));
    }

    db.saveSrsCard(word, updatedCard);
    db.addSrsHistory(word, grade, updatedCard.scheduled_days ?? updatedCard.interval ?? 0, currentCard?.source || 'Yoru Reader');

    if (grade === 1) {
      setDueCards(prev => {
        const copy = prev.filter(w => w !== word);
        copy.push(word);
        return copy;
      });
      setShowAnswer(false);
    } else {
      if (currentIndex + 1 >= dueCards.length) {
        setIsFinished(true);
      } else {
        setCurrentIndex(prev => prev + 1);
        setShowAnswer(false);
      }
    }
  };

  if (!isOpen) return null;

  const currentWord = dueCards[currentIndex];
  const displayWord = currentWord ? (currentWord.includes(':') ? currentWord.split(':')[0] : currentWord) : '';
  const srsCardData = currentWord ? db.getSrsCard(currentWord) : null;
  const intervals = calculateSrsIntervals(srsCardData, fsrs);

  const newCardsCount = dueCards.filter(w => {
    const card = db.getSrsCard(w);
    return !card || !card.repetitions || card.repetitions === 0;
  }).length;
  const reviewCardsCount = dueCards.length - newCardsCount;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      background: '#000000',
      zIndex: 1500,
      display: 'flex',
      flexDirection: 'column',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      
      {/* Native Top Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#000000', borderBottom: '1px solid #18181b', position: 'relative' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ background: '#2563eb', color: '#ffffff', fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 800 }}>
            {newCardsCount} new
          </span>
          <span style={{ background: '#16a34a', color: '#ffffff', fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 800 }}>
            {reviewCardsCount} review
          </span>
        </div>
 
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em' }}>
            <span style={{ color: '#ffffff' }}>{dueCards.length > 0 ? currentIndex + 1 : 0}</span>
            <span style={{ color: '#71717a', margin: '0 4px' }}>/</span>
            <span style={{ color: '#71717a' }}>{dueCards.length}</span>
          </div>
          {isTimerVisible && (
            <div style={{ fontSize: '0.74rem', color: '#71717a', fontWeight: 700, marginTop: '2px' }}>
              {formatTimer(timerSeconds)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsTimerVisible(prev => !prev)}
            style={{ background: 'transparent', border: '1px solid #27272a', borderRadius: '8px', color: '#a1a1aa', width: '36px', height: '36px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
            title={lang === 'es' ? 'Mostrar/Ocultar cronómetro' : 'Show/Hide timer'}
          >
            <Clock size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: '1px solid #27272a', borderRadius: '8px', color: '#ef4444', width: '36px', height: '36px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
            title={lang === 'es' ? 'Salir' : 'Exit'}
          >
            <LogOut size={16} />
          </button>
          <button
            type="button"
            style={{ background: 'transparent', border: '1px solid #27272a', borderRadius: '8px', color: '#a1a1aa', width: '36px', height: '36px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* Red Progress Bar */}
      <div style={{ width: '100%', height: '4px', background: '#18181b', position: 'relative' }}>
        <div style={{ 
          width: `${dueCards.length > 0 ? ((currentIndex + 1) / dueCards.length) * 100 : 0}%`, 
          height: '100%', 
          background: '#ef4444', 
          transition: 'width 0.2s ease-in-out' 
        }} />
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', background: '#000000', overflowY: 'auto', justifyContent: 'center', alignItems: 'center' }}>
        
        {dueCards.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#71717a', maxWidth: '450px', width: '100%' }}>
            <div style={{ fontSize: '4.5rem', marginBottom: '24px' }}>🏆</div>
            <h3 style={{ fontSize: '1.6rem', color: '#ffffff', marginBottom: '10px', fontWeight: 800 }}>
              {lang === 'es' ? '¡Estás al día!' : 'Zero reviews due!'}
            </h3>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', textAlign: 'center', color: '#a1a1aa', margin: '0 0 32px 0' }}>
              {lang === 'es' 
                ? 'No tienes palabras pendientes de repaso en este mazo en este momento. ¡Buen trabajo!' 
                : 'You have no words due for review in this deck right now. Great job!'}
            </p>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ padding: '12px 36px', background: 'var(--primary)', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              {lang === 'es' ? 'Volver' : 'Go Back'}
            </button>
          </div>
        ) : isFinished ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#71717a', maxWidth: '450px', width: '100%' }}>
            <div style={{ fontSize: '4.5rem', marginBottom: '24px' }}>🎉</div>
            <h3 style={{ fontSize: '1.6rem', color: '#ffffff', marginBottom: '10px', fontWeight: 800 }}>
              {lang === 'es' ? '¡Sesión Completada!' : 'Session Completed!'}
            </h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '28px', textAlign: 'center', color: '#a1a1aa' }}>
              {lang === 'es' 
                ? `Has repasado ${sessionCount} palabras en esta sesión.` 
                : `You reviewed ${sessionCount} words in this session.`}
            </p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '36px', width: '100%' }}>
              <div style={{ flex: 1, background: 'rgba(34, 197, 94, 0.04)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '16px 20px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: '#22c55e', letterSpacing: '0.04em' }}>{lang === 'es' ? 'Aciertos' : 'Correct'}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#22c55e', marginTop: '6px' }}>{sessionStats.correct}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '16px 20px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: '#ef4444', letterSpacing: '0.04em' }}>{lang === 'es' ? 'Fallos' : 'Forgot'}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444', marginTop: '6px' }}>{sessionStats.incorrect}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                type="button" 
                onClick={initSession} 
                style={{ flex: 1, padding: '12px 24px', background: '#18181b', color: '#ffffff', border: '1px solid #27272a', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {lang === 'es' ? 'Reiniciar' : 'Restart'}
              </button>
              <button 
                type="button" 
                onClick={onClose} 
                style={{ flex: 1, padding: '12px 28px', background: 'var(--primary)', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {lang === 'es' ? 'Finalizar' : 'Finish'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '720px', margin: '0 auto' }}>
            
            {/* Card Container */}
            <div style={{ 
              background: '#09090b', 
              border: '1px solid #27272a', 
              borderRadius: '16px', 
              padding: '30px', 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              position: 'relative', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              overflowY: 'auto'
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: '#71717a', fontSize: '0.74rem' }}>
                <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1rem' }}>Review</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>#{currentIndex + 1}</span>
                  <span style={{ cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>•••</span>
                </div>
              </div>

              {loadingEntry ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: showAnswer ? 'flex-start' : 'center' }}>
                  {/* Spelling Area */}
                  <div style={{ textAlign: 'center', marginBottom: showAnswer ? '20px' : '0' }}>
                    {showAnswer && currentEntry?.reading && (
                      <div style={{ 
                        fontSize: fontSizeMode === 'S' ? '1rem' : (fontSizeMode === 'M' ? '1.3rem' : '1.7rem'), 
                        color: '#a1a1aa', 
                        fontWeight: 500, 
                        marginBottom: '8px', 
                        fontFamily: 'var(--font-japanese)' 
                      }}>
                        {currentEntry.reading}
                      </div>
                    )}
                    <h2 style={{ 
                      fontSize: showAnswer 
                        ? (fontSizeMode === 'S' ? '2.2rem' : (fontSizeMode === 'M' ? '2.8rem' : '3.6rem')) 
                        : (fontSizeMode === 'S' ? '3.2rem' : (fontSizeMode === 'M' ? '4.2rem' : '5.4rem')), 
                      fontWeight: 800, 
                      color: '#ffffff', 
                      letterSpacing: '0.01em', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '14px', 
                      margin: 0, 
                      fontFamily: 'var(--font-japanese)',
                      justifyContent: 'center',
                      width: '100%'
                    }}>
                      {displayWord}
                      <button
                        type="button"
                        onClick={() => playWordTts(displayWord, currentEntry?.reading)}
                        style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '50%', width: '38px', height: '38px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#38bdf8', transition: 'all 0.15s' }}
                      >
                        <Volume2 size={18} />
                      </button>
                    </h2>
                  </div>

                  {showAnswer && <div style={{ borderBottom: '1px solid #18181b', width: '100%', marginBottom: '20px', marginTop: '10px' }}></div>}

                  {showAnswer ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                      {currentEntry?.partsOfSpeech && currentEntry.partsOfSpeech.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {currentEntry.partsOfSpeech.filter((pos: string) => pos !== 'Yomitan').map((pos: string, i: number) => (
                            <span key={i} style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#f59e0b', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                              {pos}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ 
                        color: '#e4e4e7', 
                        fontSize: fontSizeMode === 'S' ? '0.85rem' : (fontSizeMode === 'M' ? '0.98rem' : '1.15rem'), 
                        lineHeight: '1.6' 
                      }}>
                        {currentEntry?.definitions && currentEntry.definitions.length > 0 ? (
                          <ol style={{ paddingLeft: '20px', margin: 0 }}>
                            {currentEntry.definitions.slice(0, 5).map((def: any, i: number) => {
                              const text = typeof def === 'string' ? def : (def.glossary || '');
                              return (
                                <li key={i} style={{ marginBottom: '6px', fontWeight: 500 }}>
                                  {text}
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p style={{ color: '#71717a', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            {lang === 'es' ? 'Sin traducción' : 'No translation available'}
                          </p>
                        )}
                      </div>

                      {currentEntry?.pitches && currentEntry.pitches.length > 0 ? (
                        <PitchAccentGraph
                          reading={currentEntry.reading || displayWord}
                          position={currentEntry.pitches[0]?.pitches[0]?.position ?? 0}
                        />
                      ) : (
                        currentEntry?.reading && (
                          <PitchAccentGraph reading={currentEntry.reading} position={0} />
                        )
                      )}

                      {/* Context sentence */}
                      {srsCardData?.sentence && (
                        <div style={{ 
                          background: '#18181b', 
                          border: '1px solid #27272a', 
                          borderRadius: '10px', 
                          padding: '14px 18px', 
                          marginTop: '8px', 
                          direction: 'ltr', 
                          textAlign: 'left' 
                        }}>
                          <p style={{ 
                            margin: 0, 
                            fontSize: fontSizeMode === 'S' ? '0.88rem' : (fontSizeMode === 'M' ? '1.02rem' : '1.18rem'), 
                            color: '#ffffff', 
                            fontFamily: 'var(--font-japanese)', 
                            lineHeight: '1.6' 
                          }}>
                            {srsCardData.sentence}
                          </p>
                          {srsCardData.source && (
                            <div style={{ fontSize: '0.74rem', color: '#71717a', marginTop: '6px', fontWeight: 600 }}>
                              Source: <span style={{ color: '#a1a1aa' }}>{srsCardData.source}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#71717a', fontSize: '0.95rem' }}>
                      Click or press Space to reveal
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Area */}
            {showAnswer ? (
              <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 4 Grading Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  
                  {/* Again */}
                  <button
                    type="button"
                    onClick={() => submitGrade(1)}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: 'rgba(239, 68, 68, 0.04)',
                      border: '2px solid #ef4444',
                      borderRadius: '10px',
                      color: '#f87171',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)'}
                  >
                    <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 700 }}>{intervals.again}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0' }}>Again</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>1</div>
                  </button>

                  {/* Hard */}
                  <button
                    type="button"
                    onClick={() => submitGrade(2)}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: 'rgba(249, 115, 22, 0.04)',
                      border: '2px solid #f97316',
                      borderRadius: '10px',
                      color: '#fb923c',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.04)'}
                  >
                    <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 700 }}>{intervals.hard}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0' }}>Hard</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>2</div>
                  </button>

                  {/* Good */}
                  <button
                    type="button"
                    onClick={() => submitGrade(3)}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: 'rgba(34, 197, 94, 0.04)',
                      border: '2px solid #22c55e',
                      borderRadius: '10px',
                      color: '#4ade80',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.04)'}
                  >
                    <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 700 }}>{intervals.good}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0' }}>Good</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>3</div>
                  </button>

                  {/* Easy */}
                  <button
                    type="button"
                    onClick={() => submitGrade(4)}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: 'rgba(59, 130, 246, 0.04)',
                      border: '2px solid #3b82f6',
                      borderRadius: '10px',
                      color: '#60a5fa',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)'}
                  >
                    <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 700 }}>{intervals.easy}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0' }}>Easy</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>4</div>
                  </button>
                </div>

                {/* Utility Buttons row */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleToggleBlacklist}
                    style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#ffffff', padding: '8px 18px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Ban size={13} style={{ color: '#ef4444' }} />
                    <span>Blacklist</span>
                    <span style={{ opacity: 0.5, fontSize: '0.66rem', border: '1px solid #27272a', padding: '1px 4px', borderRadius: '3px' }}>B</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMaster}
                    style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#ffffff', padding: '8px 18px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Star size={13} style={{ color: '#f59e0b' }} />
                    <span>Master</span>
                    <span style={{ opacity: 0.5, fontSize: '0.66rem', border: '1px solid #27272a', padding: '1px 4px', borderRadius: '3px' }}>M</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyStack.length === 0}
                    style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: historyStack.length > 0 ? '#ffffff' : '#71717a', padding: '8px 18px', fontSize: '0.78rem', fontWeight: 700, cursor: historyStack.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: historyStack.length > 0 ? 1 : 0.5 }}
                  >
                    <Undo2 size={13} />
                    <span>Undo</span>
                    <span style={{ opacity: 0.5, fontSize: '0.66rem', border: '1px solid #27272a', padding: '1px 4px', borderRadius: '3px' }}>Z</span>
                  </button>

                  <button
                    type="button"
                    style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#ffffff', padding: '8px 18px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>... More</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                
                {/* Undo Z button */}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyStack.length === 0}
                  style={{ background: 'transparent', border: 'none', color: historyStack.length > 0 ? '#a1a1aa' : '#3f3f46', fontSize: '0.78rem', fontWeight: 650, cursor: historyStack.length > 0 ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', transition: 'all 0.15s' }}
                >
                  <Undo2 size={13} />
                  <span>Undo Z</span>
                </button>

                {/* Show Answer button */}
                <button
                  type="button"
                  onClick={() => setShowAnswer(true)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#27272a'}
                  onMouseLeave={e => e.currentTarget.style.background = '#18181b'}
                >
                  <span>Show Answer</span>
                  <span style={{ fontSize: '0.74rem', background: '#27272a', color: '#a1a1aa', padding: '2px 8px', borderRadius: '4px' }}>Space</span>
                </button>
              </div>
            )}

            {/* Bottom Footer Options */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px', paddingBottom: '10px' }}>
              
              {/* Font Size Selector S M L */}
              <div style={{ display: 'flex', background: '#18181b', border: '1px solid #27272a', borderRadius: '20px', padding: '2px' }}>
                {(['S', 'M', 'L'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFontSizeMode(mode)}
                    style={{
                      background: fontSizeMode === mode ? '#3f3f46' : 'transparent',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: fontSizeMode === mode ? '#ffffff' : '#71717a',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Layouts toggle */}
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Columns size={16} />
              </button>

              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Settings size={16} />
              </button>

              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronDown size={16} />
              </button>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
