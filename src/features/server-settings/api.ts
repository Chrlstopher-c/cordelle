// Appels d'administration : erreurs traduites (Discord 403 = permission manquante) et permissions en bits Discord.
import { invoke } from "@tauri-apps/api/core";
import type { EngineError, ChannelSummary } from "../../contract/bindings";
import type {
  AuditEntry, AutomodRule, Ban, ChannelDetail, ChannelEdit, GuildDetail, GuildEdit, ServerEmoji, Integration,
  Invite, MemberSummary, NewChannelKind, Role, RoleEdit,
} from "./server-contract";

export type Outcome<T> = { ok: true; data: T } | { ok: false; message: string };
type Raw<T> = { status: "ok"; data: T } | { status: "error"; error: EngineError };

export interface PageProps {
  acc: string;
  guildId: string;
  perms: string;
  flash: (message: string) => void;
}

const NO_PERMISSION = new Set([50013, 50001]);

export function errorMessage(error: EngineError): string {
  switch (error.kind) {
    case "discord":
      return NO_PERMISSION.has(error.code) ? "Tu n'as pas la permission" : error.message;
    case "rate_limited":
      return "Discord limite les requêtes, réessaie dans un instant";
    case "network":
      return "Connexion à Discord impossible";
    default:
      return "Action impossible pour le moment";
  }
}

export async function attempt<T>(call: Promise<Raw<T>>): Promise<Outcome<T>> {
  const r = await call;
  return r.status === "ok" ? { ok: true, data: r.data } : { ok: false, message: errorMessage(r.error) };
}

export const PERM = {
  CREATE_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  VIEW_AUDIT_LOG: 1n << 7n,
  MENTION_EVERYONE: 1n << 17n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS: 1n << 30n,
  MODERATE_MEMBERS: 1n << 40n,
} as const;

/** Permissions qu'on peut accorder à un rôle depuis l'interface (les mêmes bits que Discord). */
export const ROLE_PERMS: { bit: bigint; label: string; help: string }[] = [
  { bit: PERM.ADMINISTRATOR, label: "Administrateur", help: "Accès à tout, contourne les autres permissions." },
  { bit: PERM.MANAGE_GUILD, label: "Gérer le serveur",
    help: "Modifier le nom, la description et les réglages." },
  {
    bit: PERM.MANAGE_ROLES, label: "Gérer les rôles",
    help: "Créer, modifier et ordonner les rôles inférieurs au sien.",
  },
  { bit: PERM.MANAGE_CHANNELS, label: "Gérer les salons", help: "Créer, modifier et supprimer les salons." },
  { bit: PERM.MANAGE_EMOJIS, label: "Gérer les emoji", help: "Supprimer les emoji et autocollants du serveur." },
  { bit: PERM.MANAGE_WEBHOOKS, label: "Gérer les webhooks", help: "Créer et modifier les webhooks des salons." },
  { bit: PERM.CREATE_INVITE, label: "Créer des invitations", help: "Générer un lien pour inviter des gens." },
  { bit: PERM.KICK_MEMBERS, label: "Expulser des membres", help: "Retirer quelqu'un du serveur, il peut revenir." },
  { bit: PERM.BAN_MEMBERS, label: "Bannir des membres", help: "Retirer quelqu'un et l'empêcher de revenir." },
  { bit: PERM.MODERATE_MEMBERS, label: "Exclure temporairement", help: "Empêcher d'écrire ou de parler un temps." },
  { bit: PERM.MANAGE_NICKNAMES, label: "Gérer les pseudos", help: "Changer le pseudo des autres membres." },
  {
    bit: PERM.VIEW_AUDIT_LOG, label: "Voir le journal d'audit",
    help: "Consulter les actions de modération et de configuration.",
  },
  { bit: PERM.MENTION_EVERYONE, label: "Mentionner @everyone", help: "Prévenir tous les membres d'un salon." },
];

export function can(perms: string, bit: bigint): boolean {
  const mine = BigInt(perms || "0");
  return (mine & PERM.ADMINISTRATOR) !== 0n || (mine & bit) !== 0n;
}

export function hasBit(perms: string, bit: bigint): boolean {
  return (BigInt(perms || "0") & bit) !== 0n;
}

export function withBit(perms: string, bit: bigint, on: boolean): string {
  const value = BigInt(perms || "0");
  return (on ? value | bit : value & ~bit).toString();
}

/** Couleur de rôle Discord (entier) en CSS ; 0 = pas de couleur. */
export function colorCss(color: number): string {
  return color ? `#${color.toString(16).padStart(6, "0")}` : "transparent";
}

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<Raw<T>> {
  try {
    return { status: "ok", data: await invoke<T>(cmd, args) };
  } catch (e) {
    // Tauri rejette avec la valeur sérialisée de EngineError (contrat) : on la reprend telle quelle.
    return { status: "error", error: e as EngineError };
  }
}

/** Commandes d'administration (noms snake_case côté moteur, arguments camelCase). */
export const srv = {
  guildInfo: (accountId: string, guildId: string) => call<GuildDetail>("guild_info", { accountId, guildId }),
  guildUpdate: (accountId: string, guildId: string, edit: GuildEdit) => call<null>("guild_update", { accountId, guildId, edit }),
  guildAck: (accountId: string, guildId: string) => call<null>("guild_ack", { accountId, guildId }),
  guildLeave: (accountId: string, guildId: string) => call<null>("guild_leave", { accountId, guildId }),
  channelsList: (accountId: string, guildId: string) => call<ChannelSummary[]>("channels_list", { accountId, guildId }),
  rolesList: (accountId: string, guildId: string) => call<Role[]>("roles_list", { accountId, guildId }),
  roleCreate: (accountId: string, guildId: string, name: string) => call<Role>("role_create", { accountId, guildId, name }),
  roleUpdate: (accountId: string, guildId: string, roleId: string, edit: RoleEdit) =>
    call<null>("role_update", { accountId, guildId, roleId, edit }),
  roleDelete: (accountId: string, guildId: string, roleId: string) => call<null>("role_delete", { accountId, guildId, roleId }),
  roleReorder: (accountId: string, guildId: string, order: string[]) => call<null>("role_reorder", { accountId, guildId, order }),
  guildMembersSearch: (accountId: string, guildId: string, query: string, limit: number) =>
    call<MemberSummary[]>("guild_members_search", { accountId, guildId, query, limit }),
  memberKick: (accountId: string, guildId: string, userId: string) => call<null>("member_kick", { accountId, guildId, userId }),
  memberBan: (accountId: string, guildId: string, userId: string, deleteDays: number) =>
    call<null>("member_ban", { accountId, guildId, userId, deleteDays }),
  bansList: (accountId: string, guildId: string) => call<Ban[]>("bans_list", { accountId, guildId }),
  banRemove: (accountId: string, guildId: string, userId: string) => call<null>("ban_remove", { accountId, guildId, userId }),
  invitesList: (accountId: string, guildId: string) => call<Invite[]>("invites_list", { accountId, guildId }),
  inviteCreate: (accountId: string, channelId: string, maxAge: number, maxUses: number) =>
    call<Invite>("invite_create", { accountId, channelId, maxAge, maxUses }),
  inviteDelete: (accountId: string, code: string) => call<null>("invite_delete", { accountId, code }),
  guildEmojisManage: (accountId: string, guildId: string, remove: string | null) =>
    call<ServerEmoji[]>("guild_emojis_manage", { accountId, guildId, remove }),
  auditLog: (accountId: string, guildId: string) => call<AuditEntry[]>("audit_log", { accountId, guildId }),
  automodRules: (accountId: string, guildId: string) => call<AutomodRule[]>("automod_rules", { accountId, guildId }),
  integrationsList: (accountId: string, guildId: string) => call<Integration[]>("integrations_list", { accountId, guildId }),
  channelInfo: (accountId: string, channelId: string) => call<ChannelDetail>("channel_info", { accountId, channelId }),
  channelUpdate: (accountId: string, channelId: string, edit: ChannelEdit) =>
    call<null>("channel_update", { accountId, channelId, edit }),
  channelCreate: (accountId: string, guildId: string, name: string, kind: NewChannelKind) =>
    call<null>("channel_create", { accountId, guildId, name, kind }),
};
