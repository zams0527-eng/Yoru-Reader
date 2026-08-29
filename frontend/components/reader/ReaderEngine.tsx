import React, { useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import { ReaderSettingsState } from '../../hooks/useReaderSettings';

interface Chapter {
  title: string;
  content: string;
  isFromToc?: boolean;
}

interface Book {
  title: string;
  chapters: Chapter[];
  _savedSection?: number;
}

interface Section {
  id: string;
  title: string;
  content: string;
  lastIndex: number;
  startChars: number;
  charCount?: number;
  isFromToc?: boolean;
}

interface CharsUpdatePayload {
  currChars: number;
  totalChars: number;
  lastIndex: number;
  currSection: number;
}

interface ReaderEngineProps {
  book: Book;
  readerSettings: ReaderSettingsState;
  onCharsUpdate?: (payload: CharsUpdatePayload) => void;
  onSectionChange?: (sectionIndex: number) => void;
  onClick?: (e: React.MouseEvent) => void;
  children?: ReactNode;
  targetSection?: number | null;
  targetParagraphId?: number | null;
  targetCharPosition?: number | null;
  colors: any;
}

export function sanitizeJapaneseText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\uFF40\u0060\u2018\u2019\u00B4｀`]/g, '、')
    .replace(/[\u309C\uFF9F\u00B0゜°]/g, '。')
    .replace(/［＃[^］]+］/g, '')
    .replace(/｜([^\n《]+)《([^\n》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>')
    .replace(/([\u4e00-\u9faf\u3400-\u4dbf々ー]+)《([^\n》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>')
    .replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
}

export function processRuby(text: string): string {
  return sanitizeJapaneseText(text);
}

export function countJapaneseChars(text: string): number {
  if (!text) return 0;
  const regex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf々ー]/g;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * ReaderEngine — Direct EPUB rendering engine for Yoru Reader.
 * Replaces the Svelte iframe. Renders book chapter HTML directly in the DOM
 * using CSS columns for pagination and writing-mode for vertical reading.
 */
function ReaderEngineComponent({
  book,
  readerSettings,
  onCharsUpdate,
  onSectionChange,
  onClick,
  children,
  targetSection,
  targetParagraphId,
  targetCharPosition,
  colors,
}: ReaderEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Current section index (chapter)
  const [currSection, setCurrSection] = useState<number>(() => {
    const saved = book._savedSection;
    return typeof saved === 'number' ? saved : 0;
  });

  // Build HTML sections from book.chapters
  const sections = useMemo<Section[]>(() => {
    if (!book || !book.chapters) return [];
    let paragraphId = 0;
    let charAccum = 0;

    return book.chapters.map((chapter, idx) => {
      const lines = (chapter.content || '').split(/\r?\n/);
      let sectionHtml = '';
      const startChars = charAccum;

      lines.forEach(line => {
        // heading tags
        if (line.startsWith('{h1:') && line.endsWith('}')) {
          const text = processRuby(line.substring(4, line.length - 1));
          sectionHtml += `<h1 class="chapter-content-h1">${text}</h1>`;
          return;
        }
        if (line.startsWith('{h2:') && line.endsWith('}')) {
          const text = processRuby(line.substring(4, line.length - 1));
          sectionHtml += `<h2 class="chapter-content-h2">${text}</h2>`;
          return;
        }
        if (line.startsWith('{h3:') && line.endsWith('}')) {
          const text = processRuby(line.substring(4, line.length - 1));
          sectionHtml += `<h3 class="chapter-content-h3">${text}</h3>`;
          return;
        }
        // standalone images
        if (line.startsWith('{img:') && line.endsWith('}')) {
          const src = line.substring(5, line.length - 1);
          sectionHtml += `<img index="${paragraphId}" characumm="${charAccum}" src="${src}" style="max-width:100%; max-height:var(--reader-image-height,85vh); object-fit:contain; display:block; margin:1em auto;" />`;
          paragraphId++;
          return;
        }
        // standard paragraph
        const sanitized = sanitizeJapaneseText(line);
        const processed = sanitized
          .replace(/\{img:([^{}]+)\}/gi, '<img src="$1" style="max-width:100%; max-height:var(--reader-image-height,85vh); object-fit:contain; display:block; margin:1em auto;" />');

        // count Japanese characters (excluding furigana)
        const plainText = line
          .replace(/\{img:[^{}]*\}/gi, '')
          .replace(/\{[^|{}]+\|[^{}]*\}/g, (m) => m.split('|')[0].substring(1))
          .replace(/[｀`]/g, '、')
          .replace(/[゜°]/g, '。');
        const jpCount = countJapaneseChars(plainText);

        sectionHtml += `<p class="chapter-content" index="${paragraphId}" characumm="${charAccum}">${processed}</p>`;
        charAccum += jpCount;
        paragraphId++;
      });

      return {
        id: `chapter-${idx}`,
        title: chapter.title,
        content: sectionHtml,
        lastIndex: paragraphId - 1,
        startChars,
        charCount: charAccum - startChars,
        isFromToc: chapter.isFromToc,
      };
    });
  }, [book]);

  const totalChars = useMemo(() => {
    if (sections.length === 0) return 0;
    const lastSection = sections[sections.length - 1];
    return lastSection.startChars + (lastSection.charCount || 0);
  }, [sections]);

  const { vertical, paginated, fontSize, lineHeight, verticalPadding, horizontalPadding, fontFamily } = readerSettings;

  // Container styles
  const containerStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontFamily: fontFamily !== '__default__' ? `"${fontFamily}", serif` : 'inherit',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.bg,
      color: colors.textMain,
    };
  }, [fontFamily, colors.bg, colors.textMain]);

  // Content div styles — CSS columns for pagination
  const contentStyle = useMemo<React.CSSProperties>(() => {
    const vp = `${window.innerHeight * (verticalPadding / 100)}px`;
    const hp = `${window.innerWidth * (horizontalPadding / 100)}px`;

    const base: React.CSSProperties = {
      margin: 'auto',
      fontFamily: fontFamily !== '__default__' ? `"${fontFamily}", serif` : 'inherit',
      fontSize: `${fontSize}px`,
      lineHeight: `${lineHeight}`,
      padding: `${vp} ${hp}`,
      backgroundColor: colors.bg,
      color: colors.textMain,
    };

    if (paginated && vertical) {
      return {
        ...base,
        writingMode: 'vertical-rl',
        overflowX: 'hidden',
        overflowY: 'hidden',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        columnGap: `calc(${hp} * 2)`,
        columnWidth: `calc(100vw - ${hp} * 2)`,
        columnFill: 'auto',
      };
    } else if (paginated && !vertical) {
      return {
        ...base,
        overflowY: 'hidden',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        columnGap: `calc(${hp} * 2)`,
        columnWidth: `calc(100vw - ${hp} * 2)`,
        columnFill: 'auto',
      };
    } else if (!paginated && vertical) {
      return {
        ...base,
        writingMode: 'vertical-rl',
        overflowX: 'auto',
        overflowY: 'hidden',
        boxSizing: 'border-box',
        height: '100%',
        width: '100%',
      };
    } else {
      // continuous horizontal
      return {
        ...base,
        boxSizing: 'border-box',
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      };
    }
  }, [fontSize, lineHeight, verticalPadding, horizontalPadding, vertical, paginated, fontFamily, colors.bg, colors.textMain]);

  // Handle resize → update CSS variables
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      container.style.setProperty('--reader-height', `${window.innerHeight}px`);
      container.style.setProperty('--reader-width', `${window.innerWidth}px`);
      container.style.setProperty(
        '--reader-image-height',
        `${window.innerHeight - 2 * window.innerHeight * (verticalPadding / 100) - 60}px`
      );
      container.style.setProperty(
        '--reader-image-width',
        `${window.innerWidth - 2 * window.innerWidth * (horizontalPadding / 100) - 60}px`
      );

      // Re-align columns after resize
      const content = contentRef.current;
      if (content && paginated) {
        if (!vertical) {
          const col = Math.round(content.scrollLeft / content.clientWidth);
          content.scrollLeft = col * content.clientWidth;
        } else {
          const col = Math.round(content.scrollTop / content.clientHeight);
          content.scrollTop = col * content.clientHeight;
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      container.style.removeProperty('--reader-height');
      container.style.removeProperty('--reader-width');
      container.style.removeProperty('--reader-image-height');
      container.style.removeProperty('--reader-image-width');
    };
  }, [verticalPadding, horizontalPadding, vertical, paginated]);

  // Update current chars read based on visible paragraphs
  const updateChars = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    let lastIndex = 0;
    let currChars = 0;
    const pTags = content.querySelectorAll('[index]');

    for (let i = 0; i < pTags.length; i++) {
      const rect = pTags[i].getBoundingClientRect();
      lastIndex = Number(pTags[i].getAttribute('index')) || lastIndex;
      currChars = Number(pTags[i].getAttribute('characumm')) || currChars;

      // Stop at first visible element
      if (
        (!paginated && !vertical && rect.bottom > 0) ||
        (!paginated && vertical && rect.x < window.innerWidth) ||
        (paginated && !vertical && rect.x > 0) ||
        (paginated && vertical && rect.y > 0)
      ) break;
    }

    if (onCharsUpdate) {
      onCharsUpdate({ currChars, totalChars, lastIndex, currSection });
    }
  }, [paginated, vertical, totalChars, currSection, onCharsUpdate]);

  // Page flip function
  const flipPage = useCallback((multiplier: number) => {
    const content = contentRef.current;
    if (!content) return;

    if (paginated) {
      if (vertical) {
        // Vertical paginated (writingMode: vertical-rl)
        const clientW = content.clientWidth;
        const scrollW = content.scrollWidth;
        const currentScroll = Math.abs(content.scrollLeft);
        const maxScroll = Math.max(0, scrollW - clientW);

        const atStart = currentScroll <= 25;
        const atEnd = currentScroll >= maxScroll - 25 || maxScroll === 0;

        if (atStart && multiplier === -1) {
          if (currSection > 0) {
            setCurrSection(prev => prev - 1);
            requestAnimationFrame(() => {
              const c = contentRef.current;
              if (c) c.scrollLeft = -(c.scrollWidth - c.clientWidth);
            });
          }
          return;
        }
        if (atEnd && multiplier === 1) {
          if (currSection < sections.length - 1) {
            setCurrSection(prev => prev + 1);
            requestAnimationFrame(() => {
              const c = contentRef.current;
              if (c) c.scrollLeft = 0;
            });
          }
          return;
        }

        const nextScroll = Math.max(0, Math.min(maxScroll, currentScroll + clientW * multiplier));
        content.scrollLeft = -nextScroll;
      } else {
        // Horizontal paginated
        const clientW = content.clientWidth;
        const scrollW = content.scrollWidth;
        const currentScroll = content.scrollLeft;
        const maxScroll = Math.max(0, scrollW - clientW);

        const atStart = currentScroll <= 25;
        const atEnd = currentScroll >= maxScroll - 25 || maxScroll === 0;

        if (atStart && multiplier === -1) {
          if (currSection > 0) {
            setCurrSection(prev => prev - 1);
            requestAnimationFrame(() => {
              const c = contentRef.current;
              if (c) c.scrollLeft = c.scrollWidth - c.clientWidth;
            });
          }
          return;
        }
        if (atEnd && multiplier === 1) {
          if (currSection < sections.length - 1) {
            setCurrSection(prev => prev + 1);
            requestAnimationFrame(() => {
              const c = contentRef.current;
              if (c) c.scrollLeft = 0;
            });
          }
          return;
        }

        const nextScroll = Math.max(0, Math.min(maxScroll, currentScroll + clientW * multiplier));
        content.scrollTo({ left: nextScroll, behavior: 'instant' });
      }
    } else {
      // Continuous scroll mode
      if (vertical) {
        content.scrollLeft -= 100 * multiplier;
      } else {
        content.scrollTop += 100 * multiplier;
      }
    }
    updateChars();
  }, [vertical, paginated, currSection, sections.length, updateChars]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;

      if (vertical) {
        if (e.key === 'ArrowLeft') flipPage(1);
        else if (e.key === 'ArrowRight') flipPage(-1);
      } else {
        if (e.key === 'ArrowRight') flipPage(1);
        else if (e.key === 'ArrowLeft') flipPage(-1);
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') flipPage(1);
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') flipPage(-1);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [vertical, flipPage]);

  // Touch swipe
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !paginated) return;

    let startX = 0;
    const handleTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const handleTouchEnd = (e: TouchEvent) => {
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 50) {
        if (vertical) {
          flipPage(delta < 0 ? -1 : 1);
        } else {
          flipPage(delta < 0 ? 1 : -1);
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [paginated, vertical, flipPage]);

  // Mouse wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (paginated) {
        e.preventDefault();
        flipPage(e.deltaY > 0 ? 1 : -1);
      } else if (vertical && !paginated) {
        // continuous vertical → scroll horizontally
        container.scrollLeft -= e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [paginated, vertical, flipPage]);

  // Update chars on section change
  useEffect(() => {
    requestAnimationFrame(() => updateChars());
    if (onSectionChange) onSectionChange(currSection);
  }, [currSection]);

  // Automatically trigger Yoru Parser on section change / page load
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('yoru:parse-page'));
        window.postMessage({ type: 'YORU_PARSE_PAGE' }, '*');
        if ((window as any).__yoruParserInstance && contentRef.current) {
          (window as any).__yoruParserInstance.parseNode(contentRef.current);
        }
      } catch (err) {
        console.error('[ReaderEngine] Auto parse trigger failed:', err);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [currSection, sections]);

  // Navigate to section by index
  const goToSection = useCallback((idx: number) => {
    if (idx >= 0 && idx < sections.length) {
      setCurrSection(idx);
      requestAnimationFrame(() => {
        const c = contentRef.current;
        if (c) {
          if (vertical) c.scrollTo({ top: 0, behavior: 'instant' });
          else c.scrollTo({ left: 0, behavior: 'instant' });
        }
        updateChars();
      });
    }
  }, [sections.length, vertical, updateChars]);

  // Prop-driven navigation
  useEffect(() => {
    if (typeof targetSection === 'number') {
      goToSection(targetSection);
    }
  }, [targetSection, goToSection]);

  useEffect(() => {
    if (typeof targetParagraphId === 'number') {
      const content = contentRef.current;
      if (content) {
        const el = content.querySelector(`[index="${targetParagraphId}"]`);
        if (el) {
          el.scrollIntoView({ inline: 'center', block: 'center' });
        }
      }
    }
  }, [targetParagraphId]);

  // Navigate to specific character position
  useEffect(() => {
    if (typeof targetCharPosition === 'number' && targetCharPosition >= 0 && sections.length > 0) {
      const sectionIdx = sections.findIndex((s, idx) => {
        const nextSection = sections[idx + 1];
        if (!nextSection) return true;
        return targetCharPosition >= s.startChars && targetCharPosition < nextSection.startChars;
      });

      if (sectionIdx !== -1) {
        setCurrSection(sectionIdx);
        requestAnimationFrame(() => {
          const content = contentRef.current;
          if (content) {
            const pTags = content.querySelectorAll('[characumm]');
            let targetP: HTMLElement | null = null;
            for (let i = 0; i < pTags.length; i++) {
              const accum = parseInt(pTags[i].getAttribute('characumm') || '0', 10);
              if (accum <= targetCharPosition) {
                targetP = pTags[i] as HTMLElement;
              } else {
                break;
              }
            }
            if (targetP) {
              targetP.scrollIntoView({ inline: 'center', block: 'center' });
            }
          }
          updateChars();
        });
      }
    }
  }, [targetCharPosition, sections, updateChars]);

  // Build the current section HTML
  const currentHtml = useMemo(() => {
    if (paginated) {
      // In paginated mode, render only the current section
      return sections[currSection]?.content || '';
    }
    // In continuous mode, render ALL sections
    return sections.map(s => s.content).join('');
  }, [sections, currSection, paginated]);

  // Handle content click (close sidebars, etc.)
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (onClick) onClick(e);
  }, [onClick]);

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onClick={handleContentClick}
      className="reader-engine-container book-content"
    >
      <div
        ref={contentRef}
        id={`reader-content-sec-${currSection}`}
        style={contentStyle}
        className="reader-engine-content book-content-container"
        dangerouslySetInnerHTML={{ __html: currentHtml }}
      />
      {/* Render children (overlays like selection toolbar, char counter) */}
      {children}
    </div>
  );
}

const ReaderEngine = React.memo(ReaderEngineComponent, (prevProps, nextProps) => {
  return (
    prevProps.book.id === nextProps.book.id &&
    prevProps.book._savedSection === nextProps.book._savedSection &&
    prevProps.readerSettings.fontSize === nextProps.readerSettings.fontSize &&
    prevProps.readerSettings.lineHeight === nextProps.readerSettings.lineHeight &&
    prevProps.readerSettings.fontFamily === nextProps.readerSettings.fontFamily &&
    prevProps.readerSettings.verticalPadding === nextProps.readerSettings.verticalPadding &&
    prevProps.readerSettings.horizontalPadding === nextProps.readerSettings.horizontalPadding &&
    prevProps.readerSettings.vertical === nextProps.readerSettings.vertical &&
    prevProps.readerSettings.paginated === nextProps.readerSettings.paginated &&
    prevProps.readerSettings.showFurigana === nextProps.readerSettings.showFurigana &&
    prevProps.readerSettings.disableCss === nextProps.readerSettings.disableCss &&
    prevProps.readerSettings.theme === nextProps.readerSettings.theme &&
    prevProps.readerSettings.showProgressLine === nextProps.readerSettings.showProgressLine &&
    prevProps.readerSettings.direction === nextProps.readerSettings.direction &&
    prevProps.colors.bg === nextProps.colors.bg &&
    prevProps.colors.textMain === nextProps.colors.textMain &&
    prevProps.targetSection === nextProps.targetSection &&
    prevProps.targetParagraphId === nextProps.targetParagraphId &&
    prevProps.targetCharPosition === nextProps.targetCharPosition
  );
});

export default ReaderEngine;
