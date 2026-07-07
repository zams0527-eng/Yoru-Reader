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
 * Elimina un diccionario y sus registros asociados en micro-lotes para evitar consumo de memoria.
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
    
    // 2. Borrar todos los términos en lotes usando cursores ligeros
    let hasMoreTerms = true;
    while (hasMoreTerms) {
      hasMoreTerms = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_TERMS, 'readwrite');
        const store = tx.objectStore(STORE_TERMS);
        const index = store.index('dictionary');
        const request = index.openCursor(IDBKeyRange.only(title));
        let count = 0;
        
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor && count < 5000) {
            cursor.delete();
            count++;
            cursor.continue();
          } else {
            resolve(!!cursor);
          }
        };
        request.onerror = reject;
      });
      await new Promise(r => setTimeout(r, 20));
    }
    
    // 3. Borrar todas las frecuencias en lotes
    let hasMoreFreqs = true;
    while (hasMoreFreqs) {
      hasMoreFreqs = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FREQS, 'readwrite');
        const store = tx.objectStore(STORE_FREQS);
        const index = store.index('dictionary');
        const request = index.openCursor(IDBKeyRange.only(title));
        let count = 0;
        
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor && count < 5000) {
            cursor.delete();
            count++;
            cursor.continue();
          } else {
            resolve(!!cursor);
          }
        };
        request.onerror = reject;
      });
      await new Promise(r => setTimeout(r, 20));
    }
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
    
    const dictTitle = indexData.title;
    onProgress(`Instalando ${dictTitle}...`, 10);
    
    const termFiles = Object.keys(zip.files).filter(name => name.startsWith('term_bank_') && name.endsWith('.json'));
    const metaFiles = Object.keys(zip.files).filter(name => name.startsWith('term_meta_bank_') && name.endsWith('.json'));
    
    if (termFiles.length === 0 && metaFiles.length === 0) {
      throw new Error('No se encontraron bancos de términos ni metadatos de frecuencia.');
    }
    
    const db = await getDB();
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DICTS, 'readwrite');
      tx.objectStore(STORE_DICTS).put({
        title: dictTitle,
        format: indexData.format,
        revision: indexData.revision,
        description: indexData.description,
        importedAt: Date.now()
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
              store.put({
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
              
              store.put({
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
          // Consultas selectivas: Extraer únicamente las propiedades necesarias
          freqs.push({
            dictionary: val.dictionary,
            value: val.value,
            displayValue: val.displayValue
          });
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => resolve();
    });
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
          // Guardar únicamente lo requerido para ahorrar memoria
          results.push({
            term: val.term,
            reading: val.reading,
            definitions: val.definitions,
            tags: val.tags
          });
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
            results.push({
              term: val.term,
              reading: val.reading,
              definitions: val.definitions,
              tags: val.tags
            });
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
      const combinedDefs = [];
      const tagsSet = new Set();
      
      results.forEach(res => {
        if (res.tags) {
          res.tags.split(' ').filter(t => t.length > 0).forEach(t => tagsSet.add(t));
        }
        res.definitions.forEach(def => {
          const cleaned = cleanDefinition(def);
          if (cleaned) combinedDefs.push(cleaned);
        });
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
          chunk.forEach(t => store.put(t));
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
          chunk.forEach(f => store.put(f));
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
