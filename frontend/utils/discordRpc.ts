let readingStartTime: number | null = null;
let currentBookId: string | null = null;

export function updateDiscordReading(book: any, settings: any) {
  if (!window.electronAPI || !window.electronAPI.updateDiscordPresence) return;
  if (!settings.discordEnabled) {
    window.electronAPI.updateDiscordPresence(null);
    return;
  }

  // Check blacklist
  if (settings.discordBlacklist && book?.title) {
    const blacklist = settings.discordBlacklist.split('\n').map((line: string) => line.trim().toLowerCase());
    if (blacklist.includes(book.title.toLowerCase())) {
      window.electronAPI.updateDiscordPresence(null);
      return;
    }
  }

  if (currentBookId !== book.id) {
    currentBookId = book.id;
    readingStartTime = Date.now();
  }

  const details = `Leyendo: ${book.title}`;
  const currChapterIdx = book.progress?.currentChapter ?? 0;
  const chapter = book.chapters?.[currChapterIdx];
  let state = chapter ? chapter.title : 'Novela ligera';

  if (settings.discordShowStats === 'Progress') {
    state = `${state} (${book.progress?.percent ?? 0}%)`;
  }

  const presence: any = {
    details,
    state,
    assets: {
      large_image: 'logo',
      large_text: 'Yoru Reader'
    }
  };

  if (settings.discordShowStats === 'Time' && readingStartTime) {
    presence.timestamps = {
      start: readingStartTime
    };
  }

  window.electronAPI.updateDiscordPresence(presence);
}

export function updateDiscordReview(settings: any) {
  if (!window.electronAPI || !window.electronAPI.updateDiscordPresence) return;
  if (!settings.discordEnabled) {
    window.electronAPI.updateDiscordPresence(null);
    return;
  }

  window.electronAPI.updateDiscordPresence({
    details: 'Repasando tarjetas',
    state: 'Sesión de SRS',
    assets: {
      large_image: 'logo',
      large_text: 'Yoru Reader'
    },
    timestamps: {
      start: Date.now()
    }
  });
}

export function clearDiscordPresence() {
  if (!window.electronAPI || !window.electronAPI.updateDiscordPresence) return;
  window.electronAPI.updateDiscordPresence(null);
  currentBookId = null;
  readingStartTime = null;
}
