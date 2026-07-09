import JSZip from 'jszip';

const DB_NAME = 'yoru_yomitan_db';
const DB_VERSION = 3;
const STORE_DICTS = 'dictionaries';
const STORE_TERMS = 'terms';
const STORE_FREQS = 'frequencies';
const STORE_PITCHES = 'pitches';

let dbInstance = null;

// ─── Session-level in-memory caches ─────────────────────────────────────────
// Eliminan las 90+ transacciones IDB que ocurrían por cada cambio de página.
// Se invalidan explícitamente al importar/eliminar diccionarios o cambiar settings.
const _searchCache = new Map();  // word → searchYomitanDB result
const _freqCache   = new Map();  // word → getFrequenciesForWord result
const _pitchCache  = new Map();  // word → getPitchesForWord result
let _cachedSettings = null;       // { disabledDicts, dictOrder }
let _cachedInstalledTitles = null; // Set<string>

/**
 * Invalida todos los caches en memoria.
 * Debe llamarse al instalar/eliminar un diccionario y al guardar settings.
 */
export function clearYomitanCache() {
  _searchCache.clear();
  _freqCache.clear();
  _pitchCache.clear();
  _cachedSettings = null;
  _cachedInstalledTitles = null;
}

/** Lee settings de lectura desde localStorage y los caches para la sesión. */
function getCachedSettings() {
  if (_cachedSettings) return _cachedSettings;
  try {
    const activeProfile = localStorage.getItem('migaku_reader_active_profile_id') || 'profile-default';
    const settingsKey = `migaku_reader_settings_${activeProfile}`;
    const settingsStr = localStorage.getItem(settingsKey) || localStorage.getItem('migaku_reader_settings');
    if (settingsStr) {
      const parsed = JSON.parse(settingsStr);
      _cachedSettings = {
        disabledDicts: parsed.disabledDictionaries || [],
        dictOrder: parsed.dictionaryOrder || []
      };
    } else {
      _cachedSettings = { disabledDicts: [], dictOrder: [] };
    }
  } catch (_e) {
    _cachedSettings = { disabledDicts: [], dictOrder: [] };
  }
  return _cachedSettings;
}

/** Consulta los títulos de dicts instalados una sola vez y los caches. */
async function getCachedInstalledTitles() {
  if (_cachedInstalledTitles) return _cachedInstalledTitles;
  const db = await getDB();
  _cachedInstalledTitles = await new Promise((resolve) => {
    const tx = db.transaction(STORE_DICTS, 'readonly');
    const req = tx.objectStore(STORE_DICTS).getAllKeys();
    req.onsuccess = () => resolve(new Set(req.result));
    req.onerror = () => resolve(new Set());
  });
  return _cachedInstalledTitles;
}

/**
 * Cierra de forma inmediata la conexión de IndexedDB para liberar memoria.
 */
export async function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log("Conexión a IndexedDB cerrada de forma inmediata para liberar memoria RAM.");
  }
}

/**
 * Obtiene la instancia activa de IndexedDB.
 */
export async function getDB() {
  if (dbInstance) return dbInstance;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => reject('Error opening IndexedDB: ' + event.target.error);
    
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_DICTS)) {
        db.createObjectStore(STORE_DICTS, { keyPath: 'title' });
      }
      
      if (!db.objectStoreNames.contains(STORE_TERMS)) {
        const termStore = db.createObjectStore(STORE_TERMS, { keyPath: 'id', autoIncrement: true });
        termStore.createIndex('term', 'term', { unique: false });
        termStore.createIndex('reading', 'reading', { unique: false });
        termStore.createIndex('dictionary', 'dictionary', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_FREQS)) {
        const freqStore = db.createObjectStore(STORE_FREQS, { keyPath: 'id', autoIncrement: true });
        freqStore.createIndex('term', 'term', { unique: false });
        freqStore.createIndex('dictionary', 'dictionary', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_PITCHES)) {
        const pitchStore = db.createObjectStore(STORE_PITCHES, { keyPath: 'id', autoIncrement: true });
        pitchStore.createIndex('term', 'term', { unique: false });
        pitchStore.createIndex('dictionary', 'dictionary', { unique: false });
      }
    };
  });
}

/**
 * Obtiene la lista de diccionarios instalados y cierra la conexión.
 */
export async function getInstalledDictionaries() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DICTS, 'readonly');
    const store = tx.objectStore(STORE_DICTS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Migra los diccionarios existentes que no tienen los flags hasTerms/hasFreqs,
 * detectando el tipo real consultando los stores de términos y frecuencias.
 */
export async function migrateDictFlags() {
  const db = await getDB();
  try {
    const dicts = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DICTS, 'readonly');
      const req = tx.objectStore(STORE_DICTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const needsMigration = dicts.filter(d => d.hasTerms === undefined || d.hasFreqs === undefined);
    if (needsMigration.length === 0) return;

    for (const dict of needsMigration) {
      const hasTerms = await new Promise((resolve) => {
        const tx = db.transaction(STORE_TERMS, 'readonly');
        const idx = tx.objectStore(STORE_TERMS).index('dictionary');
        const req = idx.openCursor(IDBKeyRange.only(dict.title));
        req.onsuccess = (e) => resolve(!!e.target.result);
        req.onerror = () => resolve(false);
      });

      const hasFreqs = await new Promise((resolve) => {
        const tx = db.transaction(STORE_FREQS, 'readonly');
        const idx = tx.objectStore(STORE_FREQS).index('dictionary');
        const req = idx.openCursor(IDBKeyRange.only(dict.title));
        req.onsuccess = (e) => resolve(!!e.target.result);
        req.onerror = () => resolve(false);
      });

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DICTS, 'readwrite');
        tx.objectStore(STORE_DICTS).put({ ...dict, hasTerms, hasFreqs });
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    }
  } catch (err) {
    console.warn('migrateDictFlags failed:', err);
  }
}

/**
 * Elimina entradas huérfanas de términos y frecuencias cuyos diccionarios ya no existen en STORE_DICTS.
 */
export async function cleanOrphanedEntries() {
  const db = await getDB();
  try {
    const knownTitles = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DICTS, 'readonly');
      const req = tx.objectStore(STORE_DICTS).getAllKeys();
      req.onsuccess = () => resolve(new Set(req.result));
      req.onerror = () => reject(req.error);
    });

    if (knownTitles.size === 0) return;

    // Delete orphaned terms
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TERMS, 'readwrite');
      const req = tx.objectStore(STORE_TERMS).openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (!knownTitles.has(cursor.value.dictionary)) cursor.delete();
          cursor.continue();
        } else resolve();
      };
      req.onerror = reject;
    });

    // Delete orphaned frequencies
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FREQS, 'readwrite');
      const req = tx.objectStore(STORE_FREQS).openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (!knownTitles.has(cursor.value.dictionary)) cursor.delete();
          cursor.continue();
        } else resolve();
      };
      req.onerror = reject;
    });

    // Delete orphaned pitches
    if (db.objectStoreNames.contains(STORE_PITCHES)) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PITCHES, 'readwrite');
        const req = tx.objectStore(STORE_PITCHES).openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (!knownTitles.has(cursor.value.dictionary)) cursor.delete();
            cursor.continue();
          } else resolve();
        };
        req.onerror = reject;
      });
    }

    console.log('[yomitanDB] Orphaned entries cleaned. Active dicts:', [...knownTitles]);
  } catch (err) {
    console.warn('cleanOrphanedEntries failed:', err);
  }
}

/**
 * Elimina un diccionario y sus registros asociados de forma ultra-rápida en una sola transacción.
 */
export async function deleteDictionary(title) {
  // Invalidar cachés en memoria porque el inventario de dicts cambió
  clearYomitanCache();
  const db = await getDB();
  
  // 1. Borrar de la tabla de diccionarios
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DICTS, 'readwrite');
    tx.objectStore(STORE_DICTS).delete(title);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
  
  // 2. Borrar todos los términos en una sola transacción rápida
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TERMS, 'readwrite');
    const store = tx.objectStore(STORE_TERMS);
    const index = store.index('dictionary');
    const request = index.openCursor(IDBKeyRange.only(title));
    
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = reject;
  });
  
  // 3. Borrar todas las frecuencias en una sola transacción rápida
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FREQS, 'readwrite');
    const store = tx.objectStore(STORE_FREQS);
    const index = store.index('dictionary');
    const request = index.openCursor(IDBKeyRange.only(title));
    
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = reject;
  });

  // 4. Borrar todos los registros de pitch
  if (db.objectStoreNames.contains(STORE_PITCHES)) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PITCHES, 'readwrite');
      const store = tx.objectStore(STORE_PITCHES);
      const index = store.index('dictionary');
      const request = index.openCursor(IDBKeyRange.only(title));
      
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = reject;
    });
  }
}

/**
 * Importa un diccionario Yomitan en formato ZIP liberando memoria de forma proactiva.
 */
export async function importYomitanZip(file, onProgress) {
  let zip = null;
  try {
    // Invalidar cachés: un nuevo diccionario cambia los resultados de búsqueda
    clearYomitanCache();
    onProgress('Leyendo archivo .zip...', 0);
    zip = await JSZip.loadAsync(file);
    
    let indexData = null;
    if (zip.file('index.json')) {
      const indexStr = await zip.file('index.json').async('string');
      indexData = JSON.parse(indexStr);
    } else {
      throw new Error('Archivo index.json no encontrado. ¿Es un diccionario de Yomitan válido?');
    }
    
    let dictTitle = indexData.title;
    if (dictTitle.startsWith('JMdict') && !dictTitle.includes('Spanish') && !dictTitle.includes('English') && !dictTitle.includes('Frecuencia')) {
      dictTitle = dictTitle.replace('JMdict', 'JMdict (English)');
    }
    onProgress(`Instalando ${dictTitle}...`, 10);
    
    const termFiles = Object.keys(zip.files).filter(name => name.startsWith('term_bank_') && name.endsWith('.json'));
    const metaFiles = Object.keys(zip.files).filter(name => name.startsWith('term_meta_bank_') && name.endsWith('.json'));
    
    if (termFiles.length === 0 && metaFiles.length === 0) {
      throw new Error('No se encontraron bancos de términos ni metadatos de frecuencia.');
    }
    
    const db = await getDB();
    
    const hasTerms = termFiles.length > 0;
    const hasFreqs = metaFiles.length > 0;

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DICTS, 'readwrite');
      tx.objectStore(STORE_DICTS).put({
        title: dictTitle,
        format: indexData.format,
        revision: indexData.revision,
        description: indexData.description,
        importedAt: Date.now(),
        hasTerms,
        hasFreqs
      });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    let totalProcessed = 0;
    const BATCH_SIZE = 5000;

    if (termFiles.length > 0) {
      const totalFiles = termFiles.length;
      for (let i = 0; i < totalFiles; i++) {
        const filename = termFiles[i];
        
        let content = await zip.file(filename).async('string');
        let termsArray = JSON.parse(content);
        content = null;
        
        const totalTerms = termsArray.length;
        for (let j = 0; j < totalTerms; j += BATCH_SIZE) {
          const chunk = termsArray.slice(j, j + BATCH_SIZE);
          
          const currentPercent = 10 + Math.round((i / totalFiles) * 40) + Math.round((j / totalTerms) * (40 / totalFiles));
          const termProgressMsg = totalFiles > 1 
            ? `Procesando términos ${i+1}/${totalFiles} (${Math.round((j / totalTerms) * 100)}%)...` 
            : `Procesando términos (${Math.round((j / totalTerms) * 100)}%)...`;
          onProgress(termProgressMsg, currentPercent);
          
          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_TERMS, 'readwrite');
            const store = tx.objectStore(STORE_TERMS);
            
            chunk.forEach(termData => {
              if (Array.isArray(termData)) {
                store.add({
                  dictionary: dictTitle,
                  term: termData[0],
                  reading: termData[1] || '',
                  definitions: typeof termData[5] === 'string' ? [termData[5]] : termData[5] || [],
                  tags: termData[2] || '',
                  score: termData[4] || 0
                });
                totalProcessed++;
              }
            });
            
            tx.oncomplete = resolve;
            tx.onerror = reject;
          });
          
          await new Promise(r => setTimeout(r, 1));
        }
        
        termsArray = null;
      }
    }

    if (metaFiles.length > 0) {
      const totalMetaFiles = metaFiles.length;
      for (let i = 0; i < totalMetaFiles; i++) {
        const filename = metaFiles[i];
        
        let content = await zip.file(filename).async('string');
        let metaArray = JSON.parse(content);
        content = null;
        
        const totalMeta = metaArray.length;
        for (let j = 0; j < totalMeta; j += BATCH_SIZE) {
          const chunk = metaArray.slice(j, j + BATCH_SIZE);
          
          const currentPercent = 50 + Math.round((i / totalMetaFiles) * 40) + Math.round((j / totalMeta) * (40 / totalMetaFiles));
          const metaProgressMsg = totalMetaFiles > 1 
            ? `Procesando frecuencias ${i+1}/${totalMetaFiles} (${Math.round((j / totalMeta) * 100)}%)...` 
            : `Procesando frecuencias (${Math.round((j / totalMeta) * 100)}%)...`;
          onProgress(metaProgressMsg, currentPercent);
          
          await new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_FREQS, STORE_PITCHES], 'readwrite');
            const storeFreq = tx.objectStore(STORE_FREQS);
            const storePitch = tx.objectStore(STORE_PITCHES);
            
            chunk.forEach(metaData => {
              if (Array.isArray(metaData)) {
                const term = metaData[0];
                const type = metaData[1];
                
                if (type === 'freq') {
                  let value = 0;
                  let displayValue = '';
                  
                  let freqVal = null;
                  if (metaData.length === 3) {
                    freqVal = metaData[2];
                  } else if (metaData.length === 4) {
                    freqVal = metaData[3];
                  }

                  if (freqVal !== null && freqVal !== undefined) {
                    const targetVal = (typeof freqVal === 'object' && freqVal.frequency !== undefined)
                      ? freqVal.frequency
                      : freqVal;

                    if (typeof targetVal === 'object' && targetVal !== null) {
                      value = targetVal.value || 0;
                      displayValue = targetVal.displayValue || String(value);
                    } else {
                      value = Number(targetVal) || 0;
                      displayValue = String(targetVal);
                    }
                  }
                  
                  storeFreq.add({
                    dictionary: dictTitle,
                    term,
                    value,
                    displayValue
                  });
                  totalProcessed++;
                } else if (type === 'pitch') {
                  const pitchData = metaData[2];
                  if (pitchData && typeof pitchData === 'object') {
                    storePitch.add({
                      dictionary: dictTitle,
                      term,
                      reading: pitchData.reading || '',
                      pitches: pitchData.pitches || []
                    });
                    totalProcessed++;
                  }
                }
              }
            });
            
            tx.oncomplete = resolve;
            tx.onerror = reject;
          });
          
          await new Promise(r => setTimeout(r, 1));
        }
        
        metaArray = null;
      }
    }
    
    onProgress('¡Instalación completada!', 100);
    return { success: true, title: dictTitle, termsCount: totalProcessed };
  } finally {
    zip = null;
  }
}

/**
 * Obtiene las frecuencias de una palabra. Usa caché en memoria para evitar
 * consultas IDB y relecturas de localStorage repetidas por página.
 */
export async function getFrequenciesForWord(word) {
  // Cache hit: devolver inmediatamente sin tocar IDB ni localStorage
  if (_freqCache.has(word)) return _freqCache.get(word);

  const db = await getDB();
  const freqs = [];
  const { disabledDicts, dictOrder } = getCachedSettings();
  const installedTitles = await getCachedInstalledTitles();

  await new Promise((resolve) => {
    const tx = db.transaction(STORE_FREQS, 'readonly');
    const store = tx.objectStore(STORE_FREQS);
    const index = store.index('term');
    const request = index.openCursor(IDBKeyRange.only(word));
    
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        if (installedTitles.has(val.dictionary) && !disabledDicts.includes(val.dictionary)) {
          freqs.push({
            dictionary: val.dictionary,
            value: val.value,
            displayValue: val.displayValue
          });
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => resolve();
  });
  
  if (dictOrder.length > 0) {
    freqs.sort((a, b) => {
      const idxA = dictOrder.indexOf(a.dictionary);
      const idxB = dictOrder.indexOf(b.dictionary);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }

  // Guardar en caché antes de retornar
  _freqCache.set(word, freqs);
  return freqs;
}

/**
 * Obtiene los tonos (pitch accent) de una palabra desde STORE_PITCHES.
 * Usa caché en memoria para evitar consultas IDB repetidas por página.
 */
export async function getPitchesForWord(word) {
  // Cache hit
  if (_pitchCache.has(word)) return _pitchCache.get(word);

  const db = await getDB();
  if (!db.objectStoreNames.contains(STORE_PITCHES)) {
    _pitchCache.set(word, []);
    return [];
  }
  const pitches = [];
  const { disabledDicts } = getCachedSettings();
  const installedTitles = await getCachedInstalledTitles();

  await new Promise((resolve) => {
    const tx = db.transaction(STORE_PITCHES, 'readonly');
    const store = tx.objectStore(STORE_PITCHES);
    const index = store.index('term');
    const request = index.openCursor(IDBKeyRange.only(word));
    
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        if (installedTitles.has(val.dictionary) && !disabledDicts.includes(val.dictionary)) {
          pitches.push({
            dictionary: val.dictionary,
            reading: val.reading,
            pitches: val.pitches
          });
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => resolve();
  });

  _pitchCache.set(word, pitches);
  return pitches;
}

function cleanDefinition(def) {
  if (typeof def === 'string') {
    return def;
  }
  if (typeof def === 'object' && def !== null) {
    let text = '';
    const traverse = (node) => {
      if (typeof node === 'string') {
        text += node + ' ';
      } else if (Array.isArray(node)) {
        node.forEach(traverse);
      } else if (typeof node === 'object' && node !== null) {
        if (node.content) traverse(node.content);
        if (node.text) text += node.text + ' ';
      }
    };
    traverse(def);
    return text.trim();
  }
  return '';
}

/**
 * Realiza una búsqueda de palabras en la base de datos IndexedDB usando cursores y proyección
 * para minimizar drásticamente el consumo de RAM.
 * Los resultados se cachean en memoria por sesión para eliminar repetidas consultas IDB por página.
 */
export async function searchYomitanDB(word, reading = '') {
  // Cache hit: respuesta instantánea sin IDB
  const cacheKey = reading ? `${word}|${reading}` : word;
  if (_searchCache.has(cacheKey)) return _searchCache.get(cacheKey);

  const db = await getDB();
  let results = [];
  const { disabledDicts, dictOrder } = getCachedSettings();

  try {
    // 1. Buscar coincidencia de término exacto usando cursores (Consultas selectivas)
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TERMS, 'readonly');
      const store = tx.objectStore(STORE_TERMS);
      const index = store.index('term');
      const request = index.openCursor(IDBKeyRange.only(word));
      
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!disabledDicts.includes(val.dictionary)) {
            results.push({
              term: val.term,
              reading: val.reading,
              definitions: val.definitions,
              tags: val.tags,
              dictionary: val.dictionary
            });
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = reject;
    });
    
    // 2. Buscar por lectura como fallback si no se encontró término exacto
    if (reading && results.length === 0) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_TERMS, 'readonly');
        const store = tx.objectStore(STORE_TERMS);
        const index = store.index('reading');
        const request = index.openCursor(IDBKeyRange.only(reading));
        
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            if (!disabledDicts.includes(val.dictionary)) {
              results.push({
                term: val.term,
                reading: val.reading,
                definitions: val.definitions,
                tags: val.tags,
                dictionary: val.dictionary
              });
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = reject;
      });
    }
    
    const freqs = await getFrequenciesForWord(word);
    const pitches = await getPitchesForWord(word);
    
    if (results.length > 0) {
      // Sort results by dictionaryOrder
      if (dictOrder.length > 0) {
        results.sort((a, b) => {
          const idxA = dictOrder.indexOf(a.dictionary);
          const idxB = dictOrder.indexOf(b.dictionary);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }

      const combinedDefs = [];
      const tagsSet = new Set();

      // Helpers to classify definitions by language
      const SPA_DIACRITICS = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/u;
      const SPA_WORDS = /\b(de|del|el|la|los|las|en|un|una|unos|unas|con|por|para|que|es|son|su|sus|se|al|como|más|no|si|lo|le|les|muy|también|pero|cuando|este|esta|estos|estas|fue|ser|hay|ya|porque|aunque|donde|mientras|entre)\b/i;
      const ENG_WORDS = /\b(the|of|to|and|a|in|is|for|on|with|as|by|at|an|be|this|that|from|it|are|or|if|but|after|before|during|while|have|has|had|not|also|can|will|its|was|were|been|one|two|three|four|five|used|made|when|which|who|what|where|how)\b/i;

      const isSpanish = (text) => SPA_DIACRITICS.test(text) || SPA_WORDS.test(text);
      const isEnglish = (text) => !SPA_DIACRITICS.test(text) && ENG_WORDS.test(text) && !SPA_WORDS.test(text);

      results.forEach(res => {
        if (res.tags) {
          res.tags.split(' ').filter(t => t.length > 0).forEach(t => tagsSet.add(t));
        }

        const defs = res.definitions.map(cleanDefinition).filter(Boolean);

        // Check if this entry has at least one Spanish definition
        const hasSpanish = defs.some(isSpanish);

        if (hasSpanish) {
          // Keep only non-English defs (Spanish + Japanese notes + other)
          const filtered = defs.filter(d => !isEnglish(d));
          combinedDefs.push(...(filtered.length > 0 ? filtered : defs));
        } else {
          combinedDefs.push(...defs);
        }
      });

      
      const posTags = [...tagsSet].slice(0, 3);
      const finalResult = {
        word: results[0].term,
        reading: results[0].reading || reading,
        definitions: combinedDefs.slice(0, 5), // Limit definitions returned to UI to save RAM
        partsOfSpeech: posTags.length > 0 ? posTags : [],
        frequencies: freqs,
        pitches: pitches,
        isFromYomitan: true
      };
      
      // Garbage Collection Manual: Destruir referencias internas y liberar RAM
      results.length = 0; 
      results = null;
      tagsSet.clear();

      // Guardar en caché para futuras páginas
      _searchCache.set(cacheKey, finalResult);
      return finalResult;
    }
    
    if (freqs.length > 0 || pitches.length > 0) {
      const finalResult = {
        word,
        reading: reading || '',
        definitions: [],
        partsOfSpeech: [],
        frequencies: freqs,
        pitches: pitches,
        isFromYomitan: true
      };
      results.length = 0;
      results = null;
      _searchCache.set(cacheKey, finalResult);
      return finalResult;
    }
    
    results.length = 0;
    results = null;
    // null también se cachea para no repetir búsquedas fallidas
    _searchCache.set(cacheKey, null);
    return null;
  } catch (err) {
    console.error('Error in searchYomitanDB:', err);
    throw err;
  }
}

/**
 * Exporta el contenido de los diccionarios liberando memoria entre iteraciones.
 */
export async function exportDictionaryDataToZip(zip, onProgress) {
  const db = await getDB();
  
  try {
    onProgress('Exportando metadatos de diccionarios...', 5);
    const dictionaries = await new Promise(r => {
      const tx = db.transaction(STORE_DICTS, 'readonly');
      const req = tx.objectStore(STORE_DICTS).getAll();
      req.onsuccess = () => r(req.result || []);
      req.onerror = () => r([]);
    });
    
    onProgress('Exportando términos del diccionario...', 10);
    const termChunkSize = 5000;
    let currentTermChunk = [];
    let termChunkCount = 0;
    let totalTermsExported = 0;
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TERMS, 'readonly');
      const store = tx.objectStore(STORE_TERMS);
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          currentTermChunk.push(cursor.value);
          totalTermsExported++;
          
          if (currentTermChunk.length >= termChunkSize) {
            zip.file(`terms_chunk_${termChunkCount}.json`, JSON.stringify(currentTermChunk));
            termChunkCount++;
            currentTermChunk.length = 0;
            onProgress(`Exportados ${totalTermsExported} términos...`, 15 + Math.min(30, Math.floor(totalTermsExported / 10000)));
          }
          cursor.continue();
        } else {
          if (currentTermChunk.length > 0) {
            zip.file(`terms_chunk_${termChunkCount}.json`, JSON.stringify(currentTermChunk));
            termChunkCount++;
            currentTermChunk = null;
          }
          resolve();
        }
      };
      request.onerror = reject;
    });
    
    zip.file('terms_info.json', JSON.stringify({ chunkCount: termChunkCount, totalCount: totalTermsExported }));
    
    onProgress('Exportando frecuencias del diccionario...', 50);
    const freqChunkSize = 5000;
    let currentFreqChunk = [];
    let freqChunkCount = 0;
    let totalFreqsExported = 0;
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FREQS, 'readonly');
      const store = tx.objectStore(STORE_FREQS);
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          currentFreqChunk.push(cursor.value);
          totalFreqsExported++;
          
          if (currentFreqChunk.length >= freqChunkSize) {
            zip.file(`frequencies_chunk_${freqChunkCount}.json`, JSON.stringify(currentFreqChunk));
            freqChunkCount++;
            currentFreqChunk.length = 0;
            onProgress(`Exportadas ${totalFreqsExported} frecuencias...`, 55 + Math.min(35, Math.floor(totalFreqsExported / 10000)));
          }
          cursor.continue();
        } else {
          if (currentFreqChunk.length > 0) {
            zip.file(`frequencies_chunk_${freqChunkCount}.json`, JSON.stringify(currentFreqChunk));
            freqChunkCount++;
            currentFreqChunk = null;
          }
          resolve();
        }
      };
      request.onerror = reject;
    });
    
    zip.file('frequencies_info.json', JSON.stringify({ chunkCount: freqChunkCount, totalCount: totalFreqsExported }));
    
    return dictionaries;
  } catch (err) {
    console.error('Error exporting dictionary to zip:', err);
    throw err;
  }
}

/**
 * Importa todos los diccionarios por micro-lotes con pausas para evitar fugas.
 */
export async function importAllDictionaryData({ dictionaries, terms, frequencies }) {
  const db = await getDB();
  
  try {
    if (dictionaries && dictionaries.length > 0) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DICTS, 'readwrite');
        const store = tx.objectStore(STORE_DICTS);
        dictionaries.forEach(d => store.put(d));
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(tx.error || e.target.error || new Error('Dictionary transaction failed'));
      });
    }
    
    if (terms && terms.length > 0) {
      const batchSize = 2500;
      for (let i = 0; i < terms.length; i += batchSize) {
        let chunk = terms.slice(i, i + batchSize);
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_TERMS, 'readwrite');
          const store = tx.objectStore(STORE_TERMS);
          chunk.forEach(t => store.put(t));
          tx.oncomplete = resolve;
          tx.onerror = (e) => reject(tx.error || e.target.error || new Error('Terms transaction failed'));
        });
        chunk = null;
        await new Promise(r => setTimeout(r, 15));
      }
    }
    
    if (frequencies && frequencies.length > 0) {
      const batchSize = 2500;
      for (let i = 0; i < frequencies.length; i += batchSize) {
        let chunk = frequencies.slice(i, i + batchSize);
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_FREQS, 'readwrite');
          const store = tx.objectStore(STORE_FREQS);
          chunk.forEach(f => store.put(f));
          tx.oncomplete = resolve;
          tx.onerror = (e) => reject(tx.error || e.target.error || new Error('Frequencies transaction failed'));
        });
        chunk = null;
        await new Promise(r => setTimeout(r, 15));
      }
    }
  } catch (err) {
    console.error('Error importing all dictionary data:', err);
    throw err;
  }
}

/**
 * Migra los nombres de los diccionarios de inglés para agregar "(English)" de forma retrocompatible.
 */
export async function migrateEnglishDictName() {
  const db = await getDB();
  try {
    // 1. Read dictionaries using a short-lived readonly transaction
    const dicts = await new Promise((resolve) => {
      const tx = db.transaction(STORE_DICTS, 'readonly');
      const req = tx.objectStore(STORE_DICTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    
    const targetDict = dicts.find(d => d.title.startsWith('JMdict') && !d.title.includes('Spanish') && !d.title.includes('English') && !d.title.includes('Frecuencia'));
    if (!targetDict) return;
    
    const oldTitle = targetDict.title;
    const newTitle = oldTitle.replace('JMdict', 'JMdict (English)');
    
    // 2. Open readwrite transaction only when we actually need to migrate!
    const tx = db.transaction([STORE_DICTS, STORE_TERMS, STORE_FREQS], 'readwrite');
    const dictStore = tx.objectStore(STORE_DICTS);
    const termStore = tx.objectStore(STORE_TERMS);
    const freqStore = tx.objectStore(STORE_FREQS);
    
    // Save new dictionary metadata
    dictStore.put({
      ...targetDict,
      title: newTitle
    });
    dictStore.delete(oldTitle);
    
    // Update terms in DB
    const termIndex = termStore.index('dictionary');
    const termRequest = termIndex.openCursor(IDBKeyRange.only(oldTitle));
    termRequest.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        val.dictionary = newTitle;
        cursor.update(val);
        cursor.continue();
      }
    };
    
    // Update frequencies in DB
    const freqIndex = freqStore.index('dictionary');
    const freqRequest = freqIndex.openCursor(IDBKeyRange.only(oldTitle));
    freqRequest.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        val.dictionary = newTitle;
        cursor.update(val);
        cursor.continue();
      }
    };

    // Await completion of migration transaction
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn("Migration of English dictionary name failed:", err);
  }
}
