export const CHANGELOG = [
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
