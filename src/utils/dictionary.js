import { searchYomitanDB } from './yomitanDB';

// Japanese-English Dictionary Utility

// Local dictionary for common words and sample book vocabulary to work instantly and offline
const LOCAL_DICTIONARY = {
  '時間': {
    word: '時間',
    reading: 'じかん',
    partsOfSpeech: ['Noun'],
    definitions: ['time', 'hour', 'period']
  },
  '長い': {
    word: '長い',
    reading: 'ながい',
    partsOfSpeech: ['Adjective'],
    definitions: ['long (length/distance)', 'long (time)', 'protracted']
  },
  '勝てる': {
    word: '勝てる',
    reading: 'かてる',
    partsOfSpeech: ['Verb, Potential'],
    definitions: ['to be able to win', 'can win']
  },
  '確か': {
    word: '確か',
    reading: 'たしか',
    partsOfSpeech: ['Adverb', 'Noun-Adjective'],
    definitions: ['sure', 'certain', 'positive', 'if I remember correctly', 'reliable']
  },
  '美味しい': {
    word: '美味しい',
    reading: 'おいしい',
    partsOfSpeech: ['Adjective'],
    definitions: ['delicious', 'tasty', 'sweet', 'attractive', 'profitable']
  },
  '焼ける': {
    word: '焼ける',
    reading: 'やける',
    partsOfSpeech: ['Verb, Intransitive'],
    definitions: ['to be burned', 'to be roasted', 'to be baked', 'to be toasted', 'to sun-tan']
  },
  '皿': {
    word: '皿',
    reading: 'さら',
    partsOfSpeech: ['Noun'],
    definitions: ['plate', 'dish', 'platter', 'helping', 'course']
  },
  '結局': {
    word: '結局',
    reading: 'けっきょく',
    partsOfSpeech: ['Noun', 'Adverb'],
    definitions: ['after all', 'in the end', 'ultimately', 'eventually']
  },
  '手': {
    word: '手',
    reading: 'て',
    partsOfSpeech: ['Noun'],
    definitions: ['hand', 'arm', 'forepaw', 'handle', 'hand, worker']
  },
  '伸ばす': {
    word: '伸ばす',
    reading: 'のばす',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to stretch', 'to extend', 'to grow (beard/hair)', 'to straighten', 'to smooth out']
  },
  'ひっこめる': {
    word: '引っ込める',
    reading: 'ひっこめる',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to pull back', 'to retract', 'to withdraw (proposal, etc.)', 'to take in']
  },
  '今日': {
    word: '今日',
    reading: 'きょう',
    partsOfSpeech: ['Noun-Temporal', 'Adverb'],
    definitions: ['today', 'this day', 'these days', 'nowadays']
  },
  '夢': {
    word: '夢',
    reading: 'ゆめ',
    partsOfSpeech: ['Noun'],
    definitions: ['dream', 'illusion', 'reverie', 'vision']
  },
  '見る': {
    word: '見る',
    reading: 'みる',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to see', 'to look', 'to watch', 'to view', 'to observe', 'to examine', 'to judge']
  },
  'また': {
    word: 'また',
    reading: 'また',
    partsOfSpeech: ['Adverb', 'Conjunction'],
    definitions: ['again', 'once more', 'furthermore', 'also', 'on the other hand']
  },
  '同じ': {
    word: '同じ',
    reading: 'おなじ',
    partsOfSpeech: ['Noun-Adjective', 'Adjective-Pre-noun'],
    definitions: ['same', 'identical', 'equal', 'uniform', 'equivalent']
  },
  '生きてる': {
    word: '生きてる',
    reading: 'いきている',
    partsOfSpeech: ['Verb, Progressive'],
    definitions: ['living', 'alive', 'currently alive']
  },
  'おばあちゃん': {
    word: 'おばあちゃん',
    reading: 'おばあちゃん',
    partsOfSpeech: ['Noun'],
    definitions: ['grandmother', 'grandma', 'elderly woman', 'old lady']
  },
  '言う': {
    word: '言う',
    reading: 'いう',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to say', 'to utter', 'to declare', 'to express', 'to name', 'to call']
  },
  '過ごす': {
    word: '過ごす',
    reading: 'すごす',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to pass (time)', 'to spend', 'to overdo', 'to live', 'to get through']
  },
  '終わる': {
    word: '終わる',
    reading: 'おわる',
    partsOfSpeech: ['Verb, Intransitive/Transitive'],
    definitions: ['to finish', 'to end', 'to close']
  },
  '食べる': {
    word: '食べる',
    reading: 'たべる',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to eat', 'to consume', 'to live on', 'to make a living']
  },
  '載る': {
    word: '載る',
    reading: 'のる',
    partsOfSpeech: ['Verb, Intransitive'],
    definitions: ['to be placed on', 'to be set on', 'to be piled on', 'to appear (in print)', 'to be recorded']
  },
  '取る': {
    word: '取る',
    reading: 'とる',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to take', 'to pick up', 'to grab', 'to catch', 'to acquire', 'to choose']
  },
  'ヤクルト': {
    word: 'ヤクルト',
    reading: 'ヤクルト',
    partsOfSpeech: ['Noun, Brand'],
    definitions: ['Yakult (sweet probiotic milk beverage)']
  },
  'アイス': {
    word: 'アイス',
    reading: 'アイス',
    partsOfSpeech: ['Noun'],
    definitions: ['ice cream', 'ice', 'iced (drinks)']
  },
  '私': {
    word: '私',
    reading: 'わたし',
    partsOfSpeech: ['Pronoun'],
    definitions: ['I', 'me', 'myself']
  },
  '彼': {
    word: '彼',
    reading: 'かれ',
    partsOfSpeech: ['Pronoun'],
    definitions: ['he', 'him', 'boyfriend']
  },
  '彼女': {
    word: '彼女',
    reading: 'かのじょ',
    partsOfSpeech: ['Pronoun'],
    definitions: ['she', 'her', 'girlfriend']
  },
  '育てる': {
    word: '育てる',
    reading: 'そだてる',
    partsOfSpeech: ['Verb, Transitive'],
    definitions: ['to raise', 'to rear', 'to bring up', 'to train', 'to cultivate']
  },
  '育てかた': {
    word: '育て方',
    reading: 'そだてかた',
    partsOfSpeech: ['Noun'],
    definitions: ['method of raising', 'how to raise', 'upbringing']
  },
  '冴えない': {
    word: '冴えない',
    reading: 'さえいない',
    partsOfSpeech: ['Adjective'],
    definitions: ['dull', 'obscure', 'uninspiring', 'lackluster', 'ordinary']
  }
};

const JISHO_CACHE = new Map();

// Look up a word (first in local database, then on Jisho.org API via CORS proxy)
export async function lookupWord(word, reading = '') {
  // 1. Clean the word: remove trailing particles or spaces
  const cleanWord = word.trim();
  if (!cleanWord) return null;

  let entry = null;

  // 2. Check local dictionary first
  if (LOCAL_DICTIONARY[cleanWord]) {
    entry = { ...LOCAL_DICTIONARY[cleanWord] };
  } else if (reading && LOCAL_DICTIONARY[reading]) {
    entry = { ...LOCAL_DICTIONARY[reading] };
  } else if (JISHO_CACHE.has(cleanWord)) {
    entry = { ...JISHO_CACHE.get(cleanWord) };
  } else {
    // 2.5 Query local Yomitan databases (IndexedDB)
    try {
      const yomitanMatch = await searchYomitanDB(cleanWord, reading);
      if (yomitanMatch) {
        entry = yomitanMatch;
      }
    } catch (err) {
      console.error('Yomitan DB search error:', err);
    }
  }

  // 3. Query Jisho.org via allorigins CORS Proxy if not found
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
          const definitions = match.senses.map(s => s.english_definitions.join(', '));
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
            JISHO_CACHE.delete(firstKey);
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
