// Retrouve les noms, avatars et salons vocaux à partir de ce que le moteur a déjà chargé (aucun appel réseau).
import type { ChannelSummary, User } from "../../contract/bindings";
import { useEngine, type EngineState } from "../../shared/data/engine-store";

/** Utilisateur connu : membres du serveur, puis auteurs des messages chargés. */
export function findKnownUser(s: EngineState, guildId: string | null, userId: string): User | null {
  const groups = guildId ? (s.memberLists[guildId] ?? []) : [];
  for (const group of groups) {
    const hit = group.members.find((m) => m.user.id === userId);
    if (hit) return hit.user;
  }
  for (const list of Object.values(s.messages)) {
    const hit = list.find((m) => m.author.id === userId);
    if (hit) return hit.author;
  }
  return null;
}

export function useKnownUser(guildId: string | null, userId: string): User | null {
  return useEngine((s) => findKnownUser(s, guildId, userId));
}

export function displayName(user: User | null, fallbackId: string): string {
  return user ? (user.global_name ?? user.username) : fallbackId;
}

export function useVoiceChannel(guildId: string | null, channelId: string | null): ChannelSummary | null {
  return useEngine((s) => {
    if (channelId === null) return null;
    const list = guildId ? (s.channelsByGuild[guildId] ?? []) : s.dms;
    return list.find((c) => c.id === channelId) ?? null;
  });
}
