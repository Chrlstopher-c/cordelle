// Faux moteur de la zone recherche (démo VITE_MOCK=1) : recherche, épingles, fils et publications fictifs.
import * as F from "./fixtures";
import type { Handler } from "./mock-tauri";

const THREADS = [
  { id: "900", name: "Stratégie des ports", message_count: 14, member_count: 4, last_message_id: "1000", archived: false, owner_id: "101" },
  { id: "901", name: "Carte en île", message_count: 6, member_count: 3, last_message_id: "1100", archived: false, owner_id: "102" },
  { id: "902", name: "Coupe d'octobre", message_count: 41, member_count: 9, last_message_id: "800", archived: true, owner_id: "103" },
];

const str = (a: Record<string, unknown>, k: string): string => String(a[k] ?? "");

/** Recherche plate dans les messages fictifs ; la requête arrive du pont IPC, son contenu est validé côté moteur. */
function searchHandler(args: Record<string, unknown>): unknown {
  const query = (args.query ?? {}) as { content?: string; offset?: number };
  const needle = (query.content ?? "").toLowerCase();
  const all = Object.values(F.MESSAGES).flat();
  const hits = all.filter((m) => !needle || m.content.toLowerCase().includes(needle));
  const offset = Number(query.offset ?? 0);
  return { total: hits.length, messages: hits.slice(offset, offset + 25) };
}

export const handlers: Record<string, Handler> = {
  messages_search: searchHandler,
  pins_list: (a) => (F.MESSAGES[str(a, "channelId")] ?? []).slice(0, 2),
  threads_list: (a) => THREADS.filter((t) => t.archived === Boolean(a.archived)),
  thread_create: (a) => ({
    id: "990", name: str(a, "name"), message_count: a.content ? 1 : 0, member_count: 1,
    last_message_id: null, archived: false, owner_id: F.ME.id,
  }),
};
