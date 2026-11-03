// Serveur d'un salon (déduit du cache, pour ne rien changer aux props de la saisie) et ses emojis personnalisés.
import { useEffect, useState } from "react";
import { useEngine } from "../../shared/data/engine-store";
import { guildEmojis, type GuildEmoji } from "./api";

const NONE: GuildEmoji[] = [];
const emojiCache = new Map<string, GuildEmoji[]>();

export function useGuildIdOf(channelId: string): string | null {
  return useEngine((s) => {
    for (const [guildId, channels] of Object.entries(s.channelsByGuild)) {
      if (channels.some((c) => c.id === channelId)) return guildId;
    }
    return null;
  });
}

async function loadGuildEmojis(accountId: string, guildId: string): Promise<GuildEmoji[]> {
  const cached = emojiCache.get(guildId);
  if (cached) return cached;
  const result = await guildEmojis(accountId, guildId);
  if (result.status === "error") {
    console.warn("emojis du serveur indisponibles", result.error);
    return NONE;
  }
  emojiCache.set(guildId, result.data);
  return result.data;
}

export function useGuildEmojis(accountId: string, guildId: string | null): GuildEmoji[] {
  const [loaded, setLoaded] = useState<{ guildId: string; list: GuildEmoji[] } | null>(null);

  useEffect(() => {
    if (!guildId) return;
    let alive = true;
    void loadGuildEmojis(accountId, guildId).then((list) => {
      if (alive) setLoaded({ guildId, list });
    });
    return () => {
      alive = false;
    };
  }, [accountId, guildId]);

  return guildId && loaded?.guildId === guildId ? loaded.list : NONE;
}
