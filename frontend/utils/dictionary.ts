import { searchYomitanDB } from './yomitanDB';

// Japanese-English Dictionary Utility

export interface DictionaryEntry {
  word: string;
  reading: string;
  partsOfSpeech: string[];
  definitions: string[];
  isFromYomitan?: boolean;
  isFromJisho?: boolean;
  isFallback?: boolean;
  frequencies?: any[];
  pitches?: any[];
}

const JISHO_CACHE = new Map<string, DictionaryEntry>();

// Look up a word (first in local database, then on Jisho.org API via CORS proxy)
export async function lookupWord(word: string, reading: string = ''): Promise<DictionaryEntry | null> {
  // 1. Clean the word: remove trailing particles or spaces
  const cleanWord = word.trim();
  if (!cleanWord) return null;

  let entry: DictionaryEntry | null = null;

  // 2. Prioritize Yomitan DB (IndexedDB) first, so user's installed dictionaries (Spanish, etc.) take precedence!
  try {
    const yomitanMatch = await searchYomitanDB(cleanWord, reading) as DictionaryEntry | null;
    if (yomitanMatch) {
      entry = yomitanMatch;
    }
  } catch (err) {
    console.error('Yomitan DB search error:', err);
  }

  // 3. Fallback to Jisho cache
  if (!entry && JISHO_CACHE.has(cleanWord)) {
    entry = { ...JISHO_CACHE.get(cleanWord)! };
  }

  // 4. Query Jisho.org via allorigins CORS Proxy if not found
  if (!entry) {
    try {
      const jishoUrl = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(cleanWord)}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(jishoUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const json = await response.json();
        const contents = JSON.parse(json.contents);
        
        if (contents && contents.data && contents.data.length > 0) {
          const match = contents.data[0];
          const definitions = match.senses.map((s: any) => s.english_definitions.join(', '));
          const partsOfSpeech = match.senses[0] ? match.senses[0].parts_of_speech : [];
          
          entry = {
            word: match.japanese[0].word || cleanWord,
            reading: match.japanese[0].reading || '',
            definitions: definitions.slice(0, 4), // Limit to top 4 definitions
            partsOfSpeech: partsOfSpeech,
            isFromJisho: true
          };
          
          // Cache it locally with eviction policy (max 20 items)
          JISHO_CACHE.set(cleanWord, entry);
          if (JISHO_CACHE.size > 20) {
            const firstKey = JISHO_CACHE.keys().next().value;
            if (firstKey) {
              JISHO_CACHE.delete(firstKey);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Jisho API lookup failed or was blocked by CORS.', error);
    }
  }

  // Fallback if nothing is found
  if (!entry) {
    entry = {
      word: cleanWord,
      reading: reading || '',
      partsOfSpeech: ['Unknown'],
      definitions: ['No translation found. Click "Search Jisho" for online lookup.'],
      isFallback: true
    };
  }

  return entry;
}
