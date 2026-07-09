import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Layers, Download, AlertTriangle } from 'lucide-react';
import { db } from '../utils/db';
import { tokenizeText } from '../utils/japanese';
import { useConfirm } from './ConfirmModal';
const DEFAULT_ANKI_SETTINGS = {
  host: 'http://127.0.0.1:8765',
  enabled: true,
  autoMature: false,
  tags: 'yomitan',
  expression: {
    deck: 'sentence mining',
    noteType: 'Lapis',
    fields: {
      Expression: '{expression}',
      ExpressionFurigana: '{furigana}',
      ExpressionReading: '{reading}',
      ExpressionAudio: '{audio}',
      SelectionText: '{popup-selection-text}',
      MainDefinition: '',
      DefinitionPicture: '',
      Sentence: '{sentence}',
      SentenceFurigana: '{sentence-furigana}',
      SentenceAudio: '',
      Picture: '{screenshot}',
    }
  },
  reading: {
    deck: 'sentence mining',
    noteType: 'Lapis',
    fields: {
      Expression: '{expression}',
      ExpressionFurigana: '{furigana}',
      ExpressionReading: '{reading}',
      ExpressionAudio: '{audio}',
      Sentence: '{sentence}',
      SentenceFurigana: '{sentence-furigana}',
    }
  },
  kanji: {
    deck: 'sentence mining',
    noteType: 'Lapis',
    fields: {
      Expression: '{expression}',
      Sentence: '{sentence}',
    }
  },
};

const AVAILABLE_TOKENS = [
  '', 
  '{expression}', 
  '{furigana}', 
  '{furigana-plain}',
  '{reading}', 
  '{audio}', 
  '{popup-selection-text}', 
  '{sentence}', 
  '{sentence-furigana}', 
  '{sentence-furigana-plain}',
  '{sentence-audio}',
  '{sentence-cloze}',
  '{screenshot}', 
  '{meaning}', 
  '{glossary}',
  '{glossary-brief}',
  '{glossary-first}',
  '{glossary-first-brief}',
  '{glossary-no-dictionary}',
  '{glossary-plain}',
  '{glossary-plain-no-dictionary}',
  '{tags}', 
  '{pitch-accent-positions}', 
  '{pitch-accent-categories}', 
  '{pitch-accent-graphs}', 
  '{pitch-accent-graphs-jj}',
  '{pitch-accents}',
  '{frequency-harmonic-rank}', 
  '{frequencies}', 
  '{single-frequency-number-bccwj}',
  '{single-frequency-number-jiten-anime}',
  '{single-frequency-number-jpdb}',
  '{single-frequency-number-vn-freq}',
  '{cloze-prefix}',
  '{cloze-body}',
  '{cloze-body-kana}',
  '{cloze-suffix}',
  '{document-title}',
  '{search-query}',
  '{part-of-speech}',
  '{bilingual}', 
  '{monolingual-primary}', 
  '{monolingual-extra}',
  '{clipboard-text}',
  '{clipboard-image}',
  '{url}',
  '{url-plain}'
];

const getAutoMappedToken = (fName) => {
  const lower = fName.toLowerCase().replace(/[-_]/g, '');
  
  // 1. Furigana
  if (lower.includes('furigana')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      if (lower.includes('plain')) return '{sentence-furigana-plain}';
      return '{sentence-furigana}';
    }
    if (lower.includes('plain')) return '{furigana-plain}';
    return '{furigana}';
  }
  
  // 2. Audio
  if (lower.includes('audio')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      return '{sentence-audio}';
    }
    return '{audio}';
  }
  
  // 3. Reading / Kana
  if (lower.includes('reading') || lower.includes('lectura') || lower === 'yomi' || lower.includes('kana') || lower.includes('pronunciation')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      return '{sentence-furigana-plain}';
    }
    return '{reading}';
  }
  
  // 4. Cloze
  if (lower.includes('cloze') || lower.includes('clozed')) {
    return '{sentence-cloze}';
  }
  
  // 5. English / Meaning / Glossary / Definition / Bilingual / Monolingual
  if (lower.includes('english') || lower.includes('meaning') || lower.includes('definition') || lower.includes('significado') || lower.includes('definicion') || lower.includes('glossary') || lower.includes('notes') || lower === 'translation') {
    if (lower.includes('bilingual') || lower.includes('bilingue')) {
      return '{bilingual}';
    }
    return '{meaning}';
  }
  
  if (lower.includes('bilingual') || lower.includes('bilingue')) {
    return '{bilingual}';
  }
  
  if (lower.includes('monolingual') || lower.includes('monolingue')) {
    if (lower.includes('extra') || lower.includes('secundario') || lower.includes('add') || lower.includes('more')) {
      return '{monolingual-extra}';
    }
    return '{monolingual-primary}';
  }
  
  // 6. Kanji / Expression / Word / Vocab
  if (lower.includes('kanji') || lower.includes('expression') || lower.includes('word') || lower.includes('vocablo') || lower.includes('palabra') || lower.includes('vocab') || lower.includes('term')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      return '{sentence}';
    }
    return '{expression}';
  }
  
  // 7. Image / Screenshot
  if (lower.includes('screenshot') || lower.includes('picture') || lower.includes('imagen') || lower === 'pic' || lower.includes('image') || lower.includes('img') || lower.includes('foto')) {
    return '{screenshot}';
  }
  
  // 8. Part of Speech / POS
  if (lower.includes('partofspeech') || lower === 'pos' || lower.includes('category') || lower === 'clase') {
    return '{part-of-speech}';
  }
  
  // 9. Pitch Accent
  if (lower.includes('pitch')) {
    if (lower.includes('num') || lower.includes('pos') || lower.includes('position') || lower.includes('acc') || lower.includes('accent')) {
      return '{pitch-accent-positions}';
    }
    if (lower.includes('graph') || lower.includes('draw') || lower.includes('line') || lower.includes('visual')) {
      return '{pitch-accent-graphs}';
    }
    if (lower.includes('category') || lower.includes('cat') || lower.includes('pattern') || lower.includes('type') || lower.includes('clase') || lower.includes('estilo')) {
      return '{pitch-accent-categories}';
    }
    return '{pitch-accent-graphs}';
  }
  
  // 10. Frequencies
  if (lower.includes('frequency') || lower.includes('frecuencia') || lower === 'freq' || lower.includes('frequencies')) {
    if (lower.includes('sorted') || lower.includes('rank') || lower.includes('harmonic') || lower.includes('best')) {
      return '{frequency-harmonic-rank}';
    }
    return '{frequencies}';
  }
  
  // 11. Sentence general fallback
  if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower === 'sent') {
    return '{sentence}';
  }
  
  return '';
};

// ── Anki Cards sub-modal ──────────────────────────────────────────────────────
function AnkiCardsModal({ settings, onSave, onClose, availableDecks, availableModels, lang }) {
  const [activeTab, setActiveTab] = useState('expression');
  const [local, setLocal] = useState(settings);
  const [modelFields, setModelFields] = useState([]);

  const tab = local[activeTab] || { deck: '', noteType: '', fields: {} };

  const setTabField = (key, value) =>
    setLocal(s => ({ ...s, [activeTab]: { ...s[activeTab], [key]: value } }));

  const setFieldToken = (fieldName, token) =>
    setLocal(s => ({
      ...s,
      [activeTab]: {
        ...s[activeTab],
        fields: { ...s[activeTab].fields, [fieldName]: token }
      }
    }));

  const handleAutoMapFields = () => {
    if (!modelFields || modelFields.length === 0) return;
    setLocal(s => {
      const updatedFields = {};
      modelFields.forEach(fName => {
        updatedFields[fName] = getAutoMappedToken(fName);
      });
      return {
        ...s,
        [activeTab]: {
          ...s[activeTab],
          fields: updatedFields
        }
      };
    });
  };

  useEffect(() => {
    let active = true;
    async function fetchFields() {
      if (!tab.noteType) return;
      try {
        const host = local.host || 'http://127.0.0.1:8765';
        const res = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'modelFieldNames',
            version: 6,
            params: { modelName: tab.noteType }
          })
        });
        const data = await res.json();
        if (data && data.result && active) {
          setModelFields(data.result);
          
          setLocal(s => {
            const currentFields = s[activeTab]?.fields || {};
            const updatedFields = {};
            let changed = false;
            data.result.forEach(fName => {
              if (currentFields[fName] !== undefined) {
                const lower = fName.toLowerCase();
                const isSentenceFurigana = (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto')) && lower.includes('furigana');
                const isSentenceAudio = (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto')) && lower.includes('audio');
                if (isSentenceFurigana && currentFields[fName] === '{furigana}') {
                  updatedFields[fName] = '{sentence-furigana}';
                  changed = true;
                } else if (isSentenceAudio && currentFields[fName] === '{audio}') {
                  updatedFields[fName] = '{sentence-audio}';
                  changed = true;
                } else {
                  updatedFields[fName] = currentFields[fName];
                }
              } else {
                updatedFields[fName] = getAutoMappedToken(fName);
                changed = true;
              }
            });
            
            const oldKeys = Object.keys(currentFields);
            const keysDifference = oldKeys.filter(x => !data.result.includes(x));
            if (keysDifference.length > 0) changed = true;

            if (changed || Object.keys(updatedFields).length !== oldKeys.length) {
              return {
                ...s,
                [activeTab]: {
                  ...s[activeTab],
                  fields: updatedFields
                }
              };
            }
            return s;
          });
        }
      } catch (err) {
        console.warn('Failed to fetch model field names:', err);
      }
    }
    fetchFields();
    return () => { active = false; };
  }, [tab.noteType, activeTab]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1400 }}>
      <div className="yomitan-cards-modal" onClick={e => e.stopPropagation()}>
        {/* Title */}
        <div className="yomitan-cards-title">{lang === 'es' ? 'Campos de tarjeta de Anki' : 'Anki Card Fields'}</div>

        {/* Tabs */}
        <div className="yomitan-cards-tabs">
          {['expression', 'reading', 'kanji'].map(t => (
            <button
              key={t}
              className={`yomitan-cards-tab ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'expression' ? (lang === 'es' ? 'Expresión' : 'Expression') :
               t === 'reading' ? (lang === 'es' ? 'Lectura' : 'Reading') :
               (lang === 'es' ? 'Kanji' : 'Kanji')}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="yomitan-cards-body">
          {/* Deck */}
          <div className="yomitan-cards-row">
            <span className="yomitan-cards-label">{lang === 'es' ? 'Mazo' : 'Deck'}</span>
            <div className="yomitan-cards-input-wrap">
              <select
                className="yomitan-cards-select"
                value={tab.deck}
                onChange={e => setTabField('deck', e.target.value)}
              >
                {availableDecks.length > 0
                  ? availableDecks.map(d => <option key={d} value={d}>{d}</option>)
                  : <option value={tab.deck}>{tab.deck || 'sentence mining'}</option>
                }
              </select>
            </div>
          </div>

          {/* Model */}
          <div className="yomitan-cards-row">
            <span className="yomitan-cards-label">{lang === 'es' ? 'Modelo' : 'Model'}</span>
            <div className="yomitan-cards-input-wrap">
              <select
                className="yomitan-cards-select"
                value={tab.noteType}
                onChange={e => setTabField('noteType', e.target.value)}
              >
                {availableModels.length > 0
                  ? availableModels.map(m => <option key={m} value={m}>{m}</option>)
                  : <option value={tab.noteType}>{tab.noteType || 'Lapis'}</option>
                }
              </select>
            </div>
          </div>

          {/* Fields divider */}
          <div className="yomitan-fields-divider" />

          {/* Auto-map button positioned right above Fields list */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px', marginTop: '4px' }}>
            <button
              type="button"
              className="yomitan-cards-btn-automap"
              onClick={handleAutoMapFields}
              style={{
                background: 'linear-gradient(135deg, var(--primary, #FFE000) 0%, #ff8c00 100%)',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(255, 224, 0, 0.25)',
                letterSpacing: '0.02em'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.filter = 'brightness(1.15)';
                e.currentTarget.style.transform = 'translateY(-1.5px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 224, 0, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = 'none';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 224, 0, 0.25)';
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'translateY(0.5px)';
              }}
            >
              <span>✨ {lang === 'es' ? 'Auto-mapear campos' : 'Auto-map fields'}</span>
            </button>
          </div>

          <div className="yomitan-fields-header">
            <span>{lang === 'es' ? 'Campo' : 'Field'}</span>
            <span>{lang === 'es' ? 'Valor' : 'Value'}</span>
          </div>

          {/* Field rows */}
          {Object.entries(tab.fields).map(([fieldName, token]) => (
            <div key={fieldName} className="yomitan-cards-row">
              <span className="yomitan-cards-label">{fieldName}</span>
              <div className="yomitan-cards-input-wrap">
                <select
                  className="yomitan-cards-select"
                  value={token}
                  onChange={e => setFieldToken(fieldName, e.target.value)}
                >
                  {AVAILABLE_TOKENS.map(t => (
                    <option key={t} value={t}>{t || (lang === 'es' ? '(vacío)' : '(empty)')}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="yomitan-cards-footer">
          <button className="yomitan-cards-help-btn" onClick={() => {}}>{lang === 'es' ? 'Ayuda' : 'Help'}</button>
          <button
            className="yomitan-cards-close-btn"
            onClick={() => { onSave(local); onClose(); }}
          >
            {lang === 'es' ? 'Guardar y cerrar' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Anki Config Modal ────────────────────────────────────────────────────
export default function AnkiConfigModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('anki_settings_v2');
    return saved ? { ...DEFAULT_ANKI_SETTINGS, ...JSON.parse(saved) } : DEFAULT_ANKI_SETTINGS;
  });

  const { showConfirm, confirmModal } = useConfirm();
  const lang = db.getSettings().appLanguage || 'es';

  const [connectionStatus, setConnectionStatus] = useState(null); // null | 'connected' | 'error' | 'testing'
  const [availableDecks, setAvailableDecks] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);

  // Persist + sync legacy keys for Reader.jsx
  useEffect(() => {
    localStorage.setItem('anki_settings_v2', JSON.stringify(settings));
    const tab = settings.expression || {};
    const fields = tab.fields || {};
    const findField = token => Object.keys(fields).find(k => fields[k] === token) || '';
    localStorage.setItem('anki_settings', JSON.stringify({
      host: settings.host,
      deck: tab.deck || '',
      noteType: tab.noteType || '',
      tags: settings.tags,
      wordField: findField('{expression}'),
      readingField: findField('{reading}'),
      meaningField: findField('{meaning}'),
      sentenceField: findField('{sentence}'),
    }));
  }, [settings]);

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch(settings.host, {
        method: 'POST',
        body: JSON.stringify({ action: 'version', version: 6 })
      });
      const data = await res.json();
      if (data.result) {
        setConnectionStatus('connected');
        fetchDecksAndModels();
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    }
  };

  const fetchDecksAndModels = async () => {
    try {
      const [dRes, mRes] = await Promise.all([
        fetch(settings.host, { method: 'POST', body: JSON.stringify({ action: 'deckNames', version: 6 }) }),
        fetch(settings.host, { method: 'POST', body: JSON.stringify({ action: 'modelNames', version: 6 }) }),
      ]);
      const d = await dRes.json(); if (d.result) setAvailableDecks(d.result);
      const m = await mRes.json(); if (m.result) setAvailableModels(m.result);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Automatically test connection when opened
      testConnection();
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  const importKnownWordsFromAnki = async () => {
    try {
      const deck = settings.expression.deck || 'sentence mining';
      const wordField = Object.keys(settings.expression.fields).find(k => settings.expression.fields[k] === '{expression}') || 'Expression';
      
      // 1. Try to search for mature cards (using standard ivl search)
      let query = `deck:"${deck}" prop:ivl>=21`;
      let cardsRes = await fetch(settings.host, {
        method: 'POST',
        body: JSON.stringify({
          action: 'findCards',
          version: 6,
          params: { query }
        })
      });
      let cardsData = await cardsRes.json();
      
      // Fallback 1: Try alternative interval parameter syntax
      if (!cardsData.result || cardsData.result.length === 0) {
        query = `deck:"${deck}" prop:interval>=21`;
        cardsRes = await fetch(settings.host, {
          method: 'POST',
          body: JSON.stringify({
            action: 'findCards',
            version: 6,
            params: { query }
          })
        });
        cardsData = await cardsRes.json();
      }

      let isFallbackToAllStudied = false;
      // Fallback 2: If no mature cards are found, fallback to any studied/reviewed card that is not new
      if (!cardsData.result || cardsData.result.length === 0) {
        isFallbackToAllStudied = true;
        query = `deck:"${deck}" -is:new`;
        cardsRes = await fetch(settings.host, {
          method: 'POST',
          body: JSON.stringify({
            action: 'findCards',
            version: 6,
            params: { query }
          })
        });
        cardsData = await cardsRes.json();
      }
      
      if (!cardsData.result || cardsData.result.length === 0) {
        await showConfirm({
          title: lang === 'es' ? 'Sin tarjetas' : 'No cards found',
          message: lang === 'es'
            ? `No se encontraron tarjetas en estudio ni maduras en el mazo "${deck}". Asegúrate de haber comenzado a estudiar este mazo en tu Anki.`
            : `No learning or mature cards were found in the deck "${deck}". Make sure you have started studying this deck in your Anki.`,
          type: 'warning',
          confirmText: lang === 'es' ? 'Entendido' : 'OK',
          cancelText: '',
        });
        return;
      }
      
      const infoRes = await fetch(settings.host, {
        method: 'POST',
        body: JSON.stringify({
          action: 'cardsInfo',
          version: 6,
          params: { cards: cardsData.result }
        })
      });
      const infoData = await infoRes.json();
      if (!infoData.result) {
        await showConfirm({
          title: lang === 'es' ? 'Error de Anki' : 'Anki Error',
          message: lang === 'es' ? 'Error al recuperar información de las tarjetas.' : 'Failed to retrieve card information.',
          type: 'warning',
          confirmText: lang === 'es' ? 'Entendido' : 'OK',
          cancelText: '',
        });
        return;
      }
      
      const cleanWord = (val) => {
        if (!val) return '';
        let s = val.replace(/<[^>]*>/g, '');
        s = s.replace(/\[[^\]]*\]/g, '')
             .replace(/\([^)]*\)/g, '')
             .replace(/（[^）]*）/g, '')
             .replace(/\{[^}]*\}/g, '');
        const parts = s.split(/[\s\-ー:：|]/);
        s = parts[0] || '';
        return s.trim();
      };

      const words = [];
      for (const card of infoData.result) {
        const fields = card.fields;
        if (fields && fields[wordField]) {
          const val = fields[wordField].value;
          if (val) {
            const cleaned = cleanWord(val);
            if (cleaned) {
              const isSentence = cleaned.length > 5 || 
                                 cleaned.includes('。') || 
                                 cleaned.includes('、') || 
                                 cleaned.includes('？') || 
                                 cleaned.includes('！') ||
                                 /[\u3040-\u309F]/.test(cleaned) && (cleaned.includes('は') || cleaned.includes('が') || cleaned.includes('を') || cleaned.includes('に') || cleaned.includes('で'));
              
              if (isSentence && cleaned.length > 3) {
                try {
                  const paragraphs = await tokenizeText(cleaned);
                  paragraphs.flat().forEach(tok => {
                    if (tok && tok.isWord && tok.basicForm) {
                      const subClean = cleanWord(tok.basicForm);
                      if (subClean && subClean.length > 0) {
                        words.push(subClean);
                      }
                    }
                  });
                } catch (e) {
                  console.error("Failed to tokenize card sentence:", cleaned, e);
                  words.push(cleaned);
                }
              } else {
                words.push(cleaned);
              }
            }
          }
        }
      }
      
      if (words.length === 0) {
        await showConfirm({
          title: lang === 'es' ? 'Extracción fallida' : 'Extraction failed',
          message: lang === 'es'
            ? 'No se pudieron extraer palabras del campo "' + wordField + '".'
            : 'Could not extract words from field "' + wordField + '".',
          type: 'warning',
          confirmText: lang === 'es' ? 'Entendido' : 'OK',
          cancelText: '',
        });
        return;
      }
      
      const confirmMessage = lang === 'es'
        ? (isFallbackToAllStudied
            ? `No se encontraron tarjetas maduras (intervalo ≥ 21 días) en "${deck}". Sin embargo, se encontraron ${words.length} tarjetas en estudio/repaso. ¿Deseas importarlas como "Conocido" en Yoru Reader?`
            : `Se encontraron ${words.length} palabras maduras en Anki. ¿Deseas importarlas como "Conocido" en Yoru Reader?`)
        : (isFallbackToAllStudied
            ? `No mature cards (interval ≥ 21 days) were found in "${deck}". However, ${words.length} learning/review cards were found. Do you want to import them as "Known" in Yoru Reader?`
            : `Found ${words.length} mature words in Anki. Do you want to import them as "Known" in Yoru Reader?`);

      const ok = await showConfirm({
        title: lang === 'es' ? '¿Sincronizar palabras?' : 'Sync words?',
        message: confirmMessage,
        type: 'info',
        confirmText: lang === 'es' ? 'Importar' : 'Import',
      });

      if (ok) {
        const currentStatuses = db.getWordStatuses();
        const updated = { ...currentStatuses };
        words.forEach(w => {
          updated[w] = 'known';
        });
        db.saveWordStatuses(updated);
        await showConfirm({
          title: lang === 'es' ? 'Sincronización completa' : 'Sync complete',
          message: lang === 'es' ? `¡Importadas ${words.length} palabras con éxito! Reiniciando para actualizar...` : `Successfully imported ${words.length} words! Restarting to update...`,
          type: 'info',
          confirmText: lang === 'es' ? 'Entendido' : 'OK',
          cancelText: '',
        });
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      await showConfirm({
        title: lang === 'es' ? 'Error' : 'Error',
        message: (lang === 'es' ? 'Error durante la sincronización: ' : 'Error during synchronization: ') + err.message,
        type: 'warning',
        confirmText: lang === 'es' ? 'Entendido' : 'OK',
        cancelText: '',
      });
    }
  };

  if (!isOpen) return null;

  const statusLabel = connectionStatus === 'connected' ? (lang === 'es' ? 'Conectado' : 'Connected')
    : connectionStatus === 'error' ? (lang === 'es' ? 'Error — sin conexión' : 'Error — no connection')
    : connectionStatus === 'testing' ? (lang === 'es' ? 'Conectando...' : 'Connecting...')
    : (lang === 'es' ? 'Desconectado' : 'Disconnected');

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
        <div className="yomitan-anki-modal" onClick={e => e.stopPropagation()}>
          {/* ── Header ── */}
          <div className="yomitan-anki-header">
            <div className="yomitan-anki-header-left">
              <Layers size={16} style={{ color: 'var(--primary)', marginRight: '2px' }} />
              <span className="yomitan-anki-title">{lang === 'es' ? 'Configuración de Anki' : 'Anki Configuration'}</span>
            </div>
            <div className="yomitan-anki-header-right">
              <span className="yomitan-anki-info-link">Info...</span>
              <button className="yomitan-close-btn" onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="yomitan-anki-body">

            {/* Enable row */}
            <div className="yomitan-anki-section">
              <div className="yomitan-anki-row">
                <div className="yomitan-anki-row-left">
                  <div className="yomitan-anki-row-title">{lang === 'es' ? 'Habilitar integración con Anki' : 'Enable Anki integration'}</div>
                  <div className="yomitan-anki-row-sub">
                    {lang === 'es' ? 'Estado de conexión:' : 'Connection status:'} <span style={{ color: connectionStatus === 'connected' ? '#34d399' : connectionStatus === 'error' ? '#f87171' : 'var(--text-muted)' }}>{statusLabel}</span>
                  </div>
                  <div className="yomitan-anki-row-desc">
                    {lang === 'es' 
                      ? 'Esta opción envía información sobre el vocabulario y las oraciones del lector a Anki a través del servidor local AnkiConnect.'
                      : 'This option sends vocabulary and sentence information from the reader to Anki via the local AnkiConnect server.'}
                  </div>
                </div>
                <label className="migaku-switch" style={{ flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={e => {
                      setSettings(s => ({ ...s, enabled: e.target.checked }));
                      if (e.target.checked) testConnection();
                    }}
                  />
                  <span className="migaku-switch-slider" />
                </label>
              </div>
            </div>

            {/* AnkiConnect address */}
            <div className="yomitan-anki-section">
              <div className="yomitan-anki-field-group">
                <div className="yomitan-anki-field-label-row">
                  <span className="yomitan-anki-field-title">{lang === 'es' ? 'Dirección del servidor AnkiConnect' : 'AnkiConnect server address'}</span>
                  <span className="yomitan-anki-field-desc">{lang === 'es' ? 'Cambia la dirección URL del servidor local de AnkiConnect.' : 'Change the URL of the AnkiConnect server.'} <a href="https://foosoft.net/projects/anki-connect/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>{lang === 'es' ? 'Más...' : 'More...'}</a></span>
                </div>
                <input
                  className="yomitan-anki-input"
                  value={settings.host}
                  onChange={e => setSettings(s => ({ ...s, host: e.target.value }))}
                  onBlur={testConnection}
                  placeholder="http://127.0.0.1:8765"
                />
              </div>
            </div>

            {/* Card tags */}
            <div className="yomitan-anki-section">
              <div className="yomitan-anki-field-group">
                <div className="yomitan-anki-field-label-row">
                  <span className="yomitan-anki-field-title">{lang === 'es' ? 'Etiquetas de tarjeta' : 'Card tags'}</span>
                  <span className="yomitan-anki-field-desc">{lang === 'es' ? 'Lista de etiquetas separadas por espacios o comas para añadir a la tarjeta.' : 'List of space or comma separated tags to add to the card.'}</span>
                </div>
                <input
                  className="yomitan-anki-input"
                  value={settings.tags}
                  onChange={e => setSettings(s => ({ ...s, tags: e.target.value }))}
                  placeholder="yomitan"
                />
              </div>
            </div>

            {connectionStatus === 'error' && (
              <div className="anki-connection-error-box" style={{ margin: '10px 20px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px dashed rgba(239, 68, 68, 0.3)', borderRadius: '10px' }}>
                <span style={{ color: '#f87171', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>{lang === 'es' ? 'Error de conexión. Asegúrate de que Anki esté abierto y AnkiConnect configurado.' : 'Connection error. Make sure Anki is open and AnkiConnect is configured.'}</span>
                </span>
                <span style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: '1.5', display: 'block' }}>
                  <strong>Configuración de CORS en AnkiConnect:</strong>
                  <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                    <li>En Anki, ve a <strong>Herramientas</strong> → <strong>Complementos (Add-ons)</strong>.</li>
                    <li>Selecciona <strong>AnkiConnect</strong> y pulsa en <strong>Configuración (Config)</strong>.</li>
                    <li>Reemplaza todo el contenido por la siguiente configuración completa:
                      <pre style={{ margin: '8px 0', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '0.72rem', color: '#ff9e2c', overflowX: 'auto', userSelect: 'all' }}>
{`{
    "apiKey": null,
    "apiLogPath": null,
    "ignoreOriginList": [],
    "webBindAddress": "127.0.0.1",
    "webBindPort": 8765,
    "webCorsOriginList": [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "chrome-extension://likgccmbimhjbgkjambclfkhldnlhbnn"
    ]
}`}
                      </pre>
                    </li>
                    <li>Guarda, <strong>reinicia Anki</strong> y vuelve a probar la conexión.</li>
                  </ol>
                </span>
              </div>
            )}

            {/* Sincronización de Vocabulario */}
            <div className="yomitan-anki-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '16px' }}>
              <div className="yomitan-anki-row-title" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>
                {lang === 'es' ? 'Vocabulario & Sincronización' : 'Vocabulary & Sync'}
              </div>

              {/* Deck Selection Field */}
              <div className="yomitan-anki-field-group" style={{ marginBottom: '16px' }}>
                <div className="yomitan-anki-field-label-row" style={{ marginBottom: '6px' }}>
                  <span className="yomitan-anki-field-title" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{lang === 'es' ? 'Mazo de Anki para Vocabulario' : 'Anki Deck for Vocabulary'}</span>
                  <span className="yomitan-anki-field-desc" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lang === 'es' ? 'Mazo desde el cual importar y en el cual madurar tarjetas.' : 'Deck to import from and set cards to mature in.'}</span>
                </div>
                <select
                  className="yomitan-anki-input"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  value={settings.expression?.deck || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setSettings(s => ({
                      ...s,
                      expression: {
                        ...(s.expression || {}),
                        deck: val
                      }
                    }));
                  }}
                >
                  {availableDecks.length > 0 ? (
                    availableDecks.map(d => <option key={d} value={d} style={{ background: '#1c1c20', color: '#fff' }}>{d}</option>)
                  ) : (
                    <option value={settings.expression?.deck || 'sentence mining'} style={{ background: '#1c1c20', color: '#fff' }}>
                      {settings.expression?.deck || 'sentence mining'}
                    </option>
                  )}
                </select>
              </div>
              
              {/* Checkbox Auto-Mature */}
              <div className="yomitan-anki-row" style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="yomitan-anki-row-left" style={{ paddingRight: '12px' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>{lang === 'es' ? 'Marcar como madura / crear en Anki' : 'Mark as mature / create in Anki'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                    {lang === 'es'
                      ? 'Al marcar una palabra como "Conocido" en Yoru Reader, se buscará su tarjeta en Anki. Si existe, la madurará automáticamente (intervalo 30 días). Si no existe, creará una tarjeta básica con la palabra y la marcará como madura.'
                      : 'When marking a word as "Known" in Yoru Reader, it will search for its card in Anki. If found, it will mature it automatically (30-day interval). If not found, it will create a basic card with the word and mark it as mature.'}
                  </div>
                </div>
                <label className="migaku-switch" style={{ flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={settings.autoMature}
                    onChange={e => {
                      setSettings(s => ({ ...s, autoMature: e.target.checked }));
                    }}
                  />
                  <span className="migaku-switch-slider" />
                </label>
              </div>

              {/* Import Button */}
              <div style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={importKnownWordsFromAnki}
                  disabled={connectionStatus !== 'connected'}
                  style={{
                    width: '100%',
                    background: connectionStatus === 'connected' ? 'rgba(255, 224, 0, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: connectionStatus === 'connected' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                    color: connectionStatus === 'connected' ? 'var(--primary)' : 'var(--text-muted)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: connectionStatus === 'connected' ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Download size={14} />
                  <span>{lang === 'es' ? 'Importar palabras conocidas de Anki' : 'Import Known Words from Anki'}</span>
                </button>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                  {lang === 'es'
                    ? 'Busca tarjetas en el mazo de expresiones con intervalo ≥ 21 días e impórtalas a tu vocabulario.'
                    : 'Finds cards in the expression deck with interval ≥ 21 days and imports them into your vocabulary.'}
                </div>
              </div>
            </div>

            {/* Configure Anki flashcards */}
            <button
              className="yomitan-anki-configure-row"
              onClick={() => {
                setIsCardsModalOpen(true);
                if (connectionStatus !== 'connected') testConnection();
              }}
            >
              <span className="yomitan-anki-configure-label">{lang === 'es' ? 'Configurar campos de tarjetas...' : 'Configure Anki flashcards...'}</span>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
            </button>

          </div>
        </div>
      </div>

      {/* ── Anki Cards sub-modal ── */}
      {isCardsModalOpen && (
        <AnkiCardsModal
          lang={lang}
          settings={settings}
          availableDecks={availableDecks}
          availableModels={availableModels}
          onSave={updated => setSettings(s => ({ ...s, ...updated }))}
          onClose={() => setIsCardsModalOpen(false)}
        />
      )}
      {confirmModal}
    </>
  );
}
