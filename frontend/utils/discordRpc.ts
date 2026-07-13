import { db } from './db';

let readingStartTime: number | null = null;
let currentBookId: string | null = null;
let sessionStartChars = 0;

function getLargeImageKey(discordIcon?: string): string {
  const icon = (discordIcon || 'Yoru').toLowerCase();
  if (icon === 'yoru') {
    return 'https://raw.githubusercontent.com/zams0527-eng/Yoru-Reader/master/yoru-reader-svelte/static/icons/regular-icon@192x192.png';
  } else if (icon === 'cute') {
    return 'gsm_cute';
  } else if (icon === 'jacked') {
    return 'gsm_jacked';
  } else if (icon === 'cursed') {
    return 'gsm_cursed';
  }
  return icon;
}

function buildPresence(details: string, state: string, largeImageKey: string, startTimestamp?: number): any {
  const presence: any = {
    details,
    state,
    assets: {
      large_image: largeImageKey,
      large_text: 'Yoru Reader',
      large_url: 'https://github.com/zams0527-eng/Yoru-Reader'
    },
    state_url: 'https://github.com/zams0527-eng/Yoru-Reader',
    details_url: 'https://github.com/zams0527-eng/Yoru-Reader',
    buttons: [
      { label: 'GitHub Repository', url: 'https://github.com/zams0527-eng/Yoru-Reader' }
    ]
  };

  if (startTimestamp) {
    presence.timestamps = {
      start: startTimestamp
    };
  }

  return presence;
}

export function updateDiscordReading(book: any, settings: any, currentProgress?: any) {
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
    sessionStartChars = currentProgress && currentProgress.currChars !== undefined
      ? currentProgress.currChars
      : (book.progress?.charactersRead || 0);
  }

  const details = `Leyendo: ${book.title}`;
  const currChapterIdx = currentProgress && currentProgress.currSection !== undefined
    ? currentProgress.currSection
    : (book.progress?.currentChapter ?? 0);
  const chapter = book.chapters?.[currChapterIdx];
  let state = chapter ? chapter.title : 'Novela ligera';

  if (settings.discordShowStats === 'Progress') {
    const percent = currentProgress && currentProgress.totalChars > 0
      ? Math.round((currentProgress.currChars / currentProgress.totalChars) * 100)
      : (book.progress?.percent ?? 0);
    state = `${state} (${percent}%)`;
  } else if (settings.discordShowStats === 'Characters per Hour') {
    const liveCharsRead = currentProgress && currentProgress.currChars !== undefined
      ? currentProgress.currChars
      : (book.progress?.charactersRead || 0);
    const sessionChars = Math.max(0, liveCharsRead - sessionStartChars);
    const elapsedHours = readingStartTime ? (Date.now() - readingStartTime) / (1000 * 60 * 60) : 0;
    const charsPerHour = elapsedHours > 0.005 ? Math.round(sessionChars / elapsedHours) : 0;
    state = `${state} (${charsPerHour} car/h)`;
  } else if (settings.discordShowStats === 'Total Characters') {
    const liveCharsRead = currentProgress && currentProgress.currChars !== undefined
      ? currentProgress.currChars
      : (book.progress?.charactersRead || 0);
    state = `${state} (${liveCharsRead} car.)`;
  } else if (settings.discordShowStats === 'Cards Mined') {
    try {
      const srsData = db.getSrsData();
      const cardsMined = Object.keys(srsData).filter(key => !key.startsWith('_')).length;
      state = `${state} (${cardsMined} tarj.)`;
    } catch (e) {
      console.error('Error fetching cards mined count for Discord:', e);
    }
  }

  const largeImageKey = getLargeImageKey(settings.discordIcon);
  const showTime = settings.discordShowStats === 'Time' || settings.discordShowStats === 'Active Reading Time';
  const presence = buildPresence(
    details,
    state,
    largeImageKey,
    showTime && readingStartTime ? readingStartTime : undefined
  );

  window.electronAPI.updateDiscordPresence(presence);
}

export function updateDiscordReview(settings: any) {
  if (!window.electronAPI || !window.electronAPI.updateDiscordPresence) return;
  if (!settings.discordEnabled) {
    window.electronAPI.updateDiscordPresence(null);
    return;
  }

  const largeImageKey = getLargeImageKey(settings.discordIcon);
  const presence = buildPresence(
    'Repasando tarjetas',
    'Sesión de SRS',
    largeImageKey,
    Date.now()
  );

  window.electronAPI.updateDiscordPresence(presence);
}

export function clearDiscordPresence() {
  if (!window.electronAPI || !window.electronAPI.updateDiscordPresence) return;
  window.electronAPI.updateDiscordPresence(null);
  currentBookId = null;
  readingStartTime = null;
}

export function updateDiscordLibrary(settings: any) {
  if (!window.electronAPI || !window.electronAPI.updateDiscordPresence) return;
  if (!settings.discordEnabled) {
    window.electronAPI.updateDiscordPresence(null);
    return;
  }

  const largeImageKey = getLargeImageKey(settings.discordIcon);
  const presence = buildPresence(
    'En la biblioteca',
    'Navegando por la biblioteca',
    largeImageKey
  );

  window.electronAPI.updateDiscordPresence(presence);
}
