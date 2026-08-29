import React, { useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import { ReaderSettingsState } from '../../hooks/useReaderSettings';

export interface Chapter {
  title: string;
  content: string;
  isFromToc?: boolean;
}

export interface Book {
  id?: string;
  title: string;
  chapters: Chapter[];
  _savedSection?: number;
}

export interface Section {
  id: string;
  title: string;
  content: string;
  lastIndex: number;
  startChars: number;
  charCount?: number;
  isFromToc?: boolean;
}

export interface CharsUpdatePayload {
  currChars: number;
  totalChars: number;
  lastIndex: number;
  currSection: number;
}

export interface ReaderEngineProps {
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
 * Authentic TTU Reader Engine Implementation
 * Matches the official ttu-ttu/ebook-reader architecture and Jiten TtsuParser.
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

  // Current chapter / section index
  const [currSection, setCurrSection] = useState<number>(() => {
    const saved = book._savedSection;
    return typeof saved === 'number' && saved >= 0 ? saved : 0;
  });

  // Current discrete page index
  const [pageIndex, setPageIndex] = useState<number>(0);

  // Build clean HTML sections from book.chapters
  const sections = useMemo<Section[]>(() => {
    if (!book || !book.chapters || book.chapters.length === 0) return [];
    let paragraphId = 0;
    let charAccum = 0;
    const resultSections: Section[] = [];

    book.chapters.forEach((chapter, chapterIdx) => {
      const lines = (chapter.content || '').split(/\r?\n/);
      let sectionHtml = '';
      let sectionCharCount = 0;
      let startChars = charAccum;
      let subSectionIdx = 0;

      lines.forEach(line => {
        if (!line.trim()) {
          sectionHtml += `<p class="chapter-content empty-line" index="${paragraphId}" characumm="${charAccum}"><br/></p>`;
          paragraphId++;
          return;
        }

        // Headings
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

        // Images
        if (line.startsWith('{img:') && line.endsWith('}')) {
          const src = line.substring(5, line.length - 1);
          sectionHtml += `<img index="${paragraphId}" characumm="${charAccum}" src="${src}" style="max-width:100%; max-height:var(--reader-image-height,85vh); object-fit:contain; display:block; margin:1em auto;" />`;
          paragraphId++;
          return;
        }

        // Standard Paragraph
        const sanitized = sanitizeJapaneseText(line);
        const processed = sanitized.replace(
          /\{img:([^{}]+)\}/gi,
          '<img src="$1" style="max-width:100%; max-height:var(--reader-image-height,85vh); object-fit:contain; display:block; margin:1em auto;" />'
        );

        const plainText = line
          .replace(/\{img:[^{}]*\}/gi, '')
          .replace(/\{[^|{}]+\|[^{}]*\}/g, (m) => m.split('|')[0].substring(1))
          .replace(/[｀`]/g, '、')
          .replace(/[゜°]/g, '。');
        const jpCount = countJapaneseChars(plainText);

        sectionHtml += `<p class="chapter-content" index="${paragraphId}" characumm="${charAccum}">${processed}</p>`;
        charAccum += jpCount;
        sectionCharCount += jpCount;
        paragraphId++;

        // Chunk large sections at ~3000 chars to avoid Chromium multi-column limits
        if (sectionCharCount >= 3000) {
          resultSections.push({
            id: `chapter-${chapterIdx}-${subSectionIdx}`,
            title: chapter.title ? (subSectionIdx === 0 ? chapter.title : `${chapter.title} (${subSectionIdx + 1})`) : `Capítulo ${chapterIdx + 1}`,
            content: sectionHtml,
            lastIndex: paragraphId - 1,
            startChars,
            charCount: charAccum - startChars,
            isFromToc: chapter.isFromToc,
          });
          sectionHtml = '';
          sectionCharCount = 0;
          startChars = charAccum;
          subSectionIdx++;
        }
      });

      if (sectionHtml.length > 0 || resultSections.length === 0) {
        resultSections.push({
          id: `chapter-${chapterIdx}-${subSectionIdx}`,
          title: chapter.title ? (subSectionIdx === 0 ? chapter.title : `${chapter.title} (${subSectionIdx + 1})`) : `Capítulo ${chapterIdx + 1}`,
          content: sectionHtml,
          lastIndex: paragraphId - 1,
          startChars,
          charCount: charAccum - startChars,
          isFromToc: chapter.isFromToc,
        });
      }
    });

    return resultSections;
  }, [book]);

  const totalChars = useMemo(() => {
    if (sections.length === 0) return 0;
    const lastSection = sections[sections.length - 1];
    return lastSection.startChars + (lastSection.charCount || 0);
  }, [sections]);

  const {
    vertical,
    paginated,
    fontSize,
    lineHeight,
    verticalPadding,
    horizontalPadding,
    fontFamily,
  } = readerSettings;

  // Outer container styles
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

  // Content styles
  const contentStyle = useMemo<React.CSSProperties>(() => {
    const vp = `${Math.max(10, window.innerHeight * (verticalPadding / 100))}px`;
    const hp = `${Math.max(10, window.innerWidth * (horizontalPadding / 100))}px`;

    const base: React.CSSProperties = {
      margin: 'auto',
      fontFamily: fontFamily !== '__default__' ? `"${fontFamily}", serif` : 'inherit',
      fontSize: `${fontSize}px`,
      lineHeight: `${lineHeight}`,
      padding: `${vp} ${hp}`,
      backgroundColor: colors.bg,
      color: colors.textMain,
      boxSizing: 'border-box',
    };

    if (paginated && vertical) {
      return {
        ...base,
        writingMode: 'vertical-rl',
        overflowX: 'hidden',
        overflowY: 'hidden',
        width: '100%',
        height: '100%',
        columnGap: `calc(${hp} * 2)`,
        columnWidth: `calc(100vw - ${hp} * 2)`,
        columnFill: 'auto',
      };
    } else if (paginated && !vertical) {
      return {
        ...base,
        writingMode: 'horizontal-tb',
        overflowY: 'hidden',
        overflowX: 'hidden',
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
        height: '100%',
        width: '100%',
      };
    } else {
      return {
        ...base,
        writingMode: 'horizontal-tb',
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      };
    }
  }, [fontSize, lineHeight, verticalPadding, horizontalPadding, vertical, paginated, fontFamily, colors.bg, colors.textMain]);

  // Update current chars read based on visible elements
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
        (!paginated && vertical && rect.right > 0) ||
        (paginated && !vertical && rect.right > 0) ||
        (paginated && vertical && rect.right > 0)
      ) {
        break;
      }
    }

    if (onCharsUpdate) {
      onCharsUpdate({ currChars, totalChars, lastIndex, currSection });
    }
  }, [paginated, vertical, totalChars, currSection, onCharsUpdate]);

  // Calculate total pages in current section
  const getMaxPages = useCallback(() => {
    const content = contentRef.current;
    if (!content) return 1;
    const clientW = content.clientWidth || window.innerWidth;
    const scrollW = content.scrollWidth;
    return Math.max(1, Math.ceil(scrollW / clientW));
  }, []);

  // Sync scroll position
  const applyPagePosition = useCallback((targetPage: number) => {
    const content = contentRef.current;
    if (!content) return;

    const clientW = content.clientWidth || window.innerWidth;
    if (vertical) {
      content.scrollLeft = -targetPage * clientW;
    } else {
      content.scrollTo({ left: targetPage * clientW, behavior: 'instant' });
    }
    updateChars();
  }, [vertical, updateChars]);

  // Page flip function (1 = forward, -1 = backward)
  const flipPage = useCallback((multiplier: number) => {
    const content = contentRef.current;
    if (!content) return;

    if (paginated) {
      const maxPages = getMaxPages();

      if (multiplier === 1) {
        // Forward
        if (pageIndex < maxPages - 1) {
          const next = pageIndex + 1;
          setPageIndex(next);
          applyPagePosition(next);
        } else {
          // Advance to next chapter
          if (currSection < sections.length - 1) {
            setCurrSection(prev => prev + 1);
            setPageIndex(0);
          }
        }
      } else if (multiplier === -1) {
        // Backward
        if (pageIndex > 0) {
          const prev = pageIndex - 1;
          setPageIndex(prev);
          applyPagePosition(prev);
        } else {
          // Go to previous chapter
          if (currSection > 0) {
            setCurrSection(prev => prev - 1);
            requestAnimationFrame(() => {
              const prevMax = getMaxPages();
              const lastPage = Math.max(0, prevMax - 1);
              setPageIndex(lastPage);
              applyPagePosition(lastPage);
            });
          }
        }
      }
    } else {
      // Continuous scroll mode
      if (vertical) {
        content.scrollLeft -= 200 * multiplier;
      } else {
        content.scrollTop += 200 * multiplier;
      }
      updateChars();
    }
  }, [paginated, vertical, pageIndex, currSection, sections.length, getMaxPages, applyPagePosition, updateChars]);

  // Jump directly to section
  const goToSection = useCallback((sectionIdx: number) => {
    if (sectionIdx < 0 || sectionIdx >= sections.length) return;
    setCurrSection(sectionIdx);
    setPageIndex(0);
    const content = contentRef.current;
    if (content) {
      content.scrollLeft = 0;
      content.scrollTop = 0;
    }
    requestAnimationFrame(() => updateChars());
  }, [sections.length, updateChars]);

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
          updateChars();
        }
      }
    }
  }, [targetParagraphId, updateChars]);

  useEffect(() => {
    if (typeof targetCharPosition === 'number' && targetCharPosition >= 0 && sections.length > 0) {
      const sectionIdx = sections.findIndex((s, idx) => {
        const nextSection = sections[idx + 1];
        if (!nextSection) return true;
        return targetCharPosition >= s.startChars && targetCharPosition < nextSection.startChars;
      });

      if (sectionIdx !== -1) {
        setCurrSection(sectionIdx);
        setPageIndex(0);
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

  // Reset scroll & update chars on section change
  useEffect(() => {
    const c = contentRef.current;
    if (c) {
      c.scrollLeft = 0;
      c.scrollTop = 0;
    }
    requestAnimationFrame(() => updateChars());
    if (onSectionChange) onSectionChange(currSection);
  }, [currSection, onSectionChange, updateChars]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;

      if (vertical) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          flipPage(1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          flipPage(-1);
        }
      } else {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          flipPage(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          flipPage(-1);
        }
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        flipPage(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        flipPage(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [vertical, flipPage]);

  // Touch swipe
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !paginated) return;

    let startX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };
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
        container.scrollLeft -= e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [paginated, vertical, flipPage]);

  // Resize handling
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

      if (paginated) {
        applyPagePosition(pageIndex);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      container.style.removeProperty('--reader-height');
      container.style.removeProperty('--reader-width');
      container.style.removeProperty('--reader-image-height');
      container.style.removeProperty('--reader-image-width');
    };
  }, [verticalPadding, horizontalPadding, paginated, pageIndex, applyPagePosition]);

  // Build current section HTML
  const currentHtml = useMemo(() => {
    if (paginated) {
      return sections[currSection]?.content || '';
    }
    return sections.map(s => s.content).join('');
  }, [sections, currSection, paginated]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (onClick) onClick(e);
  }, [onClick]);

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onClick={handleContentClick}
      className={`reader-engine-container book-content ${vertical ? 'book-content--writing-vertical-rl' : 'book-content--writing-horizontal-tb'}`}
    >
      <div
        ref={contentRef}
        id={`ttu-chapter-${currSection}`}
        style={contentStyle}
        className="reader-engine-content book-content-container"
        dangerouslySetInnerHTML={{ __html: currentHtml }}
      />
      {children}
    </div>
  );
}

export const ReaderEngine = React.memo(ReaderEngineComponent, (prevProps, nextProps) => {
  return (
    prevProps.book.id === nextProps.book.id &&
    prevProps.readerSettings.fontSize === nextProps.readerSettings.fontSize &&
    prevProps.readerSettings.lineHeight === nextProps.readerSettings.lineHeight &&
    prevProps.readerSettings.vertical === nextProps.readerSettings.vertical &&
    prevProps.readerSettings.paginated === nextProps.readerSettings.paginated &&
    prevProps.readerSettings.theme === nextProps.readerSettings.theme &&
    prevProps.readerSettings.fontFamily === nextProps.readerSettings.fontFamily &&
    prevProps.readerSettings.verticalPadding === nextProps.readerSettings.verticalPadding &&
    prevProps.readerSettings.horizontalPadding === nextProps.readerSettings.horizontalPadding &&
    prevProps.targetSection === nextProps.targetSection &&
    prevProps.targetParagraphId === nextProps.targetParagraphId &&
    prevProps.targetCharPosition === nextProps.targetCharPosition &&
    prevProps.colors === nextProps.colors
  );
});

export default ReaderEngine;
