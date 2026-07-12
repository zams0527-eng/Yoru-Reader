import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, Eye } from 'lucide-react';
import { db } from '../utils/db';
import { lookupWord } from '../utils/dictionary';

// Extract morae helper
const getMorae = (reading: string): string[] => {
  if (!reading) return [];
  return (reading.match(/[ぁ-んァ-ンぃぅぇぉゃゅょィゥェォャュョ]?[っッぁ-んァ-ン]?/g) || []).filter(Boolean);
};

interface PitchAccentGraphProps {
  reading: string;
  position: number;
}

// Beautiful Interactive SVG Pitch Accent Graph
function PitchAccentGraph({ reading, position }: PitchAccentGraphProps) {
  const morae = getMorae(reading);
  if (morae.length === 0) return null;

  const nodeSpacing = 35;
  const height = 45;
  const padding = 15;
  const width = morae.length * nodeSpacing + padding * 2;

  // Determine height level (high/low) for each mora index (0-based)
  // position: 0 (heiban), 1 (atamadaka), 2+ (nakadaka/odaka)
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
    const y = level === 1 ? height - 32 : height - 10;
    return { x, y, mora, idx, level };
  });

  // Calculate drop marker if any
  let dropLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (position > 0 && position <= morae.length) {
    const lastHighPoint = points[position - 1];
    const nextX = lastHighPoint.x + nodeSpacing / 2;
    const dropY = height - 10;
    dropLine = { x1: lastHighPoint.x, y1: lastHighPoint.y, x2: nextX, y2: dropY };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', margin: '14px 0' }}>
      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pitch accent</span>
      <div style={{ overflowX: 'auto', maxWidth: '100%', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          {/* Accent connection lines */}
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
                strokeWidth="2.5"
              />
            );
          })}

          {/* Drop helper line */}
          {dropLine && (
            <>
              <line
                x1={dropLine.x1}
                y1={dropLine.y1}
                x2={dropLine.x2}
                y2={dropLine.y2}
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={dropLine.x2}
                cy={dropLine.y2}
                r="3.5"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
              />
            </>
          )}

          {/* Mora nodes */}
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
                y={pt.y < height / 2 ? height - 3 : 13}
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

// SM-2 / FSRS-Lite scheduler calculations
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
    good: intervalGood >= 30 ? `${Math.round(intervalGood / 30)}mo` : `${intervalGood}d`,
    easy: intervalEasy >= 30 ? `${Math.round(intervalEasy / 30)}mo` : `${intervalEasy}d`,
    calculatedDays: {
      again: 0,
      hard: intervalHard,
      good: intervalGood,
      easy: intervalEasy
    }
  };
};

interface SrsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SrsReviewModal({ isOpen, onClose }: SrsReviewModalProps) {
  const rawSettings = (() => { try { return JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('reader_settings')) || '') || '{}'); } catch { return {}; } })();
  const lang = rawSettings.appLanguage || 'es';
  
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

  // Session timer effect
  useEffect(() => {
    if (!isOpen || isFinished || dueCards.length === 0) return;
    const interval = setInterval(() => {
      setTimerSeconds(s => s + 1);
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
    const learningWords = Object.keys(statuses).filter(w => statuses[w] === 'learning');
    
    const due = learningWords.filter(word => {
      const card = srsData[word];
      if (!card || !card.dueDate) return true;
      return new Date(card.dueDate) <= now;
    });

    const shuffled = due.sort(() => Math.random() - 0.5);
    setDueCards(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
    setIsFinished(false);
    setSessionCount(shuffled.length);
    setSessionStats({ correct: 0, incorrect: 0 });
    setTimerSeconds(0);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showAnswer, currentIndex, dueCards, isFinished]);

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
    
    db.setWordStatus(word, 'ignored');
    
    setDueCards(prev => prev.filter(w => w !== word));
    if (currentIndex >= dueCards.length - 1) {
      setIsFinished(true);
    }
  };

  const handleToggleMaster = () => {
    if (currentIndex >= dueCards.length) return;
    const word = dueCards[currentIndex];
    
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
      setSessionStats(s => ({ ...s, incorrect: s.incorrect + 1 }));
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
      setSessionStats(s => ({ ...s, correct: s.correct + 1 }));
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
  const srsCardData = currentWord ? db.getSrsCard(currentWord) : null;
  const intervals = calculateSrsIntervals(srsCardData);

  const newCardsCount = dueCards.filter(w => {
    const card = db.getSrsCard(w);
    return !card || !card.repetitions || card.repetitions === 0;
  }).length;
  const reviewCardsCount = dueCards.length - newCardsCount;

  return (
    <div className="modal-overlay" style={{ zIndex: 1400, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div className="yomitan-anki-modal" style={{ width: '600px', maxWidth: '95vw', height: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', overflow: 'hidden', border: '1px solid var(--border-light)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        
        {/* Native Top Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              {newCardsCount} new
            </span>
            <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              {reviewCardsCount} review
            </span>
          </div>
 
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
              <span style={{ color: 'var(--primary)' }}>{dueCards.length > 0 ? currentIndex + 1 : 0}</span> / {dueCards.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '1px' }}>
              {formatTimer(timerSeconds)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onClose}
              style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-main)', padding: '6px 10px', fontSize: '0.74rem', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.15s' }}
            >
              <X size={14} /> <span>{lang === 'es' ? 'Salir' : 'Exit'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', overflowY: 'auto' }}>
          
          {dueCards.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🏆</div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 800 }}>
                {lang === 'es' ? '¡Estás al día!' : 'Zero reviews due!'}
              </h3>
              <p style={{ fontSize: '0.85rem', maxWidth: '340px', margin: '0 auto', lineHeight: '1.6', textAlign: 'center', color: 'var(--text-muted)' }}>
                {lang === 'es' 
                  ? 'No tienes palabras pendientes de repaso en este momento. Sigue leyendo para encontrar nuevas palabras.' 
                  : 'You have no words due for review right now. Keep reading to find new words.'}
              </p>
              <button 
                type="button" 
                onClick={onClose} 
                className="reset-filter-btn" 
                style={{ marginTop: '28px', padding: '12px 30px', background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
              >
                {lang === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          ) : isFinished ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 800 }}>
                {lang === 'es' ? '¡Sesión Completada!' : 'Session Completed!'}
              </h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {lang === 'es' 
                  ? `Has repasado ${sessionCount} palabras en esta sesión.` 
                  : `You reviewed ${sessionCount} words in this session.`}
              </p>

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '28px' }}>
                <div style={{ background: 'rgba(34, 197, 94, 0.04)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '14px 24px', borderRadius: '10px', textAlign: 'center', minWidth: '110px' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: '#22c55e' }}>{lang === 'es' ? 'Aciertos' : 'Correct'}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#22c55e', marginTop: '4px' }}>{sessionStats.correct}</div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '14px 24px', borderRadius: '10px', textAlign: 'center', minWidth: '110px' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: '#ef4444' }}>{lang === 'es' ? 'Fallos' : 'Forgot'}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>{sessionStats.incorrect}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  type="button" 
                  onClick={initSession} 
                  style={{ padding: '10px 24px', background: 'var(--bg-card-hover)', color: 'var(--text-main)', border: '1px solid var(--border-light)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {lang === 'es' ? 'Repetir' : 'Restart'}
                </button>
                <button 
                  type="button" 
                  onClick={onClose} 
                  style={{ padding: '10px 28px', background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                >
                  {lang === 'es' ? 'Finalizar' : 'Finish'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '30px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ position: 'absolute', right: '20px', top: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  <span>#{currentIndex + 1}</span>
                  <span style={{ cursor: 'pointer' }}>•••</span>
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px' }}>
                  Review
                </div>

                {loadingEntry ? (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      {showAnswer && currentEntry?.reading && (
                        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '6px', fontFamily: 'var(--font-japanese)' }}>
                          {currentEntry.reading}
                        </div>
                      )}
                      <h2 style={{ fontSize: '3.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.01em', display: 'inline-flex', alignItems: 'center', gap: '14px', margin: 0, fontFamily: 'var(--font-japanese)' }}>
                        {currentWord}
                        <button
                          type="button"
                          onClick={() => playWordTts(currentWord, currentEntry?.reading)}
                          style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '50%', width: '36px', height: '36px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#38bdf8', transition: 'all 0.15s' }}
                        >
                          <Volume2 size={18} />
                        </button>
                      </h2>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--border-light)', width: '100%', marginBottom: '20px' }}></div>

                    {showAnswer ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {currentEntry?.partsOfSpeech && currentEntry.partsOfSpeech.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {currentEntry.partsOfSpeech.filter((pos: string) => pos !== 'Yomitan').map((pos: string, i: number) => (
                              <span key={i} style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#f59e0b', fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                {pos}
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ color: 'var(--text-main)', fontSize: '0.94rem', lineHeight: '1.6' }}>
                          {currentEntry?.definitions && currentEntry.definitions.length > 0 ? (
                            <ol style={{ paddingLeft: '20px', margin: 0 }}>
                              {currentEntry.definitions.slice(0, 4).map((def: string, i: number) => (
                                <li key={i} style={{ marginBottom: '6px', fontWeight: 500 }}>
                                  {def}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p style={{ color: 'var(--text-dark)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                              {lang === 'es' ? 'Sin traducción' : 'No translation available'}
                            </p>
                          )}
                        </div>

                        {currentEntry?.pitches && currentEntry.pitches.length > 0 ? (
                          <PitchAccentGraph
                            reading={currentEntry.reading || currentWord}
                            position={currentEntry.pitches[0]?.pitches[0]?.position ?? 0}
                          />
                        ) : (
                          currentEntry?.reading && (
                            <PitchAccentGraph reading={currentEntry.reading} position={0} />
                          )
                        )}
                      </div>
                    ) : (
                      <div 
                        onClick={() => setShowAnswer(true)}
                        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed var(--border-light)', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-app)', transition: 'all 0.15s' }}
                      >
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <Eye size={22} style={{ opacity: 0.5 }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 650 }}>
                            {lang === 'es' ? 'Haz clic o pulsa [Espacio] para mostrar la respuesta' : 'Click or press [Space] to reveal'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showAnswer ? (
                <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    
                    {/* Again */}
                    <button
                      type="button"
                      onClick={() => submitGrade(1)}
                      style={{
                        flex: 1,
                        padding: '12px 6px',
                        background: 'rgba(239, 68, 68, 0.04)',
                        border: '2.2px solid #ef4444',
                        borderRadius: '8px',
                        color: '#f87171',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
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
                        border: '2.2px solid #f97316',
                        borderRadius: '8px',
                        color: '#fb923c',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.12)'}
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
                        border: '2.2px solid #22c55e',
                        borderRadius: '8px',
                        color: '#4ade80',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.12)'}
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
                        border: '2.2px solid #3b82f6',
                        borderRadius: '8px',
                        color: '#60a5fa',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)'}
                    >
                      <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 700 }}>{intervals.easy}</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0' }}>Easy</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>4</div>
                    </button>

                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleToggleBlacklist}
                      style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-main)', padding: '6px 14px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      Blacklist <span style={{ opacity: 0.5, fontSize: '0.66rem', border: '1px solid var(--border-light)', padding: '1px 4px', borderRadius: '3px' }}>B</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleMaster}
                      style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-main)', padding: '6px 14px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      ★ Master <span style={{ opacity: 0.5, fontSize: '0.66rem', border: '1px solid var(--border-light)', padding: '1px 4px', borderRadius: '3px' }}>M</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  {lang === 'es' 
                    ? 'Tip: Pulsa [Espacio] para mostrar respuesta, y [1] [2] [3] [4] para calificar.' 
                    : 'Tip: Press [Space] to show answer, and [1] [2] [3] [4] to grade.'}
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
