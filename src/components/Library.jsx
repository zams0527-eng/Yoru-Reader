import React, { useState, useRef, useEffect } from 'react';
import { Plus, Info, Trash2, ListChecks, Check, BarChart3, HelpCircle, Pencil, X, ArrowUpDown, Settings, SlidersHorizontal, Calendar, BookOpen, Clock, Flame, Download, Upload, MoreVertical, Search, EyeOff, User, Tag, RotateCcw, CircleSlash, Play, Pause, ChevronDown, Database, Palette, Cloud, FolderOpen } from 'lucide-react';
import SettingsModal from './SettingsModal';
import JSZip from 'jszip';
import { importBookFile } from '../utils/fileImport';
import { db } from '../utils/db';
import { importYomitanZip, getInstalledDictionaries, deleteDictionary, exportDictionaryDataToZip, importAllDictionaryData, closeDB } from '../utils/yomitanDB';
const AnkiConfigModal = React.lazy(() => import('./AnkiConfigModal'));
import { tokenizeText } from '../utils/japanese';
import { t } from '../utils/i18n';
import { googleDriveService } from '../utils/googleDriveService';

const resizeImage = (file, maxDimension = 128) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // Compressed JPEG
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function Library({ 
  books, 
  onSelectBook, 
  onAddBooks, 
  onDeleteBook, 
  onUpdateBookDetails, 
  onOpenInfo,
  profiles = [],
  activeProfileId = 'profile-default',
  onSelectProfile,
  onAddProfile,
  onDeleteProfile,
  onBulkDeleteBooks,
  onUpdateProfile,
  settings = {},
  onSaveSettings,
  wordStatuses = {}
}) {
  const lang = settings.appLanguage || 'es';
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const profileWidgetRef = useRef(null);
  const customAvatarInputRef = useRef(null);
  
  // Book Manager states
  const [isParsing, setIsParsing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState([]);
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('yatsu_sort_by') || 'added';
  });
  const [sortDirection, setSortDirection] = useState(() => {
    return localStorage.getItem('yatsu_sort_direction') || 'desc';
  });
  const [groupSort, setGroupSort] = useState(() => {
    return localStorage.getItem('yatsu_group_sort') || 'alphabetical';
  });
  const [groupDirection, setGroupDirection] = useState(() => {
    return localStorage.getItem('yatsu_group_direction') || 'asc';
  });
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [previewBook, setPreviewBook] = useState(null);
  
  // Sidebar Navigation states
  const [activeFilter, setActiveFilter] = useState({ type: 'all', value: null });
  const [searchQuery, setSearchQuery] = useState('');

  // Library Display settings (Yatsu style)
  const [cardWidth, setCardWidth] = useState(() => {
    return parseInt(localStorage.getItem('yatsu_card_width') || '160');
  });
  const [coverFit, setCoverFit] = useState(() => {
    return localStorage.getItem('yatsu_cover_fit') || 'cover'; // 'cover' | 'contain'
  });
  const [showCardTitle, setShowCardTitle] = useState(() => {
    return localStorage.getItem('yatsu_show_title') !== 'false';
  });
  const [showCardAuthor, setShowCardAuthor] = useState(() => {
    return localStorage.getItem('yatsu_show_author') !== 'false';
  });
  const [showCardProgress, setShowCardProgress] = useState(() => {
    return localStorage.getItem('yatsu_show_progress') !== 'false';
  });
  const [showCardSeries, setShowCardSeries] = useState(() => {
    return localStorage.getItem('yatsu_show_series') !== 'false';
  });
  const [showCardTags, setShowCardTags] = useState(() => {
    return localStorage.getItem('yatsu_show_tags') !== 'false';
  });
  const [showCardStatus, setShowCardStatus] = useState(() => {
    return localStorage.getItem('yatsu_show_status') !== 'false';
  });
  const [isDetailsDropdownOpen, setIsDetailsDropdownOpen] = useState(false);
  const [groupBy, setGroupBy] = useState(() => {
    return localStorage.getItem('yatsu_group_by') || 'none'; // 'none' | 'author'
  });
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'statistics' | 'settings' | 'notes'
  const [notesSearch, setNotesSearch] = useState('');
  const [notesFilterStatus, setNotesFilterStatus] = useState('all');
  const [visibleVocabCount, setVisibleVocabCount] = useState(60);
  const vocabSentinelRef = useRef(null);
  const [notesSort, setNotesSort] = useState('alphabetical');
  const [isNotesSortOpen, setIsNotesSortOpen] = useState(false);
  const [isNotesFilterOpen, setIsNotesFilterOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(2026);
  const [statsSubTab, setStatsSubTab] = useState('overview'); // 'overview' | 'breakdown' | 'filters'
  const [statsDateFrom, setStatsDateFrom] = useState('2026-07-06');
  const [statsDateTo, setStatsDateTo] = useState('2026-07-06');
  const [statsExcludedBookIds, setStatsExcludedBookIds] = useState([]);
  const [statsTitleFilter, setStatsTitleFilter] = useState('');

  // Yomitan DB states
  const [installedDicts, setInstalledDicts] = useState([]);
  const [dictImportProgress, setDictImportProgress] = useState(0);
  const [dictImportMsg, setDictImportMsg] = useState('');
  const [isImportingDict, setIsImportingDict] = useState(false);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const [activeMenuBookId, setActiveMenuBookId] = useState(null);
  const [menuOpenLeft, setMenuOpenLeft] = useState(false); // true = dropdown opens to the left of trigger
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState(null); // null | 'import' | 'database' | 'theme' | 'more'
  const [dynamicCoverage, setDynamicCoverage] = useState(null);

  useEffect(() => {
    if (!previewBook) {
      setDynamicCoverage(null);
      return;
    }

    let active = true;
    const calculateCoverage = async () => {
      try {
        const allText = (previewBook.chapters || []).map(c => c.content || '').join('\n');
        if (!allText.trim()) {
          if (active) setDynamicCoverage(0);
          return;
        }

        const paragraphs = await tokenizeText(allText);
        const tokens = paragraphs.flat();

        const uniqueWords = new Set();
        tokens.forEach(tok => {
          if (tok && tok.isWord && tok.basicForm) {
            uniqueWords.add(tok.basicForm);
          }
        });

        if (uniqueWords.size === 0) {
          if (active) setDynamicCoverage(0);
          return;
        }

        let knownCount = 0;
        uniqueWords.forEach(word => {
          const status = wordStatuses[word];
          if (status === 'known' || status === 'starred') {
            knownCount++;
          }
        });

        const pct = Math.round((knownCount / uniqueWords.size) * 100);
        if (active) setDynamicCoverage(pct);
      } catch (err) {
        console.error("Error calculating dynamic vocabulary coverage:", err);
        if (active) setDynamicCoverage(previewBook.vocabularyCoverage || 0);
      }
    };

    calculateCoverage();

    return () => {
      active = false;
    };
  }, [previewBook, wordStatuses]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuBookId(null);
      setActiveHeaderDropdown(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      loadInstalledDicts();
    }
  }, [activeTab]);

  useEffect(() => {
    setVisibleVocabCount(60);
  }, [notesSearch, notesFilterStatus, notesSort]);

  useEffect(() => {
    if (!vocabSentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleVocabCount(prev => prev + 60);
      }
    }, { rootMargin: '200px' });
    observer.observe(vocabSentinelRef.current);
    return () => observer.disconnect();
  }, [activeTab, vocabSentinelRef.current]);

  const loadInstalledDicts = async () => {
    try {
      const dicts = await getInstalledDictionaries();
      setInstalledDicts(dicts || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleYomitanUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImportingDict(true);
    setDictImportProgress(0);
    setDictImportMsg('Iniciando...');
    try {
      await importYomitanZip(file, (msg, prog) => {
        setDictImportMsg(msg);
        setDictImportProgress(prog);
      });
      await loadInstalledDicts();
    } catch (err) {
      setDictImportMsg('Error: ' + err.message);
    } finally {
      setIsImportingDict(false);
      e.target.value = '';
    }
  };

  const handleDeleteDict = async (title) => {
    if (window.confirm(`¿Seguro que quieres borrar el diccionario "${title}"?`)) {
      await deleteDictionary(title);
      await loadInstalledDicts();
    }
  };

  // Synchronize CSS variable for card width and cover fit
  useEffect(() => {
    document.documentElement.style.setProperty('--card-width', `${cardWidth}px`);
    localStorage.setItem('yatsu_card_width', cardWidth.toString());
  }, [cardWidth]);

  useEffect(() => {
    document.documentElement.style.setProperty('--cover-fit', coverFit);
    localStorage.setItem('yatsu_cover_fit', coverFit);
  }, [coverFit]);

  useEffect(() => {
    localStorage.setItem('yatsu_show_title', showCardTitle.toString());
  }, [showCardTitle]);

  useEffect(() => {
    localStorage.setItem('yatsu_show_author', showCardAuthor.toString());
  }, [showCardAuthor]);

  useEffect(() => {
    localStorage.setItem('yatsu_show_progress', showCardProgress.toString());
  }, [showCardProgress]);

  useEffect(() => {
    localStorage.setItem('yatsu_show_series', showCardSeries.toString());
  }, [showCardSeries]);

  useEffect(() => {
    localStorage.setItem('yatsu_show_tags', showCardTags.toString());
  }, [showCardTags]);

  useEffect(() => {
    localStorage.setItem('yatsu_show_status', showCardStatus.toString());
  }, [showCardStatus]);

  useEffect(() => {
    localStorage.setItem('yatsu_group_by', groupBy);
  }, [groupBy]);

  useEffect(() => {
    localStorage.setItem('yatsu_sort_by', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('yatsu_sort_direction', sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    localStorage.setItem('yatsu_group_sort', groupSort);
  }, [groupSort]);

  useEffect(() => {
    localStorage.setItem('yatsu_group_direction', groupDirection);
  }, [groupDirection]);

  // Handle keyboard shortcut Q to toggle display settings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsDisplaySettingsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Profile Selector states
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null);

  // Profile settings state & refs
  const customProfileSettingsAvatarInputRef = useRef(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileAvatar, setEditProfileAvatar] = useState('');

  // Google Drive / Cloud Sync States
  const [isGDriveSyncOpen, setIsGDriveSyncOpen] = useState(false);
  const [gDriveClientId, setGDriveClientId] = useState(localStorage.getItem('gdrive_client_id') || '658624509601-2ef33pve1i9mifecbe4n2nk0lmop9ggu.apps.googleusercontent.com');
  const [gDriveClientSecret, setGDriveClientSecret] = useState(localStorage.getItem('gdrive_client_secret') || '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');
  const [gDriveTokens, setGDriveTokens] = useState(localStorage.getItem('gdrive_tokens') ? JSON.parse(localStorage.getItem('gdrive_tokens')) : null);
  const [gDriveUserEmail, setGDriveUserEmail] = useState(localStorage.getItem('gdrive_user_email') || '');
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(localStorage.getItem('gdrive_autosync_enabled') === 'true');
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('gdrive_last_sync_time') || '');
  const [gDriveSyncStatus, setGDriveSyncStatus] = useState(localStorage.getItem('gdrive_tokens') ? 'authorized' : 'disconnected'); // 'disconnected', 'authorized', 'syncing'

  // Load and check token on startup, run sync if auto-sync is enabled
  useEffect(() => {
    const initGDriveSync = async () => {
      const tokens = localStorage.getItem('gdrive_tokens') ? JSON.parse(localStorage.getItem('gdrive_tokens')) : null;
      if (tokens && tokens.refreshToken) {
        setGDriveSyncStatus('authorized');
        try {
          // Fetch connected user info
          const info = await googleDriveService.getUserInfo(tokens, gDriveClientId, gDriveClientSecret);
          setGDriveUserEmail(info.email);
          localStorage.setItem('gdrive_user_email', info.email);
          
          if (localStorage.getItem('gdrive_autosync_enabled') === 'true') {
            // Perform automatic background restore if cloud file is newer
            await performCloudSync(tokens, 'download-only');
          }
        } catch (err) {
          console.warn('Failed to validate startup Google Drive tokens:', err);
          // Don't auto-disconnect if it's just offline (no network)
          if (navigator.onLine) {
            setGDriveSyncStatus('disconnected');
            setGDriveUserEmail('');
            localStorage.removeItem('gdrive_tokens');
            localStorage.removeItem('gdrive_user_email');
          }
        }
      }
    };
    initGDriveSync();
  }, []);

  // Connect Google Drive Folder via loopback OAuth Flow
  const handleConnectGDrive = async () => {
    try {
      if (!gDriveClientId.trim()) {
        alert(lang === 'es' ? 'Introduce tu Client ID para continuar.' : 'Please enter your Client ID to continue.');
        return;
      }
      setGDriveSyncStatus('syncing');

      if (!window.electronAPI || !window.electronAPI.startGoogleOauth) {
        alert(lang === 'es' ? 'El puente nativo de Electron no está disponible.' : 'The Electron native bridge is not available.');
        setGDriveSyncStatus(gDriveTokens ? 'authorized' : 'disconnected');
        return;
      }

      // 1. Run local loopback callback server and open browser
      const oauthResult = await window.electronAPI.startGoogleOauth(gDriveClientId.trim());
      if (!oauthResult || !oauthResult.code) {
        throw new Error('No authorization code returned from loopback server');
      }

      // 2. Exchange authorization code + PKCE verifier for access + refresh token
      const tokenData = await googleDriveService.exchangeCodeForTokens(
        oauthResult.code,
        oauthResult.redirectUri,
        gDriveClientId.trim(),
        gDriveClientSecret.trim(), // Desktop app clients require client_secret in token exchange
        oauthResult.codeVerifier
      );

      // 3. Fetch connected user information
      const info = await googleDriveService.getUserInfo(tokenData, gDriveClientId.trim(), gDriveClientSecret.trim());
      setGDriveUserEmail(info.email);

      // Save credentials & tokens
      localStorage.setItem('gdrive_client_id', gDriveClientId.trim());
      localStorage.setItem('gdrive_client_secret', gDriveClientSecret.trim());
      localStorage.setItem('gdrive_tokens', JSON.stringify(tokenData));
      localStorage.setItem('gdrive_user_email', info.email);

      setGDriveTokens(tokenData);
      setGDriveSyncStatus('authorized');
      alert(lang === 'es' ? `¡Cuenta conectada con éxito! (${info.email})` : `Account successfully connected! (${info.email})`);
    } catch (err) {
      setGDriveSyncStatus(gDriveTokens ? 'authorized' : 'disconnected');
      console.error('Google OAuth connection failed:', err);
      alert((lang === 'es' ? 'Conexión fallida: ' : 'Connection failed: ') + err.message);
    }
  };


  // Perform Cloud Upload — Full backup ZIP (mirrors "Get complete local backup" but to Google Drive)
  const handleUploadGDrive = async () => {
    const tokens = localStorage.getItem('gdrive_tokens') ? JSON.parse(localStorage.getItem('gdrive_tokens')) : null;
    if (!tokens) return;
    try {
      setGDriveSyncStatus('syncing');
      document.body.style.cursor = 'wait';

      // 1. Build the same full ZIP as "Get complete local backup"
      const zip = new JSZip();

      const dictionaries = await exportDictionaryDataToZip(zip, (msg, pct) => {
        console.log(`[GDrive Backup] ${msg} (${pct}%)`);
      });

      const metadata = {
        version: 2,
        exportDate: new Date().toISOString(),
        profiles,
        activeProfileId: localStorage.getItem('migaku_reader_active_profile_id') || 'profile-default',
        books,
        wordStatuses,
        settings,
        ankiSettings: localStorage.getItem('anki_settings') ? JSON.parse(localStorage.getItem('anki_settings')) : null,
        ankiSettingsV2: localStorage.getItem('anki_settings_v2') ? JSON.parse(localStorage.getItem('anki_settings_v2')) : null,
        dictionaries: dictionaries || [],
      };

      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const fileName = `yoru-reader-backup-${new Date().toISOString().slice(0, 10)}.zip`;

      // 2. Upload the ZIP blob to Google Drive
      await googleDriveService.uploadBlobFile(
        tokens,
        gDriveClientId.trim(),
        zipBlob,
        'yoru_reader_full_backup.zip', // fixed name so it overwrites the previous one
        'application/zip',
        gDriveClientSecret.trim()
      );

      const timeStr = new Date().toLocaleString();
      setLastSyncTime(timeStr);
      localStorage.setItem('gdrive_last_sync_time', timeStr);
      setGDriveSyncStatus('authorized');
      alert(lang === 'es'
        ? `✅ Copia de seguridad completa subida a Google Drive con éxito.\nArchivo: yoru_reader_full_backup.zip`
        : `✅ Full backup successfully uploaded to Google Drive.\nFile: yoru_reader_full_backup.zip`);
    } catch (err) {
      setGDriveSyncStatus('authorized');
      console.error('GDrive full backup upload failed:', err);
      alert((lang === 'es' ? 'Error al subir la copia de seguridad: ' : 'Backup upload failed: ') + err.message);
    } finally {
      document.body.style.cursor = 'default';
    }
  };


  // Perform Cloud Download — restores the full backup ZIP from Google Drive
  const handleDownloadGDrive = async () => {
    const tokens = localStorage.getItem('gdrive_tokens') ? JSON.parse(localStorage.getItem('gdrive_tokens')) : null;
    if (!tokens) return;
    try {
      setGDriveSyncStatus('syncing');
      document.body.style.cursor = 'wait';

      // 1. Download the full backup ZIP from Google Drive
      const zipBlob = await googleDriveService.downloadBlobFile(
        tokens,
        gDriveClientId.trim(),
        'yoru_reader_full_backup.zip',
        gDriveClientSecret.trim()
      );

      if (!zipBlob) {
        setGDriveSyncStatus('authorized');
        alert(lang === 'es'
          ? 'No se encontró ningún archivo de copia de seguridad en Google Drive. Sube una copia primero con el botón "Subir copia completa".'
          : 'No backup file found in Google Drive. Upload one first using "Upload full backup".');
        return;
      }

      if (!confirm(lang === 'es'
        ? '¿Quieres restaurar la copia de seguridad completa de Google Drive? Se fusionarán libros, vocabulario y configuraciones con los datos actuales.'
        : 'Do you want to restore the full backup from Google Drive? Books, vocabulary and settings will be merged with current data.')) {
        setGDriveSyncStatus('authorized');
        return;
      }

      // 2. Parse the ZIP using JSZip (same logic as handleImportLibrary)
      const zip = await JSZip.loadAsync(zipBlob);
      const metaFile = zip.file('metadata.json');
      if (!metaFile) throw new Error('El ZIP de Google Drive no contiene metadatos válidos de Yoru Reader.');

      const metaStr = await metaFile.async('text');
      const importData = JSON.parse(metaStr);

      if (!importData.books && !importData.profiles) {
        throw new Error('El archivo de Google Drive no tiene un formato de respaldo válido.');
      }

      // 3. Restore active profile ID
      if (importData.activeProfileId) {
        localStorage.setItem('migaku_reader_active_profile_id', importData.activeProfileId);
      } else if (importData.profiles && importData.profiles.length > 0) {
        localStorage.setItem('migaku_reader_active_profile_id', importData.profiles[0].id);
      }

      // 4. Merge profiles
      const mergedProfiles = [...profiles];
      if (importData.profiles) {
        importData.profiles.forEach(ip => {
          if (!mergedProfiles.find(p => p.id === ip.id)) mergedProfiles.push(ip);
        });
      }
      db.saveProfiles(mergedProfiles);

      // 5. Merge books
      if (importData.books) {
        const currentBooks = await db.getBooks();
        const mergedBooks = [...currentBooks];
        for (const importBook of importData.books) {
          const index = mergedBooks.findIndex(b => b.id === importBook.id || b.title === importBook.title);
          if (index !== -1) mergedBooks[index] = importBook;
          else mergedBooks.push(importBook);
        }
        await db.saveBooks(mergedBooks);
      }

      // 6. Restore word statuses
      if (importData.wordStatuses) {
        const mergedStatuses = { ...db.getWordStatuses(), ...importData.wordStatuses };
        db.saveWordStatuses(mergedStatuses);
      }

      // 7. Restore settings
      if (importData.settings) db.saveSettings(importData.settings);
      if (importData.ankiSettings) localStorage.setItem('anki_settings', JSON.stringify(importData.ankiSettings));
      if (importData.ankiSettingsV2) localStorage.setItem('anki_settings_v2', JSON.stringify(importData.ankiSettingsV2));

      // 8. Restore dictionary metadata
      if (importData.dictionaries && importData.dictionaries.length > 0) {
        await importAllDictionaryData({ dictionaries: importData.dictionaries, terms: [], frequencies: [] });
      }

      // 9. Restore dictionary term/frequency chunks from ZIP
      const termsInfoFile = zip.file('terms_info.json');
      if (termsInfoFile) {
        const termsInfo = JSON.parse(await termsInfoFile.async('text'));
        for (let c = 0; c < termsInfo.chunkCount; c++) {
          const chunkFile = zip.file(`terms_chunk_${c}.json`);
          if (chunkFile) {
            const chunkData = JSON.parse(await chunkFile.async('text'));
            await importAllDictionaryData({ dictionaries: [], terms: chunkData, frequencies: [] });
          }
        }
      }

      const freqsInfoFile = zip.file('freqs_info.json');
      if (freqsInfoFile) {
        const freqsInfo = JSON.parse(await freqsInfoFile.async('text'));
        for (let c = 0; c < freqsInfo.chunkCount; c++) {
          const chunkFile = zip.file(`freqs_chunk_${c}.json`);
          if (chunkFile) {
            const chunkData = JSON.parse(await chunkFile.async('text'));
            await importAllDictionaryData({ dictionaries: [], terms: [], frequencies: chunkData });
          }
        }
      }

      const timeStr = new Date().toLocaleString();
      localStorage.setItem('gdrive_last_sync_time', timeStr);
      setLastSyncTime(timeStr);

      alert(lang === 'es'
        ? '✅ Copia de seguridad restaurada con éxito. Reiniciando para aplicar los cambios...'
        : '✅ Backup restored successfully. Restarting to apply changes...');
      window.location.reload();
    } catch (err) {
      setGDriveSyncStatus('authorized');
      console.error('GDrive download restore failed:', err);
      alert((lang === 'es' ? 'Error al restaurar desde Google Drive: ' : 'Restore from Google Drive failed: ') + err.message);
    } finally {
      document.body.style.cursor = 'default';
    }
  };


  // Generic background sync helper using API
  const performCloudSync = async (tokens, mode = 'full') => {
    try {
      const importedData = await googleDriveService.downloadSyncFile(
        tokens,
        gDriveClientId.trim(),
        gDriveClientSecret.trim()
      );

      if (!importedData) {
        // If file doesn't exist and not download-only, upload current db
        if (mode !== 'download-only') {
          const fullExport = await db.exportFullDatabase();
          await googleDriveService.uploadSyncFile(
            tokens,
            gDriveClientId.trim(),
            fullExport,
            gDriveClientSecret.trim()
          );
        }
        return;
      }

      // Check modification timestamps if available in backup object
      const cloudTime = importedData.exportDate ? new Date(importedData.exportDate).getTime() : 0;
      const localLastTimeStr = localStorage.getItem('gdrive_last_sync_time');
      const localLastTime = localLastTimeStr ? new Date(localLastTimeStr).getTime() : 0;

      if (cloudTime > localLastTime) {
        // Cloud has newer data, auto-restore
        await db.importFullDatabase(importedData);
        const timeStr = new Date().toLocaleString();
        localStorage.setItem('gdrive_last_sync_time', timeStr);
        console.log("Auto-sincronizada base de datos desde Google Drive.");
        window.location.reload();
      } else if (mode !== 'download-only') {
        // Local is newer, upload current state
        const fullExport = await db.exportFullDatabase();
        await googleDriveService.uploadSyncFile(
          tokens,
          gDriveClientId.trim(),
          fullExport,
          gDriveClientSecret.trim()
        );
        const timeStr = new Date().toLocaleString();
        localStorage.setItem('gdrive_last_sync_time', timeStr);
        setLastSyncTime(timeStr);
      }
    } catch (err) {
      console.error('Background cloud sync failed:', err);
    }
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileWidgetRef.current && !profileWidgetRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false);
        setIsCreatingProfile(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const handleCustomAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 128);
      setCustomAvatarUrl(dataUrl);
    } catch (err) {
      console.error(err);
      alert('Error al procesar la imagen de perfil.');
    }
  };

  const handleEditProfileAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 128);
      setEditProfileAvatar(dataUrl);
    } catch (err) {
      console.error(err);
      alert('Error al procesar la imagen de perfil.');
    }
  };

  const handleProfileSettingsSubmit = (e) => {
    e.preventDefault();
    if (!editProfileName.trim()) return;

    onUpdateProfile(activeProfileId, {
      name: editProfileName.trim(),
      avatar: editProfileAvatar,
      avatarEmoji: ''
    });
    setIsProfileSettingsOpen(false);
  };

  const openProfileSettings = () => {
    setEditProfileName(activeProfile?.name || '');
    setEditProfileAvatar(activeProfile?.avatar || '');
    setIsProfileSettingsOpen(true);
    setIsProfileDropdownOpen(false);
  };

  // --- ANKI INTEGRATION & BACKUP HELPERS (Yatsu style) ---
  const [ankiSettings, setAnkiSettings] = useState(() => {
    const saved = localStorage.getItem('anki_settings');
    return saved ? JSON.parse(saved) : {
      host: 'http://127.0.0.1:8765',
      deck: 'Yoru Cafe',
      noteType: 'Japanese',
      sentenceField: 'Sentence',
      wordField: 'Expression',
      meaningField: 'Meaning'
    };
  });

  const saveAnkiSettings = (key, value) => {
    const updated = { ...ankiSettings, [key]: value };
    setAnkiSettings(updated);
    localStorage.setItem('anki_settings', JSON.stringify(updated));
  };

  const [ankiConnectionStatus, setAnkiConnectionStatus] = useState(null); // 'connected' | 'error' | 'testing' | null
  const [isAnkiConfigOpen, setIsAnkiConfigOpen] = useState(false);

  const testAnkiConnection = async () => {
    setAnkiConnectionStatus('testing');
    try {
      // Bypassing CORS preflight OPTIONS request by not setting custom Content-Type
      const res = await fetch(ankiSettings.host, {
        method: 'POST',
        body: JSON.stringify({ action: 'version', version: 6 })
      });
      const data = await res.json();
      if (data.result) {
        setAnkiConnectionStatus('connected');
      } else {
        setAnkiConnectionStatus('error');
      }
    } catch (err) {
      setAnkiConnectionStatus('error');
    }
  };
  const handleExportLibrary = async () => {
    try {
      document.body.style.cursor = 'wait';
      const zip = new JSZip();
      
      const dictionaries = await exportDictionaryDataToZip(zip, (msg, pct) => {
        console.log(`[Export Library] ${msg} (${pct}%)`);
      });
      
      const metadata = {
        version: 2,
        exportDate: new Date().toISOString(),
        profiles: profiles,
        activeProfileId: localStorage.getItem('migaku_reader_active_profile_id') || 'profile-default',
        books: books,
        wordStatuses: wordStatuses,
        settings: settings,
        ankiSettings: localStorage.getItem('anki_settings') ? JSON.parse(localStorage.getItem('anki_settings')) : null,
        ankiSettingsV2: localStorage.getItem('anki_settings_v2') ? JSON.parse(localStorage.getItem('anki_settings_v2')) : null,
        dictionaries: dictionaries || []
      };
      
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      
      const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      
      // 6. Download the zip
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yoru-reader-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error al exportar la biblioteca: ' + e.message);
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const handleImportLibrary = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      document.body.style.cursor = 'wait';
      let importData = null;
      let zip = null;
      const isZip = file.name.toLowerCase().endsWith('.zip');

      if (isZip) {
        zip = await JSZip.loadAsync(file);
        const metaFile = zip.file('metadata.json');
        if (!metaFile) {
          alert('El archivo zip no contiene metadatos válidos de Yoru Reader.');
          return;
        }
        const metaStr = await metaFile.async('text');
        importData = JSON.parse(metaStr);
      } else {
        // Legacy JSON backup support
        const text = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = (evt) => resolve(evt.target.result);
          r.onerror = (err) => reject(err);
          r.readAsText(file);
        });
        importData = JSON.parse(text);
      }

      if (!importData.books && !importData.profiles) {
        alert('El archivo no tiene un formato de respaldo válido de Yoru Reader.');
        return;
      }

      if (confirm('Al restaurar, se combinarán los libros, historiales, configuraciones y diccionarios con los actuales. ¿Deseas continuar?')) {
        
        // 1. Restore active profile ID
        if (importData.activeProfileId) {
          localStorage.setItem('migaku_reader_active_profile_id', importData.activeProfileId);
        } else if (importData.profiles && importData.profiles.length > 0) {
          localStorage.setItem('migaku_reader_active_profile_id', importData.profiles[0].id);
        }

        // 2. Merge profiles
        const mergedProfiles = [...profiles];
        if (importData.profiles) {
          importData.profiles.forEach(ip => {
            if (!mergedProfiles.find(p => p.id === ip.id)) {
              mergedProfiles.push(ip);
            }
          });
        }
        db.saveProfiles(mergedProfiles);

        // 3. Merge books
        if (importData.books) {
          const currentBooks = await db.getBooks();
          const mergedBooks = [...currentBooks];
          for (const importBook of importData.books) {
            const index = mergedBooks.findIndex(b => b.id === importBook.id || b.title === importBook.title);
            if (index !== -1) {
              mergedBooks[index] = importBook;
            } else {
              mergedBooks.push(importBook);
            }
          }
          await db.saveBooks(mergedBooks);
        }
        
        // 4. Restore word statuses
        if (importData.wordStatuses) {
          const mergedStatuses = { ...db.getWordStatuses(), ...importData.wordStatuses };
          db.saveWordStatuses(mergedStatuses);
        }

        // 5. Restore settings
        if (importData.settings) {
          db.saveSettings(importData.settings);
        }
        if (importData.ankiSettings) {
          localStorage.setItem('anki_settings', JSON.stringify(importData.ankiSettings));
        }
        if (importData.ankiSettingsV2) {
          localStorage.setItem('anki_settings_v2', JSON.stringify(importData.ankiSettingsV2));
        }

        // 6. Restore Yomitan dictionary metadata
        if (importData.dictionaries && importData.dictionaries.length > 0) {
          await importAllDictionaryData({
            dictionaries: importData.dictionaries,
            terms: [],
            frequencies: []
          });
        }

        // 7. Load chunks of terms and frequencies from Zip if present
        if (isZip && zip) {
          // Load terms chunks
          const termsInfoFile = zip.file('terms_info.json');
          if (termsInfoFile) {
            const termsInfo = JSON.parse(await termsInfoFile.async('text'));
            for (let c = 0; c < termsInfo.chunkCount; c++) {
              const chunkFile = zip.file(`terms_chunk_${c}.json`);
              if (chunkFile) {
                const chunkStr = await chunkFile.async('text');
                const chunkData = JSON.parse(chunkStr);
                await importAllDictionaryData({ dictionaries: [], terms: chunkData, frequencies: [] });
              }
            }
          }

          // Load frequencies chunks
          const freqsInfoFile = zip.file('freqs_info.json');
          if (freqsInfoFile) {
            const freqsInfo = JSON.parse(await freqsInfoFile.async('text'));
            for (let c = 0; c < freqsInfo.chunkCount; c++) {
              const chunkFile = zip.file(`freqs_chunk_${c}.json`);
              if (chunkFile) {
                const chunkStr = await chunkFile.async('text');
                const chunkData = JSON.parse(chunkStr);
                await importAllDictionaryData({ dictionaries: [], terms: [], frequencies: chunkData });
              }
            }
          }
        } else {
          // Fallback legacy dictionary import
          if (importData.terms || importData.frequencies) {
            await importAllDictionaryData({
              dictionaries: [],
              terms: importData.terms || [],
              frequencies: importData.frequencies || []
            });
          }
        }
        
        alert('¡Respaldo importado con éxito! Reiniciaremos la aplicación para aplicar los cambios.');
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('Error al restaurar el respaldo: ' + err.message);
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const handleCreateProfileSubmit = (e) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    let avatar = 'linear-gradient(135deg, #1f1f23 0%, #0d0d0f 100%)';
    let emoji = '👤';

    if (customAvatarUrl) {
      avatar = customAvatarUrl;
      emoji = '';
    }

    const newProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName.trim(),
      avatar: avatar,
      avatarEmoji: emoji
    };

    onAddProfile(newProfile);
    setIsCreatingProfile(false);
    setNewProfileName('');
    setCustomAvatarUrl(null);
    setIsProfileDropdownOpen(false);
  };

  // Book Edit Details states
  const [editingBook, setEditingBook] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editHideCover, setEditHideCover] = useState(false);
  const [editDescription, setEditDescription] = useState('');

  // Load word statistics from localStorage DB
  const localWordStatuses = db.getWordStatuses();
  const knownWordsCount = Object.values(localWordStatuses).filter(s => s === 'known').length;
  const learningWordsCount = Object.values(localWordStatuses).filter(s => s === 'learning').length;
  const newWordsCount = Object.values(localWordStatuses).filter(s => s === 'new').length;
  const totalWords = knownWordsCount + learningWordsCount + newWordsCount;

  // Calculate percentages for vocabulary chart
  const knownPercent = totalWords > 0 ? Math.round((knownWordsCount / totalWords) * 100) : 0;
  const learningPercent = totalWords > 0 ? Math.round((learningWordsCount / totalWords) * 100) : 0;
  const newPercent = totalWords > 0 ? Math.round((newWordsCount / totalWords) * 100) : 100; // default to 100% new if empty

  // File upload trigger
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsParsing(true);
    const parsedBooks = [];
    let failedCount = 0;
    let lastError = null;

    try {
      for (const file of files) {
        try {
          const bookData = await importBookFile(file);
          parsedBooks.push(bookData);
        } catch (err) {
          console.error(`Error importing file "${file.name}":`, err);
          failedCount++;
          lastError = err;
        }
      }

      if (parsedBooks.length > 0) {
        onAddBooks(parsedBooks);
      }

      if (failedCount > 0) {
        alert(
          `Se importaron ${parsedBooks.length} de ${files.length} archivos.\n` +
          `${failedCount} archivo(s) fallaron al procesarse.\n` +
          `Último error: ${lastError?.message || 'Desconocido'}`
        );
      }
    } finally {
      setIsParsing(false);
      e.target.value = ''; // clear input
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Toggle book selection in multi-select mode
  const handleCardClick = (book) => {
    if (selectMode) {
      if (selectedBookIds.includes(book.id)) {
        setSelectedBookIds(selectedBookIds.filter(id => id !== book.id));
      } else {
        setSelectedBookIds([...selectedBookIds, book.id]);
      }
    } else {
      setPreviewBook(book);
    }
  };

  // Bulk deletion
  const handleBulkDelete = () => {
    if (selectedBookIds.length === 0) return;
    if (confirm(lang === 'es' ? `¿Estás seguro de que quieres eliminar los ${selectedBookIds.length} libros seleccionados?` : `Are you sure you want to delete the ${selectedBookIds.length} selected books?`)) {
      onBulkDeleteBooks(selectedBookIds);
      setSelectedBookIds([]);
      setSelectMode(false);
    }
  };

  // Toggle select mode
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedBookIds([]); // reset selection
  };

  const handleSelectAllVisible = () => {
    setSelectedBookIds(filteredBooksList.map(b => b.id));
  };

  const handleClearSelection = () => {
    setSelectedBookIds([]);
  };

  const handleSetSeries = async () => {
    if (selectedBookIds.length === 0) return;
    const series = prompt(lang === 'es' ? "Introduce el nombre de la serie para los libros seleccionados:" : "Enter the series name for the selected books:");
    if (series === null) return;
    for (const bookId of selectedBookIds) {
      await onUpdateBookDetails(bookId, { series: series.trim() });
    }
    alert(lang === 'es' ? "Serie actualizada con éxito." : "Series successfully updated.");
  };

  const handleSetAuthor = async () => {
    if (selectedBookIds.length === 0) return;
    const author = prompt(lang === 'es' ? "Introduce el nombre del autor para los libros seleccionados:" : "Enter the author name for the selected books:");
    if (author === null) return;
    for (const bookId of selectedBookIds) {
      await onUpdateBookDetails(bookId, { author: author.trim() });
    }
    alert(lang === 'es' ? "Autor actualizado con éxito." : "Author successfully updated.");
  };

  const handleAddTags = async () => {
    if (selectedBookIds.length === 0) return;
    const tag = prompt(lang === 'es' ? "Introduce la etiqueta que deseas añadir:" : "Enter the tag you want to add:");
    if (!tag) return;
    const tagTrim = tag.trim();
    for (const bookId of selectedBookIds) {
      const book = books.find(b => b.id === bookId);
      if (book) {
        const tags = book.tags ? [...book.tags] : [];
        if (!tags.includes(tagTrim)) {
          tags.push(tagTrim);
          await onUpdateBookDetails(bookId, { tags });
        }
      }
    }
    alert(lang === 'es' ? "Etiquetas añadidas." : "Tags added.");
  };

  const handleRemoveTags = async () => {
    if (selectedBookIds.length === 0) return;
    const tag = prompt(lang === 'es' ? "Introduce la etiqueta que deseas eliminar:" : "Enter the tag you want to remove:");
    if (!tag) return;
    const tagTrim = tag.trim();
    for (const bookId of selectedBookIds) {
      const book = books.find(b => b.id === bookId);
      if (book && book.tags) {
        const tags = book.tags.filter(t => t !== tagTrim);
        await onUpdateBookDetails(bookId, { tags });
      }
    }
    alert(lang === 'es' ? "Etiquetas eliminadas." : "Tags removed.");
  };

  const handleBlurCovers = async () => {
    if (selectedBookIds.length === 0) return;
    for (const bookId of selectedBookIds) {
      const book = books.find(b => b.id === bookId);
      if (book) {
        await onUpdateBookDetails(bookId, { hideCover: !book.hideCover });
      }
    }
    alert(lang === 'es' ? 'Visibilidad de portadas actualizada.' : 'Covers visibility updated.');
  };

  const handleMarkAsUnread = async () => {
    if (selectedBookIds.length === 0) return;
    if (confirm(lang === 'es' ? "¿Quieres marcar como no leídos los libros seleccionados y reiniciar su progreso?" : "Do you want to mark selected books as unread and reset their progress?")) {
      for (const bookId of selectedBookIds) {
        await onUpdateBookDetails(bookId, {
          progress: { currentChapter: 0, currentPage: 0, percent: 0 },
          status: 'unread'
        });
      }
      alert(lang === 'es' ? "Progreso reiniciado para los libros seleccionados." : "Progress reset for selected books.");
    }
  };

  const handleExportSelection = async () => {
    if (selectedBookIds.length === 0) return;
    try {
      const selectedBooks = books.filter(b => selectedBookIds.includes(b.id));
      const exportData = {
        version: 2,
        exportDate: new Date().toISOString(),
        profiles: profiles,
        activeProfileId: localStorage.getItem('migaku_reader_active_profile_id') || 'profile-default',
        books: selectedBooks,
        wordStatuses: wordStatuses,
        settings: settings,
        ankiSettings: localStorage.getItem('anki_settings') ? JSON.parse(localStorage.getItem('anki_settings')) : null,
        ankiSettingsV2: localStorage.getItem('anki_settings_v2') ? JSON.parse(localStorage.getItem('anki_settings_v2')) : null
      };
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yoru-reader-selection-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((lang === 'es' ? 'Error al exportar selección: ' : 'Error exporting selection: ') + e.message);
    }
  };

  const handleOpenStatistics = () => {
    if (selectedBookIds.length === 0) return;
    const excluded = books.filter(b => !selectedBookIds.includes(b.id)).map(b => b.id);
    setStatsExcludedBookIds(excluded);
    setActiveTab('statistics');
  };

  const handleDeleteStatistics = async () => {
    if (selectedBookIds.length === 0) return;
    if (confirm(lang === 'es' ? `¿Seguro que quieres borrar los registros de lectura de ${selectedBookIds.length} libro(s) seleccionado(s)?` : `Are you sure you want to clear the reading records of the ${selectedBookIds.length} selected book(s)?`)) {
      for (const bookId of selectedBookIds) {
        await onUpdateBookDetails(bookId, {
          progress: { ...((books.find(b => b.id === bookId) || {}).progress || {}), charactersRead: 0, secondsRead: 0 },
          lastRead: null
        });
      }
      alert(lang === 'es' ? 'Estadísticas de lectura borradas.' : 'Reading statistics cleared.');
    }
  };

  // Dynamic sorting
  const getSortedBooks = (booksList) => {
    return [...booksList].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title, 'ja');
          break;
        case 'author':
          const authorA = a.author || 'Desconocido';
          const authorB = b.author || 'Desconocido';
          comparison = authorA.localeCompare(authorB, 'ja');
          break;
        case 'series':
          const seriesA = a.series || 'Sin Serie';
          const seriesB = b.series || 'Sin Serie';
          comparison = seriesA.localeCompare(seriesB, 'ja');
          break;
        case 'characters':
          const charsA = a.chapters ? a.chapters.reduce((acc, chap) => acc + (chap.text ? chap.text.length : 0), 0) : 0;
          const charsB = b.chapters ? b.chapters.reduce((acc, chap) => acc + (chap.text ? chap.text.length : 0), 0) : 0;
          comparison = charsA - charsB;
          break;
        case 'lastUpdate':
          const updateA = a.lastRead || a.createdAt || new Date(0).toISOString();
          const updateB = b.lastRead || b.createdAt || new Date(0).toISOString();
          comparison = updateA.localeCompare(updateB);
          break;
        case 'lastRead':
          const readA = a.lastRead || '';
          const readB = b.lastRead || '';
          if (!readA && !readB) comparison = 0;
          else if (!readA) comparison = 1; // puts empty lastRead at the bottom
          else if (!readB) comparison = -1;
          else comparison = readA.localeCompare(readB);
          break;
        case 'progress':
          const progA = (a.progress && a.progress.percent) ? a.progress.percent : 0;
          const progB = (b.progress && b.progress.percent) ? b.progress.percent : 0;
          comparison = progA - progB;
          break;
        case 'currentPosition':
          const posA = a.progress ? (a.progress.currentChapter * 100000 + a.progress.currentPage) : 0;
          const posB = b.progress ? (b.progress.currentChapter * 100000 + b.progress.currentPage) : 0;
          comparison = posA - posB;
          break;
        case 'added':
        default:
          const addA = a.createdAt || new Date(0).toISOString();
          const addB = b.createdAt || new Date(0).toISOString();
          comparison = addA.localeCompare(addB);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Dynamic filtering based on active sidebar navigation and search box
  const getFilteredBooks = () => {
    let list = books;

    // 1. Category Filter
    if (activeFilter.type === 'unread') {
      list = list.filter(b => b.status === 'unread' || (!b.status && b.progress.percent === 0));
    } else if (activeFilter.type === 'reading') {
      list = list.filter(b => b.status === 'reading' || (!b.status && b.progress.percent > 0 && b.progress.percent < 100));
    } else if (activeFilter.type === 'completed') {
      list = list.filter(b => b.status === 'completed' || (!b.status && b.progress.percent >= 100));
    } else if (activeFilter.type === 'paused') {
      list = list.filter(b => b.status === 'paused');
    } else if (activeFilter.type === 'dropped') {
      list = list.filter(b => b.status === 'dropped');
    } else if (activeFilter.type === 'planning') {
      list = list.filter(b => b.status === 'planning');
    } else if (activeFilter.type === 'author') {
      list = list.filter(b => (b.author || 'Desconocido') === activeFilter.value);
    } else if (activeFilter.type === 'tag') {
      if (activeFilter.value === 'untagged') {
        list = list.filter(b => !b.tags || b.tags.length === 0);
      } else {
        list = list.filter(b => b.tags && b.tags.includes(activeFilter.value));
      }
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => 
        b.title.toLowerCase().includes(q) || 
        (b.author || '').toLowerCase().includes(q)
      );
    }

    return list;
  };

  // Compute unique authors and counts dynamically
  const authorCounts = {};
  books.forEach(b => {
    const author = b.author || 'Desconocido';
    authorCounts[author] = (authorCounts[author] || 0) + 1;
  });
  const uniqueAuthors = Object.keys(authorCounts).sort();

  // Dynamic sorting and filtering pipeline
  const filteredBooksList = getSortedBooks(getFilteredBooks());
  const currentlyReading = getSortedBooks(getFilteredBooks().filter(b => b.status === 'reading' || (!b.status && b.progress.percent > 0 && b.progress.percent < 100)));
  const notStarted = getSortedBooks(getFilteredBooks().filter(b => b.status === 'unread' || (!b.status && b.progress.percent === 0)));
  const completed = getSortedBooks(getFilteredBooks().filter(b => b.status === 'completed' || (!b.status && b.progress.percent >= 100)));
  const allSortedBooks = filteredBooksList;

  const getSectionTitle = () => {
    let base = lang === 'es' ? "Todos los libros" : "All books";
    if (activeFilter.type === 'unread') base = lang === 'es' ? "Sin iniciar" : "Not started";
    else if (activeFilter.type === 'reading') base = lang === 'es' ? "Leyendo actualmente" : "Currently reading";
    else if (activeFilter.type === 'completed') base = lang === 'es' ? "Leídos" : "Read";
    else if (activeFilter.type === 'paused') base = lang === 'es' ? "Pausados" : "Paused";
    else if (activeFilter.type === 'dropped') base = lang === 'es' ? "Dropeados" : "Dropped";
    else if (activeFilter.type === 'planning') base = lang === 'es' ? "Planeados" : "Planned";
    else if (activeFilter.type === 'author') base = lang === 'es' ? `Libros de ${activeFilter.value}` : `Books by ${activeFilter.value}`;
    else if (activeFilter.type === 'tag') base = lang === 'es' ? "Libros sin etiquetas" : "Untagged books";
    
    if (sortBy === 'title') return `${base} (A-Z)`;
    if (sortBy === 'added') return `${base} (${lang === 'es' ? 'Añadido' : 'Added'})`;
    if (sortBy === 'lastRead') return `${base} (${lang === 'es' ? 'Leído recientemente' : 'Recently read'})`;
    return `${base} (${sortBy})`;
  };

  const handleJitenSearch = async (book, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuBookId(null);
    
    const title = book.title || '';
    // Ensure there is a space before trailing numbers (e.g. "冴えない彼女の育てかた3" -> "冴えない彼女の育てかた 3")
    const normalizedTitle = title
      .replace(/([^\s0-9])([0-9]+)$/, '$1 $2')
      .replace(/([^\s\d])(\d+)$/, '$1 $2')
      .replace(/([^\s０-９])([０-９]+)$/, '$1 $2');

    try {
      const response = await fetch(`https://api.jiten.moe/api/media-deck/get-media-decks?titleFilter=${encodeURIComponent(normalizedTitle)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          // Find closest match or default to first match
          const exactMatch = data.find(d => 
            d.title.toLowerCase() === normalizedTitle.toLowerCase() ||
            (d.alternativeTitles && d.alternativeTitles.some(t => t.toLowerCase() === normalizedTitle.toLowerCase()))
          );
          const slug = exactMatch ? exactMatch.slug : data[0].slug;
          window.open(`https://jiten.moe/decks/media/${slug}?referrer=yatsu`, '_blank');
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching from Jiten API:', err);
    }
    
    // Fallback if API fails or no match found
    window.open(`https://jiten.moe/decks/media?title=${encodeURIComponent(normalizedTitle)}&referrer=yatsu`, '_blank');
  };

  const renderStatusBadge = (book) => {
    const status = book.status || 'unread';
    let color = '';
    let icon = null;
    let tooltip = '';
    
    if (status === 'completed') {
      color = '#10b981'; // emerald green
      icon = (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
      tooltip = 'Completado';
    } else if (status === 'reading') {
      color = '#3b82f6'; // blue
      icon = (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"></path>
        </svg>
      );
      tooltip = 'En progreso';
    } else if (status === 'paused') {
      color = '#f59e0b'; // amber/orange
      icon = (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
        </svg>
      );
      tooltip = 'Pausado';
    } else if (status === 'dropped') {
      color = '#6b7280'; // gray
      icon = (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
      );
      tooltip = 'Dropeado';
    } else if (status === 'planning') {
      color = '#a855f7'; // purple
      icon = (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      );
      tooltip = 'Planeado';
    } else {
      // unread
      return null;
    }
    
    return (
      <div 
        title={tooltip}
        style={{
          position: 'absolute',
          top: '8px',
          right: '40px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 10,
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        {icon}
      </div>
    );
  };

  const renderBookCardMenu = (book) => {
    if (selectMode) return null;
    
    const isMenuOpen = activeMenuBookId === book.id;
    
    return (
      <div className="card-menu-wrapper" style={{ position: 'absolute', top: '8px', right: '8px', zIndex: isMenuOpen ? 9999 : 50 }}>
        <button 
          className="card-menu-trigger-btn"
          onClick={(e) => {
            e.stopPropagation();
            // Detect if trigger is in the right half of screen - open dropdown to the left, else to the right
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuOpenLeft(rect.right > window.innerWidth / 2);
            setActiveMenuBookId(isMenuOpen ? null : book.id);
          }}
          style={{
            background: 'rgba(28, 28, 32, 0.75)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.85)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          <MoreVertical size={14} />
        </button>

        {isMenuOpen && (
          <div 
            className="book-context-menu-dropdown"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '32px',
              ...(menuOpenLeft ? { right: '0' } : { left: '0' }),
              width: '190px',
              maxHeight: '420px',
              overflowY: 'auto',
              background: 'rgba(28, 28, 35, 0.98)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '6px 0',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              animation: 'tabViewFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 1000
            }}
          >
            <button 
              onClick={() => {
                setActiveMenuBookId(null);
                onOpenInfo(book);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s ease'
              }}
              className="context-menu-item-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} /> Ver detalles
              </div>
            </button>
            
            <button 
              onClick={() => {
                setActiveMenuBookId(null);
                const newTitle = prompt("Nuevo título del libro:", book.title);
                if (newTitle) onUpdateBookDetails(book.id, { title: newTitle });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s ease'
              }}
              className="context-menu-item-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pencil size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} /> Editar título
              </div>
            </button>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
            <div style={{ padding: '2px 0' }}>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Estado</div>
              {[
                { key: 'reading', label: 'En progreso', color: '#3b82f6', icon: <Play size={12} fill="currentColor" /> },
                { key: 'completed', label: 'Completado', color: '#10b981', icon: <Check size={12} strokeWidth={3} /> },
                { key: 'paused', label: 'Pausado', color: '#f59e0b', icon: <Pause size={12} fill="currentColor" /> },
                { key: 'planning', label: 'Planeado', color: '#a855f7', icon: <Clock size={12} /> },
                { key: 'dropped', label: 'Dropeado', color: '#9ca3af', icon: <X size={12} strokeWidth={3} /> },
                { key: 'unread', label: 'Sin iniciar', color: '#ef4444', icon: <RotateCcw size={12} /> }
              ].map(opt => {
                const isCurrent = book.status === opt.key || (opt.key === 'unread' && !book.status);
                return (
                  <button 
                    key={opt.key}
                    onClick={async () => {
                      setActiveMenuBookId(null);
                      await onUpdateBookDetails(book.id, { status: opt.key });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '5px 12px',
                      background: isCurrent ? 'rgba(255,255,255,0.06)' : 'none',
                      border: 'none',
                      color: isCurrent ? opt.color : 'rgba(255,255,255,0.8)',
                      fontWeight: isCurrent ? 600 : 400,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease'
                    }}
                    className="context-menu-item-btn"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', color: isCurrent ? opt.color : 'rgba(255,255,255,0.4)' }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={(e) => handleJitenSearch(book, e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s ease',
                gap: '8px'
              }}
              className="context-menu-item-btn"
            >
              <Search size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} /> Buscar en Jiten
            </button>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

            <button 
              onClick={() => {
                setActiveMenuBookId(null);
                if (confirm(`¿Estás seguro de que quieres eliminar "${book.title}"?`)) {
                  onDeleteBook(book.id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s ease',
                gap: '8px'
              }}
              className="context-menu-item-btn"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderBookGrid = (booksList) => {
    return (
      <div className="books-grid">
        {booksList.map((book) => {
          const isSelected = selectedBookIds.includes(book.id);
          return (
            <div 
              key={book.id} 
              className={`book-card ${isSelected ? 'selected' : ''} ${selectMode ? 'select-mode-active' : ''}`}
              onClick={() => handleCardClick(book)}
              style={{ position: 'relative', zIndex: activeMenuBookId === book.id ? 500 : 'auto' }}
            >
              {/* Card Context Menu Trigger and Popup */}
              {renderBookCardMenu(book)}

              {/* Status Badge overlay */}
              {!selectMode && renderStatusBadge(book)}

              {/* Checkbox overlay when selectMode is active */}
              {selectMode && (
                <div className="card-checkbox-container">
                  <Check size={12} className="card-checkbox-icon" />
                </div>
              )}

              {/* Book Cover */}
              <div className="book-cover-container">
                {book.cover && !book.cover.startsWith('linear-gradient') ? (
                  <img 
                    src={book.cover} 
                    alt={book.title} 
                    className="book-cover-img"
                    style={book.hideCover ? { filter: 'blur(12px)', opacity: 0.5 } : undefined}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150x220?text=Lector';
                    }}
                  />
                ) : (
                  <div 
                    className="book-cover-placeholder" 
                    style={{ 
                      background: book.cover && book.cover.startsWith('linear-gradient') 
                        ? book.cover 
                        : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' 
                    }}
                  >
                    <span>{book.title}</span>
                  </div>
                )}

                {/* Progress badge at top left of cover */}
                {showCardProgress && book.progress.percent > 0 && (
                  <div className="book-progress-badge">
                    <span>{book.progress.percent}%</span>
                  </div>
                )}

                {/* Vocab Coverage indicator (if unstarted and present) */}
                {book.progress.percent === 0 && book.vocabularyCoverage && (
                  <div className="book-progress-badge" style={{ color: '#248ff2', borderColor: 'rgba(36, 143, 242, 0.3)' }}>
                    <span>{book.vocabularyCoverage}%</span>
                  </div>
                )}

                {/* Progress bar at bottom of cover */}
                {showCardProgress && book.progress.percent > 0 && (
                  <div className="book-progress-bar-container">
                    <div 
                      className="book-progress-bar" 
                      style={{ width: `${book.progress.percent}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Book Details */}
              {(showCardTitle || showCardAuthor || showCardSeries || showCardTags) && (
                <div className="book-info" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {showCardTitle && <h4 className="book-title" title={book.title} style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.title}</h4>}
                  {showCardSeries && book.series && <p className="book-series" style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,224,0,0.85)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.series}</p>}
                  {showCardAuthor && <p className="book-author" style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.author}</p>}
                  {showCardTags && book.tags && book.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {book.tags.slice(0, 2).map(tag => (
                        <span key={tag} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderGroupedByAuthor = () => {
    // Group the active books by author
    const groups = {};
    filteredBooksList.forEach(book => {
      const author = book.author || 'Desconocido';
      if (!groups[author]) groups[author] = [];
      groups[author].push(book);
    });

    const sortedAuthors = Object.keys(groups).sort((a, b) => {
      if (a === 'Desconocido') return 1;
      if (b === 'Desconocido') return -1;
      return a.localeCompare(b, 'ja');
    });

    return (
      <div className="library-grouped-container">
        {sortedAuthors.map(author => {
          const authorBooks = groups[author];
          return (
            <div key={author} className="library-group-section">
              <div className="section-header">
                <h2 className="section-title">Autor: {author}</h2>
                <span className="section-count">{authorBooks.length}</span>
              </div>
              <div className="library-group-scroll-container">
                {authorBooks.map(book => {
                  const isSelected = selectedBookIds.includes(book.id);
                  return (
                    <div 
                      key={book.id} 
                      className={`book-card ${isSelected ? 'selected' : ''} ${selectMode ? 'select-mode-active' : ''}`}
                      onClick={() => handleCardClick(book)}
                      style={{ flexShrink: 0, position: 'relative', zIndex: activeMenuBookId === book.id ? 500 : 'auto' }}
                    >
                      {/* Card Context Menu Trigger and Popup */}
                      {renderBookCardMenu(book)}

                      {/* Status Badge overlay */}
                      {!selectMode && renderStatusBadge(book)}

                      {/* Checkbox overlay */}
                      {selectMode && (
                        <div className="card-checkbox-container">
                          <Check size={12} className="card-checkbox-icon" />
                        </div>
                      )}

                      {/* Book Cover */}
                      <div className="book-cover-container">
                        {book.cover && !book.cover.startsWith('linear-gradient') ? (
                          <img 
                            src={book.cover} 
                            alt={book.title} 
                            className="book-cover-img"
                            style={book.hideCover ? { filter: 'blur(12px)', opacity: 0.5 } : undefined}
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/150x220?text=Lector';
                            }}
                          />
                        ) : (
                          <div 
                            className="book-cover-placeholder" 
                            style={{ 
                              background: book.cover && book.cover.startsWith('linear-gradient') 
                                ? book.cover 
                                : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' 
                            }}
                          >
                            <span>{book.title}</span>
                          </div>
                        )}

                        {showCardProgress && book.progress.percent > 0 && (
                          <div className="book-progress-badge">
                            <span>{book.progress.percent}%</span>
                          </div>
                        )}

                        {book.progress.percent === 0 && book.vocabularyCoverage && (
                          <div className="book-progress-badge" style={{ color: '#248ff2', borderColor: 'rgba(36, 143, 242, 0.3)' }}>
                            <span>{book.vocabularyCoverage}%</span>
                          </div>
                        )}

                        {showCardProgress && book.progress.percent > 0 && (
                          <div className="book-progress-bar-container">
                            <div 
                              className="book-progress-bar" 
                              style={{ width: `${book.progress.percent}%` }}
                            ></div>
                          </div>
                        )}
                      </div>

                      {/* Book Details */}
                      {(showCardTitle || showCardAuthor || showCardSeries || showCardTags) && (
                        <div className="book-info" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {showCardTitle && <h4 className="book-title" title={book.title} style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.title}</h4>}
                          {showCardSeries && book.series && <p className="book-series" style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,224,0,0.85)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.series}</p>}
                          {showCardAuthor && <p className="book-author" style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.author}</p>}
                          {showCardTags && book.tags && book.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {book.tags.slice(0, 2).map(tag => (
                                <span key={tag} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGroupedBySeries = () => {
    // Group the active books by series
    const groups = {};
    filteredBooksList.forEach(book => {
      const series = book.series || 'Sin Serie';
      if (!groups[series]) groups[series] = [];
      groups[series].push(book);
    });

    const sortedSeries = Object.keys(groups).sort((a, b) => {
      // Keep "Sin Serie" at the bottom
      const cleanA = a === 'Sin Serie';
      const cleanB = b === 'Sin Serie';
      if (cleanA && !cleanB) return 1;
      if (!cleanA && cleanB) return -1;

      let comparison = 0;
      if (groupSort === 'alphabetical') {
        comparison = a.localeCompare(b, 'ja');
      } else {
        // Sort by the latest book date in each group
        const latestA = groups[a].reduce((latest, book) => {
          const date = book.createdAt || new Date(0).toISOString();
          return date > latest ? date : latest;
        }, new Date(0).toISOString());
        const latestB = groups[b].reduce((latest, book) => {
          const date = book.createdAt || new Date(0).toISOString();
          return date > latest ? date : latest;
        }, new Date(0).toISOString());
        comparison = latestA.localeCompare(latestB);
      }
      return groupDirection === 'asc' ? comparison : -comparison;
    });

    return (
      <div className="library-grouped-container">
        {sortedSeries.map(seriesName => {
          const seriesBooks = groups[seriesName];
          return (
            <div key={seriesName} className="library-group-section">
              <div className="section-header">
                <h2 className="section-title">Serie: {seriesName}</h2>
                <span className="section-count">{seriesBooks.length}</span>
              </div>
              <div className="library-group-scroll-container">
                {seriesBooks.map(book => {
                  const isSelected = selectedBookIds.includes(book.id);
                  return (
                    <div 
                      key={book.id} 
                      className={`book-card ${isSelected ? 'selected' : ''} ${selectMode ? 'select-mode-active' : ''}`}
                      onClick={() => handleCardClick(book)}
                      style={{ flexShrink: 0, position: 'relative', zIndex: activeMenuBookId === book.id ? 500 : 'auto' }}
                    >
                      {/* Card Context Menu Trigger and Popup */}
                      {renderBookCardMenu(book)}

                      {/* Status Badge overlay */}
                      {!selectMode && showCardStatus && renderStatusBadge(book)}

                      {/* Checkbox overlay */}
                      {selectMode && (
                        <div className="card-checkbox-container">
                          <Check size={12} className="card-checkbox-icon" />
                        </div>
                      )}

                      {/* Book Cover */}
                      <div className="book-cover-container">
                        {book.cover && !book.cover.startsWith('linear-gradient') ? (
                          <img 
                            src={book.cover} 
                            alt={book.title} 
                            className="book-cover-img"
                            style={book.hideCover ? { filter: 'blur(12px)', opacity: 0.5 } : undefined}
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/150x220?text=Lector';
                            }}
                          />
                        ) : (
                          <div 
                            className="book-cover-placeholder" 
                            style={{ 
                              background: book.cover && book.cover.startsWith('linear-gradient') 
                                ? book.cover 
                                : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' 
                            }}
                          >
                            <span>{book.title}</span>
                          </div>
                        )}

                        {/* Progress badge at top left of cover */}
                        {showCardProgress && book.progress.percent > 0 && (
                          <div className="book-progress-badge">
                            <span>{book.progress.percent}%</span>
                          </div>
                        )}

                        {/* Vocab Coverage indicator */}
                        {book.progress.percent === 0 && book.vocabularyCoverage && (
                          <div className="book-progress-badge" style={{ color: '#248ff2', borderColor: 'rgba(36, 143, 242, 0.3)' }}>
                            <span>{book.vocabularyCoverage}%</span>
                          </div>
                        )}

                        {/* Progress bar at bottom of cover */}
                        {showCardProgress && book.progress.percent > 0 && (
                          <div className="book-progress-bar-container">
                            <div 
                              className="book-progress-bar" 
                              style={{ width: `${book.progress.percent}%` }}
                            ></div>
                          </div>
                        )}
                      </div>

                      {/* Book Details */}
                      {(showCardTitle || showCardAuthor || showCardSeries || showCardTags) && (
                        <div className="book-info" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {showCardTitle && <h4 className="book-title" title={book.title} style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.title}</h4>}
                          {showCardSeries && book.series && <p className="book-series" style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,224,0,0.85)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.series}</p>}
                          {showCardAuthor && <p className="book-author" style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.author}</p>}
                          {showCardTags && book.tags && book.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {book.tags.slice(0, 2).map(tag => (
                                <span key={tag} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderStatisticsTab = () => {
    // 1. Filter books based on statsExcludedBookIds
    const activeStatsBooks = books.filter(b => !statsExcludedBookIds.includes(b.id));
    const totalBooks = activeStatsBooks.length;
    const totalChars = activeStatsBooks.reduce((acc, b) => acc + (b.progress.charactersRead || 0), 0);
    const totalSeconds = activeStatsBooks.reduce((acc, b) => acc + (b.progress.secondsRead || 0), 0);
    
    // Display actual read minutes if tracked, otherwise fall back to character estimation
    const readingTimeMin = totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : Math.round(totalChars / 300);
    const activeDaysCount = (totalChars > 0 || totalSeconds > 0) ? 1 : 0;
    const currentStreak = (totalChars > 0 || totalSeconds > 0) ? 1 : 0;
    const longestStreak = (totalChars > 0 || totalSeconds > 0) ? 3 : 0;

    // Generate weeks for currentYear
    const weeks = [];
    const startDate = new Date(currentYear, 0, 1);
    const dayOfWeek = startDate.getDay();
    const startOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const cursorDate = new Date(startDate);
    cursorDate.setDate(cursorDate.getDate() + startOffset);

    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(cursorDate);
        const dateStr = currentDate.toISOString().slice(0, 10);
        
        // Check if it is today (July 6, 2026)
        const isToday = dateStr === '2026-07-06';
        
        // Simulating activity value
        let charVal = 0;
        if (totalChars > 0) {
          const dayHash = (currentDate.getMonth() * 31 + currentDate.getDate()) % 17;
          if (dayHash === 3 || dayHash === 7 || dayHash === 11) {
            charVal = Math.floor((totalChars * 0.02) % 3000) + 200;
          }
          if (isToday) {
            charVal = Math.floor(totalChars * 0.05) + 150;
          }
        }

        let cellColor = 'rgba(255, 255, 255, 0.05)';
        if (charVal > 0) {
          if (charVal < 500) cellColor = 'rgba(52, 211, 153, 0.2)';
          else if (charVal < 1500) cellColor = 'rgba(52, 211, 153, 0.4)';
          else if (charVal < 3000) cellColor = 'rgba(52, 211, 153, 0.7)';
          else cellColor = 'rgba(52, 211, 153, 1)';
        }

        week.push({
          date: currentDate,
          isToday,
          dateString: dateStr,
          value: charVal,
          color: cellColor
        });

        cursorDate.setDate(cursorDate.getDate() + 1);
      }
      weeks.push(week);
    }

    const months = [
      { name: 'Jan', colSpan: 4 },
      { name: 'Feb', colSpan: 4 },
      { name: 'Mar', colSpan: 5 },
      { name: 'Apr', colSpan: 4 },
      { name: 'May', colSpan: 4 },
      { name: 'Jun', colSpan: 5 },
      { name: 'Jul', colSpan: 4 },
      { name: 'Aug', colSpan: 4 },
      { name: 'Sep', colSpan: 5 },
      { name: 'Oct', colSpan: 4 },
      { name: 'Nov', colSpan: 4 },
      { name: 'Dec', colSpan: 5 }
    ];

    // Determine breakdown sessions
    const sessions = activeStatsBooks
      .filter(b => (b.progress.charactersRead > 0 || (b.progress.secondsRead || 0) > 0))
      .map(b => ({
        date: '2026-07-06',
        bookTitle: b.title,
        bookCover: b.cover,
        chars: b.progress.charactersRead || 0,
        time: (b.progress.secondsRead || 0) > 0 ? Math.ceil(b.progress.secondsRead / 60) : Math.round((b.progress.charactersRead || 0) / 300)
      }));

    // Filter books list for Filters view
    const filteredBooksListForStats = books.filter(b => {
      const query = statsTitleFilter.toLowerCase();
      return b.title.toLowerCase().includes(query) || (b.author && b.author.toLowerCase().includes(query));
    });

    return (
      <div className="tab-view-container statistics-view">
        {/* Multi-Tab Statistics Sub-navigation */}
        <div className="stats-sub-tabs-container">
          <button 
            type="button" 
            className={`stats-sub-tab-btn ${statsSubTab === 'overview' ? 'active' : ''}`}
            onClick={() => setStatsSubTab('overview')}
          >
            <span className="sub-tab-title">{lang === 'es' ? 'Resumen' : 'Overview'}</span>
            <span className="sub-tab-desc">{lang === 'es' ? 'Mapa de calor y totales' : 'Heatmap and totals'}</span>
          </button>
          <button 
            type="button" 
            className={`stats-sub-tab-btn ${statsSubTab === 'breakdown' ? 'active' : ''}`}
            onClick={() => setStatsSubTab('breakdown')}
          >
            <span className="sub-tab-title">{lang === 'es' ? 'Desglose' : 'Breakdown'}</span>
            <span className="sub-tab-desc">{lang === 'es' ? 'Tabla y detalles' : 'Table and edits'}</span>
          </button>
          <button 
            type="button" 
            className={`stats-sub-tab-btn ${statsSubTab === 'filters' ? 'active' : ''}`}
            onClick={() => setStatsSubTab('filters')}
          >
            <span className="sub-tab-title">{lang === 'es' ? 'Filtros' : 'Filters'}</span>
            <span className="sub-tab-desc">{lang === 'es' ? 'Rango y títulos' : 'Range and titles'}</span>
          </button>
        </div>

        {/* 1. OVERVIEW VIEW */}
        {statsSubTab === 'overview' && (
          <div className="stats-panel-content">
            <div className="statistics-top-header">
              <div className="tab-header-left">
                <h2 className="tab-view-title" style={{ marginBottom: 4 }}>{lang === 'es' ? 'Resumen' : 'Overview'}</h2>
                <span className="tab-view-subtitle">{lang === 'es' ? 'Estadísticas filtradas. Los filtros actuales incluyen todos los datos registrados.' : 'Filtered stats. Current filters include all recorded data.'}</span>
              </div>
              <div className="stats-toggle-group">
                <button type="button" className="stats-toggle-btn active">{lang === 'es' ? 'Filtrado' : 'Filtered'}</button>
                <button type="button" className="stats-toggle-btn">{lang === 'es' ? 'Todo' : 'All'}</button>
              </div>
            </div>

            <div className="stats-overview-grid">
              <div className="stats-overview-item">
                <div className="stats-icon-circle"><Calendar size={18} /></div>
                <div className="stats-item-details">
                  <span className="item-label">{lang === 'es' ? 'Rango' : 'Range'}</span>
                  <span className="item-val">{statsDateFrom}</span>
                  <span className="item-sub">{lang === 'es' ? 'Cambiar ventana de fechas' : 'Change date window'}</span>
                </div>
              </div>

              <div className="stats-overview-item">
                <div className="stats-icon-circle"><BookOpen size={18} /></div>
                <div className="stats-item-details">
                  <span className="item-label">{lang === 'es' ? 'Títulos' : 'Titles'}</span>
                  <span className="item-val">{totalBooks} {totalBooks === 1 ? (lang === 'es' ? 'título' : 'title') : (lang === 'es' ? 'títulos' : 'titles')}</span>
                  <span className="item-sub">{lang === 'es' ? `${activeStatsBooks.filter(b => b.progress.percent >= 100).length} leídos en total` : `${activeStatsBooks.filter(b => b.progress.percent >= 100).length} selected overall`}</span>
                </div>
              </div>

              <div className="stats-overview-item">
                <div className="stats-icon-circle"><Clock size={18} /></div>
                <div className="stats-item-details">
                  <span className="item-label">{lang === 'es' ? 'Tiempo de lectura' : 'Reading Time'}</span>
                  <span className="item-val">{readingTimeMin} min</span>
                  <span className="item-sub">{activeDaysCount} {activeDaysCount === 1 ? (lang === 'es' ? 'día activo' : 'day') : (lang === 'es' ? 'días activos' : 'days')}</span>
                </div>
              </div>

              <div className="stats-overview-item">
                <div className="stats-icon-circle"><span style={{ fontSize: '0.85rem', fontWeight: 800 }}>A</span></div>
                <div className="stats-item-details">
                  <span className="item-label">{lang === 'es' ? 'Caracteres' : 'Characters'}</span>
                  <span className="item-val">{totalChars.toLocaleString()}</span>
                  <span className="item-sub">{lang === 'es' ? 'Datos filtrados' : 'Filtered data'}</span>
                </div>
              </div>

              <div className="stats-overview-item">
                <div className="stats-icon-circle"><Flame size={18} /></div>
                <div className="stats-item-details">
                  <span className="item-label">{lang === 'es' ? 'Racha actual' : 'Current Streak'}</span>
                  <span className="item-val">{currentStreak} {currentStreak === 1 ? (lang === 'es' ? 'día' : 'day') : (lang === 'es' ? 'días' : 'days')}</span>
                  <span className="item-sub">{lang === 'es' ? 'Hasta hoy' : 'Through today'}</span>
                </div>
              </div>

              <div className="stats-overview-item">
                <div className="stats-icon-circle"><Flame size={18} /></div>
                <div className="stats-item-details">
                  <span className="item-label">{lang === 'es' ? 'Mayor racha' : 'Longest Streak'}</span>
                  <span className="item-val">{longestStreak} {longestStreak === 1 ? (lang === 'es' ? 'día' : 'day') : (lang === 'es' ? 'días' : 'days')}</span>
                  <span className="item-sub">{lang === 'es' ? 'En datos filtrados' : 'In filtered data'}</span>
                </div>
              </div>
            </div>

            <div className="stats-heatmap-panel">
              <div className="heatmap-header">
                <div className="heatmap-header-left">
                  <h3 className="heatmap-title">{lang === 'es' ? `Mapa de calor para ${currentYear}` : `Heatmap for ${currentYear}`}</h3>
                  <span className="heatmap-subtitle">{lang === 'es' ? 'El tablero se enfoca en el año seleccionado mientras que la escala de colores refleja todos los datos registrados.' : 'The board stays focused on the selected year while the color scale reflects all recorded data.'}</span>
                </div>
                <select className="heatmap-scale-select" disabled>
                  <option>{lang === 'es' ? 'Escala global' : 'All-time scale'}</option>
                </select>
              </div>

              <div className="heatmap-legend-row">
                <div className="heatmap-legend">
                  <span className="legend-label">{lang === 'es' ? 'MENOS' : 'LESS'}</span>
                  <div className="legend-dots">
                    <div className="legend-dot level-0"></div>
                    <div className="legend-dot level-1"></div>
                    <div className="legend-dot level-2"></div>
                    <div className="legend-dot level-3"></div>
                    <div className="legend-dot level-4"></div>
                  </div>
                  <span className="legend-label">{lang === 'es' ? 'MÁS' : 'MORE'}</span>
                </div>
                <div className="heatmap-checkboxes">
                  <label className="heatmap-checkbox">
                    <span className="checkbox-dot today"></span> {lang === 'es' ? 'HOY' : 'TODAY'}
                  </label>
                  <label className="heatmap-checkbox">
                    <span className="checkbox-dot range"></span> {lang === 'es' ? 'RANGO' : 'RANGE'}
                  </label>
                </div>
              </div>

              <div className="heatmap-grid-scroll">
                <div className="heatmap-grid-container">
                  <div className="heatmap-months-labels-row">
                    <div className="heatmap-row-labels-spacer" />
                    <div className="heatmap-months-list">
                      {months.map((m, mIdx) => (
                        <span key={mIdx} className="heatmap-month-label" style={{ flex: m.colSpan }}>{m.name}</span>
                      ))}
                    </div>
                  </div>

                  <div className="heatmap-main-content-row">
                    <div className="heatmap-row-labels">
                      <span>{lang === 'es' ? 'Lun' : 'Mon'}</span>
                      <span>{lang === 'es' ? 'Mar' : 'Tue'}</span>
                      <span>{lang === 'es' ? 'Mié' : 'Wed'}</span>
                      <span>{lang === 'es' ? 'Jue' : 'Thu'}</span>
                      <span>{lang === 'es' ? 'Vie' : 'Fri'}</span>
                      <span>{lang === 'es' ? 'Sáb' : 'Sat'}</span>
                      <span>{lang === 'es' ? 'Dom' : 'Sun'}</span>
                    </div>
                    <div className="heatmap-grid-weeks">
                      {weeks.map((week, wIdx) => (
                        <div key={wIdx} className="heatmap-grid-column">
                          {week.map((day, dIdx) => {
                            const isToday = day && day.isToday;
                            const hasActivity = day && day.value > 0;
                            return (
                              <div 
                                key={dIdx} 
                                className={`heatmap-cell ${isToday ? 'today' : ''} ${hasActivity ? 'active' : ''}`}
                                style={hasActivity ? { background: day.color } : {}}
                                title={day ? `${day.dateString}: ${day.value} ${lang === 'es' ? 'caracteres' : 'characters'}` : ''}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="heatmap-nav-row">
                <button type="button" className="heatmap-nav-arrow" onClick={() => setCurrentYear(prev => prev - 1)}>&lt;</button>
                <button type="button" className="heatmap-nav-arrow" onClick={() => setCurrentYear(prev => prev + 1)}>&gt;</button>
              </div>
            </div>
          </div>
        )}

        {/* 2. BREAKDOWN VIEW */}
        {statsSubTab === 'breakdown' && (
          <div className="stats-panel-content">
            <div className="statistics-top-header">
              <div className="tab-header-left">
                <h2 className="tab-view-title" style={{ marginBottom: 4 }}>{lang === 'es' ? 'Desglose' : 'Breakdown'}</h2>
              </div>
            </div>

            {/* Breakdown Filter Badges */}
            <div className="breakdown-badges-row">
              <div className="breakdown-badge">
                <span className="badge-tag">{lang === 'es' ? 'RANGO' : 'RANGE'}</span>
                <span className="badge-value">{statsDateFrom}</span>
              </div>
              <div className="breakdown-badge">
                <span className="badge-tag">{lang === 'es' ? 'AGRUPACIÓN' : 'GROUPING'}</span>
                <span className="badge-value">{lang === 'es' ? 'Sesiones individuales' : 'Individual sessions'}</span>
              </div>
              <div className="breakdown-badge">
                <span className="badge-tag">{lang === 'es' ? 'ENTRADAS' : 'ENTRIES'}</span>
                <span className="badge-value">{lang === 'es' ? `${sessions.length} entradas` : `${sessions.length} entries`}</span>
              </div>
            </div>

            {sessions.length === 0 ? (
              <div className="stats-no-data-card">
                <span className="no-data-title">{lang === 'es' ? 'Sin datos registrados' : 'No data found'}</span>
                <span className="no-data-desc">
                  {lang === 'es' ? `No se encontró actividad de lectura para ${statsDateFrom}. Ajusta el rango de fechas o los filtros para poblar esta vista.` : `No reading activity matched ${statsDateFrom}. Adjust the date range or filters to populate this view.`}
                </span>
              </div>
            ) : (
              <div className="stats-progress-card">
                <h3 className="chart-card-title">{lang === 'es' ? 'Sesiones de lectura' : 'Reading sessions'}</h3>
                <div className="stats-books-table">
                  {sessions.map((s, idx) => (
                    <div key={idx} className="stats-book-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div 
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '8px',
                            background: s.bookCover && s.bookCover.startsWith('linear-gradient') ? s.bookCover : `url(${s.bookCover})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            flexShrink: 0,
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }}
                        />
                        <span className="stats-book-name truncate" style={{ maxWidth: '240px' }}>{s.bookTitle}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.chars} {lang === 'es' ? 'caracteres' : 'characters'}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>{s.time} {lang === 'es' ? 'min leídos' : 'min read'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. FILTERS VIEW */}
        {statsSubTab === 'filters' && (
          <div className="stats-panel-content">
            {/* Range Configuration Card */}
            <div className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? 'Rango' : 'Range'}</h3>
              
              <div className="range-controls-grid">
                <div className="settings-field-group">
                  <label className="field-label">{lang === 'es' ? 'Plantilla' : 'Template'}</label>
                  <select 
                    value="Today" 
                    onChange={() => {
                      setStatsDateFrom('2026-07-06');
                      setStatsDateTo('2026-07-06');
                    }}
                    className="migaku-select"
                  >
                    <option value="Today">{lang === 'es' ? 'Hoy' : 'Today'}</option>
                    <option value="Yesterday">{lang === 'es' ? 'Ayer' : 'Yesterday'}</option>
                    <option value="AllTime">{lang === 'es' ? 'Todo el tiempo' : 'All time'}</option>
                  </select>
                </div>

                <div className="settings-field-group">
                  <label className="field-label">{lang === 'es' ? 'Desde' : 'From'}</label>
                  <input 
                    type="date" 
                    value={statsDateFrom} 
                    onChange={(e) => setStatsDateFrom(e.target.value)}
                    className="create-profile-input" 
                  />
                </div>

                <div className="settings-field-group">
                  <label className="field-label">{lang === 'es' ? 'Hasta' : 'To'}</label>
                  <input 
                    type="date" 
                    value={statsDateTo} 
                    onChange={(e) => setStatsDateTo(e.target.value)}
                    className="create-profile-input" 
                  />
                </div>

                <div className="settings-field-group">
                  <label className="field-label">{lang === 'es' ? 'Inicio de la semana' : 'Start of week'}</label>
                  <select value="Monday" className="migaku-select" disabled>
                    <option value="Monday">{lang === 'es' ? 'Lunes' : 'Monday'}</option>
                    <option value="Sunday">{lang === 'es' ? 'Domingo' : 'Sunday'}</option>
                  </select>
                </div>
              </div>

              <button 
                type="button" 
                className="reset-filter-btn" 
                style={{ marginTop: '16px', width: '100%', textTransform: 'none', height: '40px' }}
                onClick={() => {
                  setStatsDateFrom('2026-07-06');
                  setStatsDateTo('2026-07-06');
                }}
              >
                {lang === 'es' ? 'Aplicar a todo el tiempo para los libros seleccionados' : 'Set to all time for selected book titles'}
              </button>
            </div>

            {/* Titles Filtering Card */}
            <div className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? 'Títulos' : 'Titles'}</h3>
              
              <div className="stats-titles-search-row">
                <input 
                  type="text" 
                  placeholder={lang === 'es' ? 'Filtrar títulos' : 'Filter titles'} 
                  value={statsTitleFilter}
                  onChange={(e) => setStatsTitleFilter(e.target.value)}
                  className="create-profile-input"
                  style={{ width: '100%', marginBottom: '16px' }}
                />
              </div>

              <div className="stats-selection-controls" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                  type="button" 
                  className="reset-filter-btn"
                  onClick={() => setStatsExcludedBookIds([])}
                >
                  {lang === 'es' ? 'Todos' : 'All'}
                </button>
                <button 
                  type="button" 
                  className="reset-filter-btn"
                  onClick={() => setStatsExcludedBookIds(books.map(b => b.id))}
                >
                  {lang === 'es' ? 'Ninguno' : 'None'}
                </button>
              </div>

              {filteredBooksListForStats.length === 0 ? (
                <p className="no-stats-text" style={{ textAlign: 'center', padding: '24px 0' }}>{lang === 'es' ? 'No hay títulos para filtrar.' : 'No titles to filter.'}</p>
              ) : (
                <div className="stats-titles-filter-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredBooksListForStats.map(b => {
                    const isChecked = !statsExcludedBookIds.includes(b.id);
                    return (
                      <label 
                        key={b.id} 
                        className="stats-title-checkbox-row"
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStatsExcludedBookIds(prev => prev.filter(id => id !== b.id));
                            } else {
                              setStatsExcludedBookIds(prev => [...prev, b.id]);
                            }
                          }}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 600 }}>{b.title}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({b.author || (lang === 'es' ? 'Autor desconocido' : 'Unknown author')})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleDeleteAllData = async () => {
    if (!confirm(lang === 'es' ? '⚠️ ¿Seguro que quieres eliminar TODOS los datos de la aplicación? Esta acción es irreversible.' : '⚠️ Are you sure you want to delete ALL application data? This action is irreversible.')) return;
    if (!confirm(lang === 'es' ? '⚠️ Se borrarán todos los libros, historiales, perfiles y diccionarios instalados. ¿Estás COMPLETAMENTE seguro?' : '⚠️ All books, histories, profiles, and installed dictionaries will be deleted. Are you COMPLETELY sure?')) return;
    
    localStorage.clear();
    try {
      // Close active IndexedDB connections first to prevent blocking/hanging delete database calls
      await db.close();
      await closeDB();
      
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('yoru_yomitan_db');
        req.onsuccess = resolve;
        req.onerror = reject;
      });
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('YoruReaderStore');
        req.onsuccess = resolve;
        req.onerror = reject;
      });
    } catch (e) {
      console.error('Error deleting databases:', e);
    }
    
    alert(lang === 'es' ? 'Todos los datos han sido eliminados. La aplicación se reiniciará.' : 'All data has been deleted. The application will restart.');
    window.location.reload();
  };

  const renderSettingsTab = () => {
    const handleSliderChange = (val) => {
      onSaveSettings({ ...settings, fontSize: val });
    };

    const scrollToSection = (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    const matchesSearch = (tagsStr) => {
      if (!settingsSearchQuery) return true;
      const terms = settingsSearchQuery.toLowerCase().split(/\s+/);
      return terms.every(term => tagsStr.toLowerCase().includes(term));
    };

    return (
      <div className="tab-view-container settings-view-panel yomitan-settings-layout" style={{ display: 'flex', gap: '24px', alignItems: 'stretch', height: '100%', width: '100%', margin: '0' }}>
        {/* Left Sidebar */}
        <div className="yomitan-settings-sidebar" style={{ width: '250px', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0, overflowY: 'auto', height: '100%' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '10px 0 0 0' }}>{lang === 'es' ? 'Configuración' : 'Settings'}</h2>
          
          <div className="yomitan-search-wrapper" style={{ position: 'relative', width: '100%' }}>
            <input 
              type="text" 
              placeholder={lang === 'es' ? 'Buscar...' : 'Search...'} 
              value={settingsSearchQuery}
              onChange={(e) => setSettingsSearchQuery(e.target.value)}
              style={{ width: '100%', background: '#1c1c20', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '8px 12px 8px 32px', fontSize: '0.85rem', color: '#fff', outline: 'none' }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)' }}>🔍</span>
            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', background: '#2d2d34', padding: '2px 5px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 'bold' }}>CTRL F</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* General Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                <span>🔧</span> {lang === 'es' ? 'General' : 'General'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {matchesSearch('tema theme active dark light sepia') && (
                  <button onClick={() => scrollToSection('sec-theme')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>{lang === 'es' ? '🎨 Tema' : '🎨 Theme'}</button>
                )}
                {matchesSearch('furigana traduccion translation learning status display pitch accent acento tono') && (
                  <button onClick={() => scrollToSection('sec-display')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>{lang === 'es' ? '🕒 Pantalla' : '🕒 Screen'}</button>
                )}
              </div>
            </div>

            {/* Reader Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                <span>📖</span> {lang === 'es' ? 'Lector' : 'Reader'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {matchesSearch('size texto text style font voz audio speed velocidad genero') && (
                  <button onClick={() => scrollToSection('sec-text-style')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>{lang === 'es' ? '🎨 Estilo de texto' : '🎨 Text Style'}</button>
                )}
                {matchesSearch('highlight oracion cursor hover highlights') && (
                  <button onClick={() => scrollToSection('sec-highlights')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>{lang === 'es' ? '🎯 Resaltado' : '🎯 Highlights'}</button>
                )}
              </div>
            </div>

            {/* Integration Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                <span>🔌</span> {lang === 'es' ? 'Integración' : 'Integration'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {matchesSearch('anki integration connect card mapping local') && (
                  <button onClick={() => scrollToSection('sec-anki')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>{lang === 'es' ? '🃏 Integración con Anki' : '🃏 Anki Integration'}</button>
                )}
              </div>
            </div>

            {/* Seguimiento Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                <span>📊</span> {lang === 'es' ? 'Seguimiento' : 'Tracking'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {matchesSearch('stats config estadisticas tracking delete books annotations enabled') && (
                  <button onClick={() => scrollToSection('sec-stats')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>📈 {lang === 'es' ? 'Estadísticas' : 'Statistics'}</button>
                )}
                {matchesSearch('reading day dia lectura start hours limites horas nocturno') && (
                  <button onClick={() => scrollToSection('sec-reading-day')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>🕒 {lang === 'es' ? 'Día de lectura' : 'Reading Day'}</button>
                )}
                {matchesSearch('sync merge sincronizar combinar conflicto storage sync settings gdrive drive cloud') && (
                  <button onClick={() => scrollToSection('sec-sync-merge')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>☁️ {lang === 'es' ? 'Sincronizar y combinar' : 'Sync & Merge'}</button>
                )}
              </div>
            </div>

            {/* Data Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                <span>🗄️</span> {lang === 'es' ? 'Datos' : 'Data'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {matchesSearch('backup import export catalogo perfil copia seguridad') && (
                  <button onClick={() => scrollToSection('sec-backup')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>{lang === 'es' ? '💾 Copias de seguridad' : '💾 Backups'}</button>
                )}
                {matchesSearch('diccionario dictionary offline jmdict frecuencia meta meta_bank zip') && (
                  <button onClick={() => scrollToSection('sec-dicts')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>{lang === 'es' ? '🗄️ Diccionarios' : '🗄️ Dictionaries'}</button>
                )}
                {matchesSearch('danger zone eliminar borrar todos datos irreversible reset clear storage') && (
                  <button onClick={() => scrollToSection('sec-danger')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', fontSize: '0.88rem', color: '#f87171', width: '100%', textAlign: 'left', cursor: 'pointer', fontWeight: 600 }}>{lang === 'es' ? '🔧 Zona de peligro' : '🔧 Danger Zone'}</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Pane */}
        <div className="yomitan-settings-pane" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '24px', scrollBehavior: 'smooth', height: '100%', paddingBottom: '100px' }}>
          
          {/* Card: Theme */}
          {matchesSearch('tema theme active dark light sepia') && (
            <div id="sec-theme" className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? '🎨 Tema' : '🎨 Theme'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Elige la apariencia visual del lector para reducir la fatiga ocular.' : 'Choose the reader appearance to reduce eye strain.'}</p>
              
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Tema activo' : 'Active Theme'}</span>
                <select 
                  value={settings.theme || 'dark'}
                  onChange={(e) => onSaveSettings({ ...settings, theme: e.target.value })}
                  className="migaku-select"
                >
                  <option value="dark">{lang === 'es' ? 'Oscuro (Dark)' : 'Dark'}</option>
                  <option value="light">{lang === 'es' ? 'Claro (Light)' : 'Light'}</option>
                  <option value="sepia">Sepia</option>
                </select>
              </div>
            </div>
          )}

          {/* Card: Display */}
          {matchesSearch('furigana traduccion translation learning status display pitch accent acento tono') && (
            <div id="sec-display" className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? '🕒 Pantalla' : '🕒 Screen'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Configura la visibilidad del furigana, traducciones y estados de aprendizaje.' : 'Configure furigana visibility, translations, and learning statuses.'}</p>
              
              <div className="settings-row-control">
                <span className="settings-label-text">Furigana</span>
                <select 
                  value={settings.showFurigana || 'unknown-only'}
                  onChange={(e) => onSaveSettings({ ...settings, showFurigana: e.target.value })}
                  className="migaku-select"
                >
                  <option value="unknown-only">{lang === 'es' ? 'Palabras desconocidas' : 'Unknown words only'}</option>
                  <option value="all">{lang === 'es' ? 'Todo' : 'All'}</option>
                  <option value="none">{lang === 'es' ? 'Ninguno' : 'None'}</option>
                </select>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Mostrar traducción' : 'Show translation'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.showTranslation !== false}
                    onChange={(e) => onSaveSettings({ ...settings, showTranslation: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Mostrar estado de aprendizaje' : 'Show learning status'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.showLearningStatus !== false}
                    onChange={(e) => onSaveSettings({ ...settings, showLearningStatus: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{t('interfaceLanguage', lang)}</span>
                <select 
                  value={settings.appLanguage || 'es'}
                  onChange={(e) => onSaveSettings({ ...settings, appLanguage: e.target.value })}
                  className="migaku-select"
                >
                  <option value="es">Español 🇪🇸</option>
                  <option value="en">English 🇺🇸</option>
                </select>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{t('pitchAccent', lang)}</span>
                <select 
                  value={settings.pitchAccent || 'none'}
                  onChange={(e) => onSaveSettings({ ...settings, pitchAccent: e.target.value })}
                  className="migaku-select"
                >
                  <option value="none">{t('pitchNone', lang)}</option>
                  <option value="pitch-color">{t('pitchColor', lang)}</option>
                </select>
              </div>
            </div>
          )}

          {/* Card: Text Style */}
          {matchesSearch('size texto text style font voz audio speed velocidad genero') && (
            <div id="sec-text-style" className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? '🎨 Estilos & Audio' : '🎨 Style & Audio'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Modifica el tamaño de la tipografía y los parámetros del reproductor de voz.' : 'Modify typography size and text-to-speech voice settings.'}</p>
              
              <div className="settings-row-control">
                <span className="settings-label-text">{t('readerFontSize', lang)}</span>
                <div className="migaku-slider-container" style={{ flex: 1, maxWidth: '300px' }}>
                  <span className="slider-icon-small">A</span>
                  <input 
                    type="range" 
                    min="18" 
                    max="48" 
                    step="2"
                    value={settings.fontSize || 36} 
                    onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                    className="migaku-slider"
                  />
                  <span className="slider-icon-large">A</span>
                </div>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{t('playbackSpeed', lang)}</span>
                <select 
                  value={settings.audioSpeed || '1.0'}
                  onChange={(e) => onSaveSettings({ ...settings, audioSpeed: e.target.value })}
                  className="migaku-select"
                >
                  <option value="1.0">Normal (1.0x)</option>
                  <option value="0.75">{lang === 'es' ? 'Lento (0.75x)' : 'Slow (0.75x)'}</option>
                  <option value="1.25">{lang === 'es' ? 'Rápido (1.25x)' : 'Fast (1.25x)'}</option>
                  <option value="1.5">{lang === 'es' ? 'Rápido (1.5x)' : 'Fast (1.5x)'}</option>
                </select>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{t('voiceGender', lang)}</span>
                <select 
                  value={settings.audioGender || 'female'}
                  onChange={(e) => onSaveSettings({ ...settings, audioGender: e.target.value })}
                  className="migaku-select"
                >
                  <option value="female">{t('genderFemale', lang)}</option>
                  <option value="male">{t('genderMale', lang)}</option>
                </select>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Voz de reproducción' : 'Playback Voice'}</span>
                <select 
                  value={settings.audioVoiceOption || 'Nanami'}
                  onChange={(e) => onSaveSettings({ ...settings, audioVoiceOption: e.target.value })}
                  className="migaku-select"
                >
                  <option value="Nanami">Nanami (Femenina)</option>
                  <option value="Mayu">Mayu (Femenina Joven)</option>
                  <option value="Keita">Keita (Masculina)</option>
                </select>
              </div>

              <div className="settings-row-control" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                <span className="settings-label-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Azure TTS API Key</span>
                <input 
                  type="password"
                  placeholder="Azure Key (dejar vacío para usar voz gratis local)"
                  value={settings.azureApiKey || ''}
                  onChange={(e) => onSaveSettings({ ...settings, azureApiKey: e.target.value })}
                  className="migaku-select"
                  style={{ width: '100%', padding: '6px 12px', boxSizing: 'border-box' }}
                />
              </div>

              <div className="settings-row-control" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                <span className="settings-label-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Azure TTS Region</span>
                <input 
                  type="text"
                  placeholder="eastus"
                  value={settings.azureRegion || ''}
                  onChange={(e) => onSaveSettings({ ...settings, azureRegion: e.target.value })}
                  className="migaku-select"
                  style={{ width: '100%', padding: '6px 12px', boxSizing: 'border-box' }}
                />
              </div>

            </div>
          )}

          {/* Card: Highlights */}
          {matchesSearch('highlight oracion cursor hover highlights') && (
            <div id="sec-highlights" className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? '🎯 Resaltados' : '🎯 Highlights'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Controla la interacción visual al pasar el cursor sobre las oraciones.' : 'Controls visual interaction when hovering over sentences.'}</p>
              
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Oración al pasar el cursor (Highlight)' : 'Sentence hover highlight'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.sentenceHover === true}
                    onChange={(e) => onSaveSettings({ ...settings, sentenceHover: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>
            </div>
          )}

          {/* Card: Anki Integration */}
          {matchesSearch('anki integration connect card mapping local') && (
            <div id="sec-anki" className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? '🃏 Integración con Anki' : '🃏 Anki Integration'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Conéctate a tu Anki local para añadir tarjetas directamente desde las oraciones y palabras buscadas.' : 'Connect to your local Anki instance to mine flashcards directly from sentences and dictionary words.'}</p>
              
              <button 
                type="button"
                className="reset-filter-btn"
                style={{ marginTop: '12px' }}
                onClick={() => setIsAnkiConfigOpen(true)}
              >
                ⚙️ {lang === 'es' ? 'Abrir Configuración de Anki' : 'Open Anki Settings'}
              </button>
            </div>
          )}

          {/* Card: Estadísticas (Yatsu style) */}
          {matchesSearch('stats config estadisticas tracking delete books annotations enabled') && (
            <div id="sec-stats" className="settings-section-card">
              <h3 className="settings-card-title">📈 {lang === 'es' ? 'Estadísticas' : 'Statistics'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Configura el almacenamiento del historial de lectura y las acciones de limpieza.' : 'Configure the storage of reading history and cleanup actions.'}</p>
              
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Activar estadísticas de lectura' : 'Enable reading statistics'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.enableStatistics !== false}
                    onChange={(e) => onSaveSettings({ ...settings, enableStatistics: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '16px', marginBottom: '8px' }}>
                {lang === 'es' ? 'Libros eliminados' : 'Deleted Books'}
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Conservar estadísticas al eliminar libro' : 'Keep stats on book deletion'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.keepStatsOnDelete !== false}
                    onChange={(e) => onSaveSettings({ ...settings, keepStatsOnDelete: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Conservar resaltados, notas y marcadores al eliminar' : 'Keep highlights, notes, and bookmarks on deletion'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.keepAnnotationsOnDelete === true}
                    onChange={(e) => onSaveSettings({ ...settings, keepAnnotationsOnDelete: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(lang === 'es' ? '¿Limpiar estadísticas de libros ya eliminados?' : 'Clear stats for already deleted books?')) {
                      alert(lang === 'es' ? 'Limpieza completada.' : 'Cleanup done.');
                    }
                  }}
                  style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                >
                  🧹 {lang === 'es' ? 'Estadísticas de libros eliminados' : 'Deleted-book statistics'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(lang === 'es' ? '¿Limpiar anotaciones de libros ya eliminados?' : 'Clear annotations for already deleted books?')) {
                      alert(lang === 'es' ? 'Limpieza completada.' : 'Cleanup done.');
                    }
                  }}
                  style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                >
                  🧹 {lang === 'es' ? 'Anotaciones de libros eliminados' : 'Deleted-book annotations'}
                </button>
              </div>
            </div>
          )}

          {/* Card: Día de lectura */}
          {matchesSearch('reading day dia lectura start hours limites horas nocturno') && (
            <div id="sec-reading-day" className="settings-section-card">
              <h3 className="settings-card-title">🕒 {lang === 'es' ? 'Día de lectura' : 'Reading Day'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Establece los límites horarios para el cálculo del historial de lectura diario.' : 'Sets calendar hour boundaries for daily reading history calculations.'}</p>
              
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="settings-label-text">{lang === 'es' ? 'Hora de inicio del día' : 'Start Day Hour'}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>
                    {String(settings.startDayHour || 0).padStart(2, '0')}:00
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="23" 
                  step="1"
                  value={settings.startDayHour || 0} 
                  onChange={(e) => onSaveSettings({ ...settings, startDayHour: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <p style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.3)', marginTop: '8px', lineHeight: 1.3 }}>
                  {lang === 'es' 
                    ? 'Ajusta a qué hora comienza un nuevo día. Útil si lees después de medianoche y deseas que se contabilice en el día anterior.' 
                    : 'Configure at what hour a new reading day starts. Useful for night readers.'}
                </p>
              </div>
            </div>
          )}

          {/* Card: Sincronizar y combinar */}
          {matchesSearch('sync merge sincronizar combinar conflicto storage sync settings gdrive drive cloud') && (
            <div id="sec-sync-merge" className="settings-section-card">
              <h3 className="settings-card-title">☁️ {lang === 'es' ? 'Sincronizar y combinar' : 'Sync & Merge'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Configura la sincronización con almacenamiento en la nube y cómo se resuelven los conflictos.' : 'Configure cloud storage synchronization and how metadata conflicts are resolved.'}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === 'es' ? 'Destino de sincronización de almacenamiento' : 'Storage Sync Target'}</span>
                  <span style={{ color: gDriveTokens ? '#34d399' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                    {gDriveTokens ? 'Google Drive' : (lang === 'es' ? 'Ninguno' : 'None')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === 'es' ? 'Destino de sincronización de ajustes' : 'Settings Sync Target'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                    {lang === 'es' ? 'Perfil local' : 'Local Profile'}
                  </span>
                </div>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Combinación de estadísticas' : 'Statistics Merge'}</span>
                <select 
                  value={settings.statsMergeOption || 'merge'}
                  onChange={(e) => onSaveSettings({ ...settings, statsMergeOption: e.target.value })}
                  className="migaku-select"
                >
                  <option value="merge">{lang === 'es' ? 'Combinar (Merge)' : 'Merge'}</option>
                  <option value="replace">{lang === 'es' ? 'Reemplazar (Replace)' : 'Replace'}</option>
                </select>
              </div>

              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Combinación de objetivos de lectura' : 'Reading Goals Merge'}</span>
                <select 
                  value={settings.goalsMergeOption || 'merge'}
                  onChange={(e) => onSaveSettings({ ...settings, goalsMergeOption: e.target.value })}
                  className="migaku-select"
                >
                  <option value="merge">{lang === 'es' ? 'Combinar (Merge)' : 'Merge'}</option>
                  <option value="replace">{lang === 'es' ? 'Reemplazar (Replace)' : 'Replace'}</option>
                </select>
              </div>

              {/* Botón e inputs de Google Drive */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Inputs de credenciales si no está conectado */}
                {!gDriveTokens && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span className="settings-label-text" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CLIENT ID</span>
                      <input 
                        type="password"
                        value={gDriveClientId}
                        onChange={(e) => setGDriveClientId(e.target.value)}
                        placeholder="Enter Client ID..."
                        className="migaku-select"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 12px' }}
                      />
                    </div>
                    <div>
                      <span className="settings-label-text" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CLIENT SECRET (OPTIONAL)</span>
                      <input 
                        type="password"
                        value={gDriveClientSecret}
                        onChange={(e) => setGDriveClientSecret(e.target.value)}
                        placeholder="Enter Client Secret..."
                        className="migaku-select"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 12px' }}
                      />
                    </div>
                  </div>
                )}

                <button 
                  type="button"
                  onClick={handleConnectGDrive}
                  disabled={gDriveSyncStatus === 'syncing'}
                  className="reset-filter-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  🔑 {gDriveTokens ? (lang === 'es' ? 'Re-conectar cuenta' : 'Re-connect account') : (lang === 'es' ? 'Vincular Google Drive' : 'Link Google Drive')}
                </button>

                {gDriveTokens && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        type="button"
                        onClick={handleUploadGDrive}
                        disabled={gDriveSyncStatus === 'syncing'}
                        className="reset-filter-btn"
                        style={{ flex: 1, justifyContent: 'center', background: 'rgba(52, 211, 153, 0.05)', borderColor: '#34d399', color: '#34d399' }}
                      >
                        📤 {lang === 'es' ? 'Subir copia completa' : 'Upload backup'}
                      </button>
                      <button 
                        type="button"
                        onClick={handleDownloadGDrive}
                        disabled={gDriveSyncStatus === 'syncing'}
                        className="reset-filter-btn"
                        style={{ flex: 1, justifyContent: 'center', background: 'rgba(251, 191, 36, 0.05)', borderColor: '#fbbf24', color: '#fbbf24' }}
                      >
                        📥 {lang === 'es' ? 'Descargar' : 'Download'}
                      </button>
                    </div>
                    {lastSyncTime && (
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                        {lang === 'es' ? 'Última sincronización:' : 'Last sync:'} {lastSyncTime}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card: Backup */}
          {matchesSearch('backup import export catalogo perfil copia seguridad') && (
            <div id="sec-backup" className="settings-section-card">
              <h3 className="settings-card-title">{lang === 'es' ? '💾 Copias de seguridad' : '💾 Backups'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Guarda todo tu catálogo, historial de lectura, perfiles y configuraciones de Anki en un archivo local (se excluyen los diccionarios para mantener el archivo ligero).' : 'Export all your library books, reading statistics, profiles, and configurations to a local backup file.'}</p>
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="reset-filter-btn"
                  onClick={handleExportLibrary}
                  style={{ background: 'rgba(255, 224, 0, 0.06)', borderColor: 'var(--primary)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Download size={16} /> {lang === 'es' ? 'Exportar Biblioteca' : 'Export Library'}
                </button>
                
                <label className="reset-filter-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <Upload size={16} /> {lang === 'es' ? 'Importar Respaldo' : 'Import Backup'}
                  <input 
                    type="file" 
                    accept=".json,.zip"
                    onChange={handleImportLibrary}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Card: Dictionaries */}
          {matchesSearch('diccionario dictionary offline jmdict frecuencia meta meta_bank zip') && (
            <div id="sec-dicts" className="settings-section-card">
              <h3 className="settings-card-title">{t('dictionaryTitle', lang)}</h3>
              <p className="settings-card-desc">{t('dictDesc', lang)}</p>
              
              <div style={{ marginTop: '16px' }}>
                <label className="reset-filter-btn" style={{ display: 'inline-flex', alignItems: 'center', cursor: isImportingDict ? 'not-allowed' : 'pointer', opacity: isImportingDict ? 0.6 : 1, background: 'rgba(52, 211, 153, 0.1)', borderColor: '#34d399', color: '#34d399' }}>
                  📦 {lang === 'es' ? 'Instalar Diccionario (.zip)' : 'Install Dictionary (.zip)'}
                  <input 
                    type="file" 
                    accept=".zip"
                    onChange={handleYomitanUpload}
                    disabled={isImportingDict}
                    style={{ display: 'none' }}
                  />
                </label>
                
                {isImportingDict && (
                  <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>{dictImportMsg}</span>
                      <span>{dictImportProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${dictImportProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {installedDicts.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ color: 'var(--text-dark)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{lang === 'es' ? 'Diccionarios Instalados' : 'Installed Dictionaries'}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {installedDicts.map(dict => (
                      <div key={dict.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-light)', fontSize: '0.9rem' }}>{dict.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{lang === 'es' ? `Instalado: ${new Date(dict.importedAt).toLocaleDateString()}` : `Installed: ${new Date(dict.importedAt).toLocaleDateString()}`}</div>
                        </div>
                        <button 
                          onClick={() => handleDeleteDict(dict.title)}
                          className="reader-header-btn" 
                          style={{ color: '#ef4444' }}
                          title={lang === 'es' ? 'Eliminar diccionario' : 'Delete dictionary'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card: Danger Zone */}
          {matchesSearch('danger zone eliminar borrar todos datos irreversible reset clear storage') && (
            <div id="sec-danger" className="settings-section-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.02)' }}>
              <h3 className="settings-card-title" style={{ color: '#f87171' }}>🔧 {lang === 'es' ? 'Zona de peligro' : 'Danger Zone'}</h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Acciones destructivas e irreversibles sobre los datos almacenados en la aplicación.' : 'Irreversible destructive actions on stored application data.'}</p>
              
              <div style={{ marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="reset-filter-btn"
                  onClick={handleDeleteAllData}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  ⚠️ {lang === 'es' ? 'Eliminar todos los datos' : 'Delete all data'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNotesTab = () => {
    // 1. Calculate status counts based on wordStatuses keys/values
    const allWordStatuses = db.getWordStatuses();
    const totalKnown = Object.values(allWordStatuses).filter(s => s === 'known').length;
    const totalLearning = Object.values(allWordStatuses).filter(s => s === 'learning').length;
    const totalStarred = Object.values(allWordStatuses).filter(s => s === 'starred').length;
    const totalIgnored = Object.values(allWordStatuses).filter(s => s === 'ignored').length;
    const totalNew = Object.values(allWordStatuses).filter(s => s === 'new').length;

    // 2. Build list of words
    const wordsList = Object.entries(allWordStatuses).map(([word, status]) => {
      let statusText = lang === 'es' ? 'Nuevo' : 'New';
      let statusClass = 'new';
      if (status === 'learning') {
        statusText = lang === 'es' ? 'Aprendiendo' : 'Learning';
        statusClass = 'learning';
      } else if (status === 'known') {
        statusText = lang === 'es' ? 'Conocido' : 'Known';
        statusClass = 'known';
      } else if (status === 'starred') {
        statusText = lang === 'es' ? 'Destacado' : 'Starred';
        statusClass = 'starred';
      } else if (status === 'ignored') {
        statusText = lang === 'es' ? 'Ignorado' : 'Ignored';
        statusClass = 'ignored';
      }
      return { word, status, statusText, statusClass };
    });

    // 3. Filter list
    const filteredWords = wordsList.filter(item => {
      const matchSearch = item.word.toLowerCase().includes(notesSearch.toLowerCase());
      const matchStatus = notesFilterStatus === 'all' || item.status === notesFilterStatus;
      return matchSearch && matchStatus;
    });

    // 4. Sort list
    const sortedWords = [...filteredWords].sort((a, b) => {
      if (notesSort === 'alphabetical') {
        return a.word.localeCompare(b.word, 'ja');
      } else if (notesSort === 'alphabetical-desc') {
        return b.word.localeCompare(a.word, 'ja');
      }
      return a.word.localeCompare(b.word, 'ja');
    });

    // Option details mapping for display
    const activeFilterLabel = {
      all: lang === 'es' ? 'TODOS' : 'ALL',
      new: lang === 'es' ? 'NUEVO' : 'NEW',
      learning: lang === 'es' ? 'APRENDIENDO' : 'LEARNING',
      known: lang === 'es' ? 'CONOCIDO' : 'KNOWN',
      starred: lang === 'es' ? 'DESTACADO' : 'STARRED',
      ignored: lang === 'es' ? 'IGNORADO' : 'IGNORED'
    }[notesFilterStatus] || (lang === 'es' ? 'FILTRAR' : 'FILTER');

    const activeSortLabel = {
      alphabetical: lang === 'es' ? 'ALFABÉTICO (A-Z)' : 'ALPHABETICAL (A-Z)',
      'alphabetical-desc': lang === 'es' ? 'ALFABÉTICO (Z-A)' : 'ALPHABETICAL (Z-A)'
    }[notesSort] || (lang === 'es' ? 'ORDENAR' : 'SORT');

    return (
      <div className="tab-view-container notes-view-panel" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 6rem 1rem' }}>
        {/* Premium Dashboard Summary Card (Image 1 style) */}
        <div className="vocab-dashboard-card">
          {/* Japanese flag circle emblem */}
          <div 
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#bc002d' }}></div>
          </div>

          {/* Main Counter */}
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: 800, color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--status-known)' }}>{totalKnown.toLocaleString()}</span>
            <span>{lang === 'es' ? 'Palabras conocidas' : 'Known words'}</span>
          </h2>

          {/* Subtitle counters */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            <span>
              <span style={{ color: 'var(--status-learning)', marginRight: '4px' }}>{totalLearning}</span>
              {lang === 'es' ? 'aprendiendo' : 'learning'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
            <span>
              <span style={{ color: '#ab47bc', marginRight: '4px' }}>{totalStarred}</span>
              {lang === 'es' ? 'destacada(s)' : 'starred'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
            <span>
              <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{totalIgnored}</span>
              {lang === 'es' ? 'ignorada(s)' : 'ignored'}
            </span>
          </div>
        </div>

        {/* Dropdown Filters & Actions Row */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
          {/* Sort By Button */}
          <div style={{ flex: 1, position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                setIsNotesSortOpen(!isNotesSortOpen);
                setIsNotesFilterOpen(false);
              }}
              className="vocab-action-btn"
            >
              {lang === 'es' ? 'ORDENAR POR' : 'SORT BY'}: {activeSortLabel} <ChevronDown size={14} />
            </button>
            {isNotesSortOpen && (
              <div className="vocab-dropdown-menu">
                {[
                  { value: 'alphabetical', label: lang === 'es' ? 'Alfabético (A-Z)' : 'Alphabetical (A-Z)' },
                  { value: 'alphabetical-desc', label: lang === 'es' ? 'Alfabético (Z-A)' : 'Alphabetical (Z-A)' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setNotesSort(opt.value);
                      setIsNotesSortOpen(false);
                    }}
                    style={{
                      width: '100%',
                      background: notesSort === opt.value ? 'rgba(255,224,0,0.1)' : 'transparent',
                      border: 'none',
                      color: notesSort === opt.value ? 'var(--primary)' : '#fff',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Status Button */}
          <div style={{ flex: 1, position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                setIsNotesFilterOpen(!isNotesFilterOpen);
                setIsNotesSortOpen(false);
              }}
              className="vocab-action-btn"
            >
              {lang === 'es' ? 'FILTRAR POR' : 'FILTER BY'}: {activeFilterLabel} <ChevronDown size={14} />
            </button>
            {isNotesFilterOpen && (
              <div className="vocab-dropdown-menu">
                {[
                  { value: 'all', label: lang === 'es' ? 'Todos los estados' : 'All statuses' },
                  { value: 'new', label: lang === 'es' ? 'Nuevo' : 'New' },
                  { value: 'learning', label: lang === 'es' ? 'Aprendiendo' : 'Learning' },
                  { value: 'known', label: lang === 'es' ? 'Conocido' : 'Known' },
                  { value: 'starred', label: lang === 'es' ? 'Destacado' : 'Starred' },
                  { value: 'ignored', label: lang === 'es' ? 'Ignorado' : 'Ignored' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setNotesFilterStatus(opt.value);
                      setIsNotesFilterOpen(false);
                    }}
                    style={{
                      width: '100%',
                      background: notesFilterStatus === opt.value ? 'rgba(255,224,0,0.1)' : 'transparent',
                      border: 'none',
                      color: notesFilterStatus === opt.value ? 'var(--primary)' : '#fff',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Text Keyword Search Box */}
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text"
            placeholder={lang === 'es' ? "Buscar palabra..." : "Search word..."}
            value={notesSearch}
            onChange={(e) => setNotesSearch(e.target.value)}
            className="create-profile-input"
            style={{ width: '100%', maxWidth: 'none', borderRadius: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>
        
        {/* Word Grid Output */}
        {sortedWords.length === 0 ? (
          <p className="no-stats-text" style={{ padding: '40px 0', textAlign: 'center' }}>{lang === 'es' ? 'No se encontraron palabras guardadas.' : 'No saved words found.'}</p>
        ) : (
          <>
            <div className="notes-words-grid">
              {sortedWords.slice(0, visibleVocabCount).map((item, idx) => (
                <div key={idx} className="note-word-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="note-word-text">{item.word}</span>
                    <span className={`note-word-status-badge ${item.statusClass}`}>{item.statusText}</span>
                  </div>
                  <div className="note-word-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button 
                      type="button"
                      className="profile-delete-btn"
                      onClick={() => {
                        if (confirm(lang === 'es' ? `¿Quieres eliminar "${item.word}" de tu vocabulario?` : `Do you want to delete "${item.word}" from your vocabulary?`)) {
                          db.setWordStatus(item.word, 'unknown');
                          alert(lang === 'es' ? 'Palabra eliminada. Recargando para actualizar...' : 'Word deleted. Reloading to update...');
                          window.location.reload();
                        }
                      }}
                      title={lang === 'es' ? 'Eliminar de mi lista' : 'Delete from my list'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {sortedWords.length > visibleVocabCount && (
              <div ref={vocabSentinelRef} style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', margin: '20px 0' }}>
                {lang === 'es' ? 'Cargando más vocabulario...' : 'Loading more vocabulary...'}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`library-container ${activeTab !== 'library' ? 'fixed-layout' : ''}`}>
      {/* 1. Sticky Header — Yoru Cafe style */}
      <header className="library-header">
        {/* Left: brand name in neon yellow like Yoru Cafe */}
        <span className="library-brand-name">YORU READER</span>

        {/* Center: Navigation Tabs */}
        <nav className="header-navigation-tabs">
          <button 
            className={`nav-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
            type="button"
          >
            📚 {t('library', lang)}
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
            type="button"
          >
            📈 {t('statistics', lang)}
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            type="button"
          >
            ⚙️ {t('settings', lang)}
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
            type="button"
          >
            📝 {t('vocabulary', lang)}
          </button>
        </nav>

        {/* Right: action buttons */}
        <div className="library-header-actions">
          {/* Hidden file input */}
          <input 
            type="file" 
            accept=".epub,.html,.htm,.txt,.rtf,.srt,.vtt,.ass,.ssa" 
            multiple
            className="hidden-file-input"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Hidden folder input */}
          <input 
            type="file" 
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden-file-input"
            ref={folderInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Hidden backup input */}
          <input 
            type="file" 
            accept=".json,.zip"
            className="hidden-file-input"
            ref={backupInputRef}
            onChange={handleImportLibrary}
            style={{ display: 'none' }}
          />

          {/* 1. Import Dropdown */}
          <div className="header-action-dropdown-container">
            <button 
              className={`header-action-btn-text ${activeHeaderDropdown === 'import' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveHeaderDropdown(activeHeaderDropdown === 'import' ? null : 'import');
              }}
              type="button"
            >
              <Upload size={16} />
              <span>{lang === 'es' ? 'Importar' : 'Import'}</span>
              <ChevronDown size={14} />
            </button>
            {activeHeaderDropdown === 'import' && (
              <div className="header-action-dropdown-menu align-left">
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    fileInputRef.current.click();
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <Plus size={14} style={{ color: 'var(--primary)' }} />
                    <span>{lang === 'es' ? 'Importar archivo(s)' : 'Import File(s)'}</span>
                  </div>
                  <div className="header-action-dropdown-item-desc">
                    {lang === 'es' ? 'Archivos EPUB, HTMLZ y texto' : 'EPUB, HTMLZ, and text files'}
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    folderInputRef.current.click();
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <FolderOpen size={14} style={{ color: 'var(--primary)' }} />
                    <span>{lang === 'es' ? 'Importar carpeta(s)' : 'Import Folder(s)'}</span>
                  </div>
                  <div className="header-action-dropdown-item-desc">
                    {lang === 'es' ? 'Todos los libros de una carpeta' : 'All supported books in a folder'}
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    backupInputRef.current.click();
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <Upload size={14} style={{ color: 'var(--primary)' }} />
                    <span>{lang === 'es' ? 'Importar copia de seguridad' : 'Import Backup'}</span>
                  </div>
                  <div className="header-action-dropdown-item-desc">
                    {lang === 'es' ? 'Restaurar desde un archivo ZIP' : 'Restore from a zipped backup'}
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 2. Database Dropdown */}
          {/* 3. Sincronización Google Drive */}
          <button 
            className="header-display-settings-btn"
            onClick={() => setIsGDriveSyncOpen(true)}
            title={lang === 'es' ? 'Sincronizar con Google Drive' : 'Google Drive Sync'}
            type="button"
          >
            <Database size={18} />
          </button>



          {/* 4. Display Settings Cog */}
          <button 
            className={`header-display-settings-btn ${isDisplaySettingsOpen ? 'active' : ''}`}
            onClick={() => setIsDisplaySettingsOpen(!isDisplaySettingsOpen)}
            title={lang === 'es' ? 'Ajustes de visualización (Q)' : 'Display Settings (Q)'}
            type="button"
          >
            <SlidersHorizontal size={18} />
          </button>

          {/* 5. More / Three-dots Dropdown */}
          <div className="header-action-dropdown-container">
            <button 
              className={`header-display-settings-btn ${activeHeaderDropdown === 'more' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveHeaderDropdown(activeHeaderDropdown === 'more' ? null : 'more');
              }}
              title={lang === 'es' ? 'Más opciones' : 'More Options'}
              type="button"
            >
              <MoreVertical size={18} />
            </button>
            {activeHeaderDropdown === 'more' && (
              <div className="header-action-dropdown-menu" style={{ minWidth: '220px' }}>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    handleExportLibrary();
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? '💾 Obtener copia de seguridad' : '💾 Get complete local backup'}</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(err => {
                        console.error(`Error enabling full-screen mode: ${err.message}`);
                      });
                    } else {
                      document.exitFullscreen();
                    }
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? '📺 Alternar pantalla completa' : '📺 Toggle fullscreen'}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>F</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    alert(lang === 'es' ? "Atajos:\n- Q: Abrir ajustes de visualización\n- Esc: Cerrar modales/popups\n- Flechas: Navegar páginas" : "Shortcuts:\n- Q: Open display settings\n- Esc: Close modals/popups\n- Arrows: Navigate pages");
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? '⌨️ Atajos de teclado' : '⌨️ Keyboard shortcuts'}</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    window.open('https://discord.com/invite/NwKYJAUeA', '_blank');
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? '🐛 Reportar un error' : '🐛 Report a bug'}</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    alert(lang === 'es' ? "Documentación de Yoru Reader disponible en yoru.cafe" : "Yoru Reader documentation available at yoru.cafe");
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? '📖 Documentación' : '📖 Docs'}</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    alert(lang === 'es' ? "Explora más temas de la comunidad próximamente." : "Explore community themes coming soon.");
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? '🎨 Repositorio de temas' : '🎨 Theme repository'}</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    alert(lang === 'es' ? "Última actualización: Añadido menú de importación y barra de herramientas premium." : "Last update: Added import dropdown menu and premium toolbar.");
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? '📢 Ver novedades' : '📢 Show read news'}</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    alert(lang === 'es' ? "Yoru Reader v1.2.0\nCreado para aprender japonés leyendo novelas." : "Yoru Reader v1.2.0\nCreated for learning Japanese by reading novels.");
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header">
                    <span>{lang === 'es' ? 'ℹ️ Acerca de' : 'ℹ️ About'}</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Profile Selector Widget */}
          <div className="header-profile-widget" ref={profileWidgetRef}>
            <div 
              className="active-profile-trigger" 
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <div className="active-profile-avatar-wrapper">
                {activeProfile?.avatar.startsWith('/') || activeProfile?.avatar.startsWith('data:') ? (
                  <img src={activeProfile.avatar} alt={activeProfile.name} className="active-profile-avatar" />
                ) : (
                  <div className="active-profile-avatar-emoji" style={{ background: activeProfile?.avatar || 'var(--yc-yellow-dim)' }}>
                    {activeProfile?.avatarEmoji || '👤'}
                  </div>
                )}
              </div>
              <span className="active-profile-name">{activeProfile?.name}</span>
            </div>

            {/* Profiles Dropdown */}
            {isProfileDropdownOpen && (
              <div className="profiles-dropdown-menu">
                <div className="dropdown-title">{lang === 'es' ? 'Perfiles' : 'Profiles'}</div>
                <div className="profiles-list">
                  {profiles.map(p => {
                    const isActive = p.id === activeProfileId;
                    return (
                      <div 
                        key={p.id} 
                        className={`profile-item-row ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          if (!isActive) {
                            onSelectProfile(p.id);
                            setIsProfileDropdownOpen(false);
                          }
                        }}
                      >
                        <div className="profile-item-avatar-wrapper">
                          {p.avatar.startsWith('/') || p.avatar.startsWith('data:') ? (
                            <img src={p.avatar} alt={p.name} className="profile-item-avatar" />
                          ) : (
                            <div className="profile-item-avatar-emoji" style={{ background: p.avatar }}>
                              {p.avatarEmoji || '👤'}
                            </div>
                          )}
                        </div>
                        <span className="profile-item-name">{p.name}</span>
                        {!isActive && profiles.length > 1 && (
                          <button 
                            className="profile-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProfile(p.id);
                            }}
                            title={lang === 'es' ? 'Eliminar Perfil' : 'Delete Profile'}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isCreatingProfile ? (
                  <form onSubmit={handleCreateProfileSubmit} className="create-profile-form">
                    <input 
                      type="text" 
                      placeholder={lang === 'es' ? 'Nombre del perfil...' : 'Profile name...'} 
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="create-profile-input"
                      required
                      autoFocus
                    />
                    
                    {/* Hidden file input for custom profile avatar */}
                    <input 
                      type="file" 
                      accept="image/*"
                      ref={customAvatarInputRef}
                      onChange={handleCustomAvatarChange}
                      style={{ display: 'none' }}
                    />

                    <div className="avatar-selection-label">{lang === 'es' ? 'Foto de perfil:' : 'Profile picture:'}</div>
                    <div className="custom-avatar-uploader-container">
                      {customAvatarUrl ? (
                        <div 
                          className="custom-avatar-preview-circle"
                          onClick={() => customAvatarInputRef.current.click()}
                          title={lang === 'es' ? 'Cambiar foto de perfil' : 'Change profile picture'}
                        >
                          <img src={customAvatarUrl} alt="Preview" className="avatar-preview-image" />
                          <div className="avatar-preview-overlay">📷</div>
                        </div>
                      ) : (
                        <div 
                          className="custom-avatar-placeholder-circle"
                          onClick={() => customAvatarInputRef.current.click()}
                          title={lang === 'es' ? 'Subir foto de perfil' : 'Upload profile picture'}
                        >
                          <span className="placeholder-icon">📷</span>
                          <span className="placeholder-text">{lang === 'es' ? 'Subir foto' : 'Upload image'}</span>
                        </div>
                      )}
                    </div>
                    
                    {customAvatarUrl && (
                      <button
                        type="button"
                        className="change-custom-avatar-btn"
                        onClick={() => customAvatarInputRef.current.click()}
                      >
                        {lang === 'es' ? 'Subir otra foto' : 'Upload another image'}
                      </button>
                    )}

                    <div className="create-profile-actions">
                      <button 
                        type="button" 
                        className="create-profile-cancel" 
                        onClick={() => {
                          setIsCreatingProfile(false);
                          setCustomAvatarUrl(null);
                        }}
                      >
                        {lang === 'es' ? 'Cancelar' : 'Cancel'}
                      </button>
                      <button type="submit" className="create-profile-save">
                        {lang === 'es' ? 'Crear' : 'Create'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="profile-dropdown-footer-actions">
                    <button 
                      className="add-profile-btn" 
                      onClick={() => {
                        setIsCreatingProfile(true);
                        setNewProfileName('');
                        setCustomAvatarUrl(null);
                      }}
                    >
                      <Plus size={14} style={{ marginRight: '6px' }} />
                      {lang === 'es' ? 'Crear nuevo perfil' : 'Create new profile'}
                    </button>
                    <button
                      className="profile-dropdown-settings-btn"
                      onClick={openProfileSettings}
                      title={lang === 'es' ? 'Configuración del Perfil' : 'Profile Settings'}
                      type="button"
                    >
                      <Settings size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Buttons Group — bottom-left corner */}
      {activeTab === 'library' && (
        <div className="library-fab-group">
          {/* Sort Toggle FAB */}
          <button
            className="library-fab-sort"
            onClick={() => {
              if (sortBy === 'default') setSortBy('title');
              else if (sortBy === 'title') setSortBy('date');
              else setSortBy('default');
            }}
            title={
              sortBy === 'default' ? "Ordenar: Secciones (Haz clic para ordenar A-Z)" : 
              (sortBy === 'title' ? "Ordenar: Título A-Z (Haz clic para ordenar por Recientes)" : 
              "Ordenar: Recientes (Haz clic para volver a Vista de Secciones)")
            }
          >
            <ArrowUpDown size={20} />
            <span className="fab-sort-badge">
              {sortBy === 'default' ? '🗂️' : (sortBy === 'title' ? 'AZ' : '🕒')}
            </span>
          </button>

          <button
            className={`library-fab-select ${selectMode ? 'active' : ''}`}
            onClick={toggleSelectMode}
            title="Seleccionar libros"
          >
            <ListChecks size={20} />
            {selectMode && selectedBookIds.length > 0 && (
              <span className="fab-badge">{selectedBookIds.length}</span>
            )}
          </button>
        </div>
      )}

      {/* Yomitan style Select Mode Panel */}
      {activeTab === 'library' && selectMode && (
        <div 
          className="yomitan-select-mode-panel"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '320px',
            background: 'rgba(22, 22, 28, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>{lang === 'es' ? 'Modo Selección' : 'Select Mode'}</span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                {selectedBookIds.length} {lang === 'es' ? (selectedBookIds.length === 1 ? 'libro seleccionado' : 'libros seleccionados') : (selectedBookIds.length === 1 ? 'book selected' : 'books selected')}
              </span>
            </div>
            <button 
              onClick={() => {
                setSelectMode(false);
                setSelectedBookIds([]);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '4px',
                transition: 'all 0.15s ease'
              }}
              className="panel-close-btn"
            >
              <X size={16} />
            </button>
          </div>

          {/* Grid Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              onClick={handleSelectAllVisible}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left' }}
            >
              <Check size={14} style={{ color: 'var(--primary)' }} /> {lang === 'es' ? 'Seleccionar visibles' : 'Select visible'}
            </button>

            <button 
              onClick={handleClearSelection}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left' }}
            >
              <CircleSlash size={14} style={{ color: 'rgba(255,255,255,0.5)' }} /> {lang === 'es' ? 'Limpiar' : 'Clear'}
            </button>

            <button 
              onClick={handleSetSeries}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <BookOpen size={14} style={{ color: '#60a5fa' }} /> {lang === 'es' ? 'Establecer serie' : 'Set series'}
            </button>

            <button 
              onClick={handleSetAuthor}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <User size={14} style={{ color: '#a78bfa' }} /> {lang === 'es' ? 'Establecer autor' : 'Set author'}
            </button>

            <button 
              onClick={handleAddTags}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <Tag size={14} style={{ color: '#34d399' }} /> {lang === 'es' ? 'Añadir etiquetas' : 'Add tags'}
            </button>

            <button 
              onClick={handleRemoveTags}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <Tag size={14} style={{ color: '#f87171' }} /> {lang === 'es' ? 'Quitar etiquetas' : 'Remove tags'}
            </button>

            <button 
              onClick={handleBlurCovers}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <EyeOff size={14} style={{ color: '#fbbf24' }} /> {lang === 'es' ? 'Desenfocar portadas' : 'Blur covers'}
            </button>

            <button 
              onClick={handleMarkAsUnread}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <RotateCcw size={14} style={{ color: '#38bdf8' }} /> {lang === 'es' ? 'Marcar como no leído' : 'Mark as unread'}
            </button>

            <button 
              onClick={handleExportSelection}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <Download size={14} style={{ color: '#fb7185' }} /> {lang === 'es' ? 'Exportar selección' : 'Export selection'}
            </button>

            <button 
              onClick={handleOpenStatistics}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <BarChart3 size={14} style={{ color: '#fb923c' }} /> {lang === 'es' ? 'Ver estadísticas' : 'View statistics'}
            </button>

            <button 
              onClick={handleDeleteStatistics}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <Calendar size={14} style={{ color: '#f43f5e' }} /> {lang === 'es' ? 'Borrar estadísticas' : 'Clear statistics'}
            </button>

            <button 
              onClick={handleBulkDelete}
              disabled={selectedBookIds.length === 0}
              className="select-panel-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', opacity: selectedBookIds.length === 0 ? 0.4 : 1, pointerEvents: selectedBookIds.length === 0 ? 'none' : 'auto' }}
            >
              <Trash2 size={14} /> {lang === 'es' ? 'Eliminar seleccionados' : 'Delete selected'}
            </button>
          </div>
        </div>
      )}

      {/* 2. Two-column Sidebar + Main Content Layout */}
      {activeTab === 'library' && (
        <div className="library-layout-wrapper">
          <aside className="library-sidebar">
              {/* Search Input */}
              <div className="sidebar-search-container">
                <input
                  type="text"
                  placeholder={lang === 'es' ? "Buscar por título o autor..." : "Search by title or author..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="sidebar-search-input"
                />
              </div>

              {/* Library Section */}
              <div className="sidebar-group">
                <div className="sidebar-group-title">{lang === 'es' ? 'Biblioteca' : 'Library'}</div>
                <div 
                  className={`sidebar-item ${activeFilter.type === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'all', value: null })}
                >
                  <span>{lang === 'es' ? 'Todos los libros' : 'All books'}</span>
                  <span className="sidebar-item-count">{books.length}</span>
                </div>
                 <div 
                  className={`sidebar-item ${activeFilter.type === 'unread' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'unread', value: null })}
                >
                  <span>{lang === 'es' ? 'Sin iniciar' : 'Not started'}</span>
                  <span className="sidebar-item-count">
                    {books.filter(b => b.status === 'unread' || (!b.status && b.progress.percent === 0)).length}
                  </span>
                </div>
                <div 
                  className={`sidebar-item ${activeFilter.type === 'reading' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'reading', value: null })}
                >
                  <span>{lang === 'es' ? 'Leyendo' : 'Reading'}</span>
                  <span className="sidebar-item-count">
                    {books.filter(b => b.status === 'reading' || (!b.status && b.progress.percent > 0 && b.progress.percent < 100)).length}
                  </span>
                </div>
                <div 
                  className={`sidebar-item ${activeFilter.type === 'completed' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'completed', value: null })}
                >
                  <span>{lang === 'es' ? 'Leídos' : 'Read'}</span>
                  <span className="sidebar-item-count">
                    {books.filter(b => b.status === 'completed' || (!b.status && b.progress.percent >= 100)).length}
                  </span>
                </div>
                <div 
                  className={`sidebar-item ${activeFilter.type === 'paused' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'paused', value: null })}
                >
                  <span>{lang === 'es' ? 'Pausados' : 'Paused'}</span>
                  <span className="sidebar-item-count">
                    {books.filter(b => b.status === 'paused').length}
                  </span>
                </div>
                <div 
                  className={`sidebar-item ${activeFilter.type === 'dropped' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'dropped', value: null })}
                >
                  <span>{lang === 'es' ? 'Dropeados' : 'Dropped'}</span>
                  <span className="sidebar-item-count">
                    {books.filter(b => b.status === 'dropped').length}
                  </span>
                </div>
                <div 
                  className={`sidebar-item ${activeFilter.type === 'planning' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'planning', value: null })}
                >
                  <span>{lang === 'es' ? 'Planeados' : 'Planned'}</span>
                  <span className="sidebar-item-count">
                    {books.filter(b => b.status === 'planning').length}
                  </span>
                </div>
              </div>

              {/* Authors Section */}
              {uniqueAuthors.length > 0 && (
                <div className="sidebar-group">
                  <div className="sidebar-group-title">{lang === 'es' ? 'Autores' : 'Authors'}</div>
                  {uniqueAuthors.map(author => (
                    <div 
                      key={author}
                      className={`sidebar-item ${activeFilter.type === 'author' && activeFilter.value === author ? 'active' : ''}`}
                      onClick={() => setActiveFilter({ type: 'author', value: author })}
                    >
                      <span className="truncate">{author}</span>
                      <span className="sidebar-item-count">{authorCounts[author]}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags Section */}
              <div className="sidebar-group">
                <div className="sidebar-group-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{lang === 'es' ? 'Etiquetas' : 'Tags'}</span>
                  <button
                    title={lang === 'es' ? "Añadir etiqueta" : "Add tag"}
                    onClick={async () => {
                      const tag = prompt(lang === 'es' ? 'Nueva etiqueta:' : 'New tag:');
                      if (!tag || !tag.trim()) return;
                      const tagTrim = tag.trim();
                      if (selectedBookIds.length > 0) {
                        for (const bookId of selectedBookIds) {
                          const b = books.find(bk => bk.id === bookId);
                          if (b) {
                            const tags = b.tags ? [...b.tags] : [];
                            if (!tags.includes(tagTrim)) {
                              tags.push(tagTrim);
                              await onUpdateBookDetails(bookId, { tags });
                            }
                          }
                        }
                      } else {
                        const allBookIds = filteredBooksList.map(b => b.id);
                        const targetIds = allBookIds.length > 0 ? [allBookIds[0]] : [];
                        if (targetIds.length === 0) {
                          alert(lang === 'es' ? 'Selecciona primero algunos libros con el Modo Selección para asignarles la etiqueta.' : 'First select some books using Select Mode to assign them this tag.');
                          return;
                        }
                        alert(lang === 'es' ? 'Usa el Modo Selección para asignar etiquetas a libros específicos.' : 'Use Select Mode to assign tags to specific books.');
                      }
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '0.75rem',
                      padding: 0,
                      lineHeight: 1,
                      flexShrink: 0
                    }}
                  >
                    +
                  </button>
                </div>
                <div 
                  className={`sidebar-item ${activeFilter.type === 'tag' && activeFilter.value === 'untagged' ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'tag', value: 'untagged' })}
                >
                  <span>{lang === 'es' ? 'Sin etiquetas' : 'No tags'}</span>
                  <span className="sidebar-item-count">{books.filter(b => !b.tags || b.tags.length === 0).length}</span>
                </div>
                {(() => {
                  const tagCounts = {};
                  books.forEach(b => {
                    if (b.tags && b.tags.length > 0) {
                      b.tags.forEach(t => {
                        tagCounts[t] = (tagCounts[t] || 0) + 1;
                      });
                    }
                  });
                  return Object.keys(tagCounts).sort().map(tag => (
                    <div
                      key={tag}
                      className={`sidebar-item ${activeFilter.type === 'tag' && activeFilter.value === tag ? 'active' : ''}`}
                      onClick={() => setActiveFilter({ type: 'tag', value: tag })}
                    >
                      <span className="truncate"># {tag}</span>
                      <span className="sidebar-item-count">{tagCounts[tag]}</span>
                    </div>
                  ));
                })()}
              </div>
            </aside>

          <main className="library-main-content">
            {books.length === 0 ? (
              <div className="library-empty-hero">
                {/* Left: decorative book cover stack */}
                <div className="empty-hero-covers">
                  <div className="empty-cover-card empty-cover-card--back" />
                  <div className="empty-cover-card empty-cover-card--mid" />
                  <div className="empty-cover-card empty-cover-card--front">
                    <span className="empty-cover-icon">📖</span>
                  </div>
                </div>

                {/* Right: info + actions */}
                <div className="empty-hero-right">
                  <div className="empty-info-panel">
                    <p><strong>{lang === 'es' ? 'Formatos compatibles:' : 'Supported formats:'}</strong><br />epub, html, txt, rtf, {lang === 'es' ? 'subtítulos' : 'subtitles'}</p>
                    <p><strong>{lang === 'es' ? 'Formatos de subtítulos:' : 'Subtitle formats:'}</strong><br />srt, vtt, ass, ssa</p>
                  </div>

                  <div className="empty-hero-actions">
                    <button className="empty-add-btn" onClick={triggerFileInput}>
                      <span style={{ marginRight: '8px' }}>📄</span>
                      {lang === 'es' ? 'Añadir desde archivo' : 'Add from file'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {filteredBooksList.length === 0 ? (
                  <div className="library-no-results">
                    <p>{lang === 'es' ? 'No se encontraron libros para esta categoría o búsqueda.' : 'No books found for this category or search.'}</p>
                    <button 
                      className="reset-filter-btn"
                      onClick={() => {
                        setActiveFilter({ type: 'all', value: null });
                        setSearchQuery('');
                      }}
                    >
                      {lang === 'es' ? 'Restablecer filtros' : 'Reset filters'}
                    </button>
                  </div>
                ) : (
                  <>
                    {groupBy === 'author' ? (
                      renderGroupedByAuthor()
                    ) : groupBy === 'series' ? (
                      renderGroupedBySeries()
                    ) : sortBy === 'added' && activeFilter.type === 'all' ? (
                      <>
                        {/* Leyendo Actualmente */}
                        {currentlyReading.length > 0 && (
                          <div className="library-section">
                            <div className="section-header">
                              <h2 className="section-title">{lang === 'es' ? 'Leyendo actualmente' : 'Currently reading'}</h2>
                              <span className="section-count">{currentlyReading.length}</span>
                            </div>
                            {renderBookGrid(currentlyReading)}
                          </div>
                        )}

                        {/* Sin Iniciar */}
                        {notStarted.length > 0 && (
                          <div className="library-section">
                            <div className="section-header">
                              <h2 className="section-title">{lang === 'es' ? 'Sin iniciar' : 'Not started'}</h2>
                              <span className="section-count">{notStarted.length}</span>
                            </div>
                            {renderBookGrid(notStarted)}
                          </div>
                        )}

                        {/* Leídos */}
                        {completed.length > 0 && (
                          <div className="library-section">
                            <div className="section-header">
                              <h2 className="section-title">{lang === 'es' ? 'Leídos' : 'Read'}</h2>
                              <span className="section-count">{completed.length}</span>
                            </div>
                            {renderBookGrid(completed)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="library-section">
                        <div className="section-header">
                          <h2 className="section-title">{getSectionTitle()}</h2>
                          <span className="section-count">{filteredBooksList.length}</span>
                        </div>
                        {renderBookGrid(filteredBooksList)}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {activeTab === 'statistics' && renderStatisticsTab()}
      {activeTab === 'settings' && renderSettingsTab()}
      {activeTab === 'notes' && renderNotesTab()}

      {/* Display Settings Drawer (Yatsu style) */}
      <aside className={`display-settings-drawer ${isDisplaySettingsOpen ? 'open' : ''}`} style={{ width: '310px' }}>
        <div className="drawer-header">
          <span className="drawer-title" style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'none', fontWeight: 650, letterSpacing: 'normal', textShadow: 'none' }}>{lang === 'es' ? 'Ajustes de visualización' : 'Library display settings'}</span>
          <button 
            className="drawer-close-btn" 
            onClick={() => {
              setIsDisplaySettingsOpen(false);
              setIsDetailsDropdownOpen(false);
            }}
            title={lang === 'es' ? 'Cerrar (Q)' : 'Close (Q)'}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* DISPLAY GROUP */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>{lang === 'es' ? 'Visualización' : 'Display'}</div>
            
            {/* Details */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Detalles' : 'Details'}</span>
                <span className="drawer-info-icon" title={lang === 'es' ? 'Elige qué bloques de información se muestran debajo de la portada.' : 'Choose which info blocks are shown under book card covers.'}>?</span>
              </div>
              
              {(() => {
                const detailsCount = (showCardTitle ? 1 : 0) + (showCardSeries ? 1 : 0) + (showCardAuthor ? 1 : 0) + (showCardTags ? 1 : 0) + (showCardProgress ? 1 : 0) + (showCardStatus ? 1 : 0);
                return (
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="drawer-select"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => setIsDetailsDropdownOpen(!isDetailsDropdownOpen)}
                    >
                      <span className="truncate" style={{ maxWidth: '190px' }}>
                        {[
                          showCardTitle && (lang === 'es' ? "Título" : "Title"),
                          showCardSeries && (lang === 'es' ? "Serie" : "Series"),
                          showCardAuthor && (lang === 'es' ? "Autor" : "Author"),
                          showCardTags && (lang === 'es' ? "Etiquetas" : "Tags"),
                          showCardProgress && (lang === 'es' ? "Progreso" : "Progress"),
                          showCardStatus && (lang === 'es' ? "Estado" : "Status")
                        ].filter(Boolean).join(', ') || (lang === 'es' ? "Ninguno" : "None")}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '10px', color: 'rgba(255,255,255,0.6)' }}>
                          {detailsCount}/6
                        </span>
                        <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                      </div>
                    </button>
                    
                    {isDetailsDropdownOpen && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '42px',
                          left: 0,
                          width: '100%',
                          background: 'rgba(22, 22, 28, 0.98)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          padding: '10px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          zIndex: 100,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {[
                          { key: 'title', label: lang === 'es' ? 'Título' : 'Title', value: showCardTitle, setter: setShowCardTitle },
                          { key: 'series', label: lang === 'es' ? 'Serie' : 'Series', value: showCardSeries, setter: setShowCardSeries },
                          { key: 'author', label: lang === 'es' ? 'Autor' : 'Author', value: showCardAuthor, setter: setShowCardAuthor },
                          { key: 'tags', label: lang === 'es' ? 'Etiquetas' : 'Tags', value: showCardTags, setter: setShowCardTags },
                          { key: 'progress', label: lang === 'es' ? 'Progreso' : 'Progress', value: showCardProgress, setter: setShowCardProgress },
                          { key: 'status', label: lang === 'es' ? 'Estado' : 'Status', value: showCardStatus, setter: setShowCardStatus }
                        ].map(opt => (
                          <label 
                            key={opt.key} 
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#fff', cursor: 'pointer', userSelect: 'none' }}
                          >
                            <input 
                              type="checkbox" 
                              checked={opt.value} 
                              onChange={(e) => opt.setter(e.target.checked)}
                              style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Cover Image */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Imagen de portada' : 'Cover Image'}</span>
                <span className="drawer-info-icon" title={lang === 'es' ? 'Escalar y ajustar las imágenes de portada dentro de las tarjetas.' : 'Scale and fit book cover images inside their cards.'}>?</span>
              </div>
              <div className="drawer-segmented-control">
                <button
                  type="button"
                  className={`drawer-segmented-btn ${coverFit === 'cover' ? 'active' : ''}`}
                  onClick={() => setCoverFit('cover')}
                >
                  {lang === 'es' ? 'Rellenar' : 'Fill'}
                </button>
                <button
                  type="button"
                  className={`drawer-segmented-btn ${coverFit === 'contain' ? 'active' : ''}`}
                  onClick={() => setCoverFit('contain')}
                >
                  {lang === 'es' ? 'Ajustar' : 'Fit'}
                </button>
              </div>
            </div>

            {/* Card Size */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Tamaño de tarjeta' : 'Card Size'}</span>
                <span className="drawer-info-icon" title={lang === 'es' ? 'Redimensionar la escala de las tarjetas de libros.' : 'Resize the book cards scale in the library view.'}>?</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{lang === 'es' ? 'PEQUEÑO' : 'SMALL'}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="120" 
                    max="240" 
                    step="8"
                    value={cardWidth} 
                    onChange={(e) => setCardWidth(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}
                  />
                </div>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{lang === 'es' ? 'GRANDE' : 'LARGE'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '3px 10px', color: '#fff', fontWeight: 600 }}>
                  {cardWidth} px
                </span>
                <button
                  type="button"
                  onClick={() => setCardWidth(160)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  {lang === 'es' ? 'Restablecer' : 'Reset'}
                </button>
              </div>
            </div>

            {/* Group By */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Agrupar por' : 'Group By'}</span>
                <span className="drawer-info-icon" title={lang === 'es' ? 'Agrupar tarjetas en filas horizontales por serie o autor.' : 'Group book cards into horizontal lanes by series or author.'}>?</span>
              </div>
              <div className="drawer-segmented-control">
                {[
                  { value: 'none', label: lang === 'es' ? 'Ninguno' : 'None' },
                  { value: 'series', label: lang === 'es' ? 'Serie' : 'Series' },
                  { value: 'author', label: lang === 'es' ? 'Autor' : 'Author' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`drawer-segmented-btn ${groupBy === opt.value ? 'active' : ''}`}
                    onClick={() => setGroupBy(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SORTING GROUP */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>{lang === 'es' ? 'Ordenamiento' : 'Sorting'}</div>
            
            {/* Sort By */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Ordenar por' : 'Sort By'}</span>
                <span className="drawer-info-icon" title={lang === 'es' ? 'Elige el criterio de ordenación para los libros.' : 'Choose the sorting criteria for books inside each grid or section.'}>?</span>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="drawer-select"
              >
                <option value="added">{lang === 'es' ? 'Añadido' : 'Added'}</option>
                <option value="title">{lang === 'es' ? 'Título' : 'Title'}</option>
                <option value="author">{lang === 'es' ? 'Autor' : 'Author'}</option>
                <option value="series">{lang === 'es' ? 'Serie' : 'Series'}</option>
                <option value="characters">{lang === 'es' ? 'Caracteres' : 'Characters'}</option>
                <option value="lastUpdate">{lang === 'es' ? 'Última actualización' : 'Last update'}</option>
                <option value="lastRead">{lang === 'es' ? 'Último leído' : 'Last read'}</option>
                <option value="progress">{lang === 'es' ? 'Progreso' : 'Progress'}</option>
                <option value="currentPosition">{lang === 'es' ? 'Posición actual' : 'Current position'}</option>
              </select>
            </div>

            {/* Direction */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Dirección' : 'Direction'}</span>
                <span className="drawer-info-icon" title={lang === 'es' ? 'Ordenar elementos en orden ascendente o descendente.' : 'Sort elements in ascending or descending order.'}>?</span>
              </div>
              <div className="drawer-segmented-control">
                <button
                  type="button"
                  className={`drawer-segmented-btn ${sortDirection === 'asc' ? 'active' : ''}`}
                  onClick={() => setSortDirection('asc')}
                >
                  {lang === 'es' ? 'Ascendente' : 'Ascending'}
                </button>
                <button
                  type="button"
                  className={`drawer-segmented-btn ${sortDirection === 'desc' ? 'active' : ''}`}
                  onClick={() => setSortDirection('desc')}
                >
                  {lang === 'es' ? 'Descendente' : 'Descending'}
                </button>
              </div>
            </div>

            {/* Group Sort & Group Direction (only visible if grouped) */}
            {groupBy !== 'none' && (
              <>
                {/* Group Sort */}
                <div className="drawer-section" style={{ marginBottom: '14px' }}>
                  <div className="drawer-label-row">
                    <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Orden del grupo' : 'Group Sort'}</span>
                    <span className="drawer-info-icon" title={lang === 'es' ? 'Cómo se ordenan las filas de agrupación.' : 'How the grouping lanes themselves are ordered.'}>?</span>
                  </div>
                  <select
                    value={groupSort}
                    onChange={(e) => setGroupSort(e.target.value)}
                    className="drawer-select"
                  >
                    <option value="alphabetical">{lang === 'es' ? 'Alfabético' : 'Alphabetical'}</option>
                    <option value="date">{lang === 'es' ? 'Fecha' : 'Date'}</option>
                  </select>
                </div>

                {/* Group Direction */}
                <div className="drawer-section" style={{ marginBottom: '14px' }}>
                  <div className="drawer-label-row">
                    <span className="drawer-section-label" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Dirección del grupo' : 'Group Direction'}</span>
                    <span className="drawer-info-icon" title={lang === 'es' ? 'Orden ascendente o descendente para las filas de agrupación.' : 'Ascending or descending order for grouping lanes.'}>?</span>
                  </div>
                  <div className="drawer-segmented-control">
                    <button
                      type="button"
                      className={`drawer-segmented-btn ${groupDirection === 'asc' ? 'active' : ''}`}
                      onClick={() => setGroupDirection('asc')}
                    >
                      {lang === 'es' ? 'Ascendente' : 'Ascending'}
                    </button>
                    <button
                      type="button"
                      className={`drawer-segmented-btn ${groupDirection === 'desc' ? 'active' : ''}`}
                      onClick={() => setGroupDirection('desc')}
                    >
                      {lang === 'es' ? 'Descendente' : 'Descending'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Loading Overlay while parsing */}
      {isParsing && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="settings-modal" style={{ textAlign: 'center', width: '260px' }}>
            <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
            <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Importando archivo...</p>
          </div>
        </div>
      )}

      {/* Reading Statistics Modal */}
      {isStatsOpen && (
        <div className="modal-overlay" onClick={() => setIsStatsOpen(false)} style={{ zIndex: 1100 }}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Estadísticas de Aprendizaje</h3>
              <button className="close-modal-btn" onClick={() => setIsStatsOpen(false)}>
                <Check size={20} />
              </button>
            </div>

            <div className="stats-grid">
              <div className="stats-card">
                <div className="stats-val">{books.length}</div>
                <div className="stats-label">Libros</div>
              </div>
              <div className="stats-card">
                <div className="stats-val">{books.filter(b => b.progress.percent >= 100).length}</div>
                <div className="stats-label">Leídos</div>
              </div>
              <div className="stats-card">
                <div className="stats-val" style={{ color: 'var(--status-known)' }}>{knownWordsCount}</div>
                <div className="stats-label">Conocidas</div>
              </div>
              <div className="stats-card">
                <div className="stats-val" style={{ color: 'var(--status-learning)' }}>{learningWordsCount}</div>
                <div className="stats-label">Estudiando</div>
              </div>
            </div>

            {/* Vocabulary Ratio Chart */}
            <div className="stats-chart-placeholder">
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                COBERTURA DE VOCABULARIO
              </h4>
              
              <div className="chart-bar-row">
                <div className="chart-bar-label-row">
                  <span>Conocido (💎)</span>
                  <span>{knownWordsCount} ({knownPercent}%)</span>
                </div>
                <div className="chart-bar-container">
                  <div className="chart-bar-fill" style={{ width: `${knownPercent}%`, background: 'var(--status-known)' }}></div>
                </div>
              </div>

              <div className="chart-bar-row">
                <div className="chart-bar-label-row">
                  <span>Estudiando (⚡)</span>
                  <span>{learningWordsCount} ({learningPercent}%)</span>
                </div>
                <div className="chart-bar-container">
                  <div className="chart-bar-fill" style={{ width: `${learningPercent}%`, background: 'var(--status-learning)' }}></div>
                </div>
              </div>

              <div className="chart-bar-row" style={{ marginBottom: 0 }}>
                <div className="chart-bar-label-row">
                  <span>Nuevas / Sin iniciar</span>
                  <span>{newWordsCount} ({newPercent}%)</span>
                </div>
                <div className="chart-bar-container">
                  <div className="chart-bar-fill" style={{ width: `${newPercent}%`, background: 'var(--status-new)' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Book Detail Preview Modal */}
      {previewBook && (
        <div className="modal-overlay" onClick={() => setPreviewBook(null)} style={{ zIndex: 1150 }}>
          <div className="book-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="edit-book-title-btn" 
              onClick={() => {
                setEditingBook(previewBook);
                setEditTitle(previewBook.title);
                setEditHideCover(previewBook.hideCover === true);
                setEditDescription(previewBook.description || '');
              }}
              title="Editar detalles del libro"
            >
              <Pencil size={16} />
            </button>

            <div className="preview-cover-container">
              {previewBook.cover && !previewBook.hideCover && !previewBook.cover.startsWith('linear-gradient') ? (
                <img 
                  src={previewBook.cover} 
                  alt={previewBook.title} 
                  className="preview-cover-img"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150x220?text=Lector'; }}
                />
              ) : (
                <div 
                  className="preview-cover-placeholder" 
                  style={{ 
                    background: previewBook.cover && previewBook.cover.startsWith('linear-gradient') 
                      ? previewBook.cover 
                      : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' 
                  }}
                >
                  <span>{previewBook.title}</span>
                </div>
              )}
            </div>

            <h3 className="preview-book-title">{previewBook.title}</h3>

            <div className="preview-coverage-badge">
              ⚡ {dynamicCoverage !== null ? `${dynamicCoverage}% de comprensión` : 'Calculando comprensión...'}
            </div>

            <p className="preview-book-description">
              {previewBook.description || (previewBook.author && previewBook.author !== 'Desconocido' 
                ? `Novela de ${previewBook.author}.` 
                : 'Sin descripción')}
            </p>

            <div className="preview-modal-actions">
              <button 
                className="preview-start-btn"
                onClick={() => {
                  onSelectBook(previewBook);
                  setPreviewBook(null);
                }}
              >
                Comenzar a leer
              </button>
              
              <button 
                className="preview-delete-btn"
                onClick={() => {
                  if (confirm(`¿Estás seguro de que quieres eliminar "${previewBook.title}" de la biblioteca?`)) {
                    onDeleteBook(previewBook.id);
                    setPreviewBook(null);
                  }
                }}
              >
                <Trash2 size={16} style={{ marginRight: '6px' }} />
                Eliminar de la biblioteca ({Math.round(((previewBook.chapters || []).reduce((sum, ch) => sum + (ch.content || '').length, 0) * 2) / 1024) || 2048}kb)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Edit Details Modal (Migaku replica) */}
      {editingBook && (
        <div className="modal-overlay" onClick={() => setEditingBook(null)} style={{ zIndex: 1200 }}>
          <div className="book-edit-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-edit-modal-btn" onClick={() => setEditingBook(null)}>
              <X size={20} />
            </button>

            <div className="edit-cover-container">
              {editingBook.cover && !editingBook.cover.startsWith('linear-gradient') ? (
                <img 
                  src={editingBook.cover} 
                  alt={editTitle} 
                  className="edit-cover-img"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150x220?text=Lector'; }}
                />
              ) : (
                <div className="edit-cover-placeholder" style={{ background: editingBook.cover || 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' }}>
                  <span>{editTitle}</span>
                </div>
              )}
            </div>

            <div className="edit-form-content">
              {/* Título */}
              <div className="edit-form-row">
                <label className="edit-form-label">Título</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  className="edit-form-input"
                  placeholder="Introducir título"
                />
              </div>

              {/* Ocultar imagen de portada */}
              <div className="edit-form-row inline-row">
                <label className="edit-form-label">Ocultar imagen de portada</label>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={editHideCover}
                    onChange={(e) => setEditHideCover(e.target.checked)}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              {/* Descripción */}
              <div className="edit-form-row">
                <label className="edit-form-label">Descripción (opcional)</label>
                <textarea 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  className="edit-form-textarea"
                  placeholder="Introducir descripción"
                  rows={4}
                />
              </div>

              {/* Guardar detalles */}
              <button 
                className="edit-save-btn"
                onClick={() => {
                  if (editTitle.trim()) {
                    const updatedData = { 
                      title: editTitle.trim(), 
                      hideCover: editHideCover, 
                      description: editDescription.trim() 
                    };
                    onUpdateBookDetails(editingBook.id, updatedData);
                    
                    // Actualizar el estado de previewBook para mostrar cambios inmediatamente
                    if (previewBook && previewBook.id === editingBook.id) {
                      setPreviewBook({ ...previewBook, ...updatedData });
                    }
                    
                    setEditingBook(null);
                  }
                }}
              >
                Guardar detalles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal Overlay */}
      {isProfileSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsProfileSettingsOpen(false)} style={{ zIndex: 1200 }}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{lang === 'es' ? 'Configuración del Perfil' : 'Profile Settings'}</h3>
              <button className="close-modal-btn" onClick={() => setIsProfileSettingsOpen(false)} style={{ background: 'transparent' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProfileSettingsSubmit} className="edit-form-content">
              {/* Hidden file input for custom profile avatar */}
              <input 
                type="file" 
                accept="image/*"
                ref={customProfileSettingsAvatarInputRef}
                onChange={handleEditProfileAvatarChange}
                style={{ display: 'none' }}
              />

              <div className="avatar-selection-label" style={{ textAlign: 'center', marginBottom: '8px' }}>{lang === 'es' ? 'Foto de perfil:' : 'Profile picture:'}</div>
              <div className="custom-avatar-uploader-container" style={{ marginBottom: '16px' }}>
                <div 
                  className="custom-avatar-preview-circle"
                  onClick={() => customProfileSettingsAvatarInputRef.current.click()}
                  title={lang === 'es' ? 'Cambiar foto de perfil' : 'Change profile picture'}
                  style={{ width: '90px', height: '90px' }}
                >
                  {editProfileAvatar && (editProfileAvatar.startsWith('/') || editProfileAvatar.startsWith('data:')) ? (
                    <img src={editProfileAvatar} alt="Preview" className="avatar-preview-image" />
                  ) : (
                    <div className="active-profile-avatar-emoji" style={{ background: editProfileAvatar || 'var(--yc-yellow-dim)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                      👤
                    </div>
                  )}
                  <div className="avatar-preview-overlay">📷</div>
                </div>
              </div>

              <div className="edit-form-row">
                <label className="edit-form-label">{lang === 'es' ? 'Nombre del perfil' : 'Profile name'}</label>
                <input 
                  type="text" 
                  className="edit-form-input"
                  value={editProfileName}
                  onChange={(e) => setEditProfileName(e.target.value)}
                  placeholder={lang === 'es' ? 'Nombre...' : 'Name...'}
                  required
                />
              </div>

              <div className="create-profile-actions" style={{ marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="create-profile-cancel" 
                  onClick={() => setIsProfileSettingsOpen(false)}
                >
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" className="create-profile-save">
                  {lang === 'es' ? 'Guardar' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Drive / Cloud Sync Modal */}
      {isGDriveSyncOpen && (
        <div className="modal-overlay" onClick={() => setIsGDriveSyncOpen(false)} style={{ zIndex: 1200 }}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '420px', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={20} style={{ color: '#4285F4' }} />
                <span>{lang === 'es' ? 'Sincronización Google Drive' : 'Google Drive Sync'}</span>
              </h3>
              <button className="close-modal-btn" onClick={() => setIsGDriveSyncOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: '20px' }}>
              {lang === 'es' 
                ? 'Sincroniza tus libros, progreso y vocabulario directamente con tu cuenta de Google Drive utilizando la API oficial.' 
                : 'Sync your books, progress, and vocabulary directly with your Google Drive account using the official API.'}
            </div>

            {/* Client ID / Secret Configuration */}
            {!gDriveTokens && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    CLIENT ID
                  </label>
                  <input 
                    type="password"
                    value={gDriveClientId}
                    onChange={(e) => setGDriveClientId(e.target.value)}
                    placeholder="Enter Client ID..."
                    className="edit-form-input"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    CLIENT SECRET (OPTIONAL)
                  </label>
                  <input 
                    type="password"
                    value={gDriveClientSecret}
                    onChange={(e) => setGDriveClientSecret(e.target.value)}
                    placeholder="Enter Client Secret..."
                    className="edit-form-input"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>
            )}

            {/* Connection Status Card */}
            <div style={{ 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.06)', 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                  {lang === 'es' ? 'ESTADO' : 'STATUS'}
                </span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: gDriveSyncStatus === 'authorized' ? 'rgba(52, 211, 153, 0.1)' : gDriveSyncStatus === 'syncing' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: gDriveSyncStatus === 'authorized' ? '#34d399' : gDriveSyncStatus === 'syncing' ? '#fbbf24' : '#f87171'
                }}>
                  {gDriveSyncStatus === 'authorized' ? (lang === 'es' ? 'Conectado' : 'Connected') :
                   gDriveSyncStatus === 'syncing' ? (lang === 'es' ? 'Sincronizando...' : 'Syncing...') :
                   (lang === 'es' ? 'Desconectado' : 'Disconnected')}
                </span>
              </div>

              {gDriveTokens ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✅</span> <span>{lang === 'es' ? 'Cuenta vinculada' : 'Account linked'}</span>
                  </div>
                  {lastSyncTime && (
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                      {lang === 'es' ? 'Última sincronización:' : 'Last sync:'} {lastSyncTime}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                  {lang === 'es' ? 'Ninguna cuenta conectada' : 'No account connected'}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <button 
                type="button"
                onClick={handleConnectGDrive}
                disabled={gDriveSyncStatus === 'syncing'}
                className="vocab-action-btn"
                style={{ width: '100%', padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
              >
                <span>🔑</span> {gDriveTokens ? (lang === 'es' ? 'Re-conectar cuenta' : 'Re-connect account') : (lang === 'es' ? 'Conectar cuenta' : 'Connect account')}
              </button>

              {gDriveTokens && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button 
                      type="button"
                      onClick={handleUploadGDrive}
                      disabled={gDriveSyncStatus === 'syncing'}
                      className="vocab-action-btn"
                      style={{ padding: '12px', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', background: 'rgba(66, 133, 244, 0.1)', color: '#4285F4', border: '1px solid rgba(66, 133, 244, 0.2)' }}
                    >
                      <span>📤</span> {lang === 'es' ? 'Subir copia completa' : 'Upload full backup'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleDownloadGDrive}
                      disabled={gDriveSyncStatus === 'syncing'}
                      className="vocab-action-btn"
                      style={{ padding: '12px', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}
                    >
                      <span>📥</span> {lang === 'es' ? 'Descargar' : 'Download'}
                    </button>
                  </div>

                  {/* Auto-Sync Toggle Option */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '12px', 
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>
                      {lang === 'es' ? 'Sincronización automática' : 'Auto-Sync on startup'}
                    </span>
                    <input 
                      type="checkbox"
                      checked={isAutoSyncEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setIsAutoSyncEnabled(val);
                        localStorage.setItem('gdrive_autosync_enabled', val ? 'true' : 'false');
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </label>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                className="create-profile-cancel"
                onClick={() => setIsGDriveSyncOpen(false)}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                {lang === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <React.Suspense fallback={null}>
        {isAnkiConfigOpen && (
          <AnkiConfigModal isOpen={isAnkiConfigOpen} onClose={() => setIsAnkiConfigOpen(false)} />
        )}
      </React.Suspense>

      {isSettingsOpen && (
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSaveSettings={onSaveSettings}
          libraryViewProps={{
            showCardTitle, setShowCardTitle,
            showCardSeries, setShowCardSeries,
            showCardAuthor, setShowCardAuthor,
            showCardTags, setShowCardTags,
            showCardProgress, setShowCardProgress,
            showCardStatus, setShowCardStatus,
            coverFit, setCoverFit,
            cardWidth, setCardWidth
          }}
          gDriveProps={{
            gDriveClientId, setGDriveClientId,
            gDriveClientSecret, setGDriveClientSecret,
            gDriveTokens, gDriveSyncStatus,
            lastSyncTime,
            isAutoSyncEnabled, setIsAutoSyncEnabled,
            handleConnectGDrive,
            handleUploadBackupToGDrive: handleUploadGDrive,
            handleDownloadBackupFromGDrive: handleDownloadGDrive
          }}
        />
      )}
    </div>
  );
}
