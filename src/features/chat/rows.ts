// Transforme une liste de messages (plus récent d'abord) en lignes affichables : séparateurs de date, groupement.
import type { Message } from "../../contract/bindings";

export type Row =
  | { kind: "date"; key: string; label: string }
  | { kind: "new"; key: string }
  | { kind: "message"; key: string; message: Message; grouped: boolean };

const GROUP_WINDOW_MS = 7 * 60 * 1000;

const dayLabel = (d: Date): string =>
  d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const newer = (a: string, b: string): boolean => a.length !== b.length ? a.length > b.length : a > b;

/** `lastReadId` : place le séparateur « Nouveaux messages » avant le premier message plus récent. */
export function buildRows(newestFirst: Message[], lastReadId: string | null = null): Row[] {
  const rows: Row[] = [];
  let prev: Message | null = null;
  let newPlaced = !lastReadId || newestFirst.length === 0 || !newer(newestFirst[0].id, lastReadId);
  for (let i = newestFirst.length - 1; i >= 0; i--) {
    const m = newestFirst[i];
    const at = new Date(m.timestamp);
    const prevAt = prev ? new Date(prev.timestamp) : null;
    if (!prevAt || prevAt.toDateString() !== at.toDateString()) {
      rows.push({ kind: "date", key: `d-${at.toDateString()}`, label: dayLabel(at) });
    }
    let breakGroup = false;
    if (!newPlaced && lastReadId && newer(m.id, lastReadId)) {
      rows.push({ kind: "new", key: `n-${m.id}` });
      newPlaced = true;
      breakGroup = true;
    }
    const grouped = !breakGroup && !!prev && !!prevAt && prev.author.id === m.author.id && !m.reply_to
      && at.getTime() - prevAt.getTime() < GROUP_WINDOW_MS && prevAt.toDateString() === at.toDateString();
    rows.push({ kind: "message", key: m.id, message: m, grouped });
    prev = m;
  }
  return rows;
}

export const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
