import React, { useState, useEffect, useCallback, useRef } from 'react';
import Library from './components/Library';
import WelcomeScreen from './components/WelcomeScreen';
import Reader from './components/Reader';
import SettingsModal from './components/SettingsModal';
import { db } from './utils/db';
import { tokenizeText, parseExtensionText } from './utils/japanese';
import { clearYomitanCache, migrateEnglishDictName, migrateDictFlags, cleanOrphanedEntries, getDB, importYomitanZip } from './utils/yomitanDB';
import { useConfirm } from './components/ConfirmModal';

declare global {
  interface Window {
    __yoruTheme: string;
    electronAPI: any;
  }
}

const SAMPLE_BOOKS = [
  {
    title: 'また、同じ夢を見ていた',
    author: '住野よる',
    cover: 'linear-gradient(135deg, #0f0c2f 0%, #201348 100%)',
    chapters: [
      {
        title: 'Capítulo 1',
        content: `「生きてる時間が長いからね。どうやったら勝てるのか、なっちゃんよりもよく知ってるのさ」\n\nおばあちゃんは生きてきた時間のことをよく言います。確かに、おばあちゃんは私がこれまでに生きた時間を七回も過ごしているのだから、それくらいあれば私にだって美味しいマドレーヌが焼けるかもしれません。\n\n一つ目のマドレーヌを食べ終わり、お皿に載った二つ目に手を伸ばそうとしたけど、結局何も取らずに手をひっこめました。今日はヤクルトもアイスもいりません。\n\nおばあちゃんの家を出て、小川の横 of 草むらを歩きました。風が吹くと、草が擦れ合う音がさらさらと聞こえます。\n\n「幸せって、何だろう」\n\n私は独り言を呟きながら、空を見上げました。空は夕焼け色に染まっていて、とても綺麗でした。おばあちゃんのマドレーヌのように、甘くて温かい色をしていました。`
      },
      {
        title: 'Capítulo 2',
        content: `学校の帰り道、私はいつものように公園に立ち寄りました。そこには、一匹の黒猫が座っていました。\n\n「こんにちは、お嬢さん」\n\n猫が喋るわけはありませんが、私にはそう聞こえた気がしました。猫はしっぽを一度振ると、私の足元に寄ってきて体を擦り付けました。\n\n「あなたも寂しいの？」\n\n私は猫の頭を優しく撫でました。猫の毛は柔らかく、お日様の匂いがしました。\n\n「明日もまた会えるかな」\n\n猫は小さく鳴いて、草むらの奥へと消えていきました。私は少しだけ、明日が楽しみになりました。`
      }
    ],
    progress: {
      currentChapter: 0,
      currentPage: 0,
      percent: 64
    },
    status: 'reading',
    vocabularyCoverage: 64
  },
  {
    title: '冴えない彼女の育てかた 13',
    author: '丸戸史明',
    cover: 'linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)',
    chapters: [
      {
        title: 'Capítulo 1',
        content: `これは、ある冴えないオタクの少年と、彼の運命を変えた一人の少女の物語である。\n\n「ねえ、倫也。私は本当に、あなたのヒロインになれたのかな」\n\n加藤恵は、いつもと変わらない静かな声で私に問いかけた。その表情には、いつもの掴みどころのない微笑みが浮かんでいた。\n\n「ああ、恵。君は俺にとって、世界一のメインヒロインだ」\n\n私は胸 te 答えた。彼女と出会ってからの数年間、様々なことがあった。`
      }
    ],
    progress: {
      currentChapter: 0,
      currentPage: 0,
      percent: 0
    },
    status: 'unread',
    vocabularyCoverage: 49
  },
  {
    title: '冴えない彼女の育てかた 12',
    author: '丸戸史明',
    cover: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    chapters: [
      {
        title: 'Capítulo 1',
        content: `「先輩、私のことを見てくれていますか？」\n\n波島出海は、真剣な眼差しで私を見つめた。彼女の情熱は、いつも私のクリエイターとしての魂を揺さぶる。\n\n「もちろんだ、出海。お前の描くイラストは、いつも最高だよ」\n\n彼女は顔を赤らめ、嬉しそうに俯いた。その姿は、かつての初々しい後輩そのものだった。`
      }
    ],
    progress: {
      currentChapter: 0,
      currentPage: 0,
      percent: 0
    },
    status: 'unread',
    vocabularyCoverage: 43
  },
  {
    title: '冴えない彼女の育てかた 11',
    author: '丸戸史明',
    cover: 'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)',
    chapters: [
      {
        title: 'Capítulo 1',
        content: `「倫也、私たちの同人誌、絶対に成功させようね」\n\n澤村・スペンサー・英梨々は、ツインテールを揺らしながら言った。彼女の目には、強い闘志が宿っていた。\n\n「ああ、当たり前だ. 俺たちの全力をぶつけよう」\n\n私たちは拳を軽く合わせ、これからの戦いに備えた。`
      }
    ],
    progress: {
      currentChapter: 0,
      currentPage: 0,
      percent: 0
    },
    status: 'unread',
    vocabularyCoverage: 45
  },
  {
    title: '冴えない彼女の育てかた 10',
    author: '丸戸史明',
    cover: 'linear-gradient(135deg, #e100ff 0%, #7f00ff 100%)',
    chapters: [
      {
        title: 'Capítulo 1',
        content: `「倫也くん、私の脚本、どうかしら」\n\n&emsp;霞ヶ丘詩羽は、長い黒髪をかき上げながら、妖艶な笑みを浮かべた。彼女のシナリオは、いつも完璧で、そして少しだけ恐ろしい。\n\n「素晴らしいですよ、詩羽先輩。底、このシーンは少し過激すぎませんか？」\n\n「あら、これくらいで怯むなんて、まだまだ子供ね」`
      }
    ],
    progress: {
      currentChapter: 0,
      currentPage: 0,
      percent: 0
    },
    status: 'unread',
    vocabularyCoverage: 42
  }
];

export default function App() {
  const [profiles, setProfiles] = useState<any[]>(db.getProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(db.getActiveProfileId());
  
  const [books, setBooks] = useState<any[]>([]);
  const [activeBook, setActiveBook] = useState<any | null>(null);
  const [wordStatuses, setWordStatuses] = useState<Record<string, string>>({});
  const [libraryTab, setLibraryTab] = useState('library');
  const [settings, setSettings] = useState<any>(() => {
    const s = db.getSettings();
    window.__yoruTheme = s.theme || 'dark';
    return s;
  });
  const lang = settings.appLanguage || 'es';
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [infoBook, setInfoBook] = useState<any | null>(null);

  const { showConfirm, confirmModal } = useConfirm();

  const uniqueWordsCacheRef = useRef<Record<string, { uniqueWords: Set<string>; tokens: any[] }>>({});

  // Run background database maintenance tasks exactly once on app startup
  useEffect(() => {
    let unsubscribeQuery: any = null;
    let unsubscribeSave: any = null;
    let unsubscribeParse: any = null;
    let unsubscribeUpdateStatus: any = null;

    if (window.electronAPI) {
      if (window.electronAPI.onQueryWordStatuses) {
        unsubscribeQuery = window.electronAPI.onQueryWordStatuses((words: string[]) => {
          const statuses = db.getWordStatuses();
          const result: Record<string, string> = {};
          words.forEach(w => {
            result[w] = statuses[w] || 'unknown';
          });
          window.electronAPI.replyQueryWordStatuses(result);
        });
      }

      if (window.electronAPI.onSaveWordToSrs) {
        unsubscribeSave = window.electronAPI.onSaveWordToSrs((wordData: any) => {
          console.log('[Yoru] Mining word from extension locally:', wordData);
          db.setWordStatus(wordData.word, 'learning');
          
          const existingCard = db.getSrsCard(wordData.word);
          if (!existingCard) {
            const newCard = {
              word: wordData.word,
              reading: wordData.reading || '',
              sentence: wordData.sentence || '',
              source: wordData.source || 'Yoru Reader Extension',
              interval: 1,
              ease: 2.5,
              repetitions: 0,
              dueDate: new Date().toISOString()
            };
            db.saveSrsCard(wordData.word, newCard);
            console.log('[Yoru] Saved mined card to local SRS:', newCard);
          }
          
          setWordStatuses(db.getWordStatuses());
          window.electronAPI.replySaveWordToSrs();
        });
      }

      if (window.electronAPI.onUpdateWordStatus) {
        unsubscribeUpdateStatus = window.electronAPI.onUpdateWordStatus((data: any) => {
          const { word, state } = data;
          console.log('[Yoru] Updating word status from extension:', word, state);
          
          let newStatus = 'new';
          if (state === 'learning-add') {
            newStatus = 'learning';
            const existingCard = db.getSrsCard(word);
            if (!existingCard) {
              const now = new Date();
              const newCard = {
                word: word,
                reading: '',
                sentence: '',
                source: 'Yoru Reader Extension',
                interval: 1,
                ease: 2.5,
                repetitions: 0,
                dueDate: now.toISOString(),
                lastReview: now.toISOString(),
                lapses: 0,
                state: 0
              };
              db.saveSrsCard(word, newCard);
            }
          } else if (state === 'known-add') {
            newStatus = 'known';
            db.saveSrsCard(word, null);
          } else if (state === 'ignored-add') {
            newStatus = 'ignored';
            db.saveSrsCard(word, null);
          } else {
            newStatus = 'new';
            db.saveSrsCard(word, null);
          }
          
          db.setWordStatus(word, newStatus);
          setWordStatuses(db.getWordStatuses());
          
          window.electronAPI.replyUpdateWordStatus();
        });
      }

      if (window.electronAPI.onParseTextRequest) {
        unsubscribeParse = window.electronAPI.onParseTextRequest(async ({ requestId, paragraphs }: { requestId: string; paragraphs: string[] }) => {
          try {
            console.log('[Yoru] Parsing text request from extension. Request ID:', requestId);
            const result = await parseExtensionText(paragraphs);
            window.electronAPI.replyParseText({ requestId, result });
          } catch (err: any) {
            console.error('[Yoru] Failed to parse extension text:', err);
            window.electronAPI.replyParseText({ requestId, error: err.message });
          }
        });
      }
    }

    const runMaintenance = async () => {
      try {
        console.log("[App] Running background yomitan database maintenance...");
        await migrateEnglishDictName();
        await migrateDictFlags();
        await cleanOrphanedEntries();
        console.log("[App] Yomitan database maintenance completed.");
        
        // Auto-import native pitch accent dictionary if not already installed
        try {
          const idb = await getDB();
          const installedDicts: any[] = await new Promise((resolve, reject) => {
            const tx = idb.transaction('dicts', 'readonly');
            const store = tx.objectStore('dicts');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          const hasPitch = installedDicts.some((d: any) => 
            d.title.includes('アクセント') || 
            d.title.toLowerCase().includes('pitch')
          );
          
          if (!hasPitch) {
            console.log('[App] Pitch accent dictionary not found. Attempting native auto-import...');
            try {
              const response = await fetch('./pitch_accent.zip');
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const file = new File([arrayBuffer], 'pitch_accent.zip', { type: 'application/zip' });
                console.log('[App] Starting pitch accent auto-import from bundled assets');
                await importYomitanZip(file, (msg, pct) => {
                  console.log(`[App] Auto-importing pitch: ${msg} (${pct}%)`);
                });
                console.log('[App] Pitch accent dictionary successfully auto-imported!');
              } else {
                console.warn('[App] pitch_accent.zip not found in bundled assets (HTTP:', response.status, ')');
              }
            } catch (fetchErr) {
              console.warn('[App] Failed to fetch bundled pitch_accent.zip:', fetchErr);
            }
          }
        } catch (importErr) {
          console.warn('[App] Native pitch accent auto-import failed:', importErr);
        }
      } catch (err) {
        console.warn("[App] Background maintenance failed:", err);
      }
    };
    runMaintenance();

    return () => {
      if (unsubscribeQuery) unsubscribeQuery();
      if (unsubscribeSave) unsubscribeSave();
      if (unsubscribeParse) unsubscribeParse();
      if (unsubscribeUpdateStatus) unsubscribeUpdateStatus();
    };
  }, []);

  // Calculate vocab stats ONLY for the currently active book being read
  useEffect(() => {
    if (!activeBook) return;

    let active = true;
    
    const calculateVocabStats = (uniqueWords: Set<string>, tokens: any[], statuses: Record<string, string>) => {
      let knownWordsCount = 0;
      let ignoredWordsCount = 0;
      uniqueWords.forEach(word => {
        const s = statuses[word];
        if (s === 'known' || s === 'starred') {
          knownWordsCount++;
        } else if (s === 'ignored') {
          ignoredWordsCount++;
        }
      });
      const unknownWordsCount = uniqueWords.size - knownWordsCount - ignoredWordsCount;
      const coverage = uniqueWords.size > 0 ? Math.round((knownWordsCount / uniqueWords.size) * 100) : 0;

      const sentences: any[][] = [];
      let currentSentence: any[] = [];
      tokens.forEach(tok => {
        currentSentence.push(tok);
        if (tok.isLineBreak || tok.surface === '。' || tok.surface === '！' || tok.surface === '？') {
          if (currentSentence.length > 0) {
            if (currentSentence.some(t => t.isWord)) {
              sentences.push(currentSentence);
            }
            currentSentence = [];
          }
        }
      });
      if (currentSentence.length > 0 && currentSentence.some(t => t.isWord)) {
        sentences.push(currentSentence);
      }

      let knownSentencesCount = 0;
      let oneUnknownSentencesCount = 0;
      let multipleUnknownSentencesCount = 0;

      sentences.forEach(sentence => {
        const sentenceWords = new Set<string>();
        sentence.forEach(t => {
          if (t.isWord && t.basicForm) {
            sentenceWords.add(t.basicForm);
          }
        });

        let unknownInSentence = 0;
        sentenceWords.forEach(w => {
          const s = statuses[w];
          const isKnown = s === 'known' || s === 'starred';
          const isIgnored = s === 'ignored';
          if (!isKnown && !isIgnored) {
            unknownInSentence++;
          }
        });

        if (unknownInSentence === 0) {
          knownSentencesCount++;
        } else if (unknownInSentence === 1) {
          oneUnknownSentencesCount++;
        } else {
          multipleUnknownSentencesCount++;
        }
      });

      const totalSentences = sentences.length || 1;

      return {
        coverage,
        knownWords: knownWordsCount,
        unknownWords: unknownWordsCount,
        ignoredWords: ignoredWordsCount,
        uniqueWordsTotal: uniqueWords.size,
        recommendedSentences: oneUnknownSentencesCount,
        sentencesKnownPct: Math.round((knownSentencesCount / totalSentences) * 100),
        sentences1TPct: Math.round((oneUnknownSentencesCount / totalSentences) * 100),
        sentencesMTPct: Math.round((multipleUnknownSentencesCount / totalSentences) * 100)
      };
    };

    const updateActiveBookStats = async () => {
      try {
        let cached = uniqueWordsCacheRef.current[activeBook.id];
        let uniqueWords: Set<string>;
        let tokens: any[];

        if (!cached) {
          const allText = (activeBook.chapters || []).map((c: any) => c.content || '').join('\n');
          if (allText.trim()) {
            const paragraphs = await tokenizeText(allText);
            tokens = paragraphs.flat();
            uniqueWords = new Set();
            tokens.forEach(tok => {
              if (tok && tok.isWord && tok.basicForm) {
                uniqueWords.add(tok.basicForm);
              }
            });
            uniqueWordsCacheRef.current[activeBook.id] = { uniqueWords, tokens };
          } else {
            uniqueWords = new Set();
            tokens = [];
            uniqueWordsCacheRef.current[activeBook.id] = { uniqueWords, tokens };
          }
        } else {
          uniqueWords = cached.uniqueWords;
          tokens = cached.tokens;
        }

        const stats = calculateVocabStats(uniqueWords, tokens, wordStatuses);
        const hasChanged = activeBook.vocabularyCoverage !== stats.coverage ||
                           JSON.stringify(activeBook.vocabStats || {}) !== JSON.stringify(stats);

        if (hasChanged && active) {
          const updatedBooks = await db.updateBookDetails(activeBook.id, {
            vocabularyCoverage: stats.coverage,
            vocabStats: stats
          });
          setBooks(updatedBooks);
          setActiveBook((prev: any) => {
            if (prev && prev.id === activeBook.id) {
              return {
                ...prev,
                vocabularyCoverage: stats.coverage,
                vocabStats: stats
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Error updating active book stats:", err);
      }
    };

    updateActiveBookStats();

    return () => {
      active = false;
    };
  }, [activeBook?.id, wordStatuses]);

  // 1. Initialize and reload data when active profile changes
  useEffect(() => {
    setBooks([]);
    const loadBooksData = async () => {
      const loadedBooks = await db.getBooks();
      if (loadedBooks.length === 0 && activeProfileId === 'profile-default') {
        const seeded = SAMPLE_BOOKS.map((book, idx) => ({
          ...book,
          id: `sample-${idx}-${Date.now()}`,
          progress: {
            ...(book.progress || {}),
            charactersRead: (book.progress || {}).charactersRead || 0,
            secondsRead: (book.progress || {}).secondsRead || 0
          }
        }));
        await db.saveBooks(seeded);
        setBooks(seeded);
      } else {
        setBooks(loadedBooks);
      }
    };

    loadBooksData();

    const loadedStatuses = db.getWordStatuses();
    
    if (Object.keys(loadedStatuses).length === 0 && activeProfileId === 'profile-default') {
      const initialSeed = {
        '時間': 'new',
        '長い': 'new',
        '確か': 'new',
        '美味しい': 'new',
        '焼ける': 'new',
        'お皿': 'new',
        '結局': 'new',
        '伸ばす': 'new',
        'ひっこめる': 'new',
        '今日': 'learning'
      };
      db.saveWordStatuses(initialSeed);
      setWordStatuses(initialSeed);
    } else {
      const runMigration = async () => {
        const cleanWord = (val: string) => {
          if (!val) return '';
          let s = val.replace(/<[^>]*>/g, '');
          s = s.replace(/\[[^\]]*\]/g, '')
               .replace(/\([^)]*\)/g, '')
               .replace(/（[^）]*）/g, '')
               .replace(/\{[^}]*\}/g, '');
          const parts = s.split(/[\s\-ー:：|]/);
          s = parts[0] || '';
          return s.trim();
        };

        const sanitizedStatuses: Record<string, string> = {};
        let needsMigration = false;

        for (const [key, val] of Object.entries(loadedStatuses)) {
          const cleanKey = cleanWord(key);
          if (!cleanKey) continue;

          const isSentence = cleanKey.length > 5 || 
                             cleanKey.includes('。') || 
                             cleanKey.includes('、') || 
                             cleanKey.includes('？') || 
                             cleanKey.includes('！') ||
                             /[\u3040-\u309F]/.test(cleanKey) && (cleanKey.includes('は') || cleanKey.includes('が') || cleanKey.includes('を') || cleanKey.includes('に') || cleanKey.includes('で'));

          if (isSentence && cleanKey.length > 3) {
            needsMigration = true;
            try {
              const paragraphs = await tokenizeText(cleanKey);
              const tokens = paragraphs.flat();
              tokens.forEach(tok => {
                if (tok && tok.isWord && tok.basicForm) {
                  const subClean = cleanWord(tok.basicForm);
                  if (subClean && subClean.length > 0) {
                    const existing = sanitizedStatuses[subClean];
                    if (!existing || val === 'known' || val === 'starred') {
                      sanitizedStatuses[subClean] = val;
                    }
                  }
                }
              });
            } catch (e) {
              console.error("Migration failed to tokenize sentence key:", cleanKey, e);
              sanitizedStatuses[cleanKey] = val;
            }
          } else {
            const existing = sanitizedStatuses[cleanKey];
            if (!existing || val === 'known' || val === 'starred') {
              sanitizedStatuses[cleanKey] = val;
            }
            if (cleanKey !== key) {
              needsMigration = true;
            }
          }
        }

        if (needsMigration) {
          db.saveWordStatuses(sanitizedStatuses);
        }
        setWordStatuses(sanitizedStatuses);
      };

      runMigration();
    }

    setSettings(db.getSettings());
  }, [activeProfileId]);

  useEffect(() => {
    if (activeBook) {
      document.body.classList.add('reader-active');
    } else {
      document.body.classList.remove('reader-active');
    }
    return () => {
      document.body.classList.remove('reader-active');
    };
  }, [activeBook]);

  const handleSelectBook = async (book: any) => {
    setActiveBook(book);
    await db.updateBookDetails(book.id, { lastRead: new Date().toISOString() });
    const loadedBooks = await db.getBooks();
    setBooks(loadedBooks);
  };

  const handleUpdateProgress = useCallback(async (bookId: string, currentChapter: number, currentPage: number, percent: number) => {
    const updatedBooks = await db.updateBookProgress(bookId, currentChapter, currentPage, percent);
    setBooks(updatedBooks);
  }, []);

  const handleIncrementReadingStats = useCallback(async (bookId: string, chars: number, seconds: number) => {
    const updatedBooks = await db.incrementReadingStats(bookId, chars, seconds);
    setBooks(updatedBooks);
    
    // Save to daily statistics database
    const book = updatedBooks.find(b => b.id === bookId);
    if (book && book.title) {
      await db.saveReadingStatsEntry(book.title, chars, seconds);
    }
  }, []);

  const handleAddBooks = async (booksData: any[]) => {
    const updatedBooks = await db.addBooks(booksData);
    setBooks(updatedBooks);
  };

  const handleDeleteBook = async (bookId: string) => {
    const updatedBooks = await db.deleteBook(bookId);
    setBooks(updatedBooks);
    if (activeBook && activeBook.id === bookId) {
      setActiveBook(null);
    }
  };

  const handleBulkDeleteBooks = async (bookIds: string[]) => {
    const updatedBooks = await db.deleteBooks(bookIds);
    setBooks(updatedBooks);
    if (activeBook && bookIds.includes(activeBook.id)) {
      setActiveBook(null);
    }
  };

  const handleClearDeletedBooks = async () => {
    const updatedBooks = await db.clearDeletedBooks();
    setBooks(updatedBooks);
  };

  const handleUpdateBookDetails = async (bookId: string, data: any) => {
    const updatedBooks = await db.updateBookDetails(bookId, data);
    setBooks(updatedBooks);
    if (activeBook && activeBook.id === bookId) {
      setActiveBook({ ...activeBook, ...data });
    }
  };

  const handleSetWordStatus = async (word: string, status: string, wordData: any = null) => {
    const updatedStatuses = db.setWordStatus(word, status);
    setWordStatuses(updatedStatuses);

    if (status === 'learning') {
      const existingCard = db.getSrsCard(word);
      if (!existingCard) {
        db.saveSrsCard(word, {
          word,
          reading: wordData?.reading || '',
          sentence: wordData?.sentence || '',
          source: wordData?.source || activeBook?.title || 'Yoru Reader',
          state: 0, // New
          dueDate: new Date().toISOString(), // Due immediately
          due: new Date().toISOString()
        });
      } else {
        if (wordData?.source) {
          existingCard.source = wordData.source;
          db.saveSrsCard(word, existingCard);
        }
      }
    }

    if (status !== 'known') return;

    const savedAnki = localStorage.getItem('anki_settings_v2');
    if (!savedAnki) return;

    let ankiOpts: any;
    try { ankiOpts = JSON.parse(savedAnki); } catch { return; }
    if (!ankiOpts.enabled) return;

    const host = ankiOpts.host || 'http://127.0.0.1:8765';
    const deck = ankiOpts.expression?.deck || 'sentence mining';
    const noteType = ankiOpts.expression?.noteType || 'Lapis';
    const fields = ankiOpts.expression?.fields || {};
    const wordField = ankiOpts.importWordField || Object.keys(fields).find(k => fields[k] === '{expression}') || 'Expression';

    const ankiFetch = async (action: string, params: any) => {
      try {
        const r = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, version: 6, params })
        });
        return await r.json();
      } catch { return null; }
    };

    const COMMON_WORD_FIELDS = [
      wordField,
      'Expression',
      'Vocabulary-Kanji',
      'VocabKanji',
      'Vocabulary',
      'Word',
      'Kanji',
      'Front',
      '表現',
      'Japanese',
      'Vocab',
      'Reading',
    ];
    const fieldsToTry = [...new Set(COMMON_WORD_FIELDS)];

    let noteIds = null;
    for (const field of fieldsToTry) {
      const q = `"${field}:${word}"`;
      const r = await ankiFetch('findNotes', { query: q });
      if (r?.result && r.result.length > 0) {
        noteIds = r.result;
        console.log(`[Yoru] Found ${noteIds.length} note(s) for "${word}" in field "${field}"`);
        break;
      }
    }

    const matureCards = async (cIds: number[]) => {
      if (!cIds || cIds.length === 0) return;
      await ankiFetch('setEaseFactors', { cardIds: cIds, easeFactors: cIds.map(() => 2500) });
      const today = Math.floor(Date.now() / 86400000);
      await ankiFetch('setSpecificCardInfo', { cards: cIds.map(id => ({ id, interval: 30, ease: 2500, lapses: 0, reviews: 1 })) });
      console.log(`[Yoru] Matured ${cIds.length} card(s) for word: "${word}"`);
    };

    if (noteIds && noteIds.length > 0) {
      const cardsResult = await ankiFetch('notesInfo', { notes: noteIds });
      const cardIds = (cardsResult?.result || []).flatMap((n: any) => n.cards || []);
      await matureCards(cardIds);
    } else {
      const noteFields: Record<string, string> = {};
      const reading = wordData?.reading || word;
      const meaning = wordData?.meaning || '';

      for (const [fieldName, tmpl] of Object.entries(fields)) {
        if (!tmpl) { noteFields[fieldName] = ''; continue; }
        noteFields[fieldName] = (tmpl as string)
          .replaceAll('{expression}', word)
          .replaceAll('{furigana}', reading)
          .replaceAll('{reading}', reading)
          .replaceAll('{meaning}', meaning)
          .replaceAll('{glossary}', meaning)
          .replaceAll('{glossary-brief}', meaning)
          .replaceAll('{glossary-first}', meaning)
          .replaceAll('{bilingual}', meaning)
          .replaceAll('{audio}', '')
          .replaceAll('{screenshot}', '')
          .replaceAll('{sentence}', '')
          .replaceAll('{sentence-furigana}', '')
          .replaceAll('{sentence-audio}', '')
          .replaceAll('{sentence-cloze}', '')
          .replaceAll(/\{[^}]+\}/g, '');
      }

      if (Object.keys(noteFields).length === 0) {
        noteFields[wordField] = word;
      }

      const rawTags = ankiOpts.tags || 'yoru_reader';
      const tagsList = rawTags.split(/[\s,]+/).filter((t: string) => t.trim());
      if (!tagsList.includes('yoru_reader')) tagsList.push('yoru_reader');
      if (!tagsList.includes('auto_known')) tagsList.push('auto_known');

      const addResult = await ankiFetch('addNote', {
        note: {
          deckName: deck,
          modelName: noteType,
          fields: noteFields,
          options: { allowDuplicate: false, duplicateScope: 'deck' },
          tags: tagsList
        }
      });

      if (addResult?.result) {
        const newNoteInfo = await ankiFetch('notesInfo', { notes: [addResult.result] });
        const newCardIds = (newNoteInfo?.result || []).flatMap((n: any) => n.cards || []);
        await matureCards(newCardIds);
        console.log(`[Yoru] Created + matured card for word: "${word}"`);
      } else {
        console.warn('[Yoru] Could not create Anki card for:', word, addResult?.error);
      }
    }
  };

  const handleSaveSettings = (newSettings: any) => {
    db.saveSettings(newSettings);
    setSettings(newSettings);
    clearYomitanCache();
  };

  const handleSelectProfile = (profileId: string) => {
    setBooks([]);
    db.setActiveProfileId(profileId);
    setActiveProfileId(profileId);
  };

  const handleAddProfile = (newProfile: any) => {
    setBooks([]);
    const currentSettings = db.getSettings();
    const updatedProfiles = [...profiles, newProfile];
    db.saveProfiles(updatedProfiles);
    setProfiles(updatedProfiles);
    
    db.setActiveProfileId(newProfile.id);
    db.saveSettings(currentSettings);
    setActiveProfileId(newProfile.id);
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profiles.length <= 1) {
      await showConfirm({
        title: lang === 'es' ? 'Acción no permitida' : 'Action not allowed',
        message: lang === 'es' ? 'No puedes eliminar el único perfil.' : 'You cannot delete the only profile.',
        type: 'warning',
        confirmText: lang === 'es' ? 'Entendido' : 'OK',
        cancelText: '',
      });
      return;
    }
    const ok = await showConfirm({
      title: lang === 'es' ? '¿Eliminar perfil?' : 'Delete profile?',
      message: lang === 'es'
        ? '¿Estás seguro de que deseas eliminar este perfil? Se perderán todos sus libros e historial.'
        : 'Are you sure you want to delete this profile? All books and history will be lost.',
      type: 'danger',
      confirmText: lang === 'es' ? 'Eliminar' : 'Delete',
    });
    if (ok) {
      setBooks([]);
      const updatedProfiles = profiles.filter(p => p.id !== profileId);
      db.saveProfiles(updatedProfiles);
      setProfiles(updatedProfiles);

      if (activeProfileId === profileId) {
        const nextProfileId = updatedProfiles[0].id;
        db.setActiveProfileId(nextProfileId);
        setActiveProfileId(nextProfileId);
      }
    }
  };

  const handleUpdateProfile = (profileId: string, updatedData: any) => {
    const updatedProfiles = profiles.map(p => p.id === profileId ? { ...p, ...updatedData } : p);
    db.saveProfiles(updatedProfiles);
    setProfiles(updatedProfiles);
    
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
      setTimeout(() => {
        setActiveProfileId(profileId);
      }, 0);
    }
  };

  return (
    <div className="app-container" data-theme={settings.theme}>
      {profiles.length === 0 ? (
        <WelcomeScreen onCreateProfile={handleAddProfile} settings={settings} onSaveSettings={handleSaveSettings} />
      ) : activeBook ? (
        <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>{lang === 'es' ? 'Cargando lector...' : 'Loading reader...'}</div>}>
          <Reader 
            book={activeBook}
            onBack={(targetTab) => {
              setActiveBook(null);
              if (targetTab) {
                setLibraryTab(targetTab);
              } else {
                setLibraryTab('library');
              }
            }}
            onUpdateProgress={handleUpdateProgress}
            onIncrementReadingStats={handleIncrementReadingStats}
            wordStatuses={wordStatuses}
            onSetWordStatus={handleSetWordStatus}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onUpdateBookDetails={handleUpdateBookDetails}
          />
        </React.Suspense>
      ) : (
        <Library 
          books={books}
          onSelectBook={handleSelectBook}
          onAddBooks={handleAddBooks}
          onDeleteBook={handleDeleteBook}
          onBulkDeleteBooks={handleBulkDeleteBooks}
          onUpdateBookDetails={handleUpdateBookDetails}
          onOpenInfo={(book) => {
            setInfoBook(book);
            setIsInfoOpen(true);
          }}
          profiles={profiles}
          activeProfileId={activeProfileId || ''}
          onSelectProfile={handleSelectProfile}
          onAddProfile={handleAddProfile}
          onDeleteProfile={handleDeleteProfile}
          onUpdateProfile={handleUpdateProfile}
          onClearDeletedBooks={handleClearDeletedBooks}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          wordStatuses={wordStatuses}
          initialTab={libraryTab}
        />
      )}

      {/* Manual Guide Modal */}
      <React.Suspense fallback={null}>
        {isInfoOpen && (
          <SettingsModal 
            isOpen={isInfoOpen} 
            onClose={() => {
              setIsInfoOpen(false);
              setInfoBook(null);
            }}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            mode="info"
            book={infoBook}
            onUpdateBookDetails={handleUpdateBookDetails}
          />
        )}
      </React.Suspense>

      {/* Styled confirm modal */}
      {confirmModal}
    </div>
  );
}
