import { initTokenizer, katakanaToHiragana } from './japanese';

export function getStatusClass(status?: string): string {
  if (status === 'known' || status === 'mature' || status === 'mastered') return 'jiten-word mature';
  if (status === 'learning' || status === 'young') return 'jiten-word young';
  if (status === 'ignored' || status === 'blacklisted') return 'jiten-word blacklisted';
  return 'jiten-word new';
}

const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter
  ? new (Intl as any).Segmenter('ja', { granularity: 'word' })
  : null;

/**
 * Fast tokenization and markup generation for Japanese text paragraphs
 * Handles both plain text and embedded <ruby> blocks.
 */
export function tokenizeJapaneseText(
  text: string,
  wordStatuses: Record<string, string> = {}
): string {
  if (!text) return '';

  // Split text cleanly by <ruby>...</ruby> blocks
  const parts = text.split(/(<ruby>.*?<\/rt><\/ruby>)/gi);
  const win = typeof window !== 'undefined' ? (window as any) : null;
  const tokenizer = win?.__yoru_tokenizer_instance;

  let resultHtml = '';

  for (const part of parts) {
    if (!part) continue;

    // Check if this part is a <ruby> block
    const rubyMatch = part.match(/^<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>$/i);
    if (rubyMatch) {
      const surface = rubyMatch[1].trim();
      const reading = rubyMatch[2].trim();
      const status = wordStatuses[surface] || 'new';
      const cls = getStatusClass(status);
      resultHtml += `<span class="${cls}" data-word="${surface}" data-reading="${reading}" data-pos="名詞"><ruby>${surface}<rt class="jiten-furi">${reading}</rt></ruby></span>`;
      continue;
    }

    // Process plain text chunk with Kuromoji if available
    if (tokenizer) {
      try {
        const rawTokens = tokenizer.tokenize(part);
        for (const token of rawTokens) {
          const surface = token.surface_form;
          const pos = token.pos;
          if (pos === '記号' || !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(surface)) {
            resultHtml += surface;
            continue;
          }

          const basicForm = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
          const katakanaReading = token.reading || '';
          const reading = katakanaToHiragana(katakanaReading) || surface;
          const status = wordStatuses[basicForm] || wordStatuses[surface] || 'new';
          const cls = getStatusClass(status);

          resultHtml += `<span class="${cls}" data-word="${basicForm}" data-reading="${reading}" data-pos="${pos}">${surface}</span>`;
        }
        continue;
      } catch (e) {
        console.warn('Tokenizer chunk error:', e);
      }
    }

    // High-performance Intl.Segmenter fallback
    if (segmenter) {
      const segments = segmenter.segment(part);
      for (const s of segments) {
        const seg = s.segment;
        if (!s.isWordLike || !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(seg)) {
          resultHtml += seg;
          continue;
        }

        const status = wordStatuses[seg] || 'new';
        const cls = getStatusClass(status);
        resultHtml += `<span class="${cls}" data-word="${seg}" data-pos="名詞">${seg}</span>`;
      }
      continue;
    }

    // Last-resort regex tokenizer
    const regex = /([\u4e00-\u9faf\u3400-\u4dbf々ー]+[\u3040-\u309f]*)|([\u30a0-\u30ff]{2,})|([\u3040-\u30ff]+)|([^\u3040-\u30ff\u4e00-\u9faf\u3400-\u4dbf々ー]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(part)) !== null) {
      const full = match[0];
      if (/[\u4e00-\u9faf\u3400-\u4dbf々ー]/.test(full) || /^[\u30a0-\u30ff]{2,}$/.test(full)) {
        const status = wordStatuses[full] || 'new';
        const cls = getStatusClass(status);
        resultHtml += `<span class="${cls}" data-word="${full}" data-pos="名詞">${full}</span>`;
      } else {
        resultHtml += full;
      }
    }
  }

  return resultHtml;
}

// Global initialization for native tokenizer
export async function setupNativeYoruParser(): Promise<void> {
  try {
    const tokenizer = await initTokenizer();
    if (typeof window !== 'undefined') {
      (window as any).__yoru_tokenizer_instance = tokenizer;
      window.dispatchEvent(new CustomEvent('yoru-tokenizer-ready'));
    }
  } catch (err) {
    console.warn('Kuromoji background load:', err);
  }
}
