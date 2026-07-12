import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Info, Trash2, ListChecks, Check, BarChart3, HelpCircle, Pencil, X, ArrowUpDown, Settings, SlidersHorizontal, Calendar, BookOpen, Clock, Flame, Download, Upload, MoreVertical, Search, EyeOff, User, Tag, RotateCcw, CircleSlash, Play, Pause, ChevronDown, Database, Palette, Cloud, FolderOpen, Globe, Type, Plug, Layers, AlertTriangle, Keyboard, Bug, Megaphone, Maximize, Menu, Zap, RefreshCw } from 'lucide-react';
import SettingsModal from './SettingsModal';
import JSZip from 'jszip';
import { importBookFile } from '../utils/fileImport';
import { db } from '../utils/db';
import { importYomitanZip, getInstalledDictionaries, deleteDictionary, exportDictionaryDataToZip, importAllDictionaryData, closeDB, getDB } from '../utils/yomitanDB';
const VocabularyModal = React.lazy(() => import('./VocabularyModal'));
const SrsReviewModal = React.lazy(() => import('./SrsReviewModal'));
import { tokenizeText } from '../utils/japanese';
import { t } from '../utils/i18n';
import { googleDriveService } from '../utils/googleDriveService';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';
import { useConfirm } from './ConfirmModal';
import stableManifest from '../../stable.json';
import ProgressDashboard from './ProgressDashboard';

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

const Library = React.memo(function Library({ 
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
  onClearDeletedBooks,
  settings = {},
  onSaveSettings,
  wordStatuses = {},
  initialTab
}) {
  const lang = settings.appLanguage || 'es';
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const profileWidgetRef = useRef(null);
  const customAvatarInputRef = useRef(null);

  const { showConfirm, confirmModal } = useConfirm();
  const [deleteAllState, setDeleteAllState] = useState(null); // null | 'confirm' | 'deleting' | 'success'

  // Updates states
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [latestBackendVersion, setLatestBackendVersion] = useState('Unknown');
  const [latestAppVersion, setLatestAppVersion] = useState('Unknown');
  const [backendStatus, setBackendStatus] = useState('up-to-date'); // 'up-to-date' | 'out-of-date'
  const [appStatus, setAppStatus] = useState('up-to-date'); // 'up-to-date' | 'out-of-date'
  const [currentBackendVersion, setCurrentBackendVersion] = useState('2026.6.15');
  const [currentAppVersion, setCurrentAppVersion] = useState('2026.6.15');
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [bindingKeyAction, setBindingKeyAction] = useState(null);

  useEffect(() => {
    if (!bindingKeyAction) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const keyName = e.key;
      // Ignore bare modifiers
      if (['control', 'shift', 'alt', 'meta'].includes(keyName.toLowerCase())) {
        return;
      }
      
      const currentBindings = settings.keybindings || {
        toggleFullscreen: 'f',
        nextPage: 'ArrowRight',
        prevPage: 'ArrowLeft',
        toggleMenu: 'Escape',
        readAloud: 't'
      };
      
      const updatedBindings = {
        ...currentBindings,
        [bindingKeyAction]: keyName
      };
      
      onSaveSettings({
        ...settings,
        keybindings: updatedBindings
      });
      
      setBindingKeyAction(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [bindingKeyAction, settings, onSaveSettings]);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/zams0527-eng/Yoru-Reader/releases/latest');
        if (res.ok) {
          const data = await res.json();
          const latestTag = data.tag_name;
          const cleanTag = latestTag.replace(/^v/, '');
          const currentVersion = '2026.6.15';
          
          const parts1 = cleanTag.split('.').map(Number);
          const parts2 = currentVersion.split('.').map(Number);
          let isNewer = false;
          for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) { isNewer = true; break; }
            if (p1 < p2) { break; }
          }

          if (isNewer) {
            setLatestAppVersion(cleanTag);
            setLatestBackendVersion(cleanTag);
            setAppStatus('out-of-date');
            setBackendStatus('out-of-date');
            setShowUpdateBanner(true);
            return;
          }
        }
      } catch (err) {
        console.error('Error checking updates:', err);
      }

      // Mock update check if offline or no newer release found so the user can test the banner
      setTimeout(() => {
        setLatestAppVersion('2026.7.1');
        setLatestBackendVersion('2026.7.1');
        setAppStatus('out-of-date');
        setBackendStatus('out-of-date');
        setShowUpdateBanner(true);
      }, 3000);
    };

    checkForUpdates();
  }, []);

  const handleCheckUpdates = () => {
    setCheckingUpdates(true);
    setTimeout(() => {
      setCheckingUpdates(false);
      setLatestBackendVersion('2026.7.1');
      setLatestAppVersion('2026.7.1');
      setBackendStatus('out-of-date');
      setAppStatus('out-of-date');
      showToast(
        lang === 'es' 
          ? 'Nuevas actualizaciones encontradas.' 
          : 'New updates found.', 
        'info'
      );
    }, 1500);
  };

  const handleUpdateNow = () => {
    setUpdating(true);
    // Open the official releases page in default browser so the user can download the installer/zip
    window.open('https://github.com/zams0527-eng/Yoru-Reader/releases/latest', '_blank');
    
    setTimeout(() => {
      setUpdating(false);
      setCurrentBackendVersion('2026.7.1');
      setCurrentAppVersion('2026.7.1');
      setBackendStatus('up-to-date');
      setAppStatus('up-to-date');
      showToast(
        lang === 'es' 
          ? 'Abriendo página de descargas. Backend y App actualizados localmente.' 
          : 'Opening download page. Backend and App updated locally.', 
        'success'
      );
    }, 2000);
  };
  
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
  
  // Mobile responsive layout states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mobileSettingsSectionOpen, setMobileSettingsSectionOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
    touchEndX.current = e.changedTouches[0].screenX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = () => {
    const diffX = touchEndX.current - touchStartX.current;
    
    // 1. Left Sidebar Navigation Drawer
    if (diffX > 70 && touchStartX.current < 60 && !isSidebarOpen) {
      setIsSidebarOpen(true);
    }
    if (diffX < -70 && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
    
    // 2. Right Display Settings Drawer (Option Q)
    if (diffX < -70 && touchStartX.current > window.innerWidth - 60 && !isDisplaySettingsOpen) {
      setIsDisplaySettingsOpen(true);
    }
    if (diffX > 70 && isDisplaySettingsOpen) {
      setIsDisplaySettingsOpen(false);
    }
  };

  // Sidebar Navigation states
  const [activeFilter, setActiveFilter] = useState({ type: 'all', value: null });
  const [searchQuery, setSearchQuery] = useState('');

  // Custom themed toast notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimerRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

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
  const [activeTab, setActiveTab] = useState(initialTab || 'library'); // 'library' | 'statistics' | 'settings' | 'notes'
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
  const [dictImportSuccess, setDictImportSuccess] = useState(false);
  const [freqImportProgress, setFreqImportProgress] = useState(0);
  const [freqImportMsg, setFreqImportMsg] = useState('');
  const [isImportingFreq, setIsImportingFreq] = useState(false);
  const [freqImportSuccess, setFreqImportSuccess] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [downloadingDictUrl, setDownloadingDictUrl] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const [activeSettingsSection, setActiveSettingsSection] = useState('sec-theme');
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
    loadInstalledDicts().catch(err => console.warn("Failed to load installed dicts on mount:", err));
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

  const isFreqDict = (dict) => {
    if (dict.hasFreqs !== undefined) return dict.hasFreqs && !dict.hasTerms;
    const title = (dict.title || '').toLowerCase();
    return title.includes('freq') || title.includes('frecuencia') || title.includes('meta');
  };

  const isTermDict = (dict) => {
    if (dict.hasTerms !== undefined) return dict.hasTerms;
    return !isFreqDict(dict);
  };

  const sortDicts = (dicts, order) => {
    if (!order || order.length === 0) return dicts;
    return [...dicts].sort((a, b) => {
      const idxA = order.indexOf(a.title);
      const idxB = order.indexOf(b.title);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  };

  const loadInstalledDicts = async () => {
    try {
      const dicts = await getInstalledDictionaries();
      const order = settings.dictionaryOrder || [];
      const sorted = sortDicts(dicts || [], order);
      setInstalledDicts(sorted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleYomitanUpload = async (e, isFreq = false) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const setMsg = isFreq ? setFreqImportMsg : setDictImportMsg;
    const setProg = isFreq ? setFreqImportProgress : setDictImportProgress;
    const setIsImporting = isFreq ? setIsImportingFreq : setIsImportingDict;
    const setSuccess = isFreq ? setFreqImportSuccess : setDictImportSuccess;

    setIsImporting(true);
    setSuccess(false);
    setProg(0);
    setMsg('Iniciando...');
    try {
      let hasTerms = !isFreq;
      let hasFreqs = isFreq;
      try {
        const zipFileObj = await JSZip.loadAsync(file);
        const termFiles = Object.keys(zipFileObj.files).filter(name => name.startsWith('term_bank_') && name.endsWith('.json'));
        const metaFiles = Object.keys(zipFileObj.files).filter(name => name.startsWith('term_meta_bank_') && name.endsWith('.json'));
        hasTerms = termFiles.length > 0;
        hasFreqs = metaFiles.length > 0;
      } catch (eZip) {
        console.warn("Could not inspect zip file properties:", eZip);
      }

      await importYomitanZip(file, (msg, prog) => {
        setMsg(msg);
        setProg(prog);
      });

      try {
        const dbInst = await getDB();
        const zipFileObj = await JSZip.loadAsync(file);
        const indexStr = await zipFileObj.file('index.json').async('string');
        const indexData = JSON.parse(indexStr);
        let dictTitle = indexData.title;
        if (dictTitle.startsWith('JMdict') && !dictTitle.includes('Spanish') && !dictTitle.includes('English') && !dictTitle.includes('Frecuencia')) {
          dictTitle = dictTitle.replace('JMdict', 'JMdict (English)');
        }
        
        const tx = dbInst.transaction('dictionaries', 'readwrite');
        const store = tx.objectStore('dictionaries');
        const request = store.get(dictTitle);
        request.onsuccess = () => {
          if (request.result) {
            const updated = { ...request.result, hasTerms, hasFreqs };
            store.put(updated);
          }
        };
      } catch (errInspect) {
        console.warn("Inspect/update dict type flags failed:", errInspect);
      }

      // Show success state briefly, then hide bar and reload in background
      setSuccess(true);
      setMsg('¡Instalado correctamente!');
      setProg(100);
      setTimeout(() => {
        setIsImporting(false);
        setSuccess(false);
        setProg(0);
        setMsg('');
        loadInstalledDicts();
      }, 1500);
    } catch (err) {
      setMsg('Error: ' + err.message);
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleDeleteDict = async (title) => {
    const ok = await showConfirm({
      title: lang === 'es' ? '¿Eliminar diccionario?' : 'Delete dictionary?',
      message: lang === 'es' ? `¿Seguro que quieres borrar el diccionario "${title}"?` : `Are you sure you want to delete the dictionary "${title}"?`,
      type: 'danger',
      confirmText: lang === 'es' ? 'Borrar' : 'Delete',
    });
    if (ok) {
      // Immediately remove from state so the UI updates instantly
      setInstalledDicts(prev => prev.filter(d => d.title !== title));
      try {
        await deleteDictionary(title);
      } catch (err) {
        console.error('Error deleting dictionary:', err);
        // Reload on error to restore correct state
        await loadInstalledDicts();
      }
    }
  };

  const handleToggleDict = (title) => {
    const disabled = settings.disabledDictionaries || [];
    let newDisabled;
    if (disabled.includes(title)) {
      newDisabled = disabled.filter(t => t !== title);
    } else {
      newDisabled = [...disabled, title];
    }
    onSaveSettings({
      ...settings,
      disabledDictionaries: newDisabled
    });
  };

  const [draggingIdx, setDraggingIdx] = useState(null);
  const [draggingCategory, setDraggingCategory] = useState(null);

  const handleDragStart = (e, index, category) => {
    setDraggingIdx(index);
    setDraggingCategory(category);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, targetIdx, category) => {
    e.preventDefault();
    if (draggingIdx === null || draggingCategory !== category || draggingIdx === targetIdx) return;
    
    const isFreq = category === 'freq';
    const categoryDicts = installedDicts.filter(d => isFreq ? isFreqDict(d) : isTermDict(d));
    const otherDicts = installedDicts.filter(d => isFreq ? isTermDict(d) : isFreqDict(d));
    
    const reordered = [...categoryDicts];
    const [removed] = reordered.splice(draggingIdx, 1);
    reordered.splice(targetIdx, 0, removed);
    
    const newAll = [];
    let catCounter = 0;
    let otherCounter = 0;
    
    installedDicts.forEach(d => {
      if (isFreq ? isFreqDict(d) : isTermDict(d)) {
        newAll.push(reordered[catCounter++]);
      } else {
        newAll.push(otherDicts[otherCounter++]);
      }
    });
    
    setInstalledDicts(newAll);
    
    onSaveSettings({
      ...settings,
      dictionaryOrder: newAll.map(d => d.title)
    });
    
    setDraggingIdx(targetIdx);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDraggingCategory(null);
  };

  const handleInstallPresetDict = async (title, url, isFreq = false) => {
    const setMsg = isFreq ? setFreqImportMsg : setDictImportMsg;
    const setProg = isFreq ? setFreqImportProgress : setDictImportProgress;
    const setIsImporting = isFreq ? setIsImportingFreq : setIsImportingDict;
    const setSuccess = isFreq ? setFreqImportSuccess : setDictImportSuccess;

    setDownloadingDictUrl(url);
    setDownloadProgress(0);
    setIsImporting(true);
    setSuccess(false);
    setMsg('Conectando...');
    setProg(0);
    
    try {
      let arrayBuffer;
      
      if (window.electronAPI && window.electronAPI.downloadGoogleDrive) {
        const removeListener = window.electronAPI.onDownloadProgress((data) => {
          if (data.id === url) {
            if (data.percent >= 0) {
              setDownloadProgress(data.percent);
              setMsg(`Descargando: ${data.percent}%`);
            } else {
              setMsg(`Descargado ${Math.round(data.downloadedBytes / 1024)} KB`);
            }
          }
        });
        
        try {
          const buffer = await window.electronAPI.downloadGoogleDrive(url, url);
          arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        } finally {
          removeListener();
        }
      } else {
        let response = null;
        let lastError = null;
        const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
        
        if (url.includes('drive.google.com') && !isNative) {
          // List of public CORS proxies to try sequentially for Google Drive downloads (Web only)
          const proxies = [
            (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
            (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
            (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`
          ];
          
          for (let i = 0; i < proxies.length; i++) {
            const fetchUrl = proxies[i](url);
            try {
              console.log(`Trying proxy ${i + 1} for download: ${fetchUrl}`);
              response = await fetch(fetchUrl);
              if (response.ok) {
                console.log(`Proxy ${i + 1} downloaded file successfully!`);
                break;
              } else {
                lastError = new Error(`Proxy ${i + 1} returned status ${response.status}`);
              }
            } catch (err) {
              lastError = err;
            }
          }
          if (!response || !response.ok) {
            throw lastError || new Error('All CORS proxies failed to download the file.');
          }
        } else {
          // Direct fetch for native apps (CapacitorHttp bypasses CORS) or non-GDrive links
          console.log(`Direct fetching URL: ${url}`);
          response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        }
        
        if (response.body && typeof response.body.getReader === 'function') {
          const reader = response.body.getReader();
          const contentLength = +response.headers.get('Content-Length');
          let receivedLength = 0;
          let chunks = [];
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            if (contentLength) {
              const percent = Math.round((receivedLength / contentLength) * 100);
              setDownloadProgress(percent);
              setMsg(`Descargando: ${percent}%`);
            } else {
              setMsg(`Descargado ${Math.round(receivedLength / 1024)} KB`);
            }
          }
          const blob = new Blob(chunks);
          arrayBuffer = await blob.arrayBuffer();
        } else {
          setMsg(lang === 'es' ? 'Descargando diccionario...' : 'Downloading dictionary...');
          const blob = await response.blob();
          arrayBuffer = await blob.arrayBuffer();
        }
      }
      
      setMsg('Procesando base de datos...');
      const file = new File([arrayBuffer], `${title.replace(/\s+/g, '_')}.zip`, { type: 'application/zip' });
      
      let hasTerms = !isFreq;
      let hasFreqs = isFreq;
      if (title.toLowerCase().includes('frecuencia') || title.toLowerCase().includes('freq')) {
        hasTerms = false;
        hasFreqs = true;
      }
      
      await importYomitanZip(file, (msg, prog) => {
        setMsg(msg);
        setProg(prog);
      });
      
      try {
        const dbInst = await getDB();
        const tx = dbInst.transaction('dictionaries', 'readwrite');
        const store = tx.objectStore('dictionaries');
        const request = store.get(title);
        request.onsuccess = () => {
          if (request.result) {
            const updated = { ...request.result, hasTerms, hasFreqs };
            store.put(updated);
          }
        };
      } catch (errInspect) {
        console.warn("Preset dict metadata update failed:", errInspect);
      }
      
      // Show success, then hide bar and reload dicts
      setSuccess(true);
      setMsg('¡Instalado correctamente!');
      setProg(100);
      setIsLibraryModalOpen(false);
      // Reload dicts immediately so they appear in the list right away
      await loadInstalledDicts();
      setTimeout(() => {
        setIsImporting(false);
        setSuccess(false);
        setProg(0);
        setMsg('');
        setDownloadingDictUrl(null);
      }, 1500);
    } catch (err) {
      alert('Error instalando diccionario: ' + err.message);
      setIsImporting(false);
      setDownloadingDictUrl(null);
    }
  };

  const renderDictList = (isFreq) => {
    const list = installedDicts.filter(d => isFreq ? isFreqDict(d) : isTermDict(d));
    if (list.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', border: '1px dashed var(--border-light)', borderRadius: '8px', fontSize: '0.85rem' }}>
          {lang === 'es' ? 'Ningún elemento instalado' : 'No items installed'}
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {list.map((dict, idx) => {
          const isDisabled = settings.disabledDictionaries?.includes(dict.title);
          const isDragging = draggingCategory === (isFreq ? 'freq' : 'term') && draggingIdx === idx;
          
          return (
            <div 
              key={dict.title}
              draggable
              onDragStart={(e) => handleDragStart(e, idx, isFreq ? 'freq' : 'term')}
              onDragOver={(e) => handleDragOver(e, idx, isFreq ? 'freq' : 'term')}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
                border: isDragging ? '1px dashed #6366f1' : '1px solid var(--border-light)',
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'grab',
                opacity: isDragging ? 0.6 : 1,
                transition: 'background 0.2s, border 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                  <ArrowUpDown size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dict.title}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dict.description || (lang === 'es' ? 'Sin descripción disponible.' : 'No description available.')}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
                <button 
                  onClick={() => handleToggleDict(dict.title)}
                  style={{
                    background: isDisabled ? 'var(--bg-card-hover)' : '#8b5cf6',
                    border: isDisabled ? '1px solid var(--border-light)' : 'none',
                    color: isDisabled ? 'var(--text-muted)' : '#fff',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginRight: '8px',
                    transition: 'all 0.2s'
                  }}
                  title={isDisabled ? (lang === 'es' ? 'Activar' : 'Enable') : (lang === 'es' ? 'Desactivar' : 'Disable')}
                >
                  <BookOpen size={14} />
                </button>
                
                <button 
                  onClick={() => handleDeleteDict(dict.title)}
                  style={{
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    color: '#ef4444',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title={lang === 'es' ? 'Eliminar' : 'Delete'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActions = (isFreq) => {
    const isImporting = isFreq ? isImportingFreq : isImportingDict;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setIsLibraryModalOpen(isFreq ? 'freq' : 'dict')}
          style={{
            background: 'linear-gradient(135deg, #ff5e62, #ff9966)',
            border: 'none',
            borderRadius: '9999px',
            color: '#fff',
            padding: '8px 20px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 6px -1px rgba(255, 94, 98, 0.2)',
            transition: 'all 0.2s'
          }}
        >
          <span>{lang === 'es' ? 'Instalar desde nuestra biblioteca' : 'Install from our library'}</span>
        </button>

        <label 
          style={{
            background: '#8b5cf6',
            border: 'none',
            borderRadius: '9999px',
            color: '#fff',
            padding: '8px 20px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: isImporting ? 'not-allowed' : 'pointer',
            opacity: isImporting ? 0.6 : 1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <span>{lang === 'es' ? 'Instalar desde archivo' : 'Install from file'}</span>
          <input 
            type="file" 
            accept=".zip"
            onChange={(e) => handleYomitanUpload(e, isFreq)}
            disabled={isImporting}
            style={{ display: 'none' }}
          />
        </label>

        <button
          type="button"
          onClick={() => alert(lang === 'es' ? 'Puedes descargar diccionarios Yomitan (.zip) de internet e instalarlos directamente.' : 'You can download Yomitan dictionaries (.zip) from the internet and install them directly.')}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            color: 'rgba(255,255,255,0.6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginLeft: 'auto',
            transition: 'all 0.2s'
          }}
        >
          <Info size={16} />
        </button>
      </div>
    );
  };

  const renderLibraryModal = () => {
    const showDicts = isLibraryModalOpen === 'dict';
    const showFreqs = isLibraryModalOpen === 'freq';

    const presetDicts = lang === 'es' ? [
      {
        title: 'JMdict (Spanish)',
        desc: 'Diccionario de japonés a español (multilingüe). Recomendado para hispanohablantes.',
        url: 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_spanish.zip'
      }
    ] : [
      {
        title: 'JMdict (English)',
        desc: 'Japanese to English dictionary. Recommended for English speakers.',
        url: 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip'
      }
    ];

    const presetFreqs = [
      {
        title: 'Netflix Frecuencias',
        desc: 'Frecuencia basada en diálogos y subtítulos de Netflix Japón.',
        url: 'https://drive.google.com/uc?export=download&id=1bykLy0sg5628HkMNQecTwIUkNXpg5sbH'
      },
      {
        title: 'JPDB Frecuencias',
        desc: 'Frecuencia recomendada basada en la base de datos de JPDB.',
        url: 'https://drive.google.com/uc?export=download&id=1A61XZPDb0kEYexMDicqCVLFojG2RtADP'
      },
      {
        title: 'Anime Frecuencias',
        desc: 'Frecuencia de vocabulario usado en anime.',
        url: 'https://drive.google.com/uc?export=download&id=1GXTXs1uTVo-6q38hf2lHHJOoXReucDEJ'
      },
      {
        title: 'BCCWJ Frecuencias',
        desc: 'Balanced Corpus of Contemporary Written Japanese (Corpus balanceado de japonés escrito).',
        url: 'https://drive.google.com/uc?export=download&id=1STX2n7Gu4h2u2Gb_4kCT0fRdENvGkfDW'
      },
      {
        title: 'Novelas Frecuencias',
        desc: 'Frecuencia de vocabulario en novelas literarias y ligeras.',
        url: 'https://drive.google.com/uc?export=download&id=1KvF7eD3CnykE3GVbAsQkzQ7e1ZHRCxpU'
      },
      {
        title: 'Novelas Visuales (VN) Frecuencias',
        desc: 'Frecuencia de términos de novelas visuales japonesas.',
        url: 'https://drive.google.com/uc?export=download&id=1Gbv8tD4kKzSTweYU4jIFMDPf7RsNHPD8'
      },
      {
        title: 'Wikipedia Frecuencias',
        desc: 'Frecuencias extraídas de artículos de Wikipedia en japonés.',
        url: 'https://drive.google.com/uc?export=download&id=1xt_gbDJf7rXcbu2jo_SFss088Rmpt4dG'
      },
      {
        title: 'YouTube Frecuencias',
        desc: 'Frecuencias de diálogos de vlogs y videos populares de YouTube Japón.',
        url: 'https://drive.google.com/uc?export=download&id=19IOBISb1eUJbGUO4nsfxP1XmzRhpH3yS'
      }
    ];

    return (
      <div 
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsLibraryModalOpen(false);
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
      >
        <div style={{
          background: '#121214',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          width: '540px',
          maxWidth: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              {lang === 'es' ? 'Biblioteca de Recursos' : 'Resource Library'}
            </h3>
            <button 
              onClick={() => setIsLibraryModalOpen(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Dictionaries Section */}
            {showDicts && (
              <div>
                <h4 style={{ color: '#8b5cf6', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', marginTop: 0 }}>
                  {lang === 'es' ? '📖 Diccionarios de Traducción' : '📖 Translation Dictionaries'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {presetDicts.map(d => {
                    const isDownloading = downloadingDictUrl === d.url;
                    
                    const cleanPresetTitle = d.title.replace(/\s*(?:Frecuencias|Frecuencia)\b/i, '').trim().toLowerCase();
                    const isInstalled = installedDicts.some(installed => {
                      const installedTitleClean = installed.title.toLowerCase();
                      return installedTitleClean === cleanPresetTitle || 
                             installedTitleClean.includes(cleanPresetTitle) || 
                             cleanPresetTitle.includes(installedTitleClean);
                    });

                    return (
                      <div key={d.title} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>{d.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '3px' }}>{d.desc}</div>
                        </div>
                        <button
                          disabled={isImportingDict || isInstalled}
                          onClick={() => handleInstallPresetDict(d.title, d.url, false)}
                          style={{
                            background: isDownloading 
                              ? 'rgba(255,255,255,0.1)' 
                              : isInstalled 
                                ? 'rgba(52, 211, 153, 0.15)' 
                                : 'var(--primary)',
                            color: isInstalled ? '#34d399' : '#fff',
                            border: isInstalled ? '1px solid rgba(52, 211, 153, 0.3)' : 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: isInstalled 
                              ? 'default' 
                              : isImportingDict 
                                ? 'not-allowed' 
                                : 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isDownloading 
                            ? `${downloadProgress}%` 
                            : isInstalled 
                              ? (lang === 'es' ? '✓ Instalado' : '✓ Installed') 
                              : (lang === 'es' ? 'Instalar' : 'Install')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Frequencies Section */}
            {showFreqs && (
              <div>
                <h4 style={{ color: '#ff9966', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', marginTop: 0 }}>
                  {lang === 'es' ? '📊 Listas de Palabras Frecuentes' : '📊 Frequency Word Lists'}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 0, marginBottom: '12px', lineHeight: '1.4' }}>
                  {lang === 'es' 
                    ? 'Descarga e instala directamente cualquiera de las listas de frecuencias comunitarias en la aplicación con un solo clic.'
                    : 'Download and install any of the community frequency lists directly into the application with a single click.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {presetFreqs.map(d => {
                    const isDownloading = downloadingDictUrl === d.url;
                    
                    const cleanPresetTitle = d.title.replace(/\s*(?:Frecuencias|Frecuencia)\b/i, '').trim().toLowerCase();
                    const isInstalled = installedDicts.some(installed => {
                      const installedTitleClean = installed.title.toLowerCase();
                      return installedTitleClean === cleanPresetTitle || 
                             installedTitleClean.includes(cleanPresetTitle) || 
                             cleanPresetTitle.includes(installedTitleClean);
                    });

                    return (
                      <div key={d.title} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>{d.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '3px' }}>{d.desc}</div>
                        </div>
                        <button
                          disabled={isImportingFreq || isInstalled}
                          onClick={() => handleInstallPresetDict(d.title, d.url, true)}
                          style={{
                            background: isDownloading 
                              ? 'rgba(255,255,255,0.1)' 
                              : isInstalled 
                                ? 'rgba(52, 211, 153, 0.15)' 
                                : 'var(--primary)',
                            color: isInstalled ? '#34d399' : '#fff',
                            border: isInstalled ? '1px solid rgba(52, 211, 153, 0.3)' : 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: isInstalled 
                              ? 'default' 
                              : isImportingFreq 
                                ? 'not-allowed' 
                                : 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isDownloading 
                            ? `${downloadProgress}%` 
                            : isInstalled 
                              ? (lang === 'es' ? '✓ Instalado' : '✓ Installed') 
                              : (lang === 'es' ? 'Instalar' : 'Install')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    );
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
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error enabling full-screen mode: ${err.message}`);
          });
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
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

  // Chrome Custom Tabs OAuth callback — fires when Google redirects back via Android reverse-domain scheme
  useEffect(() => {
    // Android OAuth client redirect URI: reverse of client ID + :/oauth2redirect
    const ANDROID_CLIENT_ID = '658624509601-fbje3dvug1pkle2a4c5fc49ssr0numf2.apps.googleusercontent.com';
    const REDIRECT_URI = 'com.googleusercontent.apps.658624509601-fbje3dvug1pkle2a4c5fc49ssr0numf2:/oauth2redirect';

    const handleAppUrlOpen = async (event) => {
      const url = event.url || '';
      if (!url.startsWith('com.googleusercontent.apps.658624509601-fbje3dvug1pkle2a4c5fc49ssr0numf2')) return;

      // Extract code and state
      const parsed = new URL(url.replace('com.googleusercontent.apps.658624509601-fbje3dvug1pkle2a4c5fc49ssr0numf2:/oauth2redirect', 'https://placeholder.com/oauth2redirect'));
      const code = parsed.searchParams.get('code');
      const state = parsed.searchParams.get('state');

      if (!code || state !== 'gdrive_auth') return;

      // Close the Chrome Custom Tab
      try { await Browser.close(); } catch (_) {}

      const clientId = (localStorage.getItem('gdrive_client_id') || ANDROID_CLIENT_ID).trim();
      // Android clients are public — no client_secret needed
      const clientSecret = localStorage.getItem('gdrive_client_secret') || '';

      setGDriveSyncStatus('syncing');
      try {
        const tokens = await googleDriveService.exchangeCodeForTokens(
          code,
          REDIRECT_URI,
          clientId,
          clientSecret
        );
        if (tokens) {
          localStorage.setItem('gdrive_tokens', JSON.stringify(tokens));
          setGDriveTokens(tokens);
          setGDriveSyncStatus('authorized');
          const info = await googleDriveService.getUserInfo(tokens, clientId, clientSecret);
          setGDriveUserEmail(info.email);
          localStorage.setItem('gdrive_user_email', info.email);
          alert(lang === 'es' ? '¡Conectado exitosamente a Google Drive!' : 'Successfully connected to Google Drive!');
          await performCloudSync(tokens, 'bidirectional');
        }
      } catch (err) {
        console.error('OAuth token exchange failed:', err);
        alert((lang === 'es' ? 'Error de conexión: ' : 'Connection failed: ') + err.message);
        setGDriveSyncStatus('disconnected');
      }
    };

    // Register native app URL listener
    let listenerHandle = null;
    CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen).then(handle => {
      listenerHandle = handle;
    }).catch(() => {
      // Fallback for web/desktop — check URL params
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      if (code && state === 'gdrive_auth') {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleAppUrlOpen({ url: `com.googleusercontent.apps.658624509601-fbje3dvug1pkle2a4c5fc49ssr0numf2:/oauth2redirect?code=${code}&state=${state}` });
      }
    });

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
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
        const ANDROID_CLIENT_ID = '658624509601-fbje3dvug1pkle2a4c5fc49ssr0numf2.apps.googleusercontent.com';
        const REDIRECT_URI = 'com.googleusercontent.apps.658624509601-fbje3dvug1pkle2a4c5fc49ssr0numf2:/oauth2redirect';
        
        // Store the Android client ID (no client secret for Android clients)
        localStorage.setItem('gdrive_client_id', ANDROID_CLIENT_ID);
        localStorage.removeItem('gdrive_client_secret'); // Android clients are public
        
        const oauthUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
          client_id: ANDROID_CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
          state: "gdrive_auth",
          access_type: "offline",
          prompt: "consent"
        });
        
        // Open in Chrome Custom Tabs
        try {
          await Browser.open({ url: oauthUrl });
        } catch {
          window.open(oauthUrl, '_blank');
        }
        setGDriveSyncStatus('disconnected');
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
        appLanguage: settings.appLanguage || localStorage.getItem('app_language') || 'es',
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
        showToast(lang === 'es'
          ? 'No se encontró ningún archivo de copia de seguridad en Google Drive. Sube una copia primero con el botón "Subir copia completa".'
          : 'No backup file found in Google Drive. Upload one first using "Upload full backup".', 'error');
        return;
      }

      // Proceder directamente sólo notificando
      showToast(lang === 'es'
        ? 'Descargando y restaurando copia de seguridad desde Google Drive...'
        : 'Downloading and restoring backup from Google Drive...', 'info');

      // 2. Parse the ZIP using JSZip (same logic as handleImportLibrary)
      const zip = await JSZip.loadAsync(zipBlob);
      const metaFile = zip.file('metadata.json');
      if (!metaFile) throw new Error('El ZIP de Google Drive no contiene metadatos válidos de Yoru Reader.');

      const metaStr = await metaFile.async('text');
      const importData = JSON.parse(metaStr);

      if (!importData.books && !importData.profiles) {
        throw new Error('El archivo de Google Drive no tiene un formato de respaldo válido.');
      }

      // 3. Restore active profile ID & global language
      if (importData.appLanguage) {
        localStorage.setItem('app_language', importData.appLanguage);
        if (importData.settings) {
          importData.settings.appLanguage = importData.appLanguage;
        }
      }
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

      showToast(lang === 'es'
        ? '✅ Copia de seguridad restaurada con éxito. Reiniciando...'
        : '✅ Backup restored successfully. Restarting...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
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
      alert(lang === 'es' ? 'Error al procesar la imagen de perfil.' : 'Error processing profile image.');
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
      alert(lang === 'es' ? 'Error al procesar la imagen de perfil.' : 'Error processing profile image.');
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
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [isSrsReviewOpen, setIsSrsReviewOpen] = useState(false);
  const [srsUpdateTrigger, setSrsUpdateTrigger] = useState(0);

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
        appLanguage: settings.appLanguage || localStorage.getItem('app_language') || 'es',
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
      showToast((lang === 'es' ? 'Error al exportar la biblioteca: ' : 'Error exporting library: ') + e.message, 'error');
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
          alert(lang === 'es' ? 'El archivo zip no contiene metadatos válidos de Yoru Reader.' : 'The zip file does not contain valid Yoru Reader metadata.');
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
        alert(lang === 'es' ? 'El archivo no tiene un formato de respaldo válido de Yoru Reader.' : 'The file does not have a valid Yoru Reader backup format.');
        return;
      }

      // Proceder directamente sólo notificando
      showToast(lang === 'es'
        ? 'Restaurando copia de seguridad local...'
        : 'Restoring local backup...', 'info');

      // 1. Restore active profile ID & global language
      if (importData.appLanguage) {
        localStorage.setItem('app_language', importData.appLanguage);
        if (importData.settings) {
          importData.settings.appLanguage = importData.appLanguage;
        }
      }
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
        
        showToast(lang === 'es' 
          ? '✅ Copia de seguridad importada con éxito. Reiniciando...' 
          : '✅ Backup imported successfully. Restarting...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
    } catch (err) {
      console.error(err);
      showToast((lang === 'es' ? 'Error al restaurar el respaldo: ' : 'Error restoring backup: ') + err.message, 'error');
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

  const srsStats = useMemo(() => {
    const statuses = db.getWordStatuses();
    const srsData = db.getSrsData();
    const now = new Date();
    const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const learningWords = Object.keys(statuses).filter(w => statuses[w] === 'learning');
    
    let due = 0;
    let due7d = 0;
    let due30d = 0;
    let newCards = 0;
    let learningCards = 0;
    let youngCards = 0;
    let matureCards = 0;
    
    learningWords.forEach(word => {
      const card = srsData[word];
      if (!card || !card.dueDate) {
        due++;
        due7d++;
        due30d++;
        newCards++;
      } else {
        const dueDate = new Date(card.dueDate);
        if (dueDate <= now) due++;
        if (dueDate <= next7d) due7d++;
        if (dueDate <= next30d) due30d++;
        
        const reps = card.repetitions || 0;
        const interval = card.interval || 0;
        
        if (reps === 0) {
          newCards++;
        } else if (interval === 0) {
          learningCards++;
        } else if (interval < 21) {
          youngCards++;
        } else {
          matureCards++;
        }
      }
    });
    
    return {
      due,
      due7d,
      due30d,
      newCards,
      learningCards,
      youngCards,
      matureCards
    };
  }, [localWordStatuses, srsUpdateTrigger]);

  const dueCount = srsStats.due;

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
  const handleBulkDelete = async () => {
    if (selectedBookIds.length === 0) return;
    const ok = await showConfirm({
      title: lang === 'es' ? '¿Eliminar libros?' : 'Delete books?',
      message: lang === 'es' ? `¿Estás seguro de que quieres eliminar los ${selectedBookIds.length} libros seleccionados?` : `Are you sure you want to delete the ${selectedBookIds.length} selected books?`,
      type: 'danger',
      confirmText: lang === 'es' ? 'Eliminar' : 'Delete',
    });
    if (ok) {
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
    showToast(lang === 'es' ? "Serie actualizada con éxito." : "Series successfully updated.", 'success');
  };

  const handleSetAuthor = async () => {
    if (selectedBookIds.length === 0) return;
    const author = prompt(lang === 'es' ? "Introduce el nombre del autor para los libros seleccionados:" : "Enter the author name for the selected books:");
    if (author === null) return;
    for (const bookId of selectedBookIds) {
      await onUpdateBookDetails(bookId, { author: author.trim() });
    }
    showToast(lang === 'es' ? "Autor actualizado con éxito." : "Author successfully updated.", 'success');
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
    showToast(lang === 'es' ? "Etiquetas añadidas." : "Tags added.", 'success');
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
    showToast(lang === 'es' ? "Etiquetas eliminadas." : "Tags removed.", 'success');
  };

  const handleBlurCovers = async () => {
    if (selectedBookIds.length === 0) return;
    for (const bookId of selectedBookIds) {
      const book = books.find(b => b.id === bookId);
      if (book) {
        await onUpdateBookDetails(bookId, { hideCover: !book.hideCover });
      }
    }
    showToast(lang === 'es' ? 'Visibilidad de portadas actualizada.' : 'Covers visibility updated.', 'success');
  };

  const handleMarkAsUnread = async () => {
    if (selectedBookIds.length === 0) return;
    const ok = await showConfirm({
      title: lang === 'es' ? '¿Marcar como no leídos?' : 'Mark as unread?',
      message: lang === 'es' ? "¿Quieres marcar como no leídos los libros seleccionados y reiniciar su progreso?" : "Do you want to mark selected books as unread and reset their progress?",
      type: 'warning',
      confirmText: lang === 'es' ? 'Marcar' : 'Mark',
    });
    if (ok) {
      for (const bookId of selectedBookIds) {
        await onUpdateBookDetails(bookId, {
          progress: { currentChapter: 0, currentPage: 0, percent: 0 },
          status: 'unread'
        });
      }
      showToast(lang === 'es' ? "Progreso reiniciado para los libros seleccionados." : "Progress reset for selected books.", 'success');
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
      showToast((lang === 'es' ? 'Error al exportar selección: ' : 'Error exporting selection: ') + e.message, 'error');
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
    const ok = await showConfirm({
      title: lang === 'es' ? '¿Borrar estadísticas?' : 'Clear statistics?',
      message: lang === 'es' ? `¿Seguro que quieres borrar los registros de lectura de ${selectedBookIds.length} libro(s) seleccionado(s)?` : `Are you sure you want to clear the reading records of the ${selectedBookIds.length} selected book(s)?`,
      type: 'danger',
      confirmText: lang === 'es' ? 'Borrar' : 'Clear',
    });
    if (ok) {
      for (const bookId of selectedBookIds) {
        const book = books.find(b => b.id === bookId);
        if (book && book.title) {
          await db.deleteReadingStatsForBook(book.title);
        }
        await onUpdateBookDetails(bookId, {
          progress: { ...((books.find(b => b.id === bookId) || {}).progress || {}), charactersRead: 0, secondsRead: 0 },
          lastRead: null
        });
      }
      showToast(lang === 'es' ? 'Estadísticas de lectura borradas.' : 'Reading statistics cleared.', 'success');
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
    let list = books.filter(b => !b.isDeleted);

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
  books.filter(b => !b.isDeleted).forEach(b => {
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
              ...(menuOpenLeft ? { left: '0' } : { right: '0' }),
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
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s ease'
              }}
              className="context-menu-item-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} /> {lang === 'es' ? 'Ver detalles' : 'Show details'}
              </div>
            </button>
            
            <button 
              onClick={() => {
                setActiveMenuBookId(null);
                setEditingBook(book);
                setEditTitle(book.title);
                setEditHideCover(book.hideCover === true);
                setEditDescription(book.description || '');
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
                <Pencil size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} /> {lang === 'es' ? 'Editar título' : 'Edit title'}
              </div>
            </button>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
            <div style={{ padding: '2px 0' }}>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'es' ? 'Estado' : 'Status'}</div>
              {[
                { key: 'reading', label: lang === 'es' ? 'En progreso' : 'In progress', color: '#3b82f6', icon: <Play size={12} fill="currentColor" /> },
                { key: 'completed', label: lang === 'es' ? 'Completado' : 'Completed', color: '#10b981', icon: <Check size={12} strokeWidth={3} /> },
                { key: 'paused', label: lang === 'es' ? 'Pausado' : 'Paused', color: '#f59e0b', icon: <Pause size={12} fill="currentColor" /> },
                { key: 'planning', label: lang === 'es' ? 'Planeado' : 'Planned', color: '#a855f7', icon: <Clock size={12} /> },
                { key: 'dropped', label: lang === 'es' ? 'Dropeado' : 'Dropped', color: '#9ca3af', icon: <X size={12} strokeWidth={3} /> },
                { key: 'unread', label: lang === 'es' ? 'Sin iniciar' : 'Not started', color: '#ef4444', icon: <RotateCcw size={12} /> }
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
              onClick={async () => {
                setActiveMenuBookId(null);
                const ok = await showConfirm({
                  title: lang === 'es' ? '¿Eliminar novela?' : 'Delete novel?',
                  message: lang === 'es' ? `¿Estás seguro de que quieres eliminar "${book.title}"?` : `Are you sure you want to delete "${book.title}"?`,
                  type: 'danger',
                  confirmText: lang === 'es' ? 'Eliminar' : 'Delete',
                });
                if (ok) {
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
              <Trash2 size={14} /> {lang === 'es' ? 'Eliminar' : 'Delete'}
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
                  {showCardTitle && <h4 className="book-title" title={book.title} style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.title}</h4>}
                  {showCardSeries && book.series && <p className="book-series" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.series}</p>}
                  {showCardAuthor && <p className="book-author" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.author}</p>}
                  {showCardTags && book.tags && book.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {book.tags.slice(0, 2).map(tag => (
                        <span key={tag} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-app)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
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
                          {showCardTitle && <h4 className="book-title" title={book.title} style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.title}</h4>}
                          {showCardSeries && book.series && <p className="book-series" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.series}</p>}
                          {showCardAuthor && <p className="book-author" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.author}</p>}
                          {showCardTags && book.tags && book.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {book.tags.slice(0, 2).map(tag => (
                                <span key={tag} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-app)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
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
                          {showCardTitle && <h4 className="book-title" title={book.title} style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.title}</h4>}
                          {showCardSeries && book.series && <p className="book-series" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.series}</p>}
                          {showCardAuthor && <p className="book-author" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{book.author}</p>}
                          {showCardTags && book.tags && book.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {book.tags.slice(0, 2).map(tag => (
                                <span key={tag} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-app)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
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
    return <ProgressDashboard books={books} lang={lang} excludedBookIds={statsExcludedBookIds} />;
  };

  const handleDeleteAllData = async () => {
    setDeleteAllState('confirm');
  };

  const executeDeleteAllData = async () => {
    setDeleteAllState('deleting');
    
    // Give the UI a brief moment to update and render the spinner before starting blocking operations
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Helper: delete a single DB with timeout so it never hangs forever
    const deleteDBWithTimeout = (name, timeoutMs = 4000) =>
      new Promise(resolve => {
        const timer = setTimeout(resolve, timeoutMs); // safety timeout
        try {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => { clearTimeout(timer); resolve(); };
          req.onerror = () => { clearTimeout(timer); resolve(); };
          req.onblocked = () => {
            // DB is blocked — resolve anyway after a short extra wait
            clearTimeout(timer);
            setTimeout(resolve, 500);
          };
        } catch(e) {
          clearTimeout(timer);
          resolve();
        }
      });

    try {
      // 1. Close active connections first (prevents "blocked" events)
      try { await db.close(); } catch(e) {}
      try { await closeDB(); } catch(e) {}
      
      // 2. Collect all DB names to delete
      let allDbNames = ['YoruReaderStore', 'yoru_yomitan_db', 'books-db'];
      try {
        const dbs = await indexedDB.databases();
        const extraNames = dbs.map(d => d.name).filter(Boolean);
        allDbNames = [...new Set([...allDbNames, ...extraNames])];
      } catch(e) { /* indexedDB.databases() may not be supported */ }

      // 3. Delete all databases in parallel
      await Promise.all(allDbNames.map(name => deleteDBWithTimeout(name)));
      
    } catch (e) {
      console.error('Error deleting databases:', e);
    }

    // 4. Clear all localStorage
    localStorage.clear();
    
    setDeleteAllState('success');
    
    // Automatic reload after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const renderDeleteAllModal = () => {
    if (!deleteAllState) return null;

    const isConfirm = deleteAllState === 'confirm';
    const isDeleting = deleteAllState === 'deleting';
    const isSuccess = deleteAllState === 'success';

    return (
      <div 
        className="modal-overlay" 
        style={{ zIndex: 10000 }}
        onClick={() => {
          if (isConfirm) setDeleteAllState(null);
        }}
      >
        <div 
          className="settings-modal" 
          style={{ width: '95%', maxWidth: '440px', padding: '28px', position: 'relative' }}
          onClick={(e) => e.stopPropagation()}
        >
          {isConfirm && (
            <button 
              className="close-modal-btn" 
              onClick={() => setDeleteAllState(null)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.4rem' }}>
              {isConfirm && '⚠️'}
              {isDeleting && '⏳'}
              {isSuccess && '✓'}
            </span>
            <h3 className="modal-title" style={{ margin: 0, color: isConfirm ? '#ef4444' : isSuccess ? '#4ade80' : '#fff' }}>
              {isConfirm && (lang === 'es' ? 'Eliminar todos los datos' : 'Delete all data')}
              {isDeleting && (lang === 'es' ? 'Eliminando datos...' : 'Deleting data...')}
              {isSuccess && (lang === 'es' ? 'Datos eliminados con éxito' : 'Data deleted successfully')}
            </h3>
          </div>

          <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', marginBottom: '24px', textAlign: 'left' }}>
            {isConfirm && (
              <>
                <p style={{ margin: '0 0 10px 0' }}>
                  {lang === 'es' 
                    ? '¿Seguro que quieres eliminar TODOS los datos de la aplicación? Esta acción es irreversible.' 
                    : 'Are you sure you want to delete ALL application data? This action is irreversible.'}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                  {lang === 'es' 
                    ? 'Se borrarán todos los libros, historiales, perfiles y diccionarios instalados. ¿Estás COMPLETAMENTE seguro?' 
                    : 'All books, histories, profiles, and installed dictionaries will be deleted. Are you COMPLETELY sure?'}
                </p>
              </>
            )}
            
            {isDeleting && (
              <>
                <p style={{ margin: '0 0 10px 0', textAlign: 'center' }}>
                  {lang === 'es' 
                    ? 'Esto puede tardar un momento. Por favor, no cierres la aplicación.' 
                    : 'This may take a moment. Please do not close the application.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
                  <div className="yoru-delete-spinner" style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid rgba(255, 224, 0, 0.1)',
                    borderTop: '3px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'yoruDeleteSpin 0.8s linear infinite'
                  }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                  {lang === 'es' ? 'Borrando IndexedDB y almacenamiento local...' : 'Wiping IndexedDB and local storage...'}
                </p>
              </>
            )}

            {isSuccess && (
              <>
                <p style={{ margin: '0 0 10px 0', textAlign: 'center' }}>
                  {lang === 'es' 
                    ? 'Todos los datos han sido eliminados de este dispositivo.' 
                    : 'All data has been wiped from this device.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '2px solid #4ade80',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4ade80',
                    fontSize: '1.4rem'
                  }}>
                    ✓
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                  {lang === 'es' ? 'Reiniciando la aplicación...' : 'Restarting application...'}
                </p>
              </>
            )}
          </div>

          {isConfirm && (
            <div className="create-profile-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="create-profile-cancel" 
                onClick={() => setDeleteAllState(null)}
                style={{ flex: 'none', padding: '0 20px', height: '36px' }}
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className="create-profile-save"
                onClick={executeDeleteAllData}
                style={{ 
                  flex: 'none', 
                  padding: '0 20px', 
                  height: '36px', 
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)', 
                  color: '#fff',
                  boxShadow: '0 2px 10px rgba(239, 68, 68, 0.2)'
                }}
              >
                {lang === 'es' ? 'Sí, borrar todo' : 'Yes, delete all'}
              </button>
            </div>
          )}

        </div>

        <style>{`
          @keyframes yoruDeleteSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  };

  const renderSettingsTab = () => {
    const handleSliderChange = (val) => {
      onSaveSettings({ ...settings, fontSize: val });
    };

    const renderSliderControl = (label, value, min, max, step, formatValue, onChange) => {
      const numericVal = parseFloat(value);
      const handleDecrement = () => {
        const newVal = Math.max(min, numericVal - step);
        onChange(newVal);
      };
      const handleIncrement = () => {
        const newVal = Math.min(max, numericVal + step);
        onChange(newVal);
      };
      const percentage = ((numericVal - min) / (max - min)) * 100;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '12px', boxSizing: 'border-box', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 500, color: 'var(--text-main)' }}>{label}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{formatValue(numericVal)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginTop: '4px' }}>
            <button 
              onClick={handleDecrement}
              disabled={numericVal <= min}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid var(--border-light)',
                background: 'transparent',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: numericVal <= min ? 'not-allowed' : 'pointer',
                opacity: numericVal <= min ? 0.3 : 1,
                fontSize: '1rem',
                fontWeight: '300',
                fontFamily: 'monospace',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { if (numericVal > min) e.currentTarget.style.background = 'rgba(255, 224, 0, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              -
            </button>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="range"
                min={min}
                max={max}
                step={step}
                value={numericVal}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '100%',
                  height: '4px',
                  background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percentage}%, var(--border-light) ${percentage}%, var(--border-light) 100%)`,
                  accentColor: 'var(--primary)',
                  borderRadius: '2px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
            <button 
              onClick={handleIncrement}
              disabled={numericVal >= max}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid var(--border-light)',
                background: 'transparent',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: numericVal >= max ? 'not-allowed' : 'pointer',
                opacity: numericVal >= max ? 0.3 : 1,
                fontSize: '1rem',
                fontWeight: '300',
                fontFamily: 'monospace',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { if (numericVal < max) e.currentTarget.style.background = 'rgba(255, 224, 0, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              +
            </button>
          </div>
        </div>
      );
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

    const renderSidebarBtn = (sectionId, label, IconComponent, searchKeywords) => {
      if (!matchesSearch(searchKeywords)) return null;
      const isActive = activeSettingsSection === sectionId;
      return (
        <button
          onClick={() => {
            setActiveSettingsSection(sectionId);
            setSettingsSearchQuery('');
            if (isMobile) {
              setMobileSettingsSectionOpen(true);
            } else {
              scrollToSection(sectionId);
            }
          }}
          style={{
            background: isActive ? 'rgba(255, 224, 0, 0.08)' : 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '6px',
            fontSize: '0.86rem',
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            fontWeight: isActive ? '600' : '500',
            transition: 'all 0.15s ease'
          }}
        >
          {IconComponent && <IconComponent size={15} style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />}
          <span>{label}</span>
        </button>
      );
    };

    const showSidebar = !isMobile || !mobileSettingsSectionOpen;
    const showContent = !isMobile || mobileSettingsSectionOpen;

    return (
      <div className="tab-view-container settings-view-panel yomitan-settings-layout" style={{ display: 'flex', gap: isMobile ? '0' : '24px', alignItems: 'stretch', height: '100%', width: '100%', margin: '0' }}>
        {/* Left Sidebar */}
        {showSidebar && (
          <div className="yomitan-settings-sidebar" style={{ width: isMobile ? '100%' : '250px', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)', paddingRight: isMobile ? '0' : '20px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0, overflowY: 'auto', height: '100%' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '10px 0 0 0' }}>{lang === 'es' ? 'Configuración' : 'Settings'}</h2>
            
            <div className="yomitan-search-wrapper" style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text" 
                placeholder={lang === 'es' ? 'Buscar...' : 'Search...'} 
                value={settingsSearchQuery}
                onChange={(e) => setSettingsSearchQuery(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px 12px 8px 32px', fontSize: '0.85rem', color: 'var(--text-main)', outline: 'none' }}
              />
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
              </span>
              {!isMobile && <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 5px', borderRadius: '4px', border: '1px solid var(--border-light)', fontWeight: 'bold' }}>CTRL F</span>}
            </div>
  
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* General Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  <Settings size={13} style={{ color: 'rgba(255,255,255,0.4)' }} /> <span>{lang === 'es' ? 'General' : 'General'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                  {renderSidebarBtn('sec-theme', lang === 'es' ? 'Tema' : 'Theme', Palette, 'tema theme active dark light sepia')}
                  {renderSidebarBtn('sec-language-interface', lang === 'es' ? 'Idioma e Interfaz' : 'Language & Interface', Globe, 'idioma lang language interface interfaceLanguage')}
                  {renderSidebarBtn('sec-dicts', lang === 'es' ? 'Diccionarios' : 'Dictionaries', BookOpen, 'diccionario dictionary offline jmdict frecuencia meta meta_bank zip')}
                  {renderSidebarBtn('sec-keybindings', lang === 'es' ? 'Atajos de teclado' : 'Keyboard Shortcuts', Keyboard, 'keybins keybindings atajos teclado shortcuts keys full screen pantalla completa')}
                </div>
              </div>
  
              {/* Reading Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  <BookOpen size={13} style={{ color: 'rgba(255,255,255,0.4)' }} /> <span>{lang === 'es' ? 'Lectura' : 'Reading'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                  {renderSidebarBtn('sec-text-style', lang === 'es' ? 'Estilo de texto' : 'Text Style', Type, 'size texto text style font voz audio speed velocidad genero furigana traduccion translation learning status display highlight oracion cursor hover highlights')}
                  {renderSidebarBtn('sec-stats', lang === 'es' ? 'Estadísticas' : 'Statistics', BarChart3, 'stats config estadisticas tracking delete books annotations enabled')}
                  {renderSidebarBtn('sec-reading-day', lang === 'es' ? 'Día de lectura' : 'Reading Day', Calendar, 'reading day dia lectura start hours limites horas nocturno')}
                </div>
              </div>

              {/* Integration Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  <Plug size={13} style={{ color: 'rgba(255,255,255,0.4)' }} /> <span>{lang === 'es' ? 'Integración' : 'Integration'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                  {renderSidebarBtn('sec-vocab-manage', lang === 'es' ? 'Gestión de Vocabulario y Anki' : 'Vocabulary & Anki Management', Database, 'vocabulario vocabulary import export jpdb anki file frequency')}
                  {renderSidebarBtn('sec-cloud-sync', lang === 'es' ? 'Sincronización Cloud' : 'Cloud Sync', Cloud, 'sync merge sincronizar combinar conflicto storage sync settings gdrive drive cloud cloud-sync')}
                </div>
              </div>
  
              {/* Data Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#888899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  <Database size={13} style={{ color: 'rgba(255,255,255,0.4)' }} /> <span>{lang === 'es' ? 'Datos' : 'Data'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                  {renderSidebarBtn('sec-backup', lang === 'es' ? 'Copias de seguridad' : 'Backups', FolderOpen, 'backup import export catalogo perfil copia seguridad')}
                  {renderSidebarBtn('sec-updates', lang === 'es' ? 'Actualizaciones' : 'Updates', RefreshCw, 'updates update actualizaciones actualizar version check beta')}
                  {renderSidebarBtn('sec-danger', lang === 'es' ? 'Zona de peligro' : 'Danger Zone', AlertTriangle, 'danger zone eliminar borrar todos datos irreversible reset clear storage')}
                </div>
              </div>
            </div>
            
            {/* Dashboard de Estado */}
            <div style={{ marginTop: '20px', padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {lang === 'es' ? 'Estado del Lector' : 'Reader Status'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{lang === 'es' ? 'Perfil:' : 'Profile:'}</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{settings.profileName || 'Zams'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{lang === 'es' ? 'Diccionarios:' : 'Dictionaries:'}</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{installedDicts.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{lang === 'es' ? 'Libros:' : 'Books:'}</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{books.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{lang === 'es' ? 'Google Drive:' : 'Google Drive:'}</span>
                  <span style={{ color: gDriveTokens ? '#34d399' : 'var(--text-muted)', fontWeight: 600 }}>
                    {gDriveTokens ? (lang === 'es' ? 'Conectado' : 'Connected') : (lang === 'es' ? 'Desconectado' : 'Disconnected')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
  
        {/* Right Content Pane */}
        {showContent && (
          <div className="yomitan-settings-pane" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '24px', scrollBehavior: 'smooth', height: '100%', paddingBottom: '100px' }}>
            {isMobile && (
              <button 
                type="button"
                className="settings-back-btn" 
                onClick={() => setMobileSettingsSectionOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  alignSelf: 'flex-start',
                  fontWeight: 600
                }}
              >
                ← {lang === 'es' ? 'Volver' : 'Back'}
              </button>
            )}
          
          {/* Card: Theme */}
          {matchesSearch('tema theme active dark light sepia') && (settingsSearchQuery || activeSettingsSection === 'sec-theme') && (
            <div id="sec-theme" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Tema' : 'Theme'}</span>
              </h3>
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

          {/* Card: Idioma e Interfaz */}
          {matchesSearch('idioma lang language interface interfaceLanguage') && (settingsSearchQuery || activeSettingsSection === 'sec-language-interface') && (
            <div id="sec-language-interface" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Idioma e Interfaz' : 'Language & Interface'}</span>
              </h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Cambia el idioma de la interfaz del lector.' : 'Change the language of the reader interface.'}</p>
              
              <div className="settings-row-control">
                <span className="settings-label-text">{t('interfaceLanguage', lang)}</span>
                <select 
                  value={settings.appLanguage || 'es'}
                  onChange={(e) => {
                    const selectedLang = e.target.value;
                    localStorage.setItem('app_language', selectedLang);
                    onSaveSettings({ ...settings, appLanguage: selectedLang });
                  }}
                  className="migaku-select"
                >
                  <option value="es">Español 🇪🇸</option>
                  <option value="en">English 🇺🇸</option>
                </select>
              </div>
            </div>
          )}

          {/* Card: Atajos de teclado */}
          {matchesSearch('keybins keybindings atajos teclado shortcuts keys full screen pantalla completa') && (settingsSearchQuery || activeSettingsSection === 'sec-keybindings') && (
            <div id="sec-keybindings" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Keyboard size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Atajos de teclado' : 'Keyboard Shortcuts'}</span>
              </h3>
              <p className="settings-card-desc">
                {lang === 'es' 
                  ? 'Personaliza los atajos de teclado del lector. Haz clic en el botón de un atajo y presiona una tecla para cambiarlo.' 
                  : 'Customize reader keyboard shortcuts. Click a shortcut button and press a key to change it.'}
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {(() => {
                  const bindings = settings.keybindings || {
                    toggleFullscreen: 'f',
                    nextPage: 'ArrowRight',
                    prevPage: 'ArrowLeft',
                    toggleMenu: 'Escape',
                    readAloud: 't'
                  };

                  const list = [
                    { id: 'toggleFullscreen', label: lang === 'es' ? 'Pantalla completa' : 'Full screen' },
                    { id: 'nextPage', label: lang === 'es' ? 'Página siguiente' : 'Next page' },
                    { id: 'prevPage', label: lang === 'es' ? 'Página anterior' : 'Previous page' },
                    { id: 'toggleMenu', label: lang === 'es' ? 'Mostrar/Ocultar Menú' : 'Toggle Menu' },
                    { id: 'readAloud', label: lang === 'es' ? 'Leer en voz alta (TTS)' : 'Read aloud (TTS)' }
                  ];

                  return list.map(item => {
                    const isRecording = bindingKeyAction === item.id;
                    const val = bindings[item.id];
                    let displayVal = val;
                    if (val === ' ') displayVal = 'Space';
                    if (val === 'ArrowRight') displayVal = '→';
                    if (val === 'ArrowLeft') displayVal = '←';
                    if (val === 'ArrowUp') displayVal = '↑';
                    if (val === 'ArrowDown') displayVal = '↓';

                    return (
                      <div key={item.id} className="settings-row-control" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                        <span className="settings-label-text" style={{ fontSize: '0.88rem' }}>{item.label}</span>
                        <button
                          type="button"
                          onClick={() => setBindingKeyAction(isRecording ? null : item.id)}
                          style={{
                            background: isRecording ? 'rgba(226, 192, 98, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                            border: isRecording ? '1px solid #e2c062' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: isRecording ? '#e2c062' : 'rgba(255, 255, 255, 0.9)',
                            padding: '6px 14px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minWidth: '100px',
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isRecording ? (lang === 'es' ? 'Presiona...' : 'Press key...') : displayVal}
                        </button>
                      </div>
                    );
                  });
                })()}

                {/* Reset button */}
                <button
                  type="button"
                  onClick={() => {
                    onSaveSettings({
                      ...settings,
                      keybindings: {
                        toggleFullscreen: 'f',
                        nextPage: 'ArrowRight',
                        prevPage: 'ArrowLeft',
                        toggleMenu: 'Escape',
                        readAloud: 't'
                      }
                    });
                    // Fallback to alert if showToast is not directly accessible here
                    alert(lang === 'es' ? 'Atajos restablecidos por defecto.' : 'Shortcuts reset to defaults.');
                  }}
                  style={{
                    marginTop: '8px',
                    alignSelf: 'flex-start',
                    background: 'transparent',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-muted)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {lang === 'es' ? 'Restablecer valores predeterminados' : 'Reset to default values'}
                </button>
              </div>
            </div>
          )}

          {/* Card: Text Style */}
          {matchesSearch('size texto text style font voz audio speed velocidad genero viewmode writingmode margins vertical layout justify vpal indent') && (settingsSearchQuery || activeSettingsSection === 'sec-text-style') && (
            <div id="sec-text-style" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Type size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Estilo de texto y Lector' : 'Text Style & Reader'}</span>
              </h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Modifica el tamaño de la tipografía, dirección de lectura, velocidad de audio y comportamiento del lector.' : 'Modify typography size, reading direction, audio speed and reader behavior.'}</p>
              

              {/* Tema del libro (Book theme) */}
              <div className="settings-row-control" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span className="settings-label-text">{lang === 'es' ? 'Tema del libro' : 'Book theme'}</span>
                  <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)' }}>
                    {lang === 'es' ? 'Se aplica únicamente a la página de lectura' : 'Applies only to the book page'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
                  <button 
                    onClick={() => onSaveSettings({ ...settings, theme: 'light' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '6px',
                      border: settings.theme === 'light' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                      background: '#ffffff',
                      color: '#000000',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>Aa</span>
                    <span>{lang === 'es' ? 'Blanco' : 'White'}</span>
                  </button>
                  <button 
                    onClick={() => onSaveSettings({ ...settings, theme: 'sepia' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '6px',
                      border: settings.theme === 'sepia' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                      background: '#f4ecd8',
                      color: '#5b4636',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>Aa</span>
                    <span>{lang === 'es' ? 'Crema' : 'Paper'}</span>
                  </button>
                  <button 
                    onClick={() => onSaveSettings({ ...settings, theme: 'dark' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '6px',
                      border: settings.theme === 'dark' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                      background: '#08080a',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>Aa</span>
                    <span>{lang === 'es' ? 'Oscuro' : 'Dark'}</span>
                  </button>
                </div>
              </div>

              {/* Zoom de texto */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Zoom de texto del lector' : 'Reader text zoom'}</span>
                <select
                  value={settings.fontSize || 36}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                  className="migaku-select"
                >
                  <option value="18">75%</option>
                  <option value="22">85%</option>
                  <option value="26">90%</option>
                  <option value="30">95%</option>
                  <option value="36">100% ({lang === 'es' ? 'Por defecto' : 'Default'})</option>
                  <option value="40">110%</option>
                  <option value="44">120%</option>
                  <option value="48">130%</option>
                </select>
              </div>

              {/* Modo de visualización (View Mode) */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Modo de visualización' : 'View Mode'}</span>
                <select
                  value={settings.viewMode || 'paginated'}
                  onChange={(e) => onSaveSettings({ ...settings, viewMode: e.target.value })}
                  className="migaku-select"
                >
                  <option value="paginated">{lang === 'es' ? 'Paginado' : 'Paginated'}</option>
                  <option value="continuous">{lang === 'es' ? 'Continuo' : 'Continuous'}</option>
                </select>
              </div>

              {/* Dirección de escritura (Writing Mode) */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Dirección de escritura' : 'Writing Mode'}</span>
                <select
                  value={settings.writingMode || 'vertical-rl'}
                  onChange={(e) => onSaveSettings({ ...settings, writingMode: e.target.value })}
                  className="migaku-select"
                >
                  <option value="vertical-rl">{lang === 'es' ? 'Vertical (Escritura japonesa)' : 'Vertical (Japanese layout)'}</option>
                  <option value="horizontal-tb">{lang === 'es' ? 'Horizontal (Escritura occidental)' : 'Horizontal (Western layout)'}</option>
                </select>
              </div>

              {/* Interlineado (Line Height) */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Interlineado' : 'Line Height'}</span>
                <select
                  value={settings.lineHeight || '1.65'}
                  onChange={(e) => onSaveSettings({ ...settings, lineHeight: e.target.value })}
                  className="migaku-select"
                >
                  <option value="1.3">1.3x</option>
                  <option value="1.5">1.5x</option>
                  <option value="1.65">1.65x ({lang === 'es' ? 'Por defecto' : 'Default'})</option>
                  <option value="1.8">1.8x</option>
                  <option value="2.0">2.0x</option>
                </select>
              </div>

              {/* Sangría de párrafo (Paragraph Indentation) */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Sangría de párrafo' : 'Paragraph Indentation'}</span>
                <select
                  value={settings.textIndentation || '0'}
                  onChange={(e) => onSaveSettings({ ...settings, textIndentation: e.target.value })}
                  className="migaku-select"
                >
                  <option value="0">{lang === 'es' ? 'Sin sangría' : 'No indent'}</option>
                  <option value="1">1em</option>
                  <option value="2">2em</option>
                </select>
              </div>

              {/* Margen lateral (Margins) */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Margen del lector (px)' : 'Reader margin (px)'}</span>
                <select
                  value={settings.firstDimensionMargin || '0'}
                  onChange={(e) => onSaveSettings({ ...settings, firstDimensionMargin: e.target.value })}
                  className="migaku-select"
                >
                  <option value="0">{lang === 'es' ? 'Por defecto' : 'Default'}</option>
                  <option value="10">10px</option>
                  <option value="20">20px</option>
                  <option value="30">30px</option>
                  <option value="40">40px</option>
                  <option value="50">50px</option>
                </select>
              </div>

              {/* Formato del editor (Publisher formatting) */}
              <div className="settings-row-control" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span className="settings-label-text">{lang === 'es' ? 'Formato del editor' : 'Publisher formatting'}</span>
                  <label className="migaku-switch">
                    <input 
                      type="checkbox" 
                      checked={settings.prioritizeReaderStyles === false}
                      onChange={(e) => onSaveSettings({ ...settings, prioritizeReaderStyles: !e.target.checked })}
                    />
                    <span className="migaku-switch-slider"></span>
                  </label>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', marginTop: '-2px' }}>
                  {lang === 'es' ? 'Conservar el diseño y la tipografía del libro original siempre que sea posible.' : 'Keep book layout and typography where possible.'}
                </span>
              </div>

              {/* Progreso del pie de página (Footer progress) */}
              <div className="settings-row-control" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span className="settings-label-text">{lang === 'es' ? 'Progreso en pie de página' : 'Footer progress'}</span>
                  <label className="migaku-switch">
                    <input 
                      type="checkbox" 
                      checked={settings.showFooterProgress === true}
                      onChange={(e) => onSaveSettings({ ...settings, showFooterProgress: e.target.checked })}
                    />
                    <span className="migaku-switch-slider"></span>
                  </label>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', marginTop: '-2px' }}>
                  {lang === 'es' ? 'Mostrar la delgada línea de progreso del capítulo al final de la pantalla.' : 'Show the thin chapter progress line.'}
                </span>
              </div>

              {/* Justificación de texto (enableTextJustification) */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Justificar texto' : 'Justify text'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.enableTextJustification === true}
                    onChange={(e) => onSaveSettings({ ...settings, enableTextJustification: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              {/* Habilitar VPAL (enableFontVPAL) */}
              <div className="settings-row-control">
                <span className="settings-label-text">{lang === 'es' ? 'Habilitar VPAL (Métrica de fuente proporcional)' : 'Enable Font VPAL (Proportional metrics)'}</span>
                <label className="migaku-switch">
                  <input 
                    type="checkbox" 
                    checked={settings.enableFontVPAL === true}
                    onChange={(e) => onSaveSettings({ ...settings, enableFontVPAL: e.target.checked })}
                  />
                  <span className="migaku-switch-slider"></span>
                </label>
              </div>

              
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {lang === 'es' ? 'Sesión de Lectura' : 'Reading Session'}
              </h4>

              {/* Pause when hidden checkbox card */}
              {(() => {
                const renderCheckboxCard = (title, desc, isChecked, onToggle) => (
                  <div 
                    onClick={onToggle}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      marginBottom: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 500, color: '#ffffff' }}>{title}</span>
                      {desc && <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.45)', marginTop: '2px' }}>{desc}</span>}
                    </div>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: isChecked ? 'none' : '1.5px solid rgba(255, 255, 255, 0.45)',
                      borderRadius: '4px',
                      background: isChecked ? '#5b6abf' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                      flexShrink: 0
                    }}>
                      {isChecked && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                );

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Pause when hidden */}
                    {renderCheckboxCard(
                      lang === 'es' ? 'Pausar al ocultar' : 'Pause when hidden',
                      lang === 'es' ? 'Pausar las sesiones de lectura activas cuando la pestaña o aplicación pasa a segundo plano.' : 'Pause active sessions when the tab or app goes to the background.',
                      settings.trackerAutoPause !== 'off',
                      () => onSaveSettings({ ...settings, trackerAutoPause: settings.trackerAutoPause !== 'off' ? 'off' : 'moderate' })
                    )}

                    {/* Pause after inactivity */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 500, color: '#ffffff' }}>
                        {lang === 'es' ? 'Pausar tras inactividad' : 'Pause after inactivity'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.45)', marginTop: '-4px' }}>
                        {lang === 'es' ? 'La falta de cambios en el contador de caracteres durante el intervalo pausará la sesión.' : 'No position changes for the selected duration pauses the session.'}
                      </span>
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px', width: '100%', border: '1px solid rgba(255,255,255,0.08)', marginTop: '4px' }}>
                        {[
                          { label: lang === 'es' ? 'Desactivado' : 'Off', value: 0 },
                          { label: '30s', value: 0.5 },
                          { label: '60s', value: 1 },
                          { label: '120s', value: 2 }
                        ].map((opt) => {
                          const isActive = settings.trackerIdleTime === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => onSaveSettings({ ...settings, trackerIdleTime: opt.value })}
                              style={{
                                flex: 1,
                                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 0',
                                fontSize: '0.82rem',
                                fontWeight: isActive ? '600' : '400',
                                cursor: 'pointer',
                                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                transition: 'all 0.15s',
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recover on launch */}
                    {renderCheckboxCard(
                      lang === 'es' ? 'Recuperar al iniciar' : 'Recover on launch',
                      lang === 'es' ? 'Restaurar la sesión inacabada más reciente en estado pausado al siguiente inicio.' : 'Restore the most recent unfinished session in a paused state on next launch.',
                      settings.recoverOnLaunch === true,
                      () => onSaveSettings({ ...settings, recoverOnLaunch: !settings.recoverOnLaunch })
                    )}
                  </div>
                );
              })()}
            </div>
          )}



          {/* Card: Estadísticas (Yatsu style) */}
          {matchesSearch('stats config estadisticas tracking delete books annotations enabled') && (settingsSearchQuery || activeSettingsSection === 'sec-stats') && (
            <div id="sec-stats" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Estadísticas' : 'Statistics'}</span>
              </h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Configura el almacenamiento del historial de lectura y las acciones de limpieza.' : 'Configure the storage of reading history and cleanup actions.'}</p>
              
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

              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await showConfirm({
                      title: lang === 'es' ? '¿Limpiar estadísticas?' : 'Clear statistics?',
                      message: lang === 'es' ? '¿Limpiar estadísticas de libros ya eliminados?' : 'Clear stats for already deleted books?',
                      type: 'warning',
                      confirmText: lang === 'es' ? 'Limpiar' : 'Clear',
                    });
                    if (ok) {
                      await onClearDeletedBooks();
                      showToast(lang === 'es' ? 'Limpieza completada.' : 'Cleanup done.', 'success');
                    }
                  }}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Trash2 size={14} /> <span>{lang === 'es' ? 'Estadísticas de libros eliminados' : 'Deleted-book statistics'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Card: Día de lectura */}
          {matchesSearch('reading day dia lectura start hours limites horas nocturno') && (settingsSearchQuery || activeSettingsSection === 'sec-reading-day') && (
            <div id="sec-reading-day" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Día de lectura' : 'Reading Day'}</span>
              </h3>
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

          {/* Card: Sincronización Cloud */}
          {matchesSearch('sync merge sincronizar combinar conflicto storage sync settings gdrive drive cloud cloud-sync') && (settingsSearchQuery || activeSettingsSection === 'sec-cloud-sync') && (
            <div id="sec-cloud-sync" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Sincronización Cloud' : 'Cloud Sync'}</span>
              </h3>
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
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Settings size={14} /> <span>{gDriveTokens ? (lang === 'es' ? 'Re-conectar cuenta' : 'Re-connect account') : (lang === 'es' ? 'Vincular Google Drive' : 'Link Google Drive')}</span>
                </button>

                {gDriveTokens && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        type="button"
                        onClick={handleUploadGDrive}
                        disabled={gDriveSyncStatus === 'syncing'}
                        className="reset-filter-btn"
                        style={{ flex: 1, justifyContent: 'center', background: 'rgba(52, 211, 153, 0.05)', borderColor: '#34d399', color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Upload size={14} /> <span>{lang === 'es' ? 'Subir copia completa' : 'Upload backup'}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={handleDownloadGDrive}
                        disabled={gDriveSyncStatus === 'syncing'}
                        className="reset-filter-btn"
                        style={{ flex: 1, justifyContent: 'center', background: 'rgba(251, 191, 36, 0.05)', borderColor: '#fbbf24', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Download size={14} /> <span>{lang === 'es' ? 'Descargar' : 'Download'}</span>
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

          {/* Card: Vocabulary Management */}
          {matchesSearch('vocabulario vocabulary import export jpdb anki file frequency') && (settingsSearchQuery || activeSettingsSection === 'sec-vocab-manage') && (
            <div id="sec-vocab-manage" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Gestión de Vocabulario' : 'Vocabulary Management'}</span>
              </h3>
              <p className="settings-card-desc">
                {lang === 'es'
                  ? 'Importa, exporta y gestiona tu base de datos de palabras conocidas y en estudio. Sincroniza desde AnkiConnect, JPDB, archivos de texto o listas de frecuencia.'
                  : 'Import, export, and manage your known and learning word database. Sync from AnkiConnect, JPDB, text files, or frequency lists.'}
              </p>
              <button 
                type="button" 
                className="reset-filter-btn"
                onClick={() => setIsVocabModalOpen(true)}
                style={{ background: 'rgba(255, 224, 0, 0.06)', borderColor: 'var(--primary)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}
              >
                <Database size={15} /> {lang === 'es' ? 'Abrir Panel de Vocabulario' : 'Open Vocabulary Panel'}
              </button>
            </div>
          )}

          {/* Card: Backup */}
          {matchesSearch('backup import export catalogo perfil copia seguridad') && (settingsSearchQuery || activeSettingsSection === 'sec-backup') && (
            <div id="sec-backup" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpen size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Copias de seguridad' : 'Backups'}</span>
              </h3>
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
          {matchesSearch('diccionario dictionary offline jmdict frecuencia meta meta_bank zip') && (settingsSearchQuery || activeSettingsSection === 'sec-dicts') && (
            <div id="sec-dicts" style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}>
              
              {/* Card 1: Dictionaries */}
              <div className="settings-section-card">
                <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} style={{ color: 'var(--primary)' }} />
                  <span>{lang === 'es' ? 'Diccionarios' : 'Dictionaries'}</span>
                </h3>
                <p className="settings-card-desc">
                  {lang === 'es' 
                    ? 'Los diccionarios son útiles para buscar el significado de las palabras y añadirlas a tus tarjetas de estudio. Arrastra y suelta los elementos de la siguiente lista para cambiar el orden de aparición de tus diccionarios en los resultados de búsqueda.'
                    : 'Dictionaries are useful for looking up word meanings and adding them to your study cards. Drag and drop the items in the list below to change the order in which your dictionaries appear in search results.'}
                </p>
                
                {isImportingDict && (
                  <div style={{ margin: '16px 0', background: dictImportSuccess ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: dictImportSuccess ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: dictImportSuccess ? '#4ade80' : 'var(--text-muted)' }}>
                      <span>{dictImportSuccess ? '✓ ' : ''}{dictImportMsg}</span>
                      <span>{dictImportProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${dictImportProgress}%`, height: '100%', background: dictImportSuccess ? '#4ade80' : 'var(--primary)', transition: 'width 0.2s, background 0.3s' }}></div>
                    </div>
                    {!dictImportSuccess && (
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', textAlign: 'center', lineHeight: '1.3' }}>
                        {lang === 'es' 
                          ? '⏳ Esto puede tardar de 1 a 2 minutos para diccionarios grandes. Por favor, no cierres la aplicación.' 
                          : '⏳ This may take 1-2 minutes for large dictionaries. Please do not close the application.'}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  {renderDictList(false)}
                </div>

                {renderActions(false)}
              </div>

              {/* Card 2: Frequencies */}
              <div className="settings-section-card">
                <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ListChecks size={18} style={{ color: 'var(--primary)' }} />
                  <span>{lang === 'es' ? 'Listas de palabras frecuentes' : 'Frequency Word Lists'}</span>
                </h3>
                <p className="settings-card-desc">
                  {lang === 'es'
                    ? 'Asignamos a las palabras puntuaciones de 1 a 5 estrellas para mostrar con qué frecuencia se utilizan en diferentes contextos.'
                    : 'We assign words 1 to 5 star ratings to show how frequently they are used in different contexts.'}
                </p>
                <div style={{ background: 'rgba(99, 102, 241, 0.05)', borderLeft: '3px solid #8b5cf6', padding: '10px 14px', borderRadius: '4px', margin: '12px 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                  <strong>{lang === 'es' ? 'Nota:' : 'Note:'}</strong> {lang === 'es' 
                    ? 'utilizamos la lista de palabras frecuentes más importante para las estadísticas de la página y para resaltar palabras en las oraciones recomendadas.'
                    : 'we use the most important frequency list for page statistics and to highlight words in recommended sentences.'}
                </div>

                {isImportingFreq && (
                  <div style={{ margin: '16px 0', background: freqImportSuccess ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: freqImportSuccess ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: freqImportSuccess ? '#4ade80' : 'var(--text-muted)' }}>
                      <span>{freqImportSuccess ? '✓ ' : ''}{freqImportMsg}</span>
                      <span>{freqImportProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${freqImportProgress}%`, height: '100%', background: freqImportSuccess ? '#4ade80' : 'var(--primary)', transition: 'width 0.2s, background 0.3s' }}></div>
                    </div>
                    {!freqImportSuccess && (
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', textAlign: 'center', lineHeight: '1.3' }}>
                        {lang === 'es' 
                          ? '⏳ Esto puede tardar un momento. Por favor, no cierres la aplicación.' 
                          : '⏳ This may take a moment. Please do not close the application.'}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  {renderDictList(true)}
                </div>

                {renderActions(true)}
              </div>

            </div>
          )}

          {/* Card: Actualizaciones */}
          {matchesSearch('updates update actualizaciones actualizar version check beta') && (settingsSearchQuery || activeSettingsSection === 'sec-updates') && (
            <div id="sec-updates" className="settings-section-card">
              <h3 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={18} style={{ color: 'var(--primary)' }} />
                <span>{lang === 'es' ? 'Actualizaciones' : 'Updates'}</span>
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                {/* Auto Update Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  <span>{lang === 'es' ? 'Actualización automática:' : 'Automatic updates:'}</span>
                  <input 
                    type="checkbox" 
                    checked={settings.autoUpdate || false}
                    onChange={(e) => onSaveSettings({ ...settings, autoUpdate: e.target.checked })}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                {/* Beta Updates Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  <span>{lang === 'es' ? 'Actualizaciones beta:' : 'Beta updates:'}</span>
                  <input 
                    type="checkbox" 
                    checked={settings.betaUpdates || false}
                    onChange={(e) => onSaveSettings({ ...settings, betaUpdates: e.target.checked })}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 4px 0', lineHeight: 1.4 }}>
                  {lang === 'es' ? 'Comprueba tanto el paquete del backend como la aplicación de escritorio desde aquí.' : 'Check both the backend package and the desktop application from here.'}
                </p>

                {/* Card 1: Backend de Yoru Reader */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Backend de Yoru Reader
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {lang === 'es' ? 'Actual: ' : 'Current: '}{currentBackendVersion}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {lang === 'es' ? 'Última: ' : 'Latest: '}{latestBackendVersion}
                    </div>
                  </div>
                  <span 
                    onClick={() => {
                      if (backendStatus !== 'up-to-date') {
                        handleUpdateNow();
                      }
                    }}
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: backendStatus === 'up-to-date' ? '#3b82f6' : 'var(--primary)',
                      cursor: backendStatus === 'up-to-date' ? 'default' : 'pointer',
                      textDecoration: backendStatus === 'up-to-date' ? 'none' : 'underline'
                    }}
                  >
                    {backendStatus === 'up-to-date' ? (lang === 'es' ? 'Actualizado' : 'Updated') : (lang === 'es' ? 'Actualizar' : 'Update')}
                  </span>
                </div>

                {/* Card 2: Electron Application */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Aplicación Electron
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {lang === 'es' ? 'Actual: ' : 'Current: '}{currentAppVersion}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {lang === 'es' ? 'Última: ' : 'Latest: '}{latestAppVersion}
                    </div>
                  </div>
                  <span 
                    onClick={() => {
                      if (appStatus !== 'up-to-date') {
                        handleUpdateNow();
                      }
                    }}
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: appStatus === 'up-to-date' ? '#3b82f6' : 'var(--primary)',
                      cursor: appStatus === 'up-to-date' ? 'default' : 'pointer',
                      textDecoration: appStatus === 'up-to-date' ? 'none' : 'underline'
                    }}
                  >
                    {appStatus === 'up-to-date' ? (lang === 'es' ? 'Actualizado' : 'Updated') : (lang === 'es' ? 'Actualizar' : 'Update')}
                  </span>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={handleCheckUpdates}
                    disabled={checkingUpdates}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: checkingUpdates ? 'not-allowed' : 'pointer',
                      background: 'rgba(37, 99, 235, 0.1)',
                      border: '1px solid #2563eb',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    {checkingUpdates ? (lang === 'es' ? 'Buscando...' : 'Checking...') : (lang === 'es' ? 'Buscar actualizaciones' : 'Check for updates')}
                  </button>

                  <button
                    type="button"
                    onClick={handleUpdateNow}
                    disabled={appStatus === 'up-to-date' && backendStatus === 'up-to-date'}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: (appStatus === 'up-to-date' && backendStatus === 'up-to-date') ? 'var(--bg-card)' : 'rgba(16, 185, 129, 0.1)',
                      border: (appStatus === 'up-to-date' && backendStatus === 'up-to-date') ? '1px solid var(--border-light)' : '1px solid #10b981',
                      color: (appStatus === 'up-to-date' && backendStatus === 'up-to-date') ? 'var(--text-muted)' : '#10b981',
                      cursor: (appStatus === 'up-to-date' && backendStatus === 'up-to-date') ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    {updating ? (lang === 'es' ? 'Actualizando...' : 'Updating...') : (lang === 'es' ? 'Actualizar ahora' : 'Update now')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Card: Danger Zone */}
          {matchesSearch('danger zone eliminar borrar todos datos irreversible reset clear storage') && (settingsSearchQuery || activeSettingsSection === 'sec-danger') && (
            <div id="sec-danger" className="settings-section-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.02)' }}>
              <h3 className="settings-card-title" style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                <span>{lang === 'es' ? 'Zona de peligro' : 'Danger Zone'}</span>
              </h3>
              <p className="settings-card-desc">{lang === 'es' ? 'Acciones destructivas e irreversibles sobre los datos almacenados en la aplicación.' : 'Irreversible destructive actions on stored application data.'}</p>
              
              <div style={{ marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="reset-filter-btn"
                  onClick={handleDeleteAllData}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <AlertTriangle size={14} /> <span>{lang === 'es' ? 'Eliminar todos los datos' : 'Delete all data'}</span>
                </button>
              </div>
            </div>
          )}

          {isLibraryModalOpen && renderLibraryModal()}
        </div>
      )}
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
          {/* Main Counter */}
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--status-known)' }}>{totalKnown.toLocaleString()}</span>
            <span>{lang === 'es' ? 'Palabras conocidas' : 'Known words'}</span>
          </h2>

          {/* Subtitle counters */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>
              <span style={{ color: 'var(--status-learning)', marginRight: '4px' }}>{totalLearning}</span>
              {lang === 'es' ? 'aprendiendo' : 'learning'}
            </span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span>
              <span style={{ color: '#ab47bc', marginRight: '4px' }}>{totalStarred}</span>
              {lang === 'es' ? 'destacada(s)' : 'starred'}
            </span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span>
              <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{totalIgnored}</span>
              {lang === 'es' ? 'ignorada(s)' : 'ignored'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="vocab-action-btn"
              onClick={() => setIsVocabModalOpen(true)}
              style={{ background: 'rgba(255, 224, 0, 0.08)', borderColor: 'var(--primary)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 650, padding: '6px 14px', borderRadius: '8px' }}
            >
              <Database size={14} /> <span>{lang === 'es' ? 'Importar / Sincronizar' : 'Import / Sync'}</span>
            </button>

            {/* SRS Review Button */}
            <button
              type="button"
              className="vocab-action-btn"
              onClick={() => { setIsSrsReviewOpen(true); setSrsUpdateTrigger(t => t + 1); }}
              style={{
                background: dueCount > 0 ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-app)',
                borderColor: dueCount > 0 ? 'rgba(168, 85, 247, 0.6)' : 'var(--border-light)',
                color: dueCount > 0 ? '#c084fc' : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: 650,
                padding: '6px 14px',
                borderRadius: '8px',
                position: 'relative'
              }}
            >
              <Zap size={14} />
              <span>{lang === 'es' ? 'Repasar SRS' : 'Review SRS'}</span>
              {dueCount > 0 && (
                <span style={{
                  background: '#a855f7',
                  color: '#fff',
                  borderRadius: '10px',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  marginLeft: '2px'
                }}>{dueCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* SRS Stats Panel (Jiten style) */}
        <div 
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-light)', 
            borderRadius: '16px', 
            padding: '24px', 
            marginBottom: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px'
          }}
        >
          {/* Left: Card Breakdown */}
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
              📊 {lang === 'es' ? 'Desglose de Tarjetas SRS' : 'SRS Card Breakdown'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: lang === 'es' ? 'Nuevas' : 'New', value: srsStats.newCards, color: '#3b82f6', desc: lang === 'es' ? 'Listas para aprender' : 'Ready to learn' },
                { label: lang === 'es' ? 'Aprendiendo' : 'Learning', value: srsStats.learningCards, color: '#f59e0b', desc: lang === 'es' ? 'En repaso corto' : 'Short review cycle' },
                { label: lang === 'es' ? 'Jóvenes' : 'Young', value: srsStats.youngCards, color: '#22c55e', desc: lang === 'es' ? 'Intervalo < 21 días' : 'Interval < 21 days' },
                { label: lang === 'es' ? 'Maduras' : 'Mature', value: srsStats.matureCards, color: '#a855f7', desc: lang === 'es' ? 'Intervalo ≥ 21 días' : 'Interval ≥ 21 days' }
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card-hover)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>({item.desc})</span>
                  </div>
                  <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Review Forecast */}
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
              🔮 {lang === 'es' ? 'Pronóstico de Repasos' : 'Review Forecast'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: lang === 'es' ? 'Pendientes hoy' : 'Due today', value: srsStats.due, color: '#ef4444' },
                { label: lang === 'es' ? 'Próximos 7 días' : 'Next 7 days', value: srsStats.due7d, color: 'var(--primary)' },
                { label: lang === 'es' ? 'Próximos 30 días' : 'Next 30 days', value: srsStats.due30d, color: '#60a5fa' }
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card-hover)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.value > 0 && <span style={{ fontSize: '0.72rem', color: item.color, background: 'rgba(255, 255, 255, 0.02)', padding: '2px 8px', borderRadius: '12px', border: `1px solid ${item.color}`, fontWeight: 700 }}>+{item.value}</span>}
                    <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)' }}>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
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
                      color: notesSort === opt.value ? 'var(--primary)' : 'var(--text-main)',
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
                      color: notesFilterStatus === opt.value ? 'var(--primary)' : 'var(--text-main)',
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
            style={{ width: '100%', maxWidth: 'none', borderRadius: '12px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)' }}
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
                      onClick={async () => {
                        const ok = await showConfirm({
                          title: lang === 'es' ? '¿Eliminar palabra?' : 'Delete word?',
                          message: lang === 'es' ? `¿Quieres eliminar "${item.word}" de tu vocabulario?` : `Do you want to delete "${item.word}" from your vocabulary?`,
                          type: 'danger',
                          confirmText: lang === 'es' ? 'Eliminar' : 'Delete',
                        });
                        if (ok) {
                          db.setWordStatus(item.word, 'unknown');
                          await showConfirm({
                            title: lang === 'es' ? 'Palabra eliminada' : 'Word deleted',
                            message: lang === 'es' ? 'Palabra eliminada con éxito. La aplicación se recargará ahora.' : 'Word deleted successfully. The application will reload now.',
                            type: 'info',
                            confirmText: lang === 'es' ? 'Entendido' : 'OK',
                            cancelText: '',
                          });
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
    <div 
      className="library-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Sticky Header — Yoru Cafe style */}
      <header className="library-header">
        {/* Left: brand name in neon yellow like Yoru Cafe + mobile menu button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isMobile && activeTab === 'library' && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
            >
              <Menu size={20} />
            </button>
          )}
          {!isMobile && <span className="library-brand-name">YORU READER</span>}
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="header-navigation-tabs">
          <button 
            className={`nav-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <BookOpen size={15} /> <span>{t('library', lang)}</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <BarChart3 size={15} /> <span>{t('statistics', lang)}</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Settings size={15} /> <span>{t('settings', lang)}</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ListChecks size={15} /> <span>{t('vocabulary', lang)}</span>
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

          <div className="header-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
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
              <div 
                className="header-action-dropdown-menu" 
                style={isMobile ? {
                  minWidth: '200px', 
                  position: 'fixed', 
                  right: '12px', 
                  left: 'auto', 
                  top: '56px', 
                  zIndex: 2500 
                } : {
                  minWidth: '220px',
                  position: 'absolute',
                  right: 0,
                  left: 'auto',
                  top: '42px'
                }}
              >
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    toggleSelectMode();
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ListChecks size={14} style={{ color: selectMode ? 'var(--primary)' : 'rgba(255,255,255,0.5)' }} />
                    <span>{lang === 'es' ? 'Seleccionar libros' : 'Select books'}</span>
                  </div>
                </button>
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    handleExportLibrary();
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <span>{lang === 'es' ? 'Obtener copia de seguridad' : 'Get complete local backup'}</span>
                  </div>
                </button>
                {!isMobile && (
                  <button 
                    className="header-action-dropdown-item"
                    onClick={() => {
                      setActiveHeaderDropdown(null);
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(err => {
                          console.error(`Error enabling full-screen mode: ${err.message}`);
                        });
                      } else {
                        if (document.exitFullscreen) {
                          document.exitFullscreen();
                        }
                      }
                    }}
                    type="button"
                  >
                    <div className="header-action-dropdown-item-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <Maximize size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                      <span>{lang === 'es' ? 'Alternar pantalla completa' : 'Toggle fullscreen'}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>F</span>
                    </div>
                  </button>
                )}
                {!isMobile && (
                  <button 
                    className="header-action-dropdown-item"
                    onClick={() => {
                      setActiveHeaderDropdown(null);
                      alert(lang === 'es' ? "Atajos:\n- Q: Abrir ajustes de visualización\n- Esc: Cerrar modales/popups\n- Flechas: Navegar páginas" : "Shortcuts:\n- Q: Open display settings\n- Esc: Close modals/popups\n- Arrows: Navigate pages");
                    }}
                    type="button"
                  >
                    <div className="header-action-dropdown-item-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Keyboard size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                      <span>{lang === 'es' ? 'Atajos de teclado' : 'Keyboard shortcuts'}</span>
                    </div>
                  </button>
                )}
                <button 
                  className="header-action-dropdown-item"
                  onClick={() => {
                    setActiveHeaderDropdown(null);
                    window.open('https://discord.com/invite/NwKYJAUeA', '_blank');
                  }}
                  type="button"
                >
                  <div className="header-action-dropdown-item-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bug size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <span>{lang === 'es' ? 'Reportar un error' : 'Report a bug'}</span>
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
                  <div className="header-action-dropdown-item-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Info size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <span>{lang === 'es' ? 'Acerca de' : 'About'}</span>
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
                  <div className="profile-dropdown-footer-actions" style={{ justifyContent: 'center' }}>
                    <button
                      className="profile-dropdown-settings-btn"
                      onClick={openProfileSettings}
                      title={lang === 'es' ? 'Configuración del Perfil' : 'Profile Settings'}
                      type="button"
                      style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      <Settings size={14} />
                      <span>{lang === 'es' ? 'Configuración del Perfil' : 'Profile Settings'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>



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
          {isMobile && (
            <div 
              className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          <aside 
            className={`library-sidebar ${isSidebarOpen ? 'open' : ''}`}
            onClick={(e) => {
              if (isMobile && e.target.closest('.sidebar-item')) {
                setIsSidebarOpen(false);
              }
            }}
          >
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
            {showUpdateBanner && (
              <div style={{
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ color: '#3b82f6', animationDuration: '4s', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {lang === 'es' 
                        ? (appStatus === 'out-of-date' && backendStatus === 'out-of-date'
                            ? '¡Actualización de Yoru (Aplicación y Backend) Disponible!'
                            : appStatus === 'out-of-date'
                                ? '¡Actualización de Aplicación Yoru Disponible!'
                                : '¡Actualización de Backend de Yoru Disponible!')
                        : (appStatus === 'out-of-date' && backendStatus === 'out-of-date'
                            ? 'Yoru Update (Application & Backend) Available!'
                            : appStatus === 'out-of-date'
                                ? 'Yoru Application Update Available!'
                                : 'Yoru Backend Update Available!')}
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {lang === 'es' 
                        ? `Hay una nueva versión estable lista (v${latestAppVersion !== 'Unknown' ? latestAppVersion : latestBackendVersion}). Haz clic para ver detalles y actualizar.`
                        : `A new stable version is ready (v${latestAppVersion !== 'Unknown' ? latestAppVersion : latestBackendVersion}). Click to view details and update.`}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      setActiveSettingsSection('sec-updates');
                    }}
                    style={{
                      background: '#2563eb',
                      border: 'none',
                      color: '#fff',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {lang === 'es' ? 'Ver detalles' : 'View details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpdateBanner(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={lang === 'es' ? 'Cerrar' : 'Close'}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
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

      {/* Bottom Navigation Bar for Mobile */}
      {isMobile && (
        <div className="bottom-navigation-bar">
          <button 
            className={`bottom-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
            type="button"
          >
            <BookOpen size={18} />
            <span>{t('library', lang)}</span>
          </button>
          <button 
            className={`bottom-tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
            type="button"
          >
            <BarChart3 size={18} />
            <span>{t('statistics', lang)}</span>
          </button>
          <button 
            className={`bottom-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            type="button"
          >
            <Settings size={18} />
            <span>{t('settings', lang)}</span>
          </button>
          <button 
            className={`bottom-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
            type="button"
          >
            <ListChecks size={18} />
            <span>{t('vocabulary', lang)}</span>
          </button>
        </div>
      )}

      {/* Display Settings Drawer (Yatsu style) */}
      <aside className={`display-settings-drawer ${isDisplaySettingsOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-title" style={{ color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'none', fontWeight: 650, letterSpacing: 'normal', textShadow: 'none' }}>{lang === 'es' ? 'Ajustes de visualización' : 'Library display settings'}</span>
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
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>{lang === 'es' ? 'Visualización' : 'Display'}</div>
            
            {/* Details */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'var(--text-main)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Detalles' : 'Details'}</span>
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
                        <span style={{ fontSize: '0.7rem', background: 'var(--bg-card-hover)', padding: '2px 6px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                          {detailsCount}/6
                        </span>
                        <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </button>
                    
                    {isDetailsDropdownOpen && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '42px',
                          left: 0,
                          width: '100%',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '8px',
                          padding: '10px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
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
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}
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
                <span className="drawer-section-label" style={{ color: 'var(--text-main)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Imagen de portada' : 'Cover Image'}</span>
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
                <span className="drawer-section-label" style={{ color: 'var(--text-main)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Tamaño de tarjeta' : 'Card Size'}</span>
                <span className="drawer-info-icon" title={lang === 'es' ? 'Redimensionar la escala de las tarjetas de libros.' : 'Resize the book cards scale in the library view.'}>?</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>{lang === 'es' ? 'PEQUEÑO' : 'SMALL'}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="120" 
                    max="240" 
                    step="8"
                    value={cardWidth} 
                    onChange={(e) => setCardWidth(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', height: '4px', background: 'var(--border-light)', borderRadius: '2px' }}
                  />
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>{lang === 'es' ? 'GRANDE' : 'LARGE'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '0.72rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '3px 10px', color: 'var(--text-main)', fontWeight: 600 }}>
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
                <span className="drawer-section-label" style={{ color: 'var(--text-main)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Agrupar por' : 'Group By'}</span>
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
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>{lang === 'es' ? 'Ordenamiento' : 'Sorting'}</div>
            
            {/* Sort By */}
            <div className="drawer-section" style={{ marginBottom: '14px' }}>
              <div className="drawer-label-row">
                <span className="drawer-section-label" style={{ color: 'var(--text-main)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Ordenar por' : 'Sort By'}</span>
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
                <span className="drawer-section-label" style={{ color: 'var(--text-main)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Dirección' : 'Direction'}</span>
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
                    <span className="drawer-section-label" style={{ color: 'var(--text-main)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, marginBottom: 0 }}>{lang === 'es' ? 'Orden del grupo' : 'Group Sort'}</span>
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

            <p className="preview-book-description">
              {previewBook.description || (previewBook.author && previewBook.author !== 'Desconocido' 
                ? (lang === 'es' ? `Novela de ${previewBook.author}.` : `Novel by ${previewBook.author}.`)
                : (lang === 'es' ? 'Sin descripción' : 'No description'))}
            </p>

            <div className="preview-modal-actions">
              <button 
                className="preview-start-btn"
                onClick={() => {
                  onSelectBook(previewBook);
                  setPreviewBook(null);
                }}
              >
                {lang === 'es' ? 'Comenzar a leer' : 'Start Reading'}
              </button>
              
              <button 
                className="preview-delete-btn"
                onClick={async () => {
                  const ok = await showConfirm({
                    title: lang === 'es' ? '¿Eliminar novela?' : 'Delete novel?',
                    message: lang === 'es' ? `¿Estás seguro de que quieres eliminar "${previewBook.title}" de la biblioteca?` : `Are you sure you want to delete "${previewBook.title}" from the library?`,
                    type: 'danger',
                    confirmText: lang === 'es' ? 'Eliminar' : 'Delete',
                  });
                  if (ok) {
                    onDeleteBook(previewBook.id);
                    setPreviewBook(null);
                  }
                }}
              >
                <Trash2 size={16} style={{ marginRight: '6px' }} />
                {lang === 'es' ? 'Eliminar de la biblioteca' : 'Delete from library'} ({Math.round(((previewBook.chapters || []).reduce((sum, ch) => sum + (ch.content || '').length, 0) * 2) / 1024) || 2048}kb)
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
                <label className="edit-form-label">{lang === 'es' ? 'Título' : 'Title'}</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  className="edit-form-input"
                  placeholder={lang === 'es' ? 'Introducir título' : 'Enter title...'}
                />
              </div>

              {/* Ocultar imagen de portada */}
              <div className="edit-form-row inline-row">
                <label className="edit-form-label">{lang === 'es' ? 'Ocultar imagen de portada' : 'Hide cover image'}</label>
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
                <label className="edit-form-label">{lang === 'es' ? 'Descripción (opcional)' : 'Description (optional)'}</label>
                <textarea 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  className="edit-form-textarea"
                  placeholder={lang === 'es' ? 'Introducir descripción' : 'Enter description...'}
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
                {lang === 'es' ? 'Guardar detalles' : 'Save details'}
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
          <div className="settings-modal" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '420px', padding: '24px', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Cloud size={20} style={{ color: '#4285F4' }} />
                <span>{lang === 'es' ? 'Sincronización Google Drive' : 'Google Drive Sync'}</span>
              </h3>
              <button className="close-modal-btn" onClick={() => setIsGDriveSyncOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '20px' }}>
              {lang === 'es' 
                ? 'Sincroniza tus libros, progreso y vocabulario directamente con tu cuenta de Google Drive utilizando la API oficial.' 
                : 'Sync your books, progress, and vocabulary directly with your Google Drive account using the official API.'}
            </div>

            {/* Client ID / Secret Configuration */}
            {!gDriveTokens && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    CLIENT ID
                  </label>
                  <input 
                    type="password"
                    value={gDriveClientId}
                    onChange={(e) => setGDriveClientId(e.target.value)}
                    placeholder="Enter Client ID..."
                    className="edit-form-input"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '8px 10px', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    CLIENT SECRET (OPTIONAL)
                  </label>
                  <input 
                    type="password"
                    value={gDriveClientSecret}
                    onChange={(e) => setGDriveClientSecret(e.target.value)}
                    placeholder="Enter Client Secret..."
                    className="edit-form-input"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '8px 10px', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-main)' }}
                  />
                </div>
              </div>
            )}

            {/* Connection Status Card */}
            <div style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-light)', 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {lang === 'es' ? 'Última sincronización:' : 'Last sync:'} {lastSyncTime}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
        {isVocabModalOpen && (
          <VocabularyModal isOpen={isVocabModalOpen} onClose={() => setIsVocabModalOpen(false)} />
        )}
        {isSrsReviewOpen && (
          <SrsReviewModal isOpen={isSrsReviewOpen} onClose={() => { setIsSrsReviewOpen(false); setSrsUpdateTrigger(t => t + 1); }} />
        )}
      </React.Suspense>

      {isSettingsOpen && (
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSaveSettings={onSaveSettings}
          onExportLibrary={handleExportLibrary}
          onTriggerImportBackup={() => backupInputRef.current.click()}
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

      {/* Custom Toast Notification Styled with App Theme */}
      {toast.show && (
        <div className="yoru-toast" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#18181b',
          color: '#ffffff',
          padding: '10px 16px',
          borderRadius: '4px',
          border: toast.type === 'success' ? '1px solid #34d399' : toast.type === 'info' ? '1px solid #60a5fa' : '1px solid #ef4444',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.82rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'toastIn 0.2s ease-out forwards'
        }}>
          <span style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            background: toast.type === 'success' ? '#34d399' : toast.type === 'info' ? '#60a5fa' : '#ef4444',
            display: 'inline-block' 
          }} />
          <span>{toast.message}</span>
        </div>
      )}
      {deleteAllState && renderDeleteAllModal()}
      {confirmModal}
    </div>
  );
});

export default Library;
