import JSZip from 'jszip';

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
  'linear-gradient(135deg, #c3ec52 0%, #0ba360 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
];

function getRandomGradient() {
  return GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
}

// Helper to recursively extract readable paragraphs from DOM tree, preserving <ruby> markup structure
export function htmlToStructuredParagraphs(doc) {
  // Clean elements that do not contain readable text (metadata, scripts, styles)
  doc.querySelectorAll('script, style, head').forEach(el => el.remove());
  
  const paragraphs = [];
  let currentParagraph = [];
  
  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        if (currentParagraph.length > 0 && typeof currentParagraph[currentParagraph.length - 1] === 'string') {
          currentParagraph[currentParagraph.length - 1] += text;
        } else {
          currentParagraph.push(text);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      if (tagName === 'img' || tagName === 'image') {
        const src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('href') || '';
        if (src) {
          currentParagraph.push({
            type: 'image',
            src: src
          });
        }
        return; // Don't traverse inside img/image elements
      }

      if (tagName === 'ruby') {
        // Extract furigana from <rt> element
        const rtElement = node.querySelector('rt');
        const rubyReading = rtElement ? rtElement.textContent.trim() : '';
        
        // Extract kanji base text by cloning and removing rt / rp elements
        const clone = node.cloneNode(true);
        clone.querySelectorAll('rt, rp').forEach(el => el.remove());
        const baseText = clone.textContent.trim();
        
        if (baseText) {
          currentParagraph.push({
            type: 'ruby',
            text: baseText,
            ruby: rubyReading
          });
        }
        return; // Skip traversing children of <ruby> as they are processed
      }
      
      const isBlock = [
        'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
        'li', 'br', 'blockquote', 'section', 'article', 'tr'
      ].includes(tagName);
      
      if (isBlock && currentParagraph.length > 0) {
        currentParagraph.tagName = tagName;
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
      
      for (let child of node.childNodes) {
        traverse(child);
      }
      
      if (isBlock && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
    }
  }
  
  if (doc.body) {
    traverse(doc.body);
  } else {
    traverse(doc);
  }
  
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }
  
  return paragraphs.map(p => {
    const newP = p.map(segment => {
      if (typeof segment === 'string') {
        return segment.replace(/\s+/g, ' ');
      }
      return segment;
    }).filter(segment => {
      if (typeof segment === 'string') {
        return segment.trim().length > 0;
      }
      if (segment.type === 'image') {
        return true;
      }
      return segment.text && segment.text.trim().length > 0;
    });
    if (p.tagName) {
      newP.tagName = p.tagName;
    }
    return newP;
  }).filter(p => p.length > 0);
}

// Helper to serialize structured paragraphs into a text format that preserves ruby blocks and images
export function serializeStructuredParagraph(p) {
  const content = p.map(segment => {
    if (typeof segment === 'string') {
      return segment;
    }
    if (segment.type === 'image') {
      return `{img:${segment.src}}`;
    }
    return `{${segment.text}|${segment.ruby}}`;
  }).join('');

  if (p.tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(p.tagName)) {
    return `{${p.tagName}:${content}}`;
  }
  return content;
}

// Helper to identify introductory metadata and front-matter sections
export function isFrontMatter(title, filename) {
  const titleLower = title.toLowerCase();
  const filenameLower = filename.toLowerCase();
  
  // If filename or title matches typical first chapter formats, it is NOT front matter
  if (/ch(apter)?[-_]?0*1\b/i.test(filenameLower) || /ch(apter)?[-_]?0*1\b/i.test(titleLower)) {
    return false;
  }
  if (/第[一１1]章/i.test(titleLower) || /第[一１1]話/i.test(titleLower)) {
    return false;
  }
  
  const keywords = [
    'cover', 'portada', 'copyright', 'derechos', 'colofon', 'coloph',
    'notice', 'advertencia', 'aviso', 'advert', 'preface', 'prefacio',
    'まえがき', '目次', 'toc', 'index', 'indice', 'tabla de contenido',
    'illustration', '口絵', 'ilustracion', 'title', 'titulo', 'author', 'autor',
    'prologue', 'prologo', 'プロローグ'
  ];
  
  for (const kw of keywords) {
    if (titleLower.includes(kw) || filenameLower.includes(kw)) {
      return true;
    }
  }
  return false;
}

// 1. HTML Parser
export function parseHTML(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const paragraphs = htmlToParagraphs(doc);
  return paragraphs.join('\n');
}

// 2. RTF Parser
export function parseRTF(rtfText) {
  let output = "";
  let groupStack = [];
  let currentGroupIgnored = false;
  
  const IGNORED_GROUPS = [
    'fonttbl', 'colortbl', 'stylesheet', 'info', 'generator', 
    'nonshppict', 'shp', 'pictures', 'private'
  ];
  
  let i = 0;
  while (i < rtfText.length) {
    const char = rtfText[i];
    
    if (char === '{') {
      groupStack.push(currentGroupIgnored);
      i++;
    } else if (char === '}') {
      if (groupStack.length > 0) {
        currentGroupIgnored = groupStack.pop();
      } else {
        currentGroupIgnored = false;
      }
      i++;
    } else if (char === '\\') {
      i++;
      if (i >= rtfText.length) break;
      
      // Escaped characters
      if (rtfText[i] === '\\' || rtfText[i] === '{' || rtfText[i] === '}') {
        if (!currentGroupIgnored) output += rtfText[i];
        i++;
        continue;
      }
      
      // Parse control word
      let word = "";
      while (i < rtfText.length && /[a-zA-Z]/.test(rtfText[i])) {
        word += rtfText[i];
        i++;
      }
      
      if (IGNORED_GROUPS.includes(word)) {
        currentGroupIgnored = true;
      }
      
      // Parse optional signed number argument
      let numStr = "";
      if (i < rtfText.length && (rtfText[i] === '-' || /[0-9]/.test(rtfText[i]))) {
        numStr += rtfText[i];
        i++;
        while (i < rtfText.length && /[0-9]/.test(rtfText[i])) {
          numStr += rtfText[i];
          i++;
        }
      }
      
      // Skip single trailing space
      if (i < rtfText.length && rtfText[i] === ' ') {
        i++;
      }
      
      // Process key tags
      if (word === 'par' || word === 'line' || word === 'row') {
        if (!currentGroupIgnored) output += '\n';
      } else if (word === 'tab') {
        if (!currentGroupIgnored) output += '\t';
      } else if (word === 'u') {
        const unicodeVal = parseInt(numStr, 10);
        if (!isNaN(unicodeVal)) {
          const codePoint = unicodeVal < 0 ? unicodeVal + 65536 : unicodeVal;
          if (!currentGroupIgnored) output += String.fromCharCode(codePoint);
        }
        // Skip placeholder char (often '?' or similar)
        if (i < rtfText.length) {
          i++;
        }
      }
    } else if (char === '\r' || char === '\n') {
      i++;
    } else {
      if (!currentGroupIgnored) {
        output += char;
      }
      i++;
    }
  }
  
  return output.trim();
}

// 3. Subtitles Parsers (SRT, VTT, ASS/SSA)
export function parseSRT(srtText) {
  const blocks = srtText.split(/\r?\n\r?\n/);
  const lines = [];

  for (const block of blocks) {
    const blockLines = block.trim().split(/\r?\n/);
    if (blockLines.length < 3) continue; // Skip malformed or empty cues
    
    // Line 0: Index (e.g. 1)
    // Line 1: Timing (e.g. 00:00:01,000 --> 00:00:04,000)
    // Line 2+: Subtitle Text
    const textLines = blockLines.slice(2);
    
    const text = textLines.join(' ')
      .replace(/<[^>]+>/g, '') // Strip HTML formatting tags like <i>, <b>
      .trim();
      
    if (text) {
      lines.push(text);
    }
  }

  return lines.join('\n\n');
}

export function parseVTT(vttText) {
  const lines = [];
  const rawBlocks = vttText.split(/\r?\n\r?\n/);
  
  // WebVTT can start with metadata / notes
  for (const block of rawBlocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock || trimmedBlock.startsWith('WEBVTT') || trimmedBlock.startsWith('NOTE')) {
      continue;
    }
    
    const blockLines = trimmedBlock.split(/\r?\n/);
    
    // Check if line contains timing arrow. Sometimes index is first line, sometimes timing is first
    let textStartIndex = 1;
    if (blockLines[0].includes('-->')) {
      textStartIndex = 1;
    } else if (blockLines.length > 1 && blockLines[1].includes('-->')) {
      textStartIndex = 2;
    } else {
      // Not a valid subtitle block
      continue;
    }
    
    const textLines = blockLines.slice(textStartIndex);
    const text = textLines.join(' ')
      .replace(/<[^>]+>/g, '') // Strip HTML tags
      .trim();
      
    if (text) {
      lines.push(text);
    }
  }

  return lines.join('\n\n');
}

export function parseASS(assText) {
  const rawLines = assText.split(/\r?\n/);
  const dialogues = [];
  let inEventsSection = false;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[Events]')) {
      inEventsSection = true;
      continue;
    }
    if (trimmed.startsWith('[')) {
      inEventsSection = false; // Another section started
      continue;
    }

    if (inEventsSection && trimmed.startsWith('Dialogue:')) {
      // SSA/ASS line structure:
      // Dialogue: Layer, Start, End, Style, Actor, MarginL, MarginR, MarginV, Effect, Text
      // Split by commas, but only for the first 9 occurrences, so we don't split the Text itself.
      const commaIndices = [];
      let index = trimmed.indexOf(',');
      while (index !== -1 && commaIndices.length < 9) {
        commaIndices.push(index);
        index = trimmed.indexOf(',', index + 1);
      }

      if (commaIndices.length === 9) {
        const textStartIndex = commaIndices[8] + 1;
        let text = trimmed.substring(textStartIndex);
        
        // Clean ASS style blocks {\...}
        text = text.replace(/\{[^}]+\}/g, '');
        // Replace \N or \n with newlines
        text = text.replace(/\\N/gi, '\n');
        text = text.replace(/\\n/gi, '\n');
        
        const cleanText = text.trim();
        if (cleanText) {
          dialogues.push(cleanText);
        }
      }
    }
  }

  return dialogues.join('\n\n');
}

function resolveRelativePath(basePath, relativePath) {
  const baseParts = basePath.split('/');
  baseParts.pop(); // Remove filename
  
  const relParts = relativePath.split('/');
  for (let part of relParts) {
    if (part === '.') {
      continue;
    } else if (part === '..') {
      baseParts.pop();
    } else if (part) {
      baseParts.push(part);
    }
  }
  return baseParts.join('/');
}

// 4. EPUB Parser (Zip extractor)
export async function parseEPUB(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // 1. Locate container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Archivo contenedor inválido (META-INF/container.xml no encontrado)');
  }
  
  const containerXml = await containerFile.async('text');
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfPathMatch) {
    throw new Error('No se pudo encontrar la ruta del archivo descriptivo principal (.opf)');
  }
  
  const opfPath = opfPathMatch[1];
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Archivo descriptivo OPF no encontrado en la ruta: ${opfPath}`);
  }
  
  const opfXml = await opfFile.async('text');
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, 'text/xml');
  
  // 2. Extract metadata
  const titleEl = opfDoc.querySelector('title') || opfDoc.querySelector('dc\\:title');
  const creatorEl = opfDoc.querySelector('creator') || opfDoc.querySelector('dc\\:creator');
  const title = titleEl ? titleEl.textContent.trim() : 'Libro EPUB';
  const author = creatorEl ? creatorEl.textContent.trim() : 'Autor Desconocido';
  
  // 3. Extract manifest items
  const manifestItems = {};
  opfDoc.querySelectorAll('manifest > item').forEach(item => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) {
      manifestItems[id] = href;
    }
  });
  
  // 4. Extract spine sequence
  const spineIds = [];
  opfDoc.querySelectorAll('spine > itemref').forEach(ref => {
    const idref = ref.getAttribute('idref');
    if (idref) {
      spineIds.push(idref);
    }
  });

  // Determine relative base folder inside ZIP for files listed in manifest
  const lastSlashIndex = opfPath.lastIndexOf('/');
  const baseDir = lastSlashIndex !== -1 ? opfPath.substring(0, lastSlashIndex + 1) : '';

  // --- Extract Table of Contents (TOC) Map ---
  const tocMap = {};
  try {
    // 1. EPUB 3 Nav TOC
    let navHref = '';
    opfDoc.querySelectorAll('item').forEach(item => {
      const props = item.getAttribute('properties') || '';
      if (props.split(/\s+/).includes('nav')) {
        navHref = item.getAttribute('href');
      }
    });
    // Fallback search if properties attribute is not found but ID or href hints it
    if (!navHref) {
      opfDoc.querySelectorAll('item').forEach(item => {
        const id = (item.getAttribute('id') || '').toLowerCase();
        const href = (item.getAttribute('href') || '').toLowerCase();
        if (id === 'nav' || id === 'toc' || href.includes('nav.xhtml') || href.includes('toc.xhtml')) {
          navHref = item.getAttribute('href');
        }
      });
    }

    if (navHref) {
      const resolvedNavPath = resolveRelativePath(opfPath, navHref);
      const navFile = zip.file(resolvedNavPath);
      if (navFile) {
        const navHtml = await navFile.async('text');
        const navDoc = parser.parseFromString(navHtml, 'text/html');
        navDoc.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href');
          if (href) {
            const cleanHref = decodeURIComponent(href.split('#')[0]);
            const targetPath = resolveRelativePath(resolvedNavPath, cleanHref);
            const label = a.textContent.trim();
            if (label && !tocMap[targetPath]) {
              tocMap[targetPath] = label;
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn("Failed to parse EPUB 3 Nav TOC:", e);
  }

  // 2. EPUB 2 NCX TOC
  if (Object.keys(tocMap).length === 0) {
    try {
      const spineEl = opfDoc.querySelector('spine') || opfDoc.querySelector('opf\\:spine');
      const tocId = spineEl ? spineEl.getAttribute('toc') : null;
      let ncxHref = '';
      if (tocId) {
        const ncxItem = opfDoc.getElementById(tocId) || opfDoc.querySelector(`item[id="${tocId}"]`);
        if (ncxItem) {
          ncxHref = ncxItem.getAttribute('href');
        }
      }
      // Fallback if spine toc attribute is missing but there is an NCX file in manifest
      if (!ncxHref) {
        opfDoc.querySelectorAll('item').forEach(item => {
          const mediaType = item.getAttribute('media-type') || '';
          if (mediaType === 'application/x-dtbncx+xml' || (item.getAttribute('href') || '').endsWith('.ncx')) {
            ncxHref = item.getAttribute('href');
          }
        });
      }

      if (ncxHref) {
        const resolvedNcxPath = resolveRelativePath(opfPath, ncxHref);
        const ncxFile = zip.file(resolvedNcxPath);
        if (ncxFile) {
          const ncxXml = await ncxFile.async('text');
          const ncxDoc = parser.parseFromString(ncxXml, 'text/html');
          ncxDoc.querySelectorAll('navpoint').forEach(point => {
            const contentEl = point.querySelector('content');
            const textEl = point.querySelector('navlabel text');
            if (contentEl && textEl) {
              const href = contentEl.getAttribute('src');
              const label = textEl.textContent.trim();
              if (href && label) {
                const cleanHref = decodeURIComponent(href.split('#')[0]);
                const targetPath = resolveRelativePath(resolvedNcxPath, cleanHref);
                if (!tocMap[targetPath]) {
                  tocMap[targetPath] = label;
                }
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn("Failed to parse EPUB 2 NCX TOC:", e);
    }
  }
  
  // --- Find and extract cover image ---
  let coverHref = null;
  
  // Method 1: Look for <meta name="cover" content="..." />
  const coverMeta = opfDoc.querySelector('meta[name="cover"]');
  if (coverMeta) {
    const coverId = coverMeta.getAttribute('content');
    const coverItem = opfDoc.getElementById(coverId) || opfDoc.querySelector(`item[id="${coverId}"]`);
    if (coverItem) {
      coverHref = coverItem.getAttribute('href');
    }
  }
  
  // Method 2: Look for item with properties="cover-image" in manifest
  if (!coverHref) {
    const coverItem = opfDoc.querySelector('item[properties~="cover-image"]') || opfDoc.querySelector('item[properties="cover-image"]');
    if (coverItem) {
      coverHref = coverItem.getAttribute('href');
    }
  }
  
  // Method 3: Search manifest for keywords in ID or href
  if (!coverHref) {
    const items = opfDoc.querySelectorAll('manifest > item');
    for (let item of items) {
      const href = item.getAttribute('href') || '';
      const id = item.getAttribute('id') || '';
      const mediaType = item.getAttribute('media-type') || '';
      if (mediaType.startsWith('image/') && (
        href.toLowerCase().includes('cover') || 
        id.toLowerCase().includes('cover')
      )) {
        coverHref = href;
        break;
      }
    }
  }

  let coverUrl = null;
  if (coverHref) {
    const decodedCoverHref = decodeURIComponent(coverHref);
    const zipCoverPath = baseDir + decodedCoverHref;
    const coverFile = zip.file(zipCoverPath);
    if (coverFile) {
      try {
        const coverBase64 = await coverFile.async('base64');
        let mediaType = 'image/jpeg';
        const items = opfDoc.querySelectorAll('manifest > item');
        for (let item of items) {
          if (item.getAttribute('href') === coverHref) {
            mediaType = item.getAttribute('media-type') || 'image/jpeg';
            break;
          }
        }
        coverUrl = `data:${mediaType};base64,${coverBase64}`;
      } catch (err) {
        console.warn("Failed to extract EPUB cover image:", err);
      }
    }
  }
  
  // 5. Read spine chapters
  const chapters = [];
  
  for (let i = 0; i < spineIds.length; i++) {
    const id = spineIds[i];
    const href = manifestItems[id];
    if (!href) continue;
    
    const decodedHref = decodeURIComponent(href);
    const resolvedPath = baseDir + decodedHref;
    
    const file = zip.file(resolvedPath);
    if (!file) continue;
    
    const chapterHtml = await file.async('text');
    const doc = parser.parseFromString(chapterHtml, 'text/html');
    
    // Determine the chapter title using resilient path-matching against the TOC map
    let chapterTitle = '';
    let isFromToc = false;
    const getCleanPath = (p) => {
      if (!p) return '';
      return p.toLowerCase().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
    };
    const cleanResolved = getCleanPath(resolvedPath);
    
    // 1. Try exact normalized match in TOC
    for (const k of Object.keys(tocMap)) {
      if (getCleanPath(k) === cleanResolved) {
        chapterTitle = tocMap[k];
        isFromToc = true;
        break;
      }
    }
    
    // 2. Try matching by filename if exact match fails (e.g. "OEBPS/xhtml/p-001.xhtml" matches "xhtml/p-001.xhtml")
    if (!chapterTitle) {
      const resolvedFilename = cleanResolved.split('/').pop();
      for (const k of Object.keys(tocMap)) {
        const kClean = getCleanPath(k);
        const kFilename = kClean.split('/').pop();
        if (resolvedFilename && resolvedFilename === kFilename) {
          chapterTitle = tocMap[k];
          isFromToc = true;
          break;
        }
      }
    }
    
    // 3. Fallback to heading tags inside HTML body
    if (!chapterTitle) {
      const heading = doc.querySelector('h1, h2, h3, h4');
      if (heading) chapterTitle = heading.textContent.trim();
    }
    
    // 4. Fallback to HTML title tag in head (only if not identical to book title)
    if (!chapterTitle) {
      const titleTag = doc.querySelector('title');
      if (titleTag) {
        const titleText = titleTag.textContent.trim();
        if (titleText && titleText !== title && titleText.toLowerCase() !== 'untitled' && titleText.toLowerCase() !== 'untitled document') {
          chapterTitle = titleText;
        }
      }
    }
    
    // 5. Hard fallback
    if (!chapterTitle) {
      chapterTitle = chapters.length === 0 ? 'Portada' : `Capítulo ${chapters.length + 1}`;
    }
    
    const structuredParagraphs = htmlToStructuredParagraphs(doc);
    if (structuredParagraphs.length === 0) continue;
    
    // Resolve relative images inside the ZIP to base64 Data URIs
    for (let pIdx = 0; pIdx < structuredParagraphs.length; pIdx++) {
      const p = structuredParagraphs[pIdx];
      for (let sIdx = 0; sIdx < p.length; sIdx++) {
        const segment = p[sIdx];
        if (segment && segment.type === 'image' && segment.src) {
          try {
            const cleanSrc = decodeURIComponent(segment.src.split('#')[0].split('?')[0]);
            const targetPath = resolveRelativePath(resolvedPath, cleanSrc);
            const imageFile = zip.file(targetPath);
            if (imageFile) {
              const ext = targetPath.split('.').pop().toLowerCase();
              const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              const imgBase64 = await imageFile.async('base64');
              segment.src = `data:${mime};base64,${imgBase64}`;
            }
          } catch (imgErr) {
            console.warn("Failed to extract inline EPUB image:", segment.src, imgErr);
          }
        }
      }
    }
    
    // Keep the chapter unified without splitting on images to preserve continuous layout flow
    chapters.push({
      title: chapterTitle || 'Portada',
      content: structuredParagraphs.map(serializeStructuredParagraph).join('\n'),
      isFromToc: isFromToc
    });
  }
  
  if (chapters.length === 0) {
    throw new Error('No se pudo extraer texto legible del archivo EPUB.');
  }
  
  return {
    title,
    author,
    chapters,
    cover: coverUrl
  };
}

// 5. General Router to Import Any Book File
export function importBookFile(file) {
  return new Promise((resolve, reject) => {
    const filename = file.name;
    const extension = filename.split('.').pop().toLowerCase();
    
    if (extension === 'epub') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = await parseEPUB(e.target.result);
          resolve({
            ...parsed,
            cover: parsed.cover || getRandomGradient()
          });
        } catch (err) {
          reject(new Error(`Fallo al parsear EPUB: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Fallo al leer archivo EPUB'));
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        let content = "";
        let author = "Importado";
        
        try {
          switch (extension) {
            case 'html':
            case 'htm':
              content = parseHTML(text);
              author = 'Archivo HTML';
              break;
              
            case 'rtf':
              content = parseRTF(text);
              author = 'Archivo RTF';
              break;
              
            case 'srt':
              content = parseSRT(text);
              author = 'Subtítulos SRT';
              break;
              
            case 'vtt':
              content = parseVTT(text);
              author = 'Subtítulos WebVTT';
              break;
              
            case 'ass':
            case 'ssa':
              content = parseASS(text);
              author = 'Subtítulos ASS';
              break;
              
            case 'txt':
            default:
              content = text;
              author = 'Archivo de Texto';
              break;
          }
          
          if (!content.trim()) {
            reject(new Error('El archivo importado no contiene ningún texto legible.'));
            return;
          }
          
          // Split into chapters by headings if any
          const lines = content.split('\n');
          let currentTitle = "Capítulo 1";
          let currentContent = [];
          const chapters = [];
          const chapterPattern = /^(第[一二三四五六七八九十百0-9]+[章話回幕節部]).*$/;
          
          for (let line of lines) {
            const trimmed = line.trim();
            if (chapterPattern.test(trimmed) || trimmed.startsWith('# ')) {
              if (currentContent.length > 0) {
                chapters.push({
                  title: currentTitle,
                  content: currentContent.join('\n')
                });
              }
              currentTitle = trimmed.replace(/^#\s+/, '');
              currentContent = [];
            } else {
              currentContent.push(line);
            }
          }
          
          if (currentContent.length > 0 || chapters.length === 0) {
            chapters.push({
              title: currentTitle,
              content: currentContent.join('\n')
            });
          }
          
          resolve({
            title: filename.replace(/\.[^/.]+$/, ""),
            author: author,
            cover: getRandomGradient(),
            chapters: chapters
          });
        } catch (err) {
          reject(new Error(`Fallo al procesar archivo: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Fallo al leer archivo de texto'));
      reader.readAsText(file);
    }
  });
}
