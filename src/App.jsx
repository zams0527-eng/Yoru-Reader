import React, { useState, useEffect, useCallback } from 'react';
import Library from './components/Library';
import Reader from './components/Reader';
import SettingsModal from './components/SettingsModal';
import { db } from './utils/db';
import { tokenizeText } from './utils/japanese';

const SAMPLE_BOOKS = [
  {
    title: 'また、同じ夢を見ていた',
    author: '住野よる',
    cover: 'linear-gradient(135deg, #0f0c2f 0%, #201348 100%)',
    chapters: [
      {
        title: 'Capítulo 1',
        content: `「生きてる時間が長いからね。どうやったら勝てるのか、なっちゃんよりもよく知ってるのさ」\n\nおばあちゃんは生きてきた時間のことをよく言います。確かに、おばあちゃんは私がこれまでに生きた時間を七回も過ごしているのだから、それくらいあれば私にだって美味しいマドレーヌが焼けるかもしれません。\n\n一つ目のマドレーヌを食べ終わり、お皿に載った二つ目に手を伸ばそうとしたけど、結局何も取らずに手をひっこめました。今日はヤクルトもアイスもいりません。\n\nおばあちゃんの家を出て、小川の横の草むらを歩きました。風が吹くと、草が擦れ合う音がさらさらと聞こえます。\n\n「幸せって、何だろう」\n\n私は独り言を呟きながら、空を見上げました。空は夕焼け色に染まっていて、とても綺麗でした。おばあちゃんのマドレーヌのように、甘くて温かい色をしていました。`
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
        content: `これは、ある冴えないオタクの少年と、彼の運命を変えた一人の少女の物語である。\n\n「ねえ、倫也。私は本当に、あなたのヒロインになれたのかな」\n\n加藤恵は、いつもと変わらない静かな声で私に問いかけた。その表情には、いつもの掴みどころのない微笑みが浮かんでいた。\n\n「ああ、恵。君は俺にとって、世界一のメインヒロインだ」\n\n私は胸を張って答えた。彼女と出会ってからの数年間、様々なことがあった。`
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
        content: `「倫也、私たちの同人誌、絶対に成功させようね」\n\n澤村・スペンサー・英梨々は、ツインテールを揺らしながら言った。彼女の目には、強い闘志が宿っていた。\n\n「ああ、当たり前だ。俺たちの全力をぶつけよう」\n\n私たちは拳を軽く合わせ、これからの戦いに備えた。`
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
        content: `「倫也くん、私の脚本、どうかしら」\n\n霞ヶ丘詩羽は、長い黒髪をかき上げながら、妖艶な笑みを浮かべた。彼女のシナリオは、いつも完璧で、そして少しだけ恐ろしい。\n\n「素晴らしいですよ、詩羽先輩。でも、このシーンは少し過激すぎませんか？」\n\n「あら、これくらいで怯むなんて、まだまだ子供ね」`
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
  const [profiles, setProfiles] = useState(db.getProfiles());
  const [activeProfileId, setActiveProfileId] = useState(db.getActiveProfileId());
  
  const [books, setBooks] = useState([]);
  const [activeBook, setActiveBook] = useState(null);
  const [wordStatuses, setWordStatuses] = useState({});
  const [settings, setSettings] = useState(db.getSettings());
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [infoBook, setInfoBook] = useState(null);

  const uniqueWordsCacheRef = React.useRef({});

  // Calculate vocab stats ONLY for the currently active book being read
  useEffect(() => {
    if (!activeBook) return;

    let active = true;
    
    const calculateVocabStats = (uniqueWords, tokens, statuses) => {
      // 1. Unique word counts
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

      // 2. Sentence metrics (1T recommended)
      const sentences = [];
      let currentSentence = [];
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
        const sentenceWords = new Set();
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
        let uniqueWords, tokens;

        if (!cached) {
          const allText = (activeBook.chapters || []).map(c => c.content || '').join('\n');
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
          setActiveBook(prev => {
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
    const loadBooksData = async () => {
      // Load books
      const loadedBooks = await db.getBooks();
      if (loadedBooks.length === 0 && activeProfileId === 'profile-default') {
        // Seed default sample books
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

    // Load word statuses
    const loadedStatuses = db.getWordStatuses();
    
    // Seed some initial statuses for the words in our sample text
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
        const cleanWord = (val) => {
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

        const sanitizedStatuses = {};
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

    // Load settings
    setSettings(db.getSettings());
  }, [activeProfileId]);

  // Toggle 'reader-active' class on body to control scrollbar visibility
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

  // 2. Handle selecting a book
  const handleSelectBook = async (book) => {
    setActiveBook(book);
    await db.updateBookDetails(book.id, { lastRead: new Date().toISOString() });
    const loadedBooks = await db.getBooks();
    setBooks(loadedBooks);
  };

  // 3. Handle updating book reading progress
  // 3. Handle updating book reading progress
  const handleUpdateProgress = useCallback(async (bookId, currentChapter, currentPage, percent) => {
    const updatedBooks = await db.updateBookProgress(bookId, currentChapter, currentPage, percent);
    setBooks(updatedBooks);
    
    // Update active book reference
    if (activeBook && activeBook.id === bookId) {
      setActiveBook(prev => ({
        ...prev,
        progress: { 
          ...(prev.progress || {}),
          currentChapter, 
          currentPage, 
          percent 
        }
      }));
    }
  }, [activeBook]);

  const handleIncrementReadingStats = useCallback(async (bookId, chars, seconds) => {
    const updatedBooks = await db.incrementReadingStats(bookId, chars, seconds);
    setBooks(updatedBooks);
    
    // Update active book reference to reflect new stats
    if (activeBook && activeBook.id === bookId) {
      setActiveBook(prev => ({
        ...prev,
        progress: {
          ...(prev.progress || {}),
          charactersRead: ((prev.progress || {}).charactersRead || 0) + chars,
          secondsRead: ((prev.progress || {}).secondsRead || 0) + seconds
        }
      }));
    }
  }, [activeBook]);

  // 4. Handle adding custom books
  const handleAddBooks = async (booksData) => {
    const updatedBooks = await db.addBooks(booksData);
    setBooks(updatedBooks);
  };

  // 5. Handle deleting a book
  const handleDeleteBook = async (bookId) => {
    const updatedBooks = await db.deleteBook(bookId);
    setBooks(updatedBooks);
    if (activeBook && activeBook.id === bookId) {
      setActiveBook(null);
    }
  };

  // 5c. Handle deleting multiple books
  const handleBulkDeleteBooks = async (bookIds) => {
    const updatedBooks = await db.deleteBooks(bookIds);
    setBooks(updatedBooks);
    if (activeBook && bookIds.includes(activeBook.id)) {
      setActiveBook(null);
    }
  };

  // 5b. Handle updating book details
  const handleUpdateBookDetails = async (bookId, data) => {
    const updatedBooks = await db.updateBookDetails(bookId, data);
    setBooks(updatedBooks);
    if (activeBook && activeBook.id === bookId) {
      setActiveBook({ ...activeBook, ...data });
    }
  };

  // 6. Handle vocabulary status changes
  // 6. Handle vocabulary status changes
  const handleSetWordStatus = async (word, status) => {
    const updatedStatuses = db.setWordStatus(word, status);
    setWordStatuses(updatedStatuses);

    // Auto-mature in Anki if enabled and status is 'known'
    const savedAnki = localStorage.getItem('anki_settings_v2');
    if (savedAnki) {
      try {
        const ankiOpts = JSON.parse(savedAnki);
        if (ankiOpts.enabled && ankiOpts.autoMature && status === 'known') {
          const deck = ankiOpts.expression?.deck || 'sentence mining';
          const fields = ankiOpts.expression?.fields || {};
          const wordField = Object.keys(fields).find(k => fields[k] === '{expression}') || 'Expression';
          
          // Query expression in Anki
          const query = `deck:"${deck}" "${wordField}:${word}"`;
          const res = await fetch(ankiOpts.host, {
            method: 'POST',
            body: JSON.stringify({
              action: 'findCards',
              version: 6,
              params: { query }
            })
          });
          const data = await res.json();
          if (data.result && data.result.length > 0) {
            // Force cards to become mature (interval: 30 days, ease: 2500)
            for (const cardId of data.result) {
              await fetch(ankiOpts.host, {
                method: 'POST',
                body: JSON.stringify({
                  action: 'setSpecificCardInfo',
                  version: 6,
                  params: {
                    card: cardId,
                    ease: 2500,
                    interval: 30,
                    lapses: 0,
                    reviews: 1
                  }
                })
              });
            }
            console.log(`Auto-matured card(s) in Anki for word: "${word}"`);
          }
        }
      } catch (err) {
        console.error('Failed to auto-mature card in Anki:', err);
      }
    }
  };

  // 7. Handle settings adjustments
  const handleSaveSettings = (newSettings) => {
    db.saveSettings(newSettings);
    setSettings(newSettings);
  };

  // 8. Profiles Management Actions
  const handleSelectProfile = (profileId) => {
    db.setActiveProfileId(profileId);
    setActiveProfileId(profileId);
  };

  const handleAddProfile = (newProfile) => {
    const updatedProfiles = [...profiles, newProfile];
    db.saveProfiles(updatedProfiles);
    setProfiles(updatedProfiles);
    
    db.setActiveProfileId(newProfile.id);
    setActiveProfileId(newProfile.id);
  };

  const handleDeleteProfile = (profileId) => {
    if (profiles.length <= 1) {
      alert("No puedes eliminar el único perfil.");
      return;
    }
    if (confirm("¿Estás seguro de que deseas eliminar este perfil? Se perderán todos sus libros e historial.")) {
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

  const handleUpdateProfile = (profileId, updatedData) => {
    const updatedProfiles = profiles.map(p => p.id === profileId ? { ...p, ...updatedData } : p);
    db.saveProfiles(updatedProfiles);
    setProfiles(updatedProfiles);
    
    // Force activeProfileId reload if the edited profile was the active one
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
      setTimeout(() => {
        setActiveProfileId(profileId);
      }, 0);
    }
  };

  return (
    <div className="app-container" data-theme={settings.theme}>
      {activeBook ? (
        <Reader 
          book={activeBook}
          onBack={() => setActiveBook(null)}
          onUpdateProgress={handleUpdateProgress}
          onIncrementReadingStats={handleIncrementReadingStats}
          wordStatuses={wordStatuses}
          onSetWordStatus={handleSetWordStatus}
          settings={settings}
          onSaveSettings={handleSaveSettings}
        />
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
          activeProfileId={activeProfileId}
          onSelectProfile={handleSelectProfile}
          onAddProfile={handleAddProfile}
          onDeleteProfile={handleDeleteProfile}
          onUpdateProfile={handleUpdateProfile}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          wordStatuses={wordStatuses}
        />
      )}

      {/* Manual Guide Modal */}
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
    </div>
  );
}
