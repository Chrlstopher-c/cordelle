// Faux moteur pour le mode démo (VITE_MOCK=1) : remplace l'IPC Tauri dans un navigateur, données fictives.
// Sert à vérifier l'interface sans compte Discord. Jamais chargé dans l'app compilée normalement.
import * as F from "./fixtures";

type Handler = (args: Record<string, unknown>) => unknown;
const callbacks = new Map<number, (payload: unknown) => void>();
let nextId = 1;

const str = (a: Record<string, unknown>, k: string): string => String(a[k] ?? "");

const HANDLERS: Record<string, Handler> = {
  accounts_list: () => F.ACCOUNTS,
  guilds_list: () => F.GUILDS,
  channels_list: (a) => F.CHANNELS[str(a, "guildId")] ?? [],
  dms_list: () => F.DMS,
  messages_get: (a) => ({ messages: F.MESSAGES[str(a, "channelId")] ?? [], has_more: false }),
  user_profile: (a) => F.profileOf(F.ALL_USERS.find((u) => u.id === str(a, "userId")) ?? F.ALICE),
  relationships_list: () => [
    { user: F.ALICE, kind: "friend", nickname: null }, { user: F.BOB, kind: "friend", nickname: null },
    { user: F.CLARA, kind: "incoming", nickname: null },
  ],
  mentions_recent: () => [{ message: F.MESSAGES["301"][0], guild_id: "200" }],
  presences_get: () => ({ [F.ALICE.id]: "online", [F.BOB.id]: "dnd", [F.CLARA.id]: "idle" }),
  members_subscribe: (a) => {
    setTimeout(() => emit("engine", { type: "member_list", account_id: F.ME.id, guild_id: str(a, "guildId"), groups: F.MEMBERS }), 50);
    return null;
  },
};

function emit(event: string, payload: unknown): void {
  for (const [, cb] of listeners.get(event) ?? []) cb({ event, id: 0, payload });
}

const listeners = new Map<string, Map<number, (p: unknown) => void>>();

/** Faux moteurs par zone : chaque fichier `zone-<nom>.ts` exporte `handlers`, chargé automatiquement. */
const zoneMocks = import.meta.glob<{ handlers: Record<string, Handler> }>("./zone-*.ts", { eager: true });
for (const mod of Object.values(zoneMocks)) Object.assign(HANDLERS, mod.handlers);

export type { Handler };

async function invoke(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (cmd === "plugin:event|listen") {
    const event = str(args, "event");
    const id = Number(args.handler);
    const cb = callbacks.get(id);
    if (cb) { if (!listeners.has(event)) listeners.set(event, new Map()); listeners.get(event)?.set(id, cb); }
    return id;
  }
  if (cmd.startsWith("plugin:")) return null;
  const h = HANDLERS[cmd];
  console.info(`[mock] ${cmd}`, args);
  return h ? h(args) : null;
}

export function installMock(): void {
  const w = window as unknown as Record<string, unknown>; // injection volontaire de l'API interne Tauri
  w.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback: (cb: (p: unknown) => void): number => { const id = nextId++; callbacks.set(id, cb); return id; },
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    convertFileSrc: (p: string): string => p,
  };
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (event: string, id: number) => listeners.get(event)?.delete(id) };
}
