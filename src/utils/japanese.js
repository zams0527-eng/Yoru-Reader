// Japanese tokenization and furigana alignment utility

let tokenizerInstance = null;
let initPromise = null;

// Initialize the Kuromoji tokenizer
export function initTokenizer() {
  if (initPromise) return initPromise;
  
  initPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error("This library can only run in a browser environment."));
      return;
    }
    
    // Check if kuromoji script tag is loaded
    if (!window.kuromoji) {
      let checkCount = 0;
      const interval = setInterval(() => {
        if (window.kuromoji) {
          clearInterval(interval);
          build();
        } else {
          checkCount++;
          if (checkCount > 50) { // 5 seconds max
            clearInterval(interval);
            reject(new Error("Kuromoji.js library not loaded from CDN."));
          }
        }
      }, 100);
    } else {
      build();
    }
    
    function build() {
      window.kuromoji.builder({
        dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/"
      }).build((err, tokenizer) => {
        if (err) {
          console.error("Error building kuromoji tokenizer:", err);
          reject(err);
        } else {
          tokenizerInstance = tokenizer;
          resolve(tokenizer);
        }
      });
    }
  });
  
  return initPromise;
}

// Convert Katakana to Hiragana
export function katakanaToHiragana(src) {
  if (!src) return '';
  return src.replace(/[\u30a1-\u30f6]/g, function (match) {
    var chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

// Check if character is Kanji
export function isKanji(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9faf) || (code >= 0x3400 && code <= 0x4dbf);
}

// Check if character is Kana
export function isKana(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff);
}

// Check if string contains Kanji
export function hasKanji(str) {
  if (!str) return false;
  for (let i = 0; i < str.length; i++) {
    if (isKanji(str[i])) return true;
  }
  return false;
}

// Align kanji surface form with reading to generate furigana splits
export function alignFurigana(surface, reading) {
  if (!surface || !reading) return null;
  
  // If no kanji, no alignment needed
  if (!hasKanji(surface)) {
    return [{ type: 'kana', text: surface }];
  }

  function align(sIndex, rIndex) {
    if (sIndex === surface.length && rIndex === reading.length) return [];
    if (sIndex === surface.length || rIndex === reading.length) return null;

    const sChar = surface[sIndex];
    const sCharHira = isKana(sChar) ? katakanaToHiragana(sChar) : sChar;
    const rChar = reading[rIndex];

    // If matches kana-to-kana
    if (isKana(sChar) && sCharHira === rChar) {
      const sub = align(sIndex + 1, rIndex + 1);
      if (sub) {
        return [{ type: 'kana', text: sChar }, ...sub];
      }
    }

    // If Kanji block
    if (isKanji(sChar)) {
      let kanjiBlock = "";
      let k = sIndex;
      while (k < surface.length && isKanji(surface[k])) {
        kanjiBlock += surface[k];
        k++;
      }

      // Try consuming different lengths of the reading string
      for (let len = 1; len <= reading.length - rIndex; len++) {
        const readingPart = reading.slice(rIndex, rIndex + len);
        const sub = align(k, rIndex + len);
        if (sub) {
          return [{ type: 'kanji', text: kanjiBlock, ruby: readingPart }, ...sub];
        }
      }
    }

    return null;
  }

  const result = align(0, 0);
  
  // Fallback if alignment algorithm fails on irregular combinations
  if (!result) {
    return [{ type: 'kanji', text: surface, ruby: reading }];
  }
  
  return result;
}

// Decode encoded ruby segments from stored markup (e.g. "{日本|にほん}")
export function parseEncodedText(text) {
  const regex = /\{([^|]+)\|([^}]+)\}/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore) {
      segments.push({ type: 'text', content: textBefore });
    }
    segments.push({ type: 'ruby', text: match[1], ruby: match[2] });
    lastIndex = regex.lastIndex;
  }
  
  const textAfter = text.slice(lastIndex);
  if (textAfter) {
    segments.push({ type: 'text', content: textAfter });
  }
  
  return segments;
}

// Tokenize text into paragraphs of tokenized words, handling unified ruby tokens
export async function tokenizeText(text) {
  const tokenizer = await initTokenizer();
  if (!text) return [];
  
  const paragraphs = text.split('\n');
  const resultParagraphs = [];
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      // Empty line placeholder
      resultParagraphs.push([{ surface: '', isLineBreak: true }]);
      continue;
    }
    
    // Parse the stored format into structured segments
    const segments = parseEncodedText(para);
    const processedTokens = [];
    
    for (const segment of segments) {
      if (segment.type === 'text') {
        try {
          const tokens = tokenizer.tokenize(segment.content);
          const mapped = tokens.map(token => {
            const surface = token.surface_form;
            const katakanaReading = token.reading || '';
            const hiraganaReading = katakanaToHiragana(katakanaReading) || surface;
            
            let alignment = [];
            if (hasKanji(surface)) {
              const aligned = alignFurigana(surface, hiraganaReading);
              alignment = aligned || [{ type: 'kanji', text: surface, ruby: hiraganaReading }];
            } else {
              alignment = [{ type: 'kana', text: surface }];
            }
            
            const CONTENT_WORD_POS = ['名詞', '動詞', '形容詞', '副詞', '連体詞', '代名詞', '感動詞'];
            const isWord = CONTENT_WORD_POS.includes(token.pos);
            
            return {
              surface,
              reading: hiraganaReading,
              basicForm: token.basic_form && token.basic_form !== '*' ? token.basic_form : surface,
              pos: token.pos,
              alignment,
              isWord,
              isPunctuation: token.pos === '記号'
            };
          });
          processedTokens.push(...mapped);
        } catch (e) {
          console.error("Failed to tokenize text segment:", segment.content, e);
          processedTokens.push({
            surface: segment.content,
            reading: '',
            basicForm: segment.content,
            pos: 'UNK',
            alignment: [{ type: 'kana', text: segment.content }],
            isWord: false,
            isPunctuation: false
          });
        }
      } else if (segment.type === 'ruby') {
        // Morphological properties based on the kanji base form
        let pos = '名詞'; // Default to Noun
        let basicForm = segment.text;
        
        try {
          const tokens = tokenizer.tokenize(segment.text);
          if (tokens.length > 0) {
            pos = tokens[0].pos;
            basicForm = tokens[0].basic_form && tokens[0].basic_form !== '*' ? tokens[0].basic_form : tokens[0].surface_form;
          }
        } catch (e) {
          console.warn("Furigana base tokenization failed:", segment.text, e);
        }
        
        const CONTENT_WORD_POS = ['名詞', '動詞', '形容詞', '副詞', '連体詞', '代名詞', '感動詞'];
        const isWord = CONTENT_WORD_POS.includes(pos);
        
        processedTokens.push({
          surface: segment.text,
          reading: segment.ruby,
          basicForm: basicForm,
          pos: pos,
          alignment: [{ type: 'kanji', text: segment.text, ruby: segment.ruby }],
          isWord,
          isPunctuation: false
        });
      }
    }
    
    resultParagraphs.push(processedTokens);
  }
  
  return resultParagraphs;
}
