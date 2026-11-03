// Candidats de la saisie assistée : @ membres et rôles, # salons, : emojis. Chaque candidat porte le texte
// affiché dans la saisie (`display`) et le texte envoyé (`final`) ; l'écart est résolu à l'envoi.
import type { ChannelSummary, Message, User } from "../../contract/bindings";
import type { GuildEmoji } from "./api";
import { ALL_EMOJIS, type EmojiEntry } from "./emoji-data";

export type TokenKind = "mention" | "channel" | "emoji";

export interface Token {
  kind: TokenKind;
  q: string;
  /** Position du déclencheur (@, #, :) dans le texte. */
  start: number;
}

export interface Candidate {
  key: string;
  kind: TokenKind;
  label: string;
  sub: string;
  search: string;
  glyph: string;
  user: User | null;
  display: string;
  final: string;
}

export interface CompletionSources {
  messages: Message[];
  recipients: User[];
  isGuild: boolean;
  channels: ChannelSummary[];
  emojis: GuildEmoji[];
}

export type Pools = Record<TokenKind, Candidate[]>;

export const LIMIT = 8;

const TRIGGERS: Record<TokenKind, RegExp> = {
  mention: /(?:^|\s)@([^\s@]{0,32})$/,
  channel: /(?:^|\s)#([^\s#]{0,40})$/,
  emoji: /(?:^|\s):([a-z0-9_]{2,32})$/i,
};

const KINDS: TokenKind[] = ["mention", "channel", "emoji"];

export function findToken(text: string, caret: number): Token | null {
  const before = text.slice(0, caret);
  for (const kind of KINDS) {
    const match = TRIGGERS[kind].exec(before);
    if (match) return { kind, q: match[1], start: caret - match[1].length - 1 };
  }
  return null;
}

const nameOf = (u: User): string => u.global_name ?? u.username;

function userCandidate(u: User): Candidate {
  const name = nameOf(u);
  return {
    key: `user-${u.id}`, kind: "mention", label: name, sub: u.username, search: `${name} ${u.username}`.toLowerCase(),
    glyph: "@", user: u, display: `@${name}`, final: `<@${u.id}>`,
  };
}

function specialCandidate(name: string, sub: string): Candidate {
  return {
    key: `special-${name}`, kind: "mention", label: name, sub, search: name, glyph: "@", user: null,
    display: `@${name}`, final: `@${name}`,
  };
}

function mentionPool(src: CompletionSources): Candidate[] {
  const seen = new Map<string, User>();
  for (const u of src.recipients) seen.set(u.id, u);
  for (const m of src.messages) if (!seen.has(m.author.id)) seen.set(m.author.id, m.author);
  const users = [...seen.values()].map(userCandidate);
  if (!src.isGuild) return users;
  return [
    ...users,
    specialCandidate("everyone", "Notifie tout le monde dans ce salon"),
    specialCandidate("here", "Notifie les personnes en ligne"),
  ];
}

function channelPool(channels: ChannelSummary[]): Candidate[] {
  return channels
    .filter((c) => c.kind !== "category")
    .map((c) => ({
      key: `channel-${c.id}`, kind: "channel", label: c.name, sub: "", search: c.name.toLowerCase(),
      glyph: c.kind === "voice" || c.kind === "stage" ? "♪" : "#", user: null, display: `#${c.name}`, final: `<#${c.id}>`,
    }));
}

function customEmojiCandidate(e: GuildEmoji): Candidate {
  const animated = e.animated ? "a" : "";
  return {
    key: `emoji-${e.id}`, kind: "emoji", label: `:${e.name}:`, sub: "Serveur", search: e.name.toLowerCase(),
    glyph: e.name.slice(0, 2), user: null, display: `:${e.name}:`, final: `<${animated}:${e.name}:${e.id}>`,
  };
}

function unicodeEmojiCandidate(e: EmojiEntry): Candidate {
  const short = e.name.split(" ")[0];
  return {
    key: `unicode-${e.char}`, kind: "emoji", label: `:${short}:`, sub: e.name.replace(/-/g, " "), search: e.name.toLowerCase(),
    glyph: e.char, user: null, display: e.char, final: e.char,
  };
}

export function buildPools(src: CompletionSources): Pools {
  return {
    mention: mentionPool(src),
    channel: channelPool(src.channels),
    emoji: [...src.emojis.map(customEmojiCandidate), ...ALL_EMOJIS.map(unicodeEmojiCandidate)],
  };
}

export function rankCandidates(pools: Pools, token: Token): Candidate[] {
  const q = token.q.toLowerCase();
  return pools[token.kind].filter((c) => c.search.includes(q)).slice(0, LIMIT);
}

/** Remplace chaque choix affiché par son texte envoyé ; les plus longs d'abord pour éviter les recouvrements. */
export function applyChosen(text: string, chosen: Map<string, string>): string {
  let out = text;
  const displays = [...chosen.keys()].sort((a, b) => b.length - a.length);
  for (const display of displays) out = out.split(display).join(chosen.get(display) ?? display);
  return out;
}
