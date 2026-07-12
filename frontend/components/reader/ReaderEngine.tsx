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

/**
 * ReaderEngine — Direct EPUB rendering engine for Yoru Reader.
 * Replaces the Svelte iframe. Renders book chapter HTML directly in the DOM
 * using CSS columns for pagination and writing-mode for vertical reading.
 *

 */
const ReaderEngine = React.memo(function ReaderEngine({
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
      const lines = (chapter.content || '').split('\n');
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
        const processed = line
          .replace(/\{img:([^{}]+)\}/gi, '<img src="$1" style="max-width:100%; max-height:var(--reader-image-height,85vh); object-fit:contain; display:block; margin:1em auto;" />')
          .replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');

        // count Japanese characters (excluding furigana)
        const plainText = line
          .replace(/\{img:[^{}]*\}/gi, '')
          .replace(/\{[^|{}]+\|[^{}]*\}/g, (m) => m.split('|')[0].substring(1));
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
        width: 'var(--reader-width, 100vw)',
        height: 'calc(var(--reader-height, 100vh) - 4em)',
        columnGap: `calc(${vp} * 2)`,
        columnWidth: `calc(var(--reader-width, 100vw) - ${vp} * 2)`,
        columnFill: 'auto',
      };
    } else if (paginated && !vertical) {
      return {
        ...base,
        overflowY: 'hidden',
        overflowX: 'hidden',
        height: 'var(--reader-height, 100vh)',
        width: 'calc(var(--reader-width, 100vw) - 4em)',
        columnGap: `calc(${hp} * 2)`,
        columnWidth: `calc(var(--reader-width, 100vw) - ${hp} * 2)`,
        columnFill: 'auto',
      };
    } else if (!paginated && vertical) {
      return {
        ...base,
        writingMode: 'vertical-rl',
        overflowY: 'hidden',
        height: 'calc(var(--reader-height, 100vh) - 4em)',
      };
    } else {
      // continuous horizontal
      return {
        ...base,
        height: '100%',
        width: 'calc(var(--reader-width, 100vw) - 4em)',
        overflowY: 'auto',
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

  // Page flip function
  const flipPage = useCallback((multiplier: number) => {
    const content = contentRef.current;
    if (!content) return;

    let isStart = false, isEnd = false;
    if (vertical) {
      isStart = content.scrollTop === 0;
      isEnd = Math.ceil(content.scrollTop + content.clientHeight) >= content.scrollHeight;
    } else {
      isStart = content.scrollLeft === 0;
      isEnd = Math.ceil(content.scrollLeft + content.clientWidth) >= content.scrollWidth;
    }

    // At section boundary → go prev/next chapter
    if (isStart && multiplier === -1) {
      if (currSection === 0) return;
      setCurrSection(prev => {
        const newSec = prev - 1;
        // scroll to end of previous section after render
        requestAnimationFrame(() => {
          const c = contentRef.current;
          if (!c) return;
          if (vertical) {
            c.scrollTo({ top: c.scrollHeight, behavior: 'instant' });
          } else {
            c.scrollTo({ left: c.scrollWidth, behavior: 'instant' });
          }
          updateChars();
        });
        return newSec;
      });
      return;
    }
    if (isEnd && multiplier === 1) {
      if (currSection >= sections.length - 1) return;
      setCurrSection(prev => {
        const newSec = prev + 1;
        requestAnimationFrame(() => {
          const c = contentRef.current;
          if (!c) return;
          if (vertical) {
            c.scrollTo({ top: 0, behavior: 'instant' });
          } else {
            c.scrollTo({ left: 0, behavior: 'instant' });
          }
          updateChars();
        });
        return newSec;
      });
      return;
    }

    const offset = vertical ? content.clientHeight : content.clientWidth;
    const current = vertical ? content.scrollTop : content.scrollLeft;
    const max = vertical ? content.scrollHeight : content.scrollWidth;
    const next = Math.max(0, Math.min(Math.ceil(current + offset * multiplier), max));

    const scrollOpts = vertical ? { top: next } : { left: next };
    content.scrollTo({ ...scrollOpts, behavior: 'instant' });
    updateChars();
  }, [vertical, currSection, sections.length]);

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
}, (prevProps, nextProps) => {
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

// -- Helpers --

function processRuby(text: string): string {
  return text.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
}

function countJapaneseChars(text: string): number {
  if (!text) return 0;
  const regex = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々〻]/gu;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

// Export helpers for external use
export { countJapaneseChars };
