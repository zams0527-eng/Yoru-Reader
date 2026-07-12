import React, { useState, useEffect } from 'react';
import { X, Database, Upload, Download, RefreshCw, FileText, BarChart3, AlertTriangle } from 'lucide-react';
import { db } from '../utils/db';
import { tokenizeText } from '../utils/japanese';
import { useConfirm } from './ConfirmModal';
import { getInstalledDictionaries, getTopWordsFromFrequencyDict } from '../utils/yomitanDB';

interface VocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  initialImportMethod?: string;
}

export default function VocabularyModal({ 
  isOpen, 
  onClose, 
  initialTab = 'summary', 
  initialImportMethod = 'anki-connect' 
}: VocabularyModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [importMethod, setImportMethod] = useState(initialImportMethod);
  
  const { showConfirm, confirmModal } = useConfirm();
  const lang = db.getSettings().appLanguage || 'es';

  // Stats
  const [stats, setStats] = useState({ total: 0, known: 0, learning: 0, starred: 0, ignored: 0 });

  // Anki settings
  const [ankiSettings, setAnkiSettings] = useState(() => {
    const saved = localStorage.getItem('anki_settings_v2');
    const defaults = {
      host: 'http://127.0.0.1:8765',
      apiKey: '',
      expression: { deck: 'sentence mining', noteType: '' },
      importWordField: '',
      importReadingField: '',
      importMinInterval: 21,
      importParseWords: true,
      tags: ''
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);
  const [expressionFields, setExpressionFields] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'testing' | 'disconnected'>('disconnected');

  // JPDB settings
  const [jpdbApiKey, setJpdbApiKey] = useState(() => localStorage.getItem('jpdb_api_key') || '');
  const [jpdbReviewsFile, setJpdbReviewsFile] = useState<File | null>(null);
  const [jpdbOverwrite, setJpdbOverwrite] = useState(true);

  // File import settings
  const [vocabFile, setVocabFile] = useState<File | null>(null);
  const [fileParseWords, setFileParseWords] = useState(true);

  // Frequency import settings
  const [availableFreqDicts, setAvailableFreqDicts] = useState<any[]>([]);
  const [selectedFreqDict, setSelectedFreqDict] = useState('');
  const [freqMaxRank, setFreqMaxRank] = useState(2000);

  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Load stats & dicts
  const loadVocabStats = () => {
    const wordStatuses = db.getWordStatuses();
    const list = Object.values(wordStatuses);
    setStats({
      total: list.length,
      known: list.filter(s => s === 'known').length,
      learning: list.filter(s => s === 'learning').length,
      starred: list.filter(s => s === 'starred').length,
      ignored: list.filter(s => s === 'ignored').length
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadVocabStats();
      document.body.style.overflow = 'hidden';
      if (importMethod === 'anki-connect') {
        testAnkiConnection();
      }
      loadFrequencyDicts();
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, importMethod]);

  const loadFrequencyDicts = async () => {
    try {
      const dicts = await getInstalledDictionaries();
      const freqs = dicts.filter(d => d.hasFreqs);
      setAvailableFreqDicts(freqs);
      if (freqs.length > 0 && !selectedFreqDict) {
        setSelectedFreqDict(freqs[0].title);
      }
    } catch (e) {
      console.warn('Failed to load frequency dictionaries:', e);
    }
  };

  // --- AnkiConnect Connect logic ---
  const testAnkiConnection = async () => {
    setConnectionStatus('testing');
    try {
      const body: any = { action: 'version', version: 6 };
      if (ankiSettings.apiKey) body.key = ankiSettings.apiKey;
      const res = await fetch(ankiSettings.host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.result) {
        setConnectionStatus('connected');
        const [deckRes, modelRes] = await Promise.all([
          fetch(ankiSettings.host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deckNames', version: 6, key: ankiSettings.apiKey || undefined })
          }),
          fetch(ankiSettings.host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'modelNames', version: 6, key: ankiSettings.apiKey || undefined })
          })
        ]);
        const deckData = await deckRes.json();
        const modelData = await modelRes.json();
        if (deckData.result) setAvailableDecks(deckData.result);
        if (modelData.result) setAvailableModels(modelData.result);
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    let active = true;
    async function fetchFields() {
      if (connectionStatus !== 'connected' || !ankiSettings.expression?.noteType) {
        setExpressionFields([]);
        return;
      }
      try {
        const res = await fetch(ankiSettings.host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'modelFieldNames',
            version: 6,
            params: { modelName: ankiSettings.expression.noteType },
            key: ankiSettings.apiKey || undefined
          })
        });
        const data = await res.json();
        if (data && data.result && active) {
          setExpressionFields(data.result);
        }
      } catch (err) {
        console.warn('Failed to fetch expression fields:', err);
      }
    }
    fetchFields();
    return () => { active = false; };
  }, [connectionStatus, ankiSettings.expression?.noteType, ankiSettings.host, ankiSettings.apiKey]);

  const saveAnkiSettings = (newSetts: any) => {
    setAnkiSettings(newSetts);
    localStorage.setItem('anki_settings_v2', JSON.stringify(newSetts));
  };

  const cleanWord = (val: string) => {
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

  // --- AnkiConnect Import Execution ---
  const handleImportAnki = async () => {
    setIsLoading(true);
    setProgressMsg(lang === 'es' ? 'Buscando tarjetas en Anki...' : 'Finding cards in Anki...');
    try {
      const deck = ankiSettings.expression.deck || 'sentence mining';
      const wordField = ankiSettings.importWordField || 'Expression';
      const readingField = ankiSettings.importReadingField || '';
      const parseWords = ankiSettings.importParseWords !== false;
      const minInterval = ankiSettings.importMinInterval !== undefined ? Number(ankiSettings.importMinInterval) : 21;

      let query = `deck:"${deck}"`;
      if (minInterval > 0) {
        query += ` prop:ivl>=${minInterval}`;
      } else if (minInterval === 0) {
        query += ` -is:new`;
      }

      const res = await fetch(ankiSettings.host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'findCards',
          version: 6,
          params: { query },
          key: ankiSettings.apiKey || undefined
        })
      });
      let data = await res.json();
      
      if (minInterval > 0 && (!data.result || data.result.length === 0)) {
        const resAlt = await fetch(ankiSettings.host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'findCards',
            version: 6,
            params: { query: `deck:"${deck}" prop:interval>=${minInterval}` },
            key: ankiSettings.apiKey || undefined
          })
        });
        data = await resAlt.json();
      }

      if (minInterval > 0 && (!data.result || data.result.length === 0)) {
        const resStudied = await fetch(ankiSettings.host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'findCards',
            version: 6,
            params: { query: `deck:"${deck}" -is:new` },
            key: ankiSettings.apiKey || undefined
          })
        });
        data = await resStudied.json();
      }

      if (!data.result || data.result.length === 0) {
        await showConfirm({
          title: lang === 'es' ? 'Sin tarjetas' : 'No cards found',
          message: lang === 'es' ? `No se encontraron tarjetas que coincidan con la búsqueda en "${deck}".` : `No matching cards found in "${deck}".`,
          type: 'warning',
          confirmText: 'OK',
          cancelText: ''
        });
        setIsLoading(false);
        return;
      }

      setProgressMsg(lang === 'es' ? `Cargando información de ${data.result.length} tarjetas...` : `Loading info for ${data.result.length} cards...`);

      const infoRes = await fetch(ankiSettings.host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cardsInfo',
          version: 6,
          params: { cards: data.result },
          key: ankiSettings.apiKey || undefined
        })
      });
      const infoData = await infoRes.json();
      if (!infoData.result) throw new Error('Failed to retrieve card info.');

      setProgressMsg(lang === 'es' ? 'Procesando y extrayendo vocabulario...' : 'Processing and extracting vocabulary...');
      const words: string[] = [];
      for (const card of infoData.result) {
        const fields = card.fields;
        if (fields) {
          let val = fields[wordField] ? fields[wordField].value : '';
          if (!val && readingField && fields[readingField]) {
            val = fields[readingField].value;
          }
          if (val) {
            const cleaned = cleanWord(val);
            if (cleaned) {
              const isSentence = parseWords && (
                cleaned.length > 5 || 
                cleaned.includes('。') || 
                cleaned.includes('、') || 
                cleaned.includes('？') || 
                cleaned.includes('！') ||
                /[\u3040-\u309F]/.test(cleaned) && (cleaned.includes('は') || cleaned.includes('    ') || cleaned.includes('を') || cleaned.includes('で'))
              );
              
              if (isSentence && cleaned.length > 3) {
                try {
                  const paragraphs = await tokenizeText(cleaned);
                  paragraphs.flat().forEach(tok => {
                    if (tok && tok.isWord && tok.basicForm) {
                      const subClean = cleanWord(tok.basicForm);
                      if (subClean) words.push(subClean);
                    }
                  });
                } catch {
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
          message: lang === 'es' ? 'No se extrajo ninguna palabra.' : 'No words were extracted.',
          type: 'warning',
          confirmText: 'OK',
          cancelText: ''
        });
        setIsLoading(false);
        return;
      }

      const ok = await showConfirm({
        title: lang === 'es' ? '¿Sincronizar palabras?' : 'Sync words?',
        message: lang === 'es' 
          ? `Se encontraron ${words.length} palabras. ¿Deseas añadirlas como "Conocido" en Yoru Reader?`
          : `Found ${words.length} words. Do you want to import them as "Known" in Yoru Reader?`,
        type: 'info',
        confirmText: lang === 'es' ? 'Importar' : 'Import'
      });

      if (ok) {
        const current = db.getWordStatuses();
        const updated = { ...current };
        words.forEach(w => { updated[w] = 'known'; });
        db.saveWordStatuses(updated);
        loadVocabStats();
        await showConfirm({
          title: lang === 'es' ? 'Completado' : 'Success',
          message: lang === 'es' ? `¡Importadas ${words.length} palabras con éxito!` : `Successfully imported ${words.length} words!`,
          type: 'info',
          confirmText: 'OK',
          cancelText: ''
        });
      }
    } catch (err: any) {
      console.error(err);
      await showConfirm({
        title: 'Error',
        message: err.message,
        type: 'warning',
        confirmText: 'OK',
        cancelText: ''
      });
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // --- JPDB Import Execution ---
  const handleImportJpdb = async () => {
    setIsLoading(true);
    setProgressMsg(lang === 'es' ? 'Conectando con JPDB...' : 'Connecting to JPDB...');
    try {
      if (jpdbApiKey) {
        localStorage.setItem('jpdb_api_key', jpdbApiKey);
        setProgressMsg(lang === 'es' ? 'Obteniendo mazos de JPDB...' : 'Fetching decks from JPDB...');
        const decksRes = await fetch('https://jpdb.io/api/v1/list-user-decks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jpdbApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        if (!decksRes.ok) throw new Error(lang === 'es' ? 'Error al autenticar clave API de JPDB.' : 'Invalid JPDB API Key.');
        const decksData = await decksRes.json();
        
        const words = new Set<string>();
        if (decksData.decks && decksData.decks.length > 0) {
          for (let i = 0; i < decksData.decks.length; i++) {
            const d = decksData.decks[i];
            setProgressMsg(lang === 'es' ? `Cargando mazo ${i+1}/${decksData.decks.length}: ${d.name || d.id}...` : `Loading deck ${i+1}/${decksData.decks.length}: ${d.name || d.id}...`);
            const vocabRes = await fetch('https://jpdb.io/api/v1/deck/list-vocabulary', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${jpdbApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ id: d.id, fetch_vocabulary: true })
            });
            if (vocabRes.ok) {
              const vocabData = await vocabRes.json();
              if (vocabData.vocabulary && vocabData.vocabulary.length > 0) {
                vocabData.vocabulary.forEach((item: any) => {
                  if (item.spelling) words.add(item.spelling);
                });
              }
            }
          }
        }

        if (words.size === 0) {
          await showConfirm({
            title: lang === 'es' ? 'Sin palabras' : 'No words found',
            message: lang === 'es' ? 'No se encontraron palabras conocidas en tus mazos de JPDB.' : 'No known words were found in your JPDB decks.',
            type: 'warning',
            confirmText: 'OK',
            cancelText: ''
          });
          setIsLoading(false);
          return;
        }

        const ok = await showConfirm({
          title: lang === 'es' ? 'Importar desde JPDB' : 'Import from JPDB',
          message: lang === 'es' 
            ? `Se encontraron ${words.size} palabras en JPDB. ¿Deseas añadirlas a tu vocabulario?`
            : `Found ${words.size} words in JPDB. Do you want to add them to your vocabulary?`,
          type: 'info',
          confirmText: lang === 'es' ? 'Importar' : 'Import'
        });

        if (ok) {
          const current = db.getWordStatuses();
          const updated = { ...current };
          words.forEach(w => { updated[w] = 'known'; });
          db.saveWordStatuses(updated);
          loadVocabStats();
          await showConfirm({
            title: lang === 'es' ? 'Completado' : 'Success',
            message: lang === 'es' ? `¡Importadas ${words.size} palabras de JPDB!` : `Successfully imported ${words.size} words from JPDB!`,
            type: 'info',
            confirmText: 'OK',
            cancelText: ''
          });
        }
      } else if (jpdbReviewsFile) {
        setProgressMsg(lang === 'es' ? 'Procesando archivo de reseñas...' : 'Processing reviews file...');
        const text = await jpdbReviewsFile.text();
        const data = JSON.parse(text);
        const vocabCards = data.cards_vocabulary_jp_en || [];
        if (vocabCards.length === 0) {
          await showConfirm({
            title: 'Error',
            message: lang === 'es' ? 'No se encontraron registros de vocabulario en el archivo.' : 'No vocabulary reviews found in the file.',
            type: 'warning',
            confirmText: 'OK',
            cancelText: ''
          });
          setIsLoading(false);
          return;
        }
        
        const words: string[] = [];
        vocabCards.forEach((c: any) => {
          if (c.spelling && (c.reviews && c.reviews.length > 0 || !jpdbOverwrite)) {
            words.push(c.spelling);
          }
        });

        if (words.length === 0) {
          await showConfirm({
            title: 'Sin palabras',
            message: lang === 'es' ? 'Ninguna palabra en el archivo cumple los criterios de importación.' : 'No words in the file match the import criteria.',
            type: 'warning',
            confirmText: 'OK',
            cancelText: ''
          });
          setIsLoading(false);
          return;
        }

        const ok = await showConfirm({
          title: lang === 'es' ? 'Importar Reseñas' : 'Import Reviews',
          message: lang === 'es' 
            ? `Se encontraron ${words.length} palabras estudiadas. ¿Deseas importarlas como "Conocido"?`
            : `Found ${words.length} studied words. Do you want to import them as "Known"?`,
          type: 'info',
          confirmText: lang === 'es' ? 'Importar' : 'Import'
        });

        if (ok) {
          const current = db.getWordStatuses();
          const updated = { ...current };
          words.forEach(w => { updated[w] = 'known'; });
          db.saveWordStatuses(updated);
          loadVocabStats();
          await showConfirm({
            title: lang === 'es' ? 'Completado' : 'Success',
            message: lang === 'es' ? `¡Importadas ${words.length} palabras con éxito!` : `Successfully imported ${words.length} words!`,
            type: 'info',
            confirmText: 'OK',
            cancelText: ''
          });
        }
      } else {
        throw new Error(lang === 'es' ? 'Proporciona una clave API de JPDB o selecciona un archivo reviews.json.' : 'Please provide a JPDB API Key or select a reviews.json file.');
      }
    } catch (err: any) {
      console.error(err);
      await showConfirm({
        title: 'Error',
        message: err.message,
        type: 'warning',
        confirmText: 'OK',
        cancelText: ''
      });
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // --- File Import (.txt / .csv) ---
  const handleImportFile = async () => {
    if (!vocabFile) return;
    setIsLoading(true);
    setProgressMsg(lang === 'es' ? 'Leyendo archivo...' : 'Reading file...');
    try {
      const text = await vocabFile.text();
      const lines = text.split(/\r?\n/);
      const rawWords: string[] = [];
      lines.forEach(l => {
        const cleanL = l.trim();
        if (cleanL && !cleanL.startsWith('#')) {
          const parts = cleanL.split(/[\t,;]/);
          const firstPart = parts[0]?.trim();
          if (firstPart) rawWords.push(firstPart);
        }
      });

      if (rawWords.length === 0) {
        await showConfirm({
          title: 'Error',
          message: lang === 'es' ? 'El archivo está vacío o no contiene vocabulario legible.' : 'The file is empty or does not contain readable vocabulary.',
          type: 'warning',
          confirmText: 'OK',
          cancelText: ''
        });
        setIsLoading(false);
        return;
      }

      setProgressMsg(lang === 'es' ? 'Analizando palabras...' : 'Analyzing words...');
      const words: string[] = [];
      for (const w of rawWords) {
        const cleaned = cleanWord(w);
        if (cleaned) {
          const isSentence = fileParseWords && (
            cleaned.length > 5 || 
            cleaned.includes('。') || 
            cleaned.includes('、') || 
            cleaned.includes('？') || 
            cleaned.includes('！')
          );
          if (isSentence && cleaned.length > 3) {
            try {
              const paragraphs = await tokenizeText(cleaned);
              paragraphs.flat().forEach(tok => {
                if (tok && tok.isWord && tok.basicForm) {
                  const subClean = cleanWord(tok.basicForm);
                  if (subClean) words.push(subClean);
                }
              });
            } catch {
              words.push(cleaned);
            }
          } else {
            words.push(cleaned);
          }
        }
      }

      const ok = await showConfirm({
        title: lang === 'es' ? 'Importar desde archivo' : 'Import from file',
        message: lang === 'es' 
          ? `Se encontraron ${words.length} palabras. ¿Deseas añadirlas como "Conocido"?`
          : `Found ${words.length} words. Do you want to import them as "Known"?`,
        type: 'info',
        confirmText: lang === 'es' ? 'Importar' : 'Import'
      });

      if (ok) {
        const current = db.getWordStatuses();
        const updated = { ...current };
        words.forEach(w => { updated[w] = 'known'; });
        db.saveWordStatuses(updated);
        loadVocabStats();
        await showConfirm({
          title: lang === 'es' ? 'Completado' : 'Success',
          message: lang === 'es' ? `¡Importadas ${words.length} palabras con éxito!` : `Successfully imported ${words.length} words!`,
          type: 'info',
          confirmText: 'OK',
          cancelText: ''
        });
      }
    } catch (err: any) {
      console.error(err);
      await showConfirm({
        title: 'Error',
        message: err.message,
        type: 'warning',
        confirmText: 'OK',
        cancelText: ''
      });
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // --- Frequency Range Import ---
  const handleImportFrequency = async () => {
    if (!selectedFreqDict) return;
    setIsLoading(true);
    setProgressMsg(lang === 'es' ? 'Consultando diccionario de frecuencias...' : 'Querying frequency dictionary...');
    try {
      const words = await getTopWordsFromFrequencyDict(selectedFreqDict, Number(freqMaxRank));
      if (words.length === 0) {
        await showConfirm({
          title: 'Sin palabras',
          message: lang === 'es' ? 'No se encontraron palabras en este rango en el diccionario seleccionado.' : 'No words found in this range in the selected dictionary.',
          type: 'warning',
          confirmText: 'OK',
          cancelText: ''
        });
        setIsLoading(false);
        return;
      }

      const ok = await showConfirm({
        title: lang === 'es' ? 'Importar Frecuencia' : 'Import Frequency',
        message: lang === 'es' 
          ? `Se encontraron ${words.length} palabras en el rango 1 a ${freqMaxRank} del diccionario "${selectedFreqDict}". ¿Deseas marcarlas como "Conocido"?`
          : `Found ${words.length} words in range 1 to ${freqMaxRank} of "${selectedFreqDict}". Do you want to mark them as "Known"?`,
        type: 'info',
        confirmText: lang === 'es' ? 'Importar' : 'Import'
      });

      if (ok) {
        const current = db.getWordStatuses();
        const updated = { ...current };
        words.forEach(w => { updated[w] = 'known'; });
        db.saveWordStatuses(updated);
        loadVocabStats();
        await showConfirm({
          title: lang === 'es' ? 'Completado' : 'Success',
          message: lang === 'es' ? `¡Importadas ${words.length} palabras con éxito!` : `Successfully imported ${words.length} words!`,
          type: 'info',
          confirmText: 'OK',
          cancelText: ''
        });
      }
    } catch (err: any) {
      console.error(err);
      await showConfirm({
        title: 'Error',
        message: err.message,
        type: 'warning',
        confirmText: 'OK',
        cancelText: ''
      });
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // --- Vocabulary Backup JSON ---
  const handleImportBackup = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setProgressMsg(lang === 'es' ? 'Restaurando copia de seguridad...' : 'Restoring backup...');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON backup file.');
      
      const ok = await showConfirm({
        title: lang === 'es' ? 'Importar copia de seguridad' : 'Import backup',
        message: lang === 'es' 
          ? `Se importarán los estados de palabras de la copia de seguridad. Esto sobrescribirá tus estados de palabras actuales. ¿Deseas continuar?`
          : `This will overwrite your current word statuses with the backup version. Do you want to continue?`,
        type: 'warning',
        confirmText: lang === 'es' ? 'Importar' : 'Import'
      });

      if (ok) {
        db.saveWordStatuses(parsed);
        loadVocabStats();
        await showConfirm({
          title: lang === 'es' ? 'Completado' : 'Success',
          message: lang === 'es' ? '¡Vocabulario restaurado con éxito!' : 'Vocabulary restored successfully!',
          type: 'info',
          confirmText: 'OK',
          cancelText: ''
        });
      }
    } catch (err: any) {
      console.error(err);
      await showConfirm({
        title: 'Error',
        message: err.message,
        type: 'warning',
        confirmText: 'OK',
        cancelText: ''
      });
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // --- Export JSON / TXT ---
  const handleExportJSON = () => {
    const statuses = db.getWordStatuses();
    const blob = new Blob([JSON.stringify(statuses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yoru_vocabulary_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTXT = (onlyKnown: boolean) => {
    const statuses = db.getWordStatuses();
    const words = Object.keys(statuses).filter(w => !onlyKnown || statuses[w] === 'known');
    const blob = new Blob([words.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yoru_vocabulary_${onlyKnown ? 'known_' : ''}${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Mass Actions: Composition ---
  const handleExpandComponents = async () => {
    setIsLoading(true);
    setProgressMsg(lang === 'es' ? 'Analizando palabras y extrayendo partes...' : 'Analyzing words and extracting parts...');
    try {
      const current = db.getWordStatuses();
      const known = Object.keys(current).filter(w => current[w] === 'known');
      const added = new Set<string>();
      
      for (const word of known) {
        if (word.length > 1) {
          try {
            const paragraphs = await tokenizeText(word);
            paragraphs.flat().forEach(tok => {
              if (tok && tok.isWord && tok.basicForm && tok.basicForm !== word) {
                const cleaned = cleanWord(tok.basicForm);
                if (cleaned && current[cleaned] !== 'known') {
                  added.add(cleaned);
                }
              }
            });
          } catch {}
        }
      }

      if (added.size === 0) {
        await showConfirm({
          title: lang === 'es' ? 'Sin cambios' : 'No components found',
          message: lang === 'es' ? 'No se encontraron componentes nuevos para agregar.' : 'No new components were found to add.',
          type: 'info',
          confirmText: 'OK',
          cancelText: ''
        });
        setIsLoading(false);
        return;
      }

      const ok = await showConfirm({
        title: lang === 'es' ? 'Expandir componentes' : 'Expand components',
        message: lang === 'es' 
          ? `Se encontraron ${added.size} palabras componentes (partes de palabras compuestas que ya conoces). ¿Deseas marcarlas como "Conocido" en tu base de datos?`
          : `Found ${added.size} component words (parts of compound words you already know). Do you want to mark them as "Known" in your database?`,
        type: 'info',
        confirmText: lang === 'es' ? 'Agregar' : 'Add'
      });

      if (ok) {
        const updated = { ...current };
        added.forEach(w => { updated[w] = 'known'; });
        db.saveWordStatuses(updated);
        loadVocabStats();
        await showConfirm({
          title: lang === 'es' ? 'Completado' : 'Success',
          message: lang === 'es' ? `¡Agregadas ${added.size} palabras componentes con éxito!` : `Successfully added ${added.size} component words!`,
          type: 'info',
          confirmText: 'OK',
          cancelText: ''
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // --- Mass Actions: Danger Zone ---
  const handleClearVocabulary = async () => {
    const ok = await showConfirm({
      title: lang === 'es' ? '¡ADVERTENCIA IRREVERSIBLE!' : 'IRREVERSIBLE WARNING!',
      message: lang === 'es' 
        ? 'Esto eliminará de forma permanente TODAS tus palabras conocidas, destacadas y en aprendizaje de la aplicación. Esta acción no se puede deshacer. ¿Seguro que deseas continuar?'
        : 'This will permanently delete ALL your known, starred, and learning words from the application. This action cannot be undone. Are you sure you want to continue?',
      type: 'danger',
      confirmText: lang === 'es' ? 'Eliminar todo' : 'Delete all'
    });

    if (ok) {
      db.saveWordStatuses({});
      loadVocabStats();
      await showConfirm({
        title: lang === 'es' ? 'Completado' : 'Deleted',
        message: lang === 'es' ? 'El vocabulario ha sido vaciado.' : 'All vocabulary has been cleared.',
        type: 'info',
        confirmText: 'OK',
        cancelText: ''
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1400 }}>
        <div className="yomitan-anki-modal" onClick={e => e.stopPropagation()} style={{ width: '640px', maxWidth: '95vw', height: '80vh', display: 'flex', flexDirection: 'column' }}>
          
          {/* Header */}
          <div className="yomitan-anki-header">
            <div className="yomitan-anki-header-left">
              <Database size={16} style={{ color: 'var(--primary)', marginRight: '2px' }} />
              <span className="yomitan-anki-title">{lang === 'es' ? 'Gestión de Vocabulario' : 'Vocabulary Management'}</span>
            </div>
            <button className="yomitan-close-btn" onClick={onClose}><X size={16} /></button>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-light)' }}>
            {[
              { id: 'summary', label: lang === 'es' ? 'Resumen' : 'Summary' },
              { id: 'import', label: lang === 'es' ? 'Importar' : 'Import' },
              { id: 'export', label: lang === 'es' ? 'Exportar' : 'Export' },
              { id: 'actions', label: lang === 'es' ? 'Acciones Masivas' : 'Mass Actions' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1,
                  background: activeTab === t.id ? 'rgba(255, 224, 0, 0.05)' : 'none',
                  border: 'none',
                  borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                  padding: '12px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Modal Body */}
          <div className="yomitan-anki-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            
            {/* 1. SUMMARY TAB */}
            {activeTab === 'summary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {lang === 'es' ? 'Palabras Totales Registradas' : 'Total Tracked Words'}
                  </div>
                  <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-main)', margin: '10px 0' }}>
                    {stats.total.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {lang === 'es' ? 'Estadísticas del vocabulario acumulado en la base de datos local' : 'Aggregated stats from your local database'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { label: lang === 'es' ? 'Conocidas' : 'Known', count: stats.known, color: 'var(--status-known)' },
                    { label: lang === 'es' ? 'Aprendiendo' : 'Learning', count: stats.learning, color: 'var(--status-learning)' },
                    { label: lang === 'es' ? 'Destacadas' : 'Starred', count: stats.starred, color: '#ab47bc' },
                    { label: lang === 'es' ? 'Ignoradas' : 'Ignored', count: stats.ignored, color: 'var(--text-muted)' }
                  ].map(c => (
                    <div key={c.label} style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{c.label}</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: c.color }}>{c.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. IMPORT TAB */}
            {activeTab === 'import' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Method selector */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '8px' }}>
                  {[
                    { id: 'anki-connect', label: 'AnkiConnect' },
                    { id: 'jpdb', label: 'JPDB' },
                    { id: 'anki-file', label: lang === 'es' ? 'Archivo' : 'File' },
                    { id: 'frequency', label: lang === 'es' ? 'Frecuencia' : 'Frequency' },
                    { id: 'backup', label: lang === 'es' ? 'Copia JSON' : 'Backup JSON' }
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setImportMethod(m.id)}
                      style={{
                        background: importMethod === m.id ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
                        border: importMethod === m.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        color: importMethod === m.id ? '#000' : '#fff',
                        padding: '8px 4px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Sub-panels */}
                
                {/* 2a. AnkiConnect Panel */}
                {importMethod === 'anki-connect' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.4', marginBottom: '8px' }}>
                      {lang === 'es' 
                        ? 'Importa palabras directamente desde tu colección local de AnkiConnect.' 
                        : 'Import words directly from your local AnkiConnect collection.'}
                    </div>

                    <div className="yomitan-anki-field-group">
                      <span className="yomitan-anki-field-title">{lang === 'es' ? 'API Key de AnkiConnect (opcional)' : 'AnkiConnect API Key (optional)'}</span>
                      <input
                        type="password"
                        className="yomitan-anki-input"
                        value={ankiSettings.apiKey || ''}
                        onChange={e => saveAnkiSettings({ ...ankiSettings, apiKey: e.target.value })}
                        onBlur={testAnkiConnection}
                        placeholder={lang === 'es' ? 'Vacío si no has configurado apiKey' : 'Leave blank unless apiKey is set in AnkiConnect'}
                      />
                    </div>

                    <div className="yomitan-anki-field-group">
                      <span className="yomitan-anki-field-title">{lang === 'es' ? 'Mazo de Anki' : 'Anki Deck'}</span>
                      <select
                        className="yomitan-anki-input"
                        value={ankiSettings.expression?.deck || ''}
                        onChange={e => saveAnkiSettings({ ...ankiSettings, expression: { ...ankiSettings.expression, deck: e.target.value } })}
                      >
                        {availableDecks.length > 0 ? (
                          availableDecks.map(d => <option key={d} value={d} style={{ background: '#1c1c20' }}>{d}</option>)
                        ) : (
                          <option value={ankiSettings.expression?.deck || 'sentence mining'} style={{ background: '#1c1c20' }}>
                            {ankiSettings.expression?.deck || 'sentence mining'}
                          </option>
                        )}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="yomitan-anki-field-group">
                        <span className="yomitan-anki-field-title">{lang === 'es' ? 'Campo de la palabra' : 'Word Field'}</span>
                        <select
                          className="yomitan-anki-input"
                          value={ankiSettings.importWordField || ''}
                          onChange={e => saveAnkiSettings({ ...ankiSettings, importWordField: e.target.value })}
                        >
                          {expressionFields.length > 0 ? (
                            expressionFields.map(f => <option key={f} value={f} style={{ background: '#1c1c20' }}>{f}</option>)
                          ) : (
                            <option value={ankiSettings.importWordField || 'Expression'} style={{ background: '#1c1c20' }}>{ankiSettings.importWordField || 'Expression'}</option>
                          )}
                        </select>
                      </div>

                      <div className="yomitan-anki-field-group">
                        <span className="yomitan-anki-field-title">{lang === 'es' ? 'Campo de lectura (opcional)' : 'Reading Field (optional)'}</span>
                        <select
                          className="yomitan-anki-input"
                          value={ankiSettings.importReadingField || ''}
                          onChange={e => saveAnkiSettings({ ...ankiSettings, importReadingField: e.target.value })}
                        >
                          <option value="" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Ninguno' : 'None'}</option>
                          {expressionFields.map(f => <option key={f} value={f} style={{ background: '#1c1c20' }}>{f}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="yomitan-anki-field-group">
                      <span className="yomitan-anki-field-title">{lang === 'es' ? 'Criterio de importación' : 'Import Criteria'}</span>
                      <select
                        className="yomitan-anki-input"
                        value={ankiSettings.importMinInterval !== undefined ? ankiSettings.importMinInterval : 21}
                        onChange={e => saveAnkiSettings({ ...ankiSettings, importMinInterval: Number(e.target.value) })}
                      >
                        <option value="-1" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Todas las tarjetas (incluyendo nuevas)' : 'All cards (including new)'}</option>
                        <option value="0" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Solo estudiadas (excluyendo nuevas)' : 'Only studied (excluding new)'}</option>
                        <option value="7" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'En repaso (intervalo ≥ 7 días)' : 'Learning/Review (interval ≥ 7 days)'}</option>
                        <option value="21" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Maduras (intervalo ≥ 21 días - recomendado)' : 'Mature (interval ≥ 21 days - recommended)'}</option>
                        <option value="30" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Intervalo ≥ 30 días' : 'Interval ≥ 30 days'}</option>
                        <option value="60" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Intervalo ≥ 60 días' : 'Interval ≥ 60 days'}</option>
                        <option value="90" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Intervalo ≥ 90 días' : 'Interval ≥ 90 days'}</option>
                      </select>
                    </div>

                    <div className="yomitan-anki-row" style={{ padding: '4px 0' }}>
                      <div className="yomitan-anki-row-left" style={{ paddingRight: '12px' }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>{lang === 'es' ? 'Analizar y lematizar oraciones' : 'Parse and lemmatize sentences'}</div>
                      </div>
                      <label className="migaku-switch" style={{ flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={ankiSettings.importParseWords !== false}
                          onChange={e => saveAnkiSettings({ ...ankiSettings, importParseWords: e.target.checked })}
                        />
                        <span className="migaku-switch-slider" />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCardsModalOpen(true)}
                      className="reset-filter-btn"
                      style={{
                        background: 'rgba(255, 224, 0, 0.03)',
                        borderColor: 'rgba(255, 224, 0, 0.25)',
                        color: 'var(--primary)',
                        marginTop: '4px',
                        justifyContent: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%'
                      }}
                    >
                      <span>🃏 {lang === 'es' ? 'Configurar campos de tarjeta de Anki (Minado)...' : 'Configure Anki card fields (Mining)...'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleImportAnki}
                      disabled={connectionStatus !== 'connected'}
                      className="reset-filter-btn"
                      style={{
                        background: connectionStatus === 'connected' ? 'rgba(255, 224, 0, 0.08)' : 'rgba(255,255,255,0.02)',
                        borderColor: connectionStatus === 'connected' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                        color: connectionStatus === 'connected' ? 'var(--primary)' : 'var(--text-muted)',
                        marginTop: '12px',
                        justifyContent: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <RefreshCw size={14} className={connectionStatus === 'testing' ? 'spin' : ''} />
                      <span>{lang === 'es' ? 'Importar de Anki' : 'Import from Anki'}</span>
                    </button>
                  </div>
                )}

                {/* 2b. JPDB Panel */}
                {importMethod === 'jpdb' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{lang === 'es' ? 'Importación por API' : 'API Import'}</h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '8px' }}>
                        {lang === 'es' 
                          ? 'Introduce tu clave API de JPDB (la encuentras en la parte inferior de jpdb.io/settings) para importar automáticamente el vocabulario de tus mazos.' 
                          : 'Enter your JPDB API key (found at the bottom of jpdb.io/settings) to automatically fetch and import your deck vocabulary.'}
                      </p>
                      <input
                        type="password"
                        className="yomitan-anki-input"
                        value={jpdbApiKey}
                        onChange={e => setJpdbApiKey(e.target.value)}
                        placeholder="JPDB API Key"
                      />
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                    <div>
                      <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{lang === 'es' ? 'Importación por Archivo reviews.json' : 'Reviews.json File Import'}</h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '8px' }}>
                        {lang === 'es' 
                          ? 'Alternativamente, puedes exportar tu historial de repasos en formato JSON desde JPDB y cargarlo aquí.' 
                          : 'Alternatively, you can export your review history in JSON format from JPDB settings and upload the reviews.json file here.'}
                      </p>
                      
                      <label className="reset-filter-btn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                        <Upload size={14} /> 
                        <span>{jpdbReviewsFile ? jpdbReviewsFile.name : (lang === 'es' ? 'Seleccionar archivo reviews.json' : 'Select reviews.json')}</span>
                        <input
                          type="file"
                          accept=".json"
                          style={{ display: 'none' }}
                          onChange={e => setJpdbReviewsFile(e.target.files?.[0] || null)}
                        />
                      </label>

                      <div className="yomitan-anki-row" style={{ padding: '8px 0', marginTop: '6px' }}>
                        <div className="yomitan-anki-row-left" style={{ paddingRight: '12px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{lang === 'es' ? 'Omitir tarjetas no estudiadas' : 'Skip unstudied cards'}</span>
                        </div>
                        <label className="migaku-switch" style={{ flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={jpdbOverwrite}
                            onChange={e => setJpdbOverwrite(e.target.checked)}
                          />
                          <span className="migaku-switch-slider" />
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleImportJpdb}
                      disabled={!jpdbApiKey && !jpdbReviewsFile}
                      className="reset-filter-btn"
                      style={{
                        background: (jpdbApiKey || jpdbReviewsFile) ? 'rgba(255, 224, 0, 0.08)' : 'rgba(255,255,255,0.02)',
                        borderColor: (jpdbApiKey || jpdbReviewsFile) ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                        color: (jpdbApiKey || jpdbReviewsFile) ? 'var(--primary)' : 'var(--text-muted)',
                        marginTop: '12px',
                        justifyContent: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Download size={14} />
                      <span>{lang === 'es' ? 'Importar de JPDB' : 'Import from JPDB'}</span>
                    </button>
                  </div>
                )}

                {/* 2c. Archivo Panel */}
                {importMethod === 'anki-file' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {lang === 'es'
                        ? 'Carga un archivo de texto plano (.txt) o archivo delimitado por comas (.csv). El lector leerá la primera columna de cada línea como una palabra.'
                        : 'Upload a plain text (.txt) or comma-separated (.csv) file. The importer reads the first column of each line as a word.'}
                    </div>

                    <label className="reset-filter-btn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                      <Upload size={14} />
                      <span>{vocabFile ? vocabFile.name : (lang === 'es' ? 'Seleccionar archivo .txt o .csv' : 'Select .txt or .csv file')}</span>
                      <input
                        type="file"
                        accept=".txt,.csv"
                        style={{ display: 'none' }}
                        onChange={e => setVocabFile(e.target.files?.[0] || null)}
                      />
                    </label>

                    <div className="yomitan-anki-row" style={{ padding: '4px 0' }}>
                      <div className="yomitan-anki-row-left" style={{ paddingRight: '12px' }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>{lang === 'es' ? 'Analizar y lematizar líneas' : 'Parse and lemmatize lines'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {lang === 'es' ? 'Activa si las líneas contienen oraciones o conjugaciones en lugar de vocablos básicos.' : 'Enable if lines contain sentences or conjugated verbs instead of simple words.'}
                        </div>
                      </div>
                      <label className="migaku-switch" style={{ flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={fileParseWords}
                          onChange={e => setFileParseWords(e.target.checked)}
                        />
                        <span className="migaku-switch-slider" />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleImportFile}
                      disabled={!vocabFile}
                      className="reset-filter-btn"
                      style={{
                        background: vocabFile ? 'rgba(255, 224, 0, 0.08)' : 'rgba(255,255,255,0.02)',
                        borderColor: vocabFile ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                        color: vocabFile ? 'var(--primary)' : 'var(--text-muted)',
                        marginTop: '12px',
                        justifyContent: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Download size={14} />
                      <span>{lang === 'es' ? 'Importar archivo' : 'Import file'}</span>
                    </button>
                  </div>
                )}

                {/* 2d. Rango de Frecuencia Panel */}
                {importMethod === 'frequency' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {lang === 'es'
                        ? 'Marca de forma masiva las palabras más comunes como "Conocido" a partir de un diccionario de frecuencias instalado en el lector (ej. las primeras 2000 palabras).'
                        : 'Bulk mark the most frequent words as "Known" using one of your installed frequency lists (e.g. top 2000 words).'}
                    </div>

                    <div className="yomitan-anki-field-group">
                      <span className="yomitan-anki-field-title">{lang === 'es' ? 'Seleccionar lista de frecuencias' : 'Select Frequency List'}</span>
                      <select
                        className="yomitan-anki-input"
                        value={selectedFreqDict}
                        onChange={e => setSelectedFreqDict(e.target.value)}
                      >
                        {availableFreqDicts.length > 0 ? (
                          availableFreqDicts.map(d => <option key={d.title} value={d.title} style={{ background: '#1c1c20' }}>{d.title}</option>)
                        ) : (
                          <option value="" style={{ background: '#1c1c20' }}>{lang === 'es' ? 'Sin listas instaladas' : 'No lists installed'}</option>
                        )}
                      </select>
                    </div>

                    <div className="yomitan-anki-field-group">
                      <span className="yomitan-anki-field-title">{lang === 'es' ? 'Cantidad de palabras (Límite de rango)' : 'Number of words (Max Rank)'}</span>
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        className="yomitan-anki-input"
                        value={freqMaxRank}
                        onChange={e => setFreqMaxRank(Number(e.target.value))}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleImportFrequency}
                      disabled={!selectedFreqDict || freqMaxRank <= 0}
                      className="reset-filter-btn"
                      style={{
                        background: (selectedFreqDict && freqMaxRank > 0) ? 'rgba(255, 224, 0, 0.08)' : 'rgba(255,255,255,0.02)',
                        borderColor: (selectedFreqDict && freqMaxRank > 0) ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                        color: (selectedFreqDict && freqMaxRank > 0) ? 'var(--primary)' : 'var(--text-muted)',
                        marginTop: '12px',
                        justifyContent: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Download size={14} />
                      <span>{lang === 'es' ? 'Importar rango' : 'Import range'}</span>
                    </button>
                  </div>
                )}

                {/* 2e. Backup JSON Panel */}
                {importMethod === 'backup' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {lang === 'es'
                        ? 'Carga una copia de seguridad del vocabulario de Yoru Reader en formato JSON. Advertencia: esto sobrescribirá tu vocabulario actual.'
                        : 'Upload a Yoru Reader vocabulary backup file in JSON format. Warning: this will overwrite your current vocabulary.'}
                    </div>

                    <label className="reset-filter-btn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                      <Upload size={14} />
                      <span>{lang === 'es' ? 'Cargar archivo JSON de respaldo' : 'Upload JSON Backup File'}</span>
                      <input
                        type="file"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleImportBackup}
                      />
                    </label>
                  </div>
                )}

              </div>
            )}

            {/* 3. EXPORT TAB */}
            {activeTab === 'export' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {lang === 'es'
                    ? 'Exporta la lista de palabras guardadas en tu perfil para usarlas en otras herramientas o como respaldo.'
                    : 'Export the list of saved words in your profile to use them in other tools or as a backup.'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="reset-filter-btn"
                    style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                  >
                    <Download size={15} />
                    <span>{lang === 'es' ? 'Exportar como Respaldo JSON completo' : 'Export as Complete JSON Backup'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportTXT(true)}
                    className="reset-filter-btn"
                    style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                  >
                    <FileText size={15} />
                    <span>{lang === 'es' ? 'Exportar palabras "Conocido" (.txt plano)' : 'Export "Known" words (.txt list)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportTXT(false)}
                    className="reset-filter-btn"
                    style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                  >
                    <FileText size={15} />
                    <span>{lang === 'es' ? 'Exportar todas las palabras guardadas (.txt plano)' : 'Export all saved words (.txt list)'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. ACTIONS TAB */}
            {activeTab === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div className="settings-section-card" style={{ margin: 0 }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={15} style={{ color: 'var(--primary)' }} />
                    <span>{lang === 'es' ? 'Marcar palabras conocidas mediante composición' : 'Mark Words as Known via Composition'}</span>
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '12px' }}>
                    {lang === 'es'
                      ? 'Analiza las palabras conocidas complejas (de longitud > 1) y extrae sus palabras componentes para agregarlas como conocidas automáticamente (ej. si conoces "突っ込む", agregará "突く" y "込む").'
                      : 'Analyzes complex known words (length > 1) and extracts their component words to automatically add them as known too (e.g. if you know "突っ込む", it adds "突く" and "込む").'}
                  </p>
                  <button
                    type="button"
                    onClick={handleExpandComponents}
                    className="reset-filter-btn"
                    style={{ background: 'rgba(99, 102, 241, 0.05)', borderColor: '#8b5cf6', color: '#a78bfa' }}
                  >
                    {lang === 'es' ? 'Analizar y expandir componentes' : 'Analyze & Expand Components'}
                  </button>
                </div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

                <div className="settings-section-card" style={{ margin: 0, borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.02)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f87171', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={15} style={{ color: '#ef4444' }} />
                    <span>{lang === 'es' ? 'Zona de peligro' : 'Danger Zone'}</span>
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(239, 68, 68, 0.65)', lineHeight: '1.4', marginBottom: '12px' }}>
                    {lang === 'es'
                      ? 'Vacía de forma permanente todas las palabras conocidas, en aprendizaje e ignoradas. Esta acción no se puede deshacer.'
                      : 'Permanently deletes all known, learning, and ignored words. This action is irreversible.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleClearVocabulary}
                    className="reset-filter-btn"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', color: '#f87171' }}
                  >
                    {lang === 'es' ? 'Eliminar todo el vocabulario' : 'Clear All Vocabulary'}
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Bottom Progress Bar */}
          {isLoading && (
            <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={16} className="spin" style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>{progressMsg}</span>
            </div>
          )}

        </div>
      </div>
      {confirmModal}
      {isCardsModalOpen && (
        <AnkiCardsModal
          lang={lang}
          settings={ankiSettings}
          availableDecks={availableDecks}
          availableModels={availableModels}
          onSave={(updated: any) => {
            const newSetts = { ...ankiSettings, ...updated };
            setAnkiSettings(newSetts);
            localStorage.setItem('anki_settings_v2', JSON.stringify(newSetts));
            const tab = newSetts.expression || {};
            const fields = tab.fields || {};
            const findField = (token: string) => Object.keys(fields).find(k => fields[k] === token) || '';
            localStorage.setItem('anki_settings', JSON.stringify({
              host: newSetts.host,
              deck: tab.deck || '',
              noteType: tab.noteType || '',
              tags: newSetts.tags,
              wordField: newSetts.importWordField || findField('{expression}'),
              readingField: findField('{reading}'),
              meaningField: findField('{meaning}'),
              sentenceField: findField('{sentence}'),
            }));
          }}
          onClose={() => setIsCardsModalOpen(false)}
        />
      )}
    </>
  );
}

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
];

const getAutoMappedToken = (fName: string) => {
  const lower = fName.toLowerCase().replace(/[-_]/g, '');
  
  if (lower.includes('furigana')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      if (lower.includes('plain')) return '{sentence-furigana-plain}';
      return '{sentence-furigana}';
    }
    if (lower.includes('plain')) return '{furigana-plain}';
    return '{furigana}';
  }
  
  if (lower.includes('audio')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      return '{sentence-audio}';
    }
    return '{audio}';
  }
  
  if (lower.includes('reading') || lower.includes('lectura') || lower === 'yomi' || lower.includes('kana') || lower.includes('pronunciation')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      return '{sentence-furigana-plain}';
    }
    return '{reading}';
  }
  
  if (lower.includes('cloze') || lower.includes('clozed')) {
    return '{sentence-cloze}';
  }
  
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
  
  if (lower.includes('kanji') || lower.includes('expression') || lower.includes('word') || lower.includes('vocablo') || lower.includes('palabra') || lower.includes('vocab') || lower.includes('term')) {
    if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower.includes('sent')) {
      return '{sentence}';
    }
    return '{expression}';
  }
  
  if (lower.includes('screenshot') || lower.includes('picture') || lower.includes('imagen') || lower === 'pic' || lower.includes('image') || lower.includes('img') || lower.includes('foto')) {
    return '{screenshot}';
  }
  
  if (lower.includes('partofspeech') || lower === 'pos' || lower.includes('category') || lower === 'clase') {
    return '{part-of-speech}';
  }
  
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
  
  if (lower.includes('frequency') || lower.includes('frecuencia') || lower === 'freq' || lower.includes('frequencies')) {
    if (lower.includes('sorted') || lower.includes('rank') || lower.includes('harmonic') || lower.includes('best')) {
      return '{frequency-harmonic-rank}';
    }
    return '{frequencies}';
  }
  
  if (lower.includes('sentence') || lower.includes('frase') || lower.includes('oracion') || lower.includes('contexto') || lower === 'sent') {
    return '{sentence}';
  }
  
  return '';
};

interface AnkiCardsModalProps {
  settings: any;
  onSave: (settings: any) => void;
  onClose: () => void;
  availableDecks: string[];
  availableModels: string[];
  lang: string;
}

function AnkiCardsModal({ settings, onSave, onClose, availableDecks, availableModels, lang }: AnkiCardsModalProps) {
  const [activeTab, setActiveTab] = useState<'expression' | 'reading' | 'kanji'>('expression');
  const [local, setLocal] = useState<any>(settings);
  const [modelFields, setModelFields] = useState<string[]>([]);

  const tab = local[activeTab] || { deck: '', noteType: '', fields: {} };

  const setTabField = (key: string, value: any) =>
    setLocal((s: any) => ({ ...s, [activeTab]: { ...s[activeTab], [key]: value } }));

  const setFieldToken = (fieldName: string, token: string) =>
    setLocal((s: any) => ({
      ...s,
      [activeTab]: {
        ...s[activeTab],
        fields: { ...s[activeTab].fields, [fieldName]: token }
      }
    }));

  const handleAutoMapFields = () => {
    if (!modelFields || modelFields.length === 0) return;
    setLocal((s: any) => {
      const updatedFields: any = {};
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
          
          setLocal((s: any) => {
            const currentFields = s[activeTab]?.fields || {};
            const updatedFields: any = {};
            let changed = false;
            data.result.forEach((fName: string) => {
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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1500 }}>
      <div className="yomitan-cards-modal" onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '90vw' }}>
        <div className="yomitan-cards-title">{lang === 'es' ? 'Campos de tarjeta de Anki' : 'Anki Card Fields'}</div>

        <div className="yomitan-cards-tabs">
          {['expression', 'reading', 'kanji'].map(t => (
            <button
              key={t}
              className={`yomitan-cards-tab ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t as any)}
            >
              {t === 'expression' ? (lang === 'es' ? 'Expresión' : 'Expression') :
               t === 'reading' ? (lang === 'es' ? 'Lectura' : 'Reading') :
               (lang === 'es' ? 'Kanji' : 'Kanji')}
            </button>
          ))}
        </div>

        <div className="yomitan-cards-body" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
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

          <div className="yomitan-fields-divider" />

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
            >
              <span>✨ {lang === 'es' ? 'Auto-mapear campos' : 'Auto-map fields'}</span>
            </button>
          </div>

          <div className="yomitan-fields-header">
            <span>{lang === 'es' ? 'Campo' : 'Field'}</span>
            <span>{lang === 'es' ? 'Valor' : 'Value'}</span>
          </div>

          {Object.entries(tab.fields || {}).map(([fieldName, token]) => (
            <div key={fieldName} className="yomitan-cards-row">
              <span className="yomitan-cards-label">{fieldName}</span>
              <div className="yomitan-cards-input-wrap">
                <select
                  className="yomitan-cards-select"
                  value={token as string}
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
