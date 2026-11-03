// Emojis récents (caractères), mémorisés par poste dans localStorage. Une lecture ou écriture refusée ne bloque rien.
const STORAGE_KEY = "cordelle.compose.recent-emojis";
const MAX_RECENT = 24;

export function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch (err) {
    console.warn("emojis récents illisibles", err);
    return [];
  }
}

export function pushRecent(char: string): string[] {
  const next = [char, ...readRecent().filter((c) => c !== char)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("emojis récents non enregistrés", err);
  }
  return next;
}
