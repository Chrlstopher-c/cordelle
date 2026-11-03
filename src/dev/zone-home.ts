// Faux moteur de la zone accueil (mode démo) : données FICTIVES, aucune vraie personne ni serveur.
import type { Handler } from "./mock-tauri";

const DEMO_GUILD = { id: "900", name: "Serveur de démo", icon_url: null, description: "Un serveur fictif pour la démo.", member_count: 128, online_count: 37 };
const NOW = Date.now();
const inHours = (h: number): string => new Date(NOW + h * 3600_000).toISOString();

const DISCOVERABLE = [
  { id: "910", name: "Club de démo", description: "Discussions fictives pour tester la grille.", icon_url: null, member_count: 4200, online_count: 310 },
  { id: "911", name: "Jeux fictifs", description: "Salons de matchmaking inventés.", icon_url: null, member_count: 980, online_count: 52 },
  { id: "912", name: "Lecture de démo", description: null, icon_url: null, member_count: 75, online_count: 9 },
];

const EVENTS = [
  { id: "920", name: "Soirée de démo", description: "Un événement fictif, à venir.", start: inHours(26), end: inHours(29), channel_id: "303", location: null, interested: 12, live: false },
  { id: "921", name: "Rencontre en direct", description: null, start: inHours(-1), end: inHours(2), channel_id: null, location: "Lieu fictif", interested: 4, live: true },
];

export const handlers: Record<string, Handler> = {
  invite_resolve: (a) => ({
    code: String(a.code ?? ""), guild_id: DEMO_GUILD.id, guild_name: DEMO_GUILD.name, icon_url: null,
    member_count: DEMO_GUILD.member_count, online_count: DEMO_GUILD.online_count, channel_name: "général",
  }),
  invite_accept: () => DEMO_GUILD.id,
  guild_create: () => "901",
  scheduled_events: () => EVENTS,
  discoverable_guilds: (a) => {
    const q = String(a.query ?? "").toLowerCase();
    const offset = Number(a.offset ?? 0);
    return DISCOVERABLE.filter((g) => g.name.toLowerCase().includes(q)).slice(offset, offset + 24);
  },
};
