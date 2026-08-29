import { initTokenizer, katakanaToHiragana } from './japanese';

export function getStatusClass(status?: string): string {
  if (status === 'known' || status === 'mature' || status === 'mastered') return 'jiten-word mature';
  if (status === 'learning' || status === 'young') return 'jiten-word young';
  if (status === 'ignored' || status === 'blacklisted') return 'jiten-word blacklisted';
  return 'jiten-word new';
}

/**
 * Fast tokenization and markup generation for Japanese text paragraphs
 */
export function tokenizeJapaneseText(
  text: string,
  wordStatuses: Record<string, string> = {}
): string {
  if (!text) return '';

  // Preserve existing ruby tags
  const rubyPlaceholders: { id: string; html: string; surface: string; reading: string }[] = [];
  let cleanText = text.replace(/<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/gi, (_match, surface, reading) => {
    const id = `__RUBY_${rubyPlaceholders.length}__`;
    rubyPlaceholders.push({ id, html: _match, surface: surface.trim(), reading: reading.trim() });
    return id;
  });

  // Check if Kuromoji is initialized
  const win = typeof window !== 'undefined' ? (window as any) : null;
  const tokenizer = win?.__yoru_tokenizer_instance;

  if (tokenizer) {
    try {
      const rawTokens = tokenizer.tokenize(cleanText);
      let html = '';

      for (const token of rawTokens) {
        const surface = token.surface_form;
        
        // Restore ruby placeholder if matched
        const rubyMatch = rubyPlaceholders.find(r => r.id === surface);
        if (rubyMatch) {
          const status = wordStatuses[rubyMatch.surface] || 'new';
          const cls = getStatusClass(status);
          html += `<span class="${cls}" data-word="${rubyMatch.surface}" data-reading="${rubyMatch.reading}" data-pos="名詞"><ruby>${rubyMatch.surface}<rt class="jiten-furi">${rubyMatch.reading}</rt></ruby></span>`;
          continue;
        }

        const pos = token.pos;
        if (pos === '記号' || !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(surface)) {
          html += surface;
          continue;
        }

        const basicForm = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
        const katakanaReading = token.reading || '';
        const reading = katakanaToHiragana(katakanaReading) || surface;
        const status = wordStatuses[basicForm] || wordStatuses[surface] || 'new';
        const cls = getStatusClass(status);

        html += `<span class="${cls}" data-word="${basicForm}" data-reading="${reading}" data-pos="${pos}">${surface}</span>`;
      }

      return html;
    } catch (e) {
      console.warn('Native tokenizer tokenize error:', e);
    }
  }

  // Fast fallback tokenizer (splitting by Kanji compounds and Kana sequences)
  const regex = /([\u4e00-\u9faf\u3400-\u4dbf々ー]+)|([\u3040-\u309f]+)|([\u30a0-\u30ff]+)|(__RUBY_\d+__)|([^\u3040-\u30ff\u4e00-\u9faf\u3400-\u4dbf々ー_]+)/g;
  let html = '';
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleanText)) !== null) {
    const full = match[0];
    const rubyMatch = rubyPlaceholders.find(r => r.id === full);
    if (rubyMatch) {
      const status = wordStatuses[rubyMatch.surface] || 'new';
      const cls = getStatusClass(status);
      html += `<span class="${cls}" data-word="${rubyMatch.surface}" data-reading="${rubyMatch.reading}" data-pos="名詞"><ruby>${rubyMatch.surface}<rt class="jiten-furi">${rubyMatch.reading}</rt></ruby></span>`;
      continue;
    }

    if (/^[\u4e00-\u9faf\u3400-\u4dbf々ー]+$/.test(full) || /^[\u30a0-\u30ff]{2,}$/.test(full)) {
      const status = wordStatuses[full] || 'new';
      const cls = getStatusClass(status);
      html += `<span class="${cls}" data-word="${full}" data-pos="名詞">${full}</span>`;
    } else {
      html += full;
    }
  }

  return html || text;
}

// Global initialization for native tokenizer
export async function setupNativeYoruParser(): Promise<void> {
  try {
    const tokenizer = await initTokenizer();
    if (typeof window !== 'undefined') {
      (window as any).__yoru_tokenizer_instance = tokenizer;
    }
  } catch (err) {
    console.warn('Kuromoji background load:', err);
  }
}
