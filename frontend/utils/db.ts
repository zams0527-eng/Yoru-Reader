// LocalStorage DB manager for the Migaku-style Japanese Reader

export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  chapters: any[];
  progress: {
    currentChapter: number;
    currentPage: number;
    percent: number;
    charactersRead: number;
    secondsRead: number;
  };
  status: 'unread' | 'reading' | 'completed';
  createdAt: string;
  lastRead?: string;
  bookmarks?: any[];
  isDeleted?: boolean;
}

export interface Settings {
  fontSize: number;
  theme: string;
  showFurigana: string;
  showTranslation: boolean;
  autoTTS: boolean;
  showLearningStatus: boolean;
  sentenceHover: boolean;
  pitchAccent: string;
  appLanguage: string;
  audioSpeed: string;
  audioGender: string;
  audioVoiceOption: string;
  readingOrientation: string;
  keepStatsOnDelete?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  avatar?: string;
}

const STORAGE_KEYS = {
  BOOKS: 'migaku_reader_books',
  WORD_STATUS: 'migaku_reader_word_status',
  SETTINGS: 'migaku_reader_settings',
  PROFILES: 'migaku_reader_profiles',
  ACTIVE_PROFILE: 'migaku_reader_active_profile_id'
};

const DEFAULT_SETTINGS: Settings = {
  fontSize: 22, // default to 22px matching reference app scale
  theme: 'dark', // 'dark', 'light', 'sepia'
  showFurigana: 'unknown-only', // default to 'unknown-only' (Palabras desconocidas)
  showTranslation: true,
  autoTTS: false,
  showLearningStatus: true,
  sentenceHover: false,
  pitchAccent: 'none',
  appLanguage: 'en',
  audioSpeed: '1.0',
  audioGender: 'male',
  audioVoiceOption: 'masaru',
  readingOrientation: 'horizontal'
};

const DEFAULT_PROFILES: Profile[] = [];

// Simple IndexedDB key-value wrapper to support unlimited storage (bypassing localStorage 5MB limit)
const idb = {
  dbPromise: null as Promise<IDBDatabase> | null,

  _getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('YoruReaderStore', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('keyvalue')) {
          db.createObjectStore('keyvalue');
        }
      };
      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });
    return this.dbPromise;
  },

  async get(key: string): Promise<any> {
    const dbInstance = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('keyvalue', 'readonly');
      const store = tx.objectStore('keyvalue');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async set(key: string, value: any): Promise<void> {
    const dbInstance = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('keyvalue', 'readwrite');
      const store = tx.objectStore('keyvalue');
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async close(): Promise<void> {
    if (this.dbPromise) {
      const dbInstance = await this.dbPromise;
      dbInstance.close();
      this.dbPromise = null;
    }
  }
};

export const db = {
  async close() {
    await idb.close();
  },

  // --- Profiles Management ---
  getProfiles(): Profile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
      return data ? JSON.parse(data) : DEFAULT_PROFILES;
    } catch (e) {
      console.error('Error loading profiles:', e);
      return DEFAULT_PROFILES;
    }
  },

  saveProfiles(profiles: Profile[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    } catch (e) {
      console.error('Error saving profiles:', e);
    }
  },

  getActiveProfileId(): string | null {
    try {
      const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
      if (id) return id;
      const profiles = this.getProfiles();
      return profiles.length > 0 ? profiles[0].id : null;
    } catch (e) {
      return null;
    }
  },

  setActiveProfileId(id: string) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, id);
    } catch (e) {
      console.error('Error setting active profile:', e);
    }
  },

  // Helper to segment keys per profile with backward compatibility
  _getKey(baseKey: string): string {
    const profileId = this.getActiveProfileId();
    const segmentedKey = `${baseKey}_${profileId}`;
    
    // Migrate legacy non-segmented data on first run for default profile
    if (profileId === 'profile-default') {
      const legacyData = localStorage.getItem(baseKey);
      const segmentedData = localStorage.getItem(segmentedKey);
      if (legacyData && !segmentedData) {
        localStorage.setItem(segmentedKey, legacyData);
      }
    }
    return segmentedKey;
  },

  // --- Settings Management ---
  getSettings(): Settings {
    try {
      const data = localStorage.getItem(this._getKey(STORAGE_KEYS.SETTINGS));
      const globalLang = localStorage.getItem('app_language') || 'es';
      const parsed = data ? JSON.parse(data) : {};
      // Ensure globalLang overrides defaults, but settings can override if they exist and match
      return { ...DEFAULT_SETTINGS, appLanguage: globalLang, ...parsed };
    } catch (e) {
      console.error('Error loading settings:', e);
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: Settings) {
    try {
      if (settings && settings.appLanguage) {
        localStorage.setItem('app_language', settings.appLanguage);
      }
      localStorage.setItem(this._getKey(STORAGE_KEYS.SETTINGS), JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  },

  // --- Books Management (IndexedDB powered) ---
  async getBooks(): Promise<Book[]> {
    try {
      const key = this._getKey(STORAGE_KEYS.BOOKS);
      let books = await idb.get(key);
      
      // Migration from localStorage to IndexedDB
      if (!books) {
        const localData = localStorage.getItem(key);
        if (localData) {
          try {
            books = JSON.parse(localData);
            await idb.set(key, books);
            localStorage.removeItem(key); // clean up localstorage
            console.log("Migradas las estanterías de libros a IndexedDB.");
          } catch (e) {
            books = [];
          }
        } else {
          // Check legacy global key
          const legacyGlobalData = localStorage.getItem(STORAGE_KEYS.BOOKS);
          if (legacyGlobalData && this.getActiveProfileId() === 'profile-default') {
            try {
              books = JSON.parse(legacyGlobalData);
              await idb.set(key, books);
              localStorage.removeItem(STORAGE_KEYS.BOOKS);
              console.log("Migrados los libros globales legacy a IndexedDB.");
            } catch (e) {
              books = [];
            }
          }
        }
      }
      return books || [];
    } catch (e) {
      console.error('Error loading books from IndexedDB:', e);
      return [];
    }
  },

  async saveBooks(books: Book[]): Promise<void> {
    try {
      const key = this._getKey(STORAGE_KEYS.BOOKS);
      await idb.set(key, books);
    } catch (e) {
      console.error('Error saving books to IndexedDB:', e);
    }
  },

  async addBook(book: Partial<Book>): Promise<Book[]> {
    const books = await this.getBooks();
    // Check if book already exists by title
    const existingIdx = books.findIndex(b => b.title === book.title);
    if (existingIdx !== -1) {
      if (books[existingIdx].isDeleted) {
        // Restore/undelete it!
        books[existingIdx].isDeleted = false;
        books[existingIdx].chapters = book.chapters || [];
        await this.saveBooks(books);
      }
      return books;
    }
    const newBook: Book = {
      id: `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: book.title || 'Libro sin título',
      author: book.author || 'Desconocido',
      cover: book.cover || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      chapters: book.chapters || [],
      progress: {
        currentChapter: 0,
        currentPage: 0,
        percent: 0,
        charactersRead: 0,
        secondsRead: 0
      },
      status: 'unread', // 'unread', 'reading', 'completed'
      createdAt: new Date().toISOString()
    };
    books.push(newBook);
    await this.saveBooks(books);
    return books;
  },

  async addBooks(booksList: Partial<Book>[]): Promise<Book[]> {
    const books = await this.getBooks();
    console.log("db.addBooks - Libros existentes en DB:", books.map(b => b.title));
    console.log("db.addBooks - Libros nuevos a añadir:", booksList.map(b => b.title));
    let addedCount = 0;
    const now = Date.now();
    
    for (let i = 0; i < booksList.length; i++) {
      const book = booksList[i];
      const existingIdx = books.findIndex(b => b.title === book.title);
      if (existingIdx !== -1) {
        if (books[existingIdx].isDeleted) {
          // Restore/undelete it!
          books[existingIdx].isDeleted = false;
          books[existingIdx].chapters = book.chapters || [];
          addedCount++;
        } else {
          console.log(`db.addBooks - Saltando "${book.title}" porque ya existe.`);
        }
        continue;
      }
      const newBook: Book = {
        id: `book-${now}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        title: book.title || 'Libro sin título',
        author: book.author || 'Desconocido',
        cover: book.cover || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        chapters: book.chapters || [],
        progress: {
          currentChapter: 0,
          currentPage: 0,
          percent: 0,
          charactersRead: 0,
          secondsRead: 0
        },
        status: 'unread',
        createdAt: new Date().toISOString()
      };
      books.push(newBook);
      addedCount++;
    }
    
    if (addedCount > 0) {
      console.log("db.addBooks - Guardando libros combinados:", books.map(b => b.title));
      await this.saveBooks(books);
    }
    return books;
  },

  async updateBookProgress(bookId: string, currentChapter: number, currentPage: number, percent: number): Promise<Book[]> {
    const books = await this.getBooks();
    const updatedBooks = books.map(book => {
      if (book.id === bookId) {
        const newStatus = percent >= 99 ? 'completed' : (percent > 0 ? 'reading' : book.status);
        return {
          ...book,
          progress: { 
            ...(book.progress || {}), 
            currentChapter, 
            currentPage, 
            percent 
          },
          status: newStatus as 'unread' | 'reading' | 'completed',
          lastRead: new Date().toISOString()
        };
      }
      return book;
    });
    await this.saveBooks(updatedBooks);
    return updatedBooks;
  },

  async incrementReadingStats(bookId: string, charsToAdd: number, secondsToAdd: number): Promise<Book[]> {
    const books = await this.getBooks();
    const updatedBooks = books.map(book => {
      if (book.id === bookId) {
        const prevProgress = book.progress || {};
        const prevChars = prevProgress.charactersRead || 0;
        const prevSeconds = prevProgress.secondsRead || 0;
        return {
          ...book,
          progress: {
            ...prevProgress,
            charactersRead: prevChars + charsToAdd,
            secondsRead: prevSeconds + secondsToAdd
          },
          lastRead: new Date().toISOString()
        };
      }
      return book;
    });
    await this.saveBooks(updatedBooks);
    return updatedBooks;
  },

  async saveReadingStatsEntry(title: string, charsToAdd: number, secondsToAdd: number): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('books', 4);
      request.onupgradeneeded = (e: any) => {
        const dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains('statistic')) {
          const statisticsStore = dbInstance.createObjectStore('statistic', {
            keyPath: ['title', 'dateKey']
          });
          statisticsStore.createIndex('dateKey', 'dateKey');
          statisticsStore.createIndex('completedBook', ['completedBook', 'title']);
        }
      };
      request.onsuccess = (e: any) => {
        const dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains('statistic')) {
          // If version was already >=4 but store didn't exist for some reason, create it by recreating connection (rare fallback)
          dbInstance.close();
          const reqUpgrade = indexedDB.open('books', dbInstance.version + 1);
          reqUpgrade.onupgradeneeded = (ev: any) => {
            const upDb = ev.target.result;
            const statisticsStore = upDb.createObjectStore('statistic', {
              keyPath: ['title', 'dateKey']
            });
            statisticsStore.createIndex('dateKey', 'dateKey');
            statisticsStore.createIndex('completedBook', ['completedBook', 'title']);
          };
          reqUpgrade.onsuccess = (ev: any) => {
            const upDb = ev.target.result;
            const tx = upDb.transaction('statistic', 'readwrite');
            const store = tx.objectStore('statistic');
            const todayStr = new Date().toLocaleDateString('sv').slice(0, 10);
            const req = store.get([title, todayStr]);
            req.onsuccess = () => {
              const record = req.result;
              if (record) {
                record.charactersRead = (record.charactersRead || 0) + charsToAdd;
                record.readingTime = (record.readingTime || 0) + secondsToAdd;
                record.lastStatisticModified = Date.now();
                store.put(record);
              } else {
                store.put({
                  title,
                  dateKey: todayStr,
                  charactersRead: charsToAdd,
                  readingTime: secondsToAdd,
                  lastStatisticModified: Date.now()
                });
              }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          };
          reqUpgrade.onerror = () => resolve();
          return;
        }

        const tx = dbInstance.transaction('statistic', 'readwrite');
        const store = tx.objectStore('statistic');
        
        const todayStr = new Date().toLocaleDateString('sv').slice(0, 10);
        const req = store.get([title, todayStr]);
        
        req.onsuccess = () => {
          const record = req.result;
          if (record) {
            record.charactersRead = (record.charactersRead || 0) + charsToAdd;
            record.readingTime = (record.readingTime || 0) + secondsToAdd;
            record.lastStatisticModified = Date.now();
            store.put(record);
          } else {
            store.put({
              title,
              dateKey: todayStr,
              charactersRead: charsToAdd,
              readingTime: secondsToAdd,
              lastStatisticModified: Date.now()
            });
          }
        };
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          resolve();
        };
      };
      request.onerror = () => {
        resolve();
      };
    });
  },

  async deleteReadingStatsForBook(title: string): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('books', 4);
      request.onsuccess = (e: any) => {
        const dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains('statistic')) {
          resolve();
          return;
        }
        const tx = dbInstance.transaction('statistic', 'readwrite');
        const store = tx.objectStore('statistic');
        try {
          const keyRange = IDBKeyRange.bound([title, ''], [title, '\uffff']);
          const req = store.openCursor(keyRange);
          req.onsuccess = (event: any) => {
            const cursor = event.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        } catch (err) {
          resolve();
        }
      };
      request.onerror = () => resolve();
    });
  },

  async saveBookBookmarks(bookId: string, bookmarks: any[]): Promise<Book[]> {
    const books = await this.getBooks();
    const updatedBooks = books.map(book => {
      if (book.id === bookId) {
        return {
          ...book,
          bookmarks
        };
      }
      return book;
    });
    await this.saveBooks(updatedBooks);
    return updatedBooks;
  },

  async deleteBook(bookId: string): Promise<Book[]> {
    const books = await this.getBooks();
    const settings = this.getSettings();
    let updatedBooks: Book[];
    if (settings.keepStatsOnDelete !== false) {
      updatedBooks = books.map(b => b.id === bookId ? { ...b, isDeleted: true, chapters: [] } : b);
    } else {
      const book = books.find(b => b.id === bookId);
      if (book && book.title) {
        await this.deleteReadingStatsForBook(book.title);
      }
      updatedBooks = books.filter(b => b.id !== bookId);
    }
    await this.saveBooks(updatedBooks);
    return updatedBooks;
  },

  async deleteBooks(bookIds: string[]): Promise<Book[]> {
    const books = await this.getBooks();
    const settings = this.getSettings();
    let updatedBooks: Book[];
    if (settings.keepStatsOnDelete !== false) {
      updatedBooks = books.map(b => bookIds.includes(b.id) ? { ...b, isDeleted: true, chapters: [] } : b);
    } else {
      const deletedBooks = books.filter(b => bookIds.includes(b.id));
      for (const b of deletedBooks) {
        if (b.title) {
          await this.deleteReadingStatsForBook(b.title);
        }
      }
      updatedBooks = books.filter(b => !bookIds.includes(b.id));
    }
    await this.saveBooks(updatedBooks);
    return updatedBooks;
  },

  async clearDeletedBooks(): Promise<Book[]> {
    const books = await this.getBooks();
    const deletedBooks = books.filter(b => b.isDeleted);
    for (const b of deletedBooks) {
      if (b.title) {
        await this.deleteReadingStatsForBook(b.title);
      }
    }
    const updatedBooks = books.filter(b => !b.isDeleted);
    await this.saveBooks(updatedBooks);
    return updatedBooks;
  },

  async updateBookDetails(bookId: string, data: Partial<Book>): Promise<Book[]> {
    const books = await this.getBooks();
    const updatedBooks = books.map(b => b.id === bookId ? { ...b, ...data, updatedAt: new Date().toISOString() } : b);
    await this.saveBooks(updatedBooks);
    return updatedBooks;
  },

  // --- Word Status Management (Migaku state: 'new' | 'learning' | 'known') ---
  getWordStatuses(): Record<string, string> {
    try {
      const data = localStorage.getItem(this._getKey(STORAGE_KEYS.WORD_STATUS));
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Error loading word statuses:', e);
      return {};
    }
  },

  saveWordStatuses(statuses: Record<string, string>) {
    try {
      localStorage.setItem(this._getKey(STORAGE_KEYS.WORD_STATUS), JSON.stringify(statuses));
    } catch (e) {
      console.error('Error saving word statuses:', e);
    }
  },

  setWordStatus(word: string, status: string | null) {
    const statuses = this.getWordStatuses();
    if (!status || status === 'unknown') {
      delete statuses[word]; // default is 'unknown' (or 'new' in Migaku term)
      this.saveSrsCard(word, null);
    } else {
      statuses[word] = status; // 'new' (red underline), 'learning' (yellow), 'known' (none)
    }
    this.saveWordStatuses(statuses);
    return statuses;
  },

  // --- SRS Spaced Repetition System Management ---
  getSrsData(): Record<string, any> {
    try {
      const data = localStorage.getItem(this._getKey('yoru_reader_srs_data'));
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Error loading SRS data:', e);
      return {};
    }
  },

  saveSrsData(srsData: Record<string, any>) {
    try {
      localStorage.setItem(this._getKey('yoru_reader_srs_data'), JSON.stringify(srsData));
    } catch (e) {
      console.error('Error saving SRS data:', e);
    }
  },

  getSrsCard(word: string): any {
    const srsData = this.getSrsData();
    return srsData[word] || null;
  },

  saveSrsCard(word: string, cardData: any) {
    const srsData = this.getSrsData();
    if (!cardData) {
      delete srsData[word];
    } else {
      srsData[word] = cardData;
    }
    this.saveSrsData(srsData);
  },

  // --- Export/Import Database for Cloud/Google Drive Sync ---
  async exportFullDatabase(): Promise<any> {
    const profiles = this.getProfiles();
    const activeProfileId = this.getActiveProfileId();
    
    const dbExport: any = {
      version: 2,
      exportDate: new Date().toISOString(),
      activeProfileId,
      profiles,
      profileData: {}
    };

    // Collect data for each profile
    for (const p of profiles) {
      // 1. Books list from IndexedDB
      const booksKey = `books_list_${p.id}`;
      const books = await idb.get(booksKey) || [];
      
      // 2. Settings from localStorage
      const settingsKey = `migaku_reader_settings_${p.id}`;
      const settingsRaw = localStorage.getItem(settingsKey);
      const settings = settingsRaw ? JSON.parse(settingsRaw) : null;
      
      // 3. Word statuses from localStorage
      const statusKey = `migaku_reader_word_status_${p.id}`;
      const statusRaw = localStorage.getItem(statusKey);
      const wordStatuses = statusRaw ? JSON.parse(statusRaw) : null;

      // 4. SRS Data
      const srsKey = `yoru_reader_srs_data_${p.id}`;
      const srsRaw = localStorage.getItem(srsKey);
      const srsData = srsRaw ? JSON.parse(srsRaw) : null;

      dbExport.profileData[p.id] = {
        books,
        settings,
        wordStatuses,
        srsData
      };
    }

    return dbExport;
  },

  async importFullDatabase(dbExport: any): Promise<void> {
    if (!dbExport || !dbExport.profiles || !Array.isArray(dbExport.profiles)) {
      throw new Error("Invalid backup format");
    }

    // Save profiles list
    this.saveProfiles(dbExport.profiles);
    
    // Save data for each profile
    for (const p of dbExport.profiles) {
      const pData = dbExport.profileData && dbExport.profileData[p.id];
      if (pData) {
        // 1. Books
        if (pData.books) {
          const booksKey = `books_list_${p.id}`;
          await idb.set(booksKey, pData.books);
        }
        // 2. Settings
        if (pData.settings) {
          const settingsKey = `migaku_reader_settings_${p.id}`;
          localStorage.setItem(settingsKey, JSON.stringify(pData.settings));
        }
        // 3. Word statuses
        if (pData.wordStatuses) {
          const statusKey = `migaku_reader_word_status_${p.id}`;
          localStorage.setItem(statusKey, JSON.stringify(pData.wordStatuses));
        }
        // 4. SRS data
        if (pData.srsData) {
          const srsKey = `yoru_reader_srs_data_${p.id}`;
          localStorage.setItem(srsKey, JSON.stringify(pData.srsData));
        }
      }
    }

    // Restore active profile
    if (dbExport.activeProfileId) {
      this.setActiveProfileId(dbExport.activeProfileId);
    }
  },

  async idbGet(key: string): Promise<any> {
    return await idb.get(key);
  },

  async idbSet(key: string, value: any): Promise<void> {
    return await idb.set(key, value);
  }
};

export default db;
