import React, { useState, useEffect, useCallback } from 'react';
import Library from './components/Library';
import WelcomeScreen from './components/WelcomeScreen';
const Reader = React.lazy(() => import('./components/Reader'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
import { db } from './utils/db';
import { tokenizeText } from './utils/japanese';
import { clearYomitanCache } from './utils/yomitanDB';
import { useConfirm } from './components/ConfirmModal';

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
  const lang = settings.appLanguage || 'es';
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [infoBook, setInfoBook] = useState(null);

  const { showConfirm, confirmModal } = useConfirm();

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
    // Solo persistimos en DB y actualizamos la lista de libros.
    // Reader gestiona su propio currentPage/currentChapter internamente,
    // por lo que actualizar activeBook aquí causaría un re-render innecesario.
    const updatedBooks = await db.updateBookProgress(bookId, currentChapter, currentPage, percent);
    setBooks(updatedBooks);
  }, []);  // Sin deps de activeBook → identidad estable entre renders

  const handleIncrementReadingStats = useCallback(async (bookId, chars, seconds) => {
    // Solo persistimos stats en DB. Reader maneja sus propios contadores en refs.
    // Actualizar activeBook causaría un re-render de Reader cada 5 segundos.
    const updatedBooks = await db.incrementReadingStats(bookId, chars, seconds);
    setBooks(updatedBooks);
  }, []);  // Sin deps de activeBook → identidad estable
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
  // wordData: optional { reading, meaning } passed from Reader when marking as known
  const handleSetWordStatus = async (word, status, wordData = null) => {
    const updatedStatuses = db.setWordStatus(word, status);
    setWordStatuses(updatedStatuses);

    // Auto-mature (and auto-create if needed) in Anki when status becomes 'known'
    if (status !== 'known') return;

    const savedAnki = localStorage.getItem('anki_settings_v2');
    if (!savedAnki) return;

    let ankiOpts;
    try { ankiOpts = JSON.parse(savedAnki); } catch { return; }
    if (!ankiOpts.enabled) return;

    const host = ankiOpts.host || 'http://127.0.0.1:8765';
    const deck = ankiOpts.expression?.deck || 'sentence mining';
    const noteType = ankiOpts.expression?.noteType || 'Lapis';
    const fields = ankiOpts.expression?.fields || {};
    const wordField = ankiOpts.importWordField || Object.keys(fields).find(k => fields[k] === '{expression}') || 'Expression';

    const ankiFetch = async (action, params) => {
      try {
        const r = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, version: 6, params })
        });
        return await r.json();
      } catch { return null; }
    };

    // 1. Search for existing notes matching this word across ALL decks and common field names.
    // Different decks use different field names (e.g. Core 2k/6k uses "Vocabulary-Kanji",
    // Lapis/Yomitan uses "Expression", etc.), so we try all common ones to avoid duplicates.
    const COMMON_WORD_FIELDS = [
      wordField,          // the user's configured field (highest priority)
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
    // De-duplicate while preserving order
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


    const matureCards = async (cIds) => {
      if (!cIds || cIds.length === 0) return;
      // Set ease to 2500 (normal) and interval to 30 days → card becomes "mature"
      await ankiFetch('setEaseFactors', { cardIds: cIds, easeFactors: cIds.map(() => 2500) });
      const today = Math.floor(Date.now() / 86400000); // Anki uses days-since-epoch
      const dues = {};
      cIds.forEach(id => { dues[String(id)] = today + 30; });
      await ankiFetch('setSpecificCardInfo', { cards: cIds.map(id => ({ id, interval: 30, ease: 2500, lapses: 0, reviews: 1 })) });
      console.log(`[Yoru] Matured ${cIds.length} card(s) for word: "${word}"`);
    };

    if (noteIds && noteIds.length > 0) {
      // Cards exist → get their card IDs and mature them
      const cardsResult = await ankiFetch('notesInfo', { notes: noteIds });
      const cardIds = (cardsResult?.result || []).flatMap(n => n.cards || []);
      await matureCards(cardIds);
    } else {
      // No card exists → create one with word data, then mature it
      // Build minimal fields using configured mapping or sensible defaults
      const noteFields = {};
      const reading = wordData?.reading || word;
      const meaning = wordData?.meaning || '';

      for (const [fieldName, tmpl] of Object.entries(fields)) {
        if (!tmpl) { noteFields[fieldName] = ''; continue; }
        noteFields[fieldName] = tmpl
          .replaceAll('{expression}', word)
          .replaceAll('{furigana}', reading)
          .replaceAll('{reading}', reading)
          .replaceAll('{meaning}', meaning)
          .replaceAll('{glossary}', meaning)
          .replaceAll('{glossary-brief}', meaning)
          .replaceAll('{glossary-first}', meaning)
          .replaceAll('{bilingual}', meaning)
          // clear media placeholders — we have no screenshot/audio in silent mode
          .replaceAll('{audio}', '')
          .replaceAll('{screenshot}', '')
          .replaceAll('{sentence}', '')
          .replaceAll('{sentence-furigana}', '')
          .replaceAll('{sentence-audio}', '')
          .replaceAll('{sentence-cloze}', '')
          .replaceAll(/\{[^}]+\}/g, '');
      }

      // Fallback: if fields is empty use bare minimum
      if (Object.keys(noteFields).length === 0) {
        noteFields[wordField] = word;
      }

      const rawTags = ankiOpts.tags || 'yoru_reader';
      const tagsList = rawTags.split(/[\s,]+/).filter(t => t.trim());
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
        // Get the card IDs for the newly created note and mature them
        const newNoteInfo = await ankiFetch('notesInfo', { notes: [addResult.result] });
        const newCardIds = (newNoteInfo?.result || []).flatMap(n => n.cards || []);
        await matureCards(newCardIds);
        console.log(`[Yoru] Created + matured card for word: "${word}"`);
      } else {
        console.warn('[Yoru] Could not create Anki card for:', word, addResult?.error);
      }
    }
  };


  // 7. Handle settings adjustments
  const handleSaveSettings = (newSettings) => {
    db.saveSettings(newSettings);
    setSettings(newSettings);
    // Invalidar cachés de búsqueda: el usuario puede haber cambiado dicts activos/orden
    clearYomitanCache();
  };

  // 8. Profiles Management Actions
  const handleSelectProfile = (profileId) => {
    db.setActiveProfileId(profileId);
    setActiveProfileId(profileId);
  };

  const handleAddProfile = (newProfile) => {
    const currentSettings = db.getSettings();
    const updatedProfiles = [...profiles, newProfile];
    db.saveProfiles(updatedProfiles);
    setProfiles(updatedProfiles);
    
    db.setActiveProfileId(newProfile.id);
    db.saveSettings(currentSettings);
    setActiveProfileId(newProfile.id);
  };

  const handleDeleteProfile = async (profileId) => {
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
      {profiles.length === 0 ? (
        <WelcomeScreen onCreateProfile={handleAddProfile} settings={settings} onSaveSettings={handleSaveSettings} />
      ) : activeBook ? (
        <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>{lang === 'es' ? 'Cargando lector...' : 'Loading reader...'}</div>}>
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

      {/* Styled confirm modal (replaces native window.confirm) */}
      {confirmModal}
    </div>
  );
}
