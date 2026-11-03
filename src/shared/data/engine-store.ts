// État client alimenté par le moteur : comptes, serveurs, salons, messages par salon. Seule source pour l'interface.
import { create } from "zustand";
import {
  commands,
  type AccountSummary,
  type ChannelSummary,
  type ConnectionState,
  type EngineEvent,
  type GuildSummary,
  type Message,
} from "../../contract/bindings";

export interface EngineState {
  accounts: AccountSummary[];
  accountsLoaded: boolean;
  connection: Record<string, ConnectionState>;
  guilds: GuildSummary[];
  channelsByGuild: Record<string, ChannelSummary[]>;
  dms: ChannelSummary[];
  /** Messages par salon, du plus récent au plus ancien. */
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  typing: Record<string, { userId: string; at: number }[]>;
  refreshAccounts: () => Promise<void>;
  loadGuilds: (accountId: string) => Promise<void>;
  loadChannels: (accountId: string, guildId: string) => Promise<void>;
  loadDms: (accountId: string) => Promise<void>;
  loadMessages: (accountId: string, channelId: string, older?: boolean) => Promise<void>;
  send: (accountId: string, channelId: string, content: string, replyTo?: string | null) => Promise<void>;
  apply: (event: EngineEvent, activeAccount: string | null) => void;
}

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
};

export const useEngine = create<EngineState>((set, get) => ({
  accounts: [],
  accountsLoaded: false,
  connection: {},
  guilds: [],
  channelsByGuild: {},
  dms: [],
  messages: {},
  hasMore: {},
  typing: {},

  refreshAccounts: async () => {
    const r = await commands.accountsList();
    if (r.status === "ok") set({ accounts: r.data, accountsLoaded: true });
    else set({ accountsLoaded: true });
  },
  loadGuilds: async (accountId) => {
    const r = await commands.guildsList(accountId);
    if (r.status === "ok") set({ guilds: r.data });
  },
  loadChannels: async (accountId, guildId) => {
    const r = await commands.channelsList(accountId, guildId);
    if (r.status === "ok") set((s) => ({ channelsByGuild: { ...s.channelsByGuild, [guildId]: r.data } }));
  },
  loadDms: async (accountId) => {
    const r = await commands.dmsList(accountId);
    if (r.status === "ok") set({ dms: r.data });
  },
  loadMessages: async (accountId, channelId, older = false) => {
    const current = get().messages[channelId] ?? [];
    const before = older && current.length > 0 ? current[current.length - 1].id : null;
    const r = await commands.messagesGet(accountId, channelId, before, 50);
    if (r.status !== "ok") return;
    set((s) => ({
      messages: { ...s.messages, [channelId]: older ? [...current, ...r.data.messages] : r.data.messages },
      hasMore: { ...s.hasMore, [channelId]: r.data.has_more },
    }));
  },
  send: async (accountId, channelId, content, replyTo = null) => {
    await commands.messageSend(accountId, channelId, { content, reply_to: replyTo, nonce: String(Date.now()) });
  },

  apply: (ev, activeAccount) => {
    if (ev.type === "connection") {
      set((s) => ({ connection: { ...s.connection, [ev.account_id]: ev.state } }));
      return;
    }
    if (ev.account_id !== activeAccount) return;
    switch (ev.type) {
      case "guild_upsert":
        set((s) => ({ guilds: upsert(s.guilds, ev.guild) }));
        break;
      case "guild_remove":
        set((s) => ({ guilds: s.guilds.filter((g) => g.id !== ev.guild_id) }));
        break;
      case "channel_upsert": {
        const c = ev.channel;
        if (c.guild_id) {
          set((s) => ({
            channelsByGuild: {
              ...s.channelsByGuild,
              [c.guild_id as string]: upsert(s.channelsByGuild[c.guild_id as string] ?? [], c),
            },
          }));
        } else set((s) => ({ dms: upsert(s.dms, c) }));
        break;
      }
      case "message_create":
        set((s) => {
          const list = s.messages[ev.message.channel_id];
          if (!list) return {};
          return { messages: { ...s.messages, [ev.message.channel_id]: [ev.message, ...list.filter((m) => m.id !== ev.message.id)] } };
        });
        break;
      case "message_update":
        set((s) => {
          const list = s.messages[ev.message.channel_id];
          if (!list) return {};
          return { messages: { ...s.messages, [ev.message.channel_id]: list.map((m) => (m.id === ev.message.id ? ev.message : m)) } };
        });
        break;
      case "message_delete":
        set((s) => {
          const list = s.messages[ev.channel_id];
          if (!list) return {};
          return { messages: { ...s.messages, [ev.channel_id]: list.filter((m) => m.id !== ev.message_id) } };
        });
        break;
      case "typing":
        set((s) => ({
          typing: {
            ...s.typing,
            [ev.channel_id]: [...(s.typing[ev.channel_id] ?? []).filter((t) => t.userId !== ev.user_id), { userId: ev.user_id, at: Date.now() }],
          },
        }));
        break;
      default:
        break;
    }
  },
}));
