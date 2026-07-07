import JSZip from 'jszip';

const DB_NAME = 'yoru_yomitan_db';
const DB_VERSION = 2;
const STORE_DICTS = 'dictionaries';
const STORE_TERMS = 'terms';
const STORE_FREQS = 'frequencies';

let dbInstance = null;

export async function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

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

export async function deleteDictionary(title) {
  const db = await getDB();
  
  // Borrar de dictionaries
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DICTS, 'readwrite');
    tx.objectStore(STORE_DICTS).delete(title);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
  
  // Borrar todos los términos de ese diccionario
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
      }
    };
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });

  // Borrar todas las frecuencias de ese diccionario
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
      }
    };
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

export async function importYomitanZip(file, onProgress) {
  try {
    onProgress('Leyendo archivo .zip...', 0);
    const zip = await JSZip.loadAsync(file);
    
    // Leer index.json
    let indexData;
    if (zip.file('index.json')) {
      const indexStr = await zip.file('index.json').async('string');
      indexData = JSON.parse(indexStr);
    } else {
      throw new Error('Archivo index.json no encontrado. ¿Es un diccionario de Yomitan válido?');
    }
    
    const dictTitle = indexData.title;
    onProgress(`Instalando ${dictTitle}...`, 10);
    
    // Buscar archivos term_bank y term_meta_bank
    const termFiles = Object.keys(zip.files).filter(name => name.startsWith('term_bank_') && name.endsWith('.json'));
    const metaFiles = Object.keys(zip.files).filter(name => name.startsWith('term_meta_bank_') && name.endsWith('.json'));
    
    if (termFiles.length === 0 && metaFiles.length === 0) {
      throw new Error('No se encontraron bancos de términos (term_bank_*.json) ni metadatos de frecuencia (term_meta_bank_*.json).');
    }
    
    // Guardar metadata del diccionario
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

    // 1. Procesar term_bank (bancos de términos) si existen
    if (termFiles.length > 0) {
      const totalFiles = termFiles.length;
      for (let i = 0; i < termFiles.length; i++) {
        const filename = termFiles[i];
        onProgress(`Procesando términos ${i+1}/${totalFiles}...`, 10 + Math.round((i/totalFiles)*40));
        
        const content = await zip.file(filename).async('string');
        const termsArray = JSON.parse(content);
        
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_TERMS, 'readwrite');
          const store = tx.objectStore(STORE_TERMS);
          
          termsArray.forEach(termData => {
            if (Array.isArray(termData)) {
              const term = termData[0];
              const reading = termData[1] || '';
              const definitions = typeof termData[5] === 'string' ? [termData[5]] : termData[5] || [];
              
              store.put({
                dictionary: dictTitle,
                term,
                reading,
                definitions,
                tags: termData[2] || '',
                score: termData[4] || 0
              });
              totalProcessed++;
            }
          });
          
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
      }
    }

    // 2. Procesar term_meta_bank (frecuencias) si existen
    if (metaFiles.length > 0) {
      const totalMetaFiles = metaFiles.length;
      for (let i = 0; i < metaFiles.length; i++) {
        const filename = metaFiles[i];
        onProgress(`Procesando frecuencias ${i+1}/${totalMetaFiles}...`, 50 + Math.round((i/totalMetaFiles)*40));
        
        const content = await zip.file(filename).async('string');
        const metaArray = JSON.parse(content);
        
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
      }
    }
    
    onProgress('¡Instalación completada!', 100);
    return { success: true, title: dictTitle, termsCount: totalProcessed };
  } catch (error) {
    console.error('Error importando Yomitan ZIP:', error);
    throw error;
  }
}

export async function getFrequenciesForWord(word) {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_FREQS, 'readonly');
    const store = tx.objectStore(STORE_FREQS);
    const index = store.index('term');
    const request = index.getAll(IDBKeyRange.only(word));
    request.onsuccess = () => {
      const matches = request.result || [];
      const freqs = matches.map(m => ({
        dictionary: m.dictionary,
        value: m.value,
        displayValue: m.displayValue
      }));
      resolve(freqs);
    };
    request.onerror = () => resolve([]);
  });
}

export async function searchYomitanDB(word, reading = '') {
  const db = await getDB();
  const results = [];
  
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TERMS, 'readonly');
    const store = tx.objectStore(STORE_TERMS);
    const index = store.index('term');
    
    const request = index.getAll(IDBKeyRange.only(word));
    request.onsuccess = () => {
      const matches = request.result || [];
      results.push(...matches);
      resolve();
    };
    request.onerror = reject;
  });
  
  if (reading && results.length === 0) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TERMS, 'readonly');
      const store = tx.objectStore(STORE_TERMS);
      const index = store.index('reading');
      
      const request = index.getAll(IDBKeyRange.only(reading));
      request.onsuccess = () => {
        const matches = request.result || [];
        results.push(...matches);
        resolve();
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
        let cleanDef = def;
        if (typeof def === 'object') cleanDef = JSON.stringify(def);
        combinedDefs.push(cleanDef);
      });
    });
    
    const posTags = [...tagsSet].slice(0, 3);
    
    return {
      word: results[0].term,
      reading: results[0].reading || reading,
      definitions: combinedDefs,
      partsOfSpeech: posTags.length > 0 ? posTags : [],
      frequencies: freqs,
      isFromYomitan: true
    };
  }
  
  // Si no hay definición, pero sí hay metadatos de frecuencia
  if (freqs.length > 0) {
    return {
      word,
      reading: reading || '',
      definitions: [],
      partsOfSpeech: [],
      frequencies: freqs,
      isFromYomitan: true
    };
  }
  
  return null;
}

export async function getAllDictionaryData() {
  const db = await getDB();
  const dictionaries = await new Promise(r => {
    const tx = db.transaction(STORE_DICTS, 'readonly');
    const req = tx.objectStore(STORE_DICTS).getAll();
    req.onsuccess = () => r(req.result || []);
    req.onerror = () => r([]);
  });
  const terms = await new Promise(r => {
    const tx = db.transaction(STORE_TERMS, 'readonly');
    const req = tx.objectStore(STORE_TERMS).getAll();
    req.onsuccess = () => r(req.result || []);
    req.onerror = () => r([]);
  });
  const frequencies = await new Promise(r => {
    const tx = db.transaction(STORE_FREQS, 'readonly');
    const req = tx.objectStore(STORE_FREQS).getAll();
    req.onsuccess = () => r(req.result || []);
    req.onerror = () => r([]);
  });
  return { dictionaries, terms, frequencies };
}

export async function importAllDictionaryData({ dictionaries, terms, frequencies }) {
  const db = await getDB();
  
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
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TERMS, 'readwrite');
      const store = tx.objectStore(STORE_TERMS);
      terms.forEach(t => store.put(t));
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }
  
  if (frequencies && frequencies.length > 0) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FREQS, 'readwrite');
      const store = tx.objectStore(STORE_FREQS);
      frequencies.forEach(f => store.put(f));
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }
}
