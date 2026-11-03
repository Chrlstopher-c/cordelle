// Faux moteur « server » pour le mode démo (VITE_MOCK=1) : administration du serveur avec données fictives.
import * as F from "./fixtures";
import type { Handler } from "./mock-tauri";

const ALL_PERMS = "18446744073709551615";
const INVITE_CODES = ["demoA1", "demoB2", "demoC3"];

const str = (a: Record<string, unknown>, k: string): string => String(a[k] ?? "");
const guildName = (id: string): string => F.GUILDS.find((g) => g.id === id)?.name ?? "Serveur démo";

const ROLES = [
  { id: "202", name: "Modérateur", color: 0x3fb97a, hoist: true, mentionable: true, position: 2,
    permissions: "1099511627776", managed: false },
  { id: "203", name: "Membre", color: 0, hoist: false, mentionable: false, position: 1,
    permissions: "104324673", managed: false },
];

const MEMBERS = [
  { user: F.ALICE, nick: null, roles: ["202"], joined_at: "2024-03-02T10:00:00Z", timed_out_until: null },
  { user: F.BOB, nick: "Bobby", roles: ["203"], joined_at: "2025-01-14T18:20:00Z", timed_out_until: null },
  { user: F.CLARA, nick: null, roles: [], joined_at: "2026-06-30T09:05:00Z", timed_out_until: null },
];

const INVITES = [
  { code: INVITE_CODES[0], inviter: F.ALICE, channel_id: "301", channel_name: "général", uses: 14, max_uses: 25,
    created_at: "2026-10-30T10:00:00Z", expires_at: "2026-11-12T10:00:00Z" },
  { code: INVITE_CODES[1], inviter: F.BOB, channel_id: "302", channel_name: "annonces", uses: 3, max_uses: 0,
    created_at: "2026-11-01T10:00:00Z", expires_at: null },
];

const EMOJIS = [
  { id: "500", name: "tasse", animated: false, user: { username: "demo_moi" } },
  { id: "501", name: "bravo", animated: true, user: { username: "demo_alice" } },
];

const AUDIT = [
  { id: "1094000000000000001", action_type: 22, actor: F.ALICE, target_id: "102", reason: "Spam (démo)", changes: [],
    created_ms: 1_770_000_000_000 },
  { id: "1094000000000000002", action_type: 31, actor: F.ME, target_id: "203", reason: null,
    changes: [{ key: "name", old: "Membre fictif", new: "Membre" }], created_ms: 1_770_000_600_000 },
];

const channelOf = (id: string): Record<string, unknown> => {
  const ch = Object.values(F.CHANNELS).flat().find((c) => c.id === id);
  return {
    id, guild_id: ch?.guild_id ?? "200", name: ch?.name ?? "salon", topic: ch?.topic ?? null,
    nsfw: false, rate_limit_per_user: 0,
  };
};

export const handlers: Record<string, Handler> = {
  guild_info: (a) => ({
    id: str(a, "guildId"), name: guildName(str(a, "guildId")), description: "Serveur fictif pour la démo.",
    icon_url: null, banner_url: null, owner_id: "101", member_count: 42, online_count: 7, permissions: ALL_PERMS,
  }),
  guild_update: () => null,
  roles_list: (a) => [
    { id: str(a, "guildId"), name: "@everyone", color: 0, hoist: false, mentionable: false, position: 0,
      permissions: "104324673", managed: false },
    ...ROLES,
  ],
  role_create: () => ({
    id: "204", name: "nouveau rôle", color: 0, hoist: false, mentionable: false, position: 3,
    permissions: "0", managed: false,
  }),
  role_update: () => null,
  role_delete: () => null,
  role_reorder: () => null,
  guild_members_search: (a) => {
    const q = str(a, "query").toLowerCase();
    return MEMBERS.filter((m) => !q || `${m.user.username} ${m.nick ?? ""}`.toLowerCase().includes(q));
  },
  member_kick: () => null,
  member_ban: () => null,
  bans_list: () => [{ user: F.CLARA, reason: "Spam (démo)" }],
  ban_remove: () => null,
  invites_list: () => INVITES,
  invite_create: (a) => ({
    code: INVITE_CODES[2], inviter: F.ME, channel_id: str(a, "channelId"), channel_name: "général", uses: 0,
    max_uses: Number(a.maxUses ?? 0), created_at: new Date().toISOString(),
    expires_at: Number(a.maxAge) > 0 ? new Date(Date.now() + Number(a.maxAge) * 1000).toISOString() : null,
  }),
  invite_delete: () => null,
  guild_emojis_manage: () => EMOJIS.map((e) => ({
    id: e.id, name: e.name, animated: e.animated, creator: e.user.username,
    image_url: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}`,
  })),
  audit_log: () => AUDIT,
  automod_rules: () => [{
    id: "600", name: "Mots interdits (démo)", enabled: true, trigger_type: 1, keywords: ["arnaque*", "gratuit"],
    actions: [1, 2], exempt_roles: ["202"], exempt_channels: [],
  }],
  integrations_list: () => [{ id: "700", name: "Alertes démo", kind: "webhook", enabled: true, account_name: null }],
  channel_info: (a) => channelOf(str(a, "channelId")),
  channel_update: () => null,
  channel_create: () => null,
  guild_ack: () => null,
  guild_leave: () => null,
};
