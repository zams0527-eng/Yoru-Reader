export const CHANGELOG = [
  {
    version: '1.0.3',
    date: '2026-07-09',
    changes: {
      es: [
        'Popup del diccionario ahora se posiciona automáticamente encima de la palabra cuando está en la mitad inferior de la pantalla, evitando que se corte.',
        'Detección reactiva de colisión: si el popup sobrepasa el borde inferior en tiempo real, sube automáticamente sobre la palabra.',
        'Corrección del conflicto de animación CSS que impedía que el popup se mostrara correctamente arriba de la palabra.',
        'Eliminado el salto de texto al pasar el cursor sobre palabras (causado por el pseudo-elemento ::after del checkmark de hover).',
        'Nuevos modales de confirmación con estilo de la app (reemplazando todos los alert/confirm nativos del sistema).',
        'Notificaciones toast no intrusivas para acciones en masa en la biblioteca.',
        'Optimización: caché en memoria para consultas Yomitan (elimina 90+ transacciones IndexedDB por cambio de página).',
        'Optimización: eliminados re-renders completos del lector al cambiar de página.',
        'El idioma de la app ahora se guarda en respaldos y se restaura automáticamente al importar.',
        'Al marcar una palabra como "Conocido": busca la tarjeta en Anki en todos los mazos y tipos de nota, la madura automáticamente (intervalo 30 días). Si no existe, crea una tarjeta básica y la madura.',
        'La búsqueda en Anki ahora prueba múltiples nombres de campo (Expression, Vocabulary-Kanji, Word, etc.) para evitar duplicados en mazos como Core 2k/6k.',
      ],
      en: [
        'Dictionary popup now automatically positions above the word when it is in the lower half of the screen, preventing cut-offs.',
        'Reactive collision detection: if the popup exceeds the bottom edge at runtime, it flips above the word automatically.',
        'Fixed CSS animation conflict that prevented the popup from correctly displaying above the word.',
        'Eliminated text jumping when hovering over words (caused by the hover checkmark ::after pseudo-element).',
        'New app-styled confirmation modals (replacing all native system alert/confirm dialogs).',
        'Non-intrusive toast notifications for bulk library actions.',
        'Optimization: in-memory cache for Yomitan queries (eliminates 90+ IndexedDB transactions per page turn).',
        'Optimization: eliminated full Reader re-renders on page turn.',
        'App language is now saved in backups and automatically restored on import.',
        'When marking a word as "Known": searches for the card in Anki across all decks and note types, matures it automatically (30-day interval). If it does not exist, creates a basic card and matures it.',
        'Anki search now tries multiple field names (Expression, Vocabulary-Kanji, Word, etc.) to prevent duplicates in decks like Core 2k/6k.',
      ]
    }
  },
  {

    version: '1.0.1',
    date: '2026-07-08',
    changes: {
      es: [
        'Corregido el problema de la clausura obsoleta al minar palabras con el atajo de teclado "m". Ahora las definiciones se envían correctamente a Anki.',
        'Añadida sección de información de la versión y registro de cambios (changelog) en la configuración.'
      ],
      en: [
        'Fixed stale closure issue when mining words using the "m" keyboard shortcut. Definitions are now successfully sent to Anki.',
        'Added version information and changelog section in the settings.'
      ]
    }
  },
  {
    version: '1.0.0',
    date: '2026-06-15',
    changes: {
      es: [
        'Lanzamiento inicial de Yoru Reader.',
        'Lector de novelas ligeras en japonés con paginación automática inteligente.',
        'Integración con diccionarios de Yomitan e IndexedDB.',
        'Soporte completo de AnkiConnect para minar vocabulario.',
        'Lectura en voz alta (TTS) y captura de capturas de pantalla/audio para tarjetas.',
        'Sincronización en la nube con Google Drive y copias de seguridad locales.'
      ],
      en: [
        'Initial release of Yoru Reader.',
        'Japanese light novel reader with smart automatic pagination.',
        'Integration with Yomitan dictionaries and IndexedDB.',
        'Full AnkiConnect support for vocabulary mining.',
        'Text-to-speech (TTS) and screenshot/audio capture for cards.',
        'Cloud synchronization with Google Drive and local backups.'
      ]
    }
  }
];
