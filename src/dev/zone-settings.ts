// Faux moteur « réglages » (mode démo) : sessions, comptes liés et abonnement fictifs.
import type { Handler } from "./mock-tauri";

let sessions = [
  {
    id_hash: "demo-session-1", client: "Discord Desktop", os: "Linux", location: "Paris, France",
    last_active: "2026-11-02T18:12:00Z",
  },
  {
    id_hash: "demo-session-2", client: "Navigateur web", os: "Windows 11", location: "Lyon, France",
    last_active: "2026-10-28T09:40:00Z",
  },
];

let connections = [
  { kind: "github", id: "demo-gh-1", name: "exemple-dev", verified: true, visible: true },
  { kind: "twitch", id: "demo-tw-1", name: "exemple_stream", verified: true, visible: false },
];

const SUBSCRIPTIONS: { id: string; status: string; period_end: string | null; canceled: boolean }[] = [];

const str = (a: Record<string, unknown>, k: string): string => String(a[k] ?? "");

export const handlers: Record<string, Handler> = {
  sessions_list: () => sessions,
  sessions_logout: (a) => {
    const hashes = Array.isArray(a.sessionIdHashes) ? a.sessionIdHashes.map(String) : [];
    sessions = sessions.filter((s) => !hashes.includes(s.id_hash));
    return null;
  },
  connections_list: () => connections,
  connection_remove: (a) => {
    connections = connections.filter((c) => !(c.kind === str(a, "kind") && c.id === str(a, "id")));
    return null;
  },
  subscriptions_list: () => SUBSCRIPTIONS,
};
