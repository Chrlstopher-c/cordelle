// Données FICTIVES du mode démo (VITE_MOCK=1) : aucune vraie personne ni vrai serveur.
import type {
  AccountSummary, ChannelSummary, GuildSummary, MemberGroup, Message, User, UserProfile,
} from "../contract/bindings";

const u = (id: string, username: string, global_name: string): User => ({ id, username, global_name, avatar_url: null, bot: false });

export const ME = u("100", "demo_moi", "Moi");
export const ALICE = u("101", "alice_demo", "Alice");
export const BOB = u("102", "bob_demo", "Bob");
export const CLARA = u("103", "clara_demo", "Clara");

export const ACCOUNTS: AccountSummary[] = [{ id: ME.id, user: ME, active: true, connection: "ready" }];

export const GUILDS: GuildSummary[] = [
  { id: "200", name: "Atelier Démo", icon_url: null, position: 0, folder_id: null, unread: true, mention_count: 1 },
  { id: "201", name: "Club Fictif", icon_url: null, position: 1, folder_id: null, unread: false, mention_count: 0 },
];

const ch = (id: string, guild_id: string | null, kind: ChannelSummary["kind"], name: string, extra?: Partial<ChannelSummary>): ChannelSummary =>
  ({ id, guild_id, parent_id: null, kind, name, topic: null, position: 0, nsfw: false, unread: false, mention_count: 0, recipients: [], ...extra });

export const CHANNELS: Record<string, ChannelSummary[]> = {
  "200": [
    ch("300", "200", "category", "Discussions", { position: 0 }),
    ch("301", "200", "text", "général", { parent_id: "300", topic: "Le salon de démonstration", unread: true, mention_count: 1 }),
    ch("302", "200", "text", "annonces", { parent_id: "300", position: 1 }),
    ch("303", "200", "voice", "vocal-1", { parent_id: "300", position: 2 }),
  ],
  "201": [ch("310", "201", "text", "accueil")],
};

export const DMS: ChannelSummary[] = [
  ch("400", null, "dm", "", { recipients: [ALICE], unread: true }),
  ch("401", null, "group_dm", "", { recipients: [BOB, CLARA] }),
];

let seq = 1000;
const msg = (channel_id: string, author: User, content: string, minutesAgo: number): Message => ({
  id: String(seq++), channel_id, author, content, timestamp: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  edited_timestamp: null, reply_to: null, attachments: [], reactions: [], embeds_json: null, pinned: false,
});

export const MESSAGES: Record<string, Message[]> = {
  "301": [
    msg("301", ALICE, `<@${ME.id}> tu passes ce soir ?`, 2),
    msg("301", ME, "Oui, vers **21 h**", 5),
    msg("301", BOB, "Qui lance la partie ? `lobby-42`", 6),
    msg("301", ALICE, "Bonjour à tous ! ||surprise||", 30),
  ],
  "400": [msg("400", ALICE, "Coucou, ça va ?", 3), msg("400", ME, "Salut !", 4)],
  "401": [msg("401", CLARA, "Groupe de démo", 10)],
};

export const MEMBERS: MemberGroup[] = [
  { id: "online", name: "En ligne", count: 3, members: [
    { user: ALICE, nick: null, color: 0x8fb8eb, status: "online", activity: "Joue à Jeu Fictif" },
    { user: BOB, nick: null, color: null, status: "dnd", activity: null },
    { user: ME, nick: null, color: 0x7fd6a8, status: "online", activity: null },
  ] },
  { id: "offline", name: "Hors ligne", count: 1, members: [{ user: CLARA, nick: null, color: null, status: "offline", activity: null }] },
];

export const profileOf = (user: User): UserProfile => ({
  user, banner_url: null, accent_color: 0x3b4a74, theme_colors: null, avatar_decoration_url: null,
  bio: "Profil de démonstration.", pronouns: null,
  badges: [{ id: "demo", description: "Badge de démonstration", link: null,
    icon_url: "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%278%27 fill=%27%235A66E8%27/%3E%3C/svg%3E" }], connected_accounts: [],
  created_at_ms: Date.UTC(2021, 3, 12), joined_guild_at: null, guild_nick: null,
  mutual_guilds: [{ id: "200", name: "Atelier Démo", icon_url: null, nick: null }], mutual_friends: [BOB], note: null,
});

export const ALL_USERS = [ME, ALICE, BOB, CLARA];
