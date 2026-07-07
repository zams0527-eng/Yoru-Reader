import JSZip from 'jszip';

const DB_NAME = 'yoru_yomitan_db';
const DB_VERSION = 2;
const STORE_DICTS = 'dictionaries';
const STORE_TERMS = 'terms';
const STORE_FREQS = 'frequencies';

let dbInstance = null;

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
    };
  });
}

/**
 * Obtiene la lista de diccionarios instalados y cierra la conexión.
 */
export async function getInstalledDictionaries() {
  const db = await getDB();
  try {
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DICTS, 'readonly');
      const store = tx.objectStore(STORE_DICTS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return result;
  } finally {
    await closeDB();
  }
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
  } finally {
    await closeDB();
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

    console.log('[yomitanDB] Orphaned entries cleaned. Active dicts:', [...knownTitles]);
  } catch (err) {
    console.warn('cleanOrphanedEntries failed:', err);
  } finally {
    await closeDB();
  }
}

/**
 * Elimina un diccionario y sus registros asociados de forma ultra-rápida en una sola transacción.
 */
export async function deleteDictionary(title) {
  const db = await getDB();
  
  try {
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
  } finally {
    await closeDB();
  }
}

/**
 * Importa un diccionario Yomitan en formato ZIP liberando memoria de forma proactiva.
 */
export async function importYomitanZip(file, onProgress) {
  let zip = null;
  try {
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

    if (termFiles.length > 0) {
      const totalFiles = termFiles.length;
      for (let i = 0; i < totalFiles; i++) {
        const filename = termFiles[i];
        onProgress(`Procesando términos ${i+1}/${totalFiles}...`, 10 + Math.round((i / totalFiles) * 40));
        
        let content = await zip.file(filename).async('string');
        let termsArray = JSON.parse(content);
        content = null;
        
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_TERMS, 'readwrite');
          const store = tx.objectStore(STORE_TERMS);
          
          termsArray.forEach(termData => {
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
        
        termsArray = null;
        await new Promise(r => setTimeout(r, 30));
      }
    }

    if (metaFiles.length > 0) {
      const totalMetaFiles = metaFiles.length;
      for (let i = 0; i < metaFiles.length; i++) {
        const filename = metaFiles[i];
        onProgress(`Procesando frecuencias ${i+1}/${totalMetaFiles}...`, 50 + Math.round((i / totalMetaFiles) * 40));
        
        let content = await zip.file(filename).async('string');
        let metaArray = JSON.parse(content);
        content = null;
        
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_FREQS, 'readwrite');
          const store = tx.objectStore(STORE_FREQS);
          
          metaArray.forEach(metaData => {
            if (Array.isArray(metaData) && metaData[1] === 'freq') {
              const term = metaData[0];
              let value = 0;
              let displayValue = '';
              
              if (metaData.length === 3) {
                const freqVal = metaData[2];
                if (typeof freqVal === 'object' && freqVal !== null) {
                  value = freqVal.value || 0;
                  displayValue = freqVal.displayValue || String(value);
                } else {
                  value = Number(freqVal) || 0;
                  displayValue = String(freqVal);
                }
              } else if (metaData.length === 4) {
                const freqVal = metaData[3];
                if (typeof freqVal === 'object' && freqVal !== null) {
                  value = freqVal.value || 0;
                  displayValue = freqVal.displayValue || String(value);
                } else {
                  value = Number(freqVal) || 0;
                  displayValue = String(freqVal);
                }
              }
              
              store.add({
                dictionary: dictTitle,
                term,
                value,
                displayValue
              });
              totalProcessed++;
            }
          });
          
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
        
        metaArray = null;
        await new Promise(r => setTimeout(r, 30));
      }
    }
    
    onProgress('¡Instalación completada!', 100);
    return { success: true, title: dictTitle, termsCount: totalProcessed };
  } catch (error) {
    console.error('Error importando Yomitan ZIP:', error);
    throw error;
  } finally {
    zip = null;
    await closeDB();
  }
}

/**
 * Obtiene las frecuencias de una palabra proyectando únicamente los campos necesarios y cerrando la conexión.
 */
export async function getFrequenciesForWord(word) {
  const db = await getDB();
  const freqs = [];
  
  let disabledDicts = [];
  let dictOrder = [];
  try {
    const activeProfile = localStorage.getItem('migaku_reader_active_profile_id') || 'profile-default';
    const settingsKey = `migaku_reader_settings_${activeProfile}`;
    const settingsStr = localStorage.getItem(settingsKey) || localStorage.getItem('migaku_reader_settings');
    if (settingsStr) {
      const parsed = JSON.parse(settingsStr);
      disabledDicts = parsed.disabledDictionaries || [];
      dictOrder = parsed.dictionaryOrder || [];
    }
  } catch (errSettings) {
    console.warn("Could not read settings for filtering:", errSettings);
  }

  try {
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_FREQS, 'readonly');
      const store = tx.objectStore(STORE_FREQS);
      const index = store.index('term');
      const request = index.openCursor(IDBKeyRange.only(word));
      
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!disabledDicts.includes(val.dictionary)) {
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
    
    return freqs;
  } finally {
    await closeDB();
  }
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
 * para minimizar drásticamente el consumo de RAM, y cierra la conexión inmediatamente al terminar.
 */
export async function searchYomitanDB(word, reading = '') {
  const db = await getDB();
  let results = [];
  
  let disabledDicts = [];
  let dictOrder = [];
  try {
    const activeProfile = localStorage.getItem('migaku_reader_active_profile_id') || 'profile-default';
    const settingsKey = `migaku_reader_settings_${activeProfile}`;
    const settingsStr = localStorage.getItem(settingsKey) || localStorage.getItem('migaku_reader_settings');
    if (settingsStr) {
      const parsed = JSON.parse(settingsStr);
      disabledDicts = parsed.disabledDictionaries || [];
      dictOrder = parsed.dictionaryOrder || [];
    }
  } catch (errSettings) {
    console.warn("Could not read settings for filtering:", errSettings);
  }

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
      
      results.forEach(res => {
        if (res.tags) {
          res.tags.split(' ').filter(t => t.length > 0).forEach(t => tagsSet.add(t));
        }
        
        const defs = res.definitions.map(cleanDefinition).filter(Boolean);
        
        // Detect if there are any Spanish definitions in this specific entry's definitions
        const hasSpanish = defs.some(d => {
          if (/[áéíóúñü]/i.test(d)) return true;
          
          const clean = d.toLowerCase().replace(/[^a-z\s]/g, '');
          const words = clean.split(/\s+/);
          const spaWords = new Set(['de', 'la', 'el', 'en', 'un', 'una', 'y', 'o', 'que', 'del', 'al', 'los', 'las', 'con', 'para', 'por', 'se', 'es', 'su', 'sus', 'casa', 'libro', 'palabra', 'tiempo', 'gente', 'vida', 'cosa', 'niño', 'mundo']);
          return words.some(w => spaWords.has(w));
        });
        
        if (hasSpanish) {
          // If Spanish is present, filter out the English definitions from this entry
          const filtered = defs.filter(d => {
            if (/[áéíóúñü]/i.test(d)) return true;
            
            const clean = d.toLowerCase().replace(/[^a-z\s]/g, '');
            const words = clean.split(/\s+/);
            
            const engWords = new Set(['the', 'of', 'to', 'and', 'a', 'in', 'is', 'for', 'on', 'with', 'as', 'by', 'at', 'an', 'be', 'this', 'that', 'from', 'it', 'school', 'day', 'after', 'before', 'water', 'house', 'book', 'word', 'time', 'year', 'people', 'way', 'man', 'life', 'thing', 'child', 'world', 'gentleman']);
            const spaWords = new Set(['de', 'la', 'el', 'en', 'un', 'una', 'y', 'o', 'que', 'del', 'al', 'los', 'las', 'con', 'para', 'por', 'se', 'es', 'su', 'sus']);
            
            let engCount = 0;
            let spaCount = 0;
            words.forEach(w => {
              if (engWords.has(w)) engCount++;
              if (spaWords.has(w)) spaCount++;
            });
            
            return engCount <= spaCount;
          });
          
          if (filtered.length > 0) {
            combinedDefs.push(...filtered);
          } else {
            combinedDefs.push(...defs);
          }
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
        isFromYomitan: true
      };
      
      // Garbage Collection Manual: Destruir referencias internas y liberar RAM
      results.length = 0; 
      results = null;
      tagsSet.clear();
      
      return finalResult;
    }
    
    if (freqs.length > 0) {
      const finalResult = {
        word,
        reading: reading || '',
        definitions: [],
        partsOfSpeech: [],
        frequencies: freqs,
        isFromYomitan: true
      };
      results.length = 0;
      results = null;
      return finalResult;
    }
    
    results.length = 0;
    results = null;
    return null;
  } finally {
    // Cerramos la conexión de forma inmediata para forzar la liberación de memoria en Chromium
    await closeDB();
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
  } finally {
    await closeDB();
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
        tx.onerror = reject;
      });
    }
    
    if (terms && terms.length > 0) {
      const batchSize = 2500;
      for (let i = 0; i < terms.length; i += batchSize) {
        let chunk = terms.slice(i, i + batchSize);
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_TERMS, 'readwrite');
          const store = tx.objectStore(STORE_TERMS);
          chunk.forEach(t => store.add(t));
          tx.oncomplete = resolve;
          tx.onerror = reject;
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
          chunk.forEach(f => store.add(f));
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
        chunk = null;
        await new Promise(r => setTimeout(r, 15));
      }
    }
  } finally {
    await closeDB();
  }
}

/**
 * Migra los nombres de los diccionarios de inglés para agregar "(English)" de forma retrocompatible.
 */
export async function migrateEnglishDictName() {
  const db = await getDB();
  try {
    const tx = db.transaction([STORE_DICTS, STORE_TERMS, STORE_FREQS], 'readwrite');
    const dictStore = tx.objectStore(STORE_DICTS);
    const termStore = tx.objectStore(STORE_TERMS);
    const freqStore = tx.objectStore(STORE_FREQS);
    
    const dicts = await new Promise((resolve) => {
      const req = dictStore.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
    
    const targetDict = dicts.find(d => d.title.startsWith('JMdict') && !d.title.includes('Spanish') && !d.title.includes('English') && !d.title.includes('Frecuencia'));
    if (!targetDict) return;
    
    const oldTitle = targetDict.title;
    const newTitle = oldTitle.replace('JMdict', 'JMdict (English)');
    
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
  } catch (err) {
    console.warn("Migration of English dictionary name failed:", err);
  } finally {
    await closeDB();
  }
}
