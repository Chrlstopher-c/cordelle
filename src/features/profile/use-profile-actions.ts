// Chargement d'un profil et actions : ouvrir le MP (ou le créer), envoyer un message direct.
import { useEffect } from "react";
import { commands, type UserProfile } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { profileKey, useProfiles } from "./profile-store";

export function useLoadedProfile(userId: string | null, guildId: string | null): { profile?: UserProfile; error?: string } {
  const account = useActiveAccount();
  const load = useProfiles((s) => s.load);
  const key = profileKey(userId ?? "", guildId);
  const profile = useProfiles((s) => s.cache[key]);
  const error = useProfiles((s) => s.errors[key]);
  useEffect(() => {
    if (account && userId) void load(account.id, userId, guildId);
  }, [account, load, userId, guildId]);
  return { profile, error };
}

/** Ouvre le MP avec l'utilisateur ; s'il n'existe pas encore, le crée. Envoie `text` s'il est fourni. */
export function useOpenDm(): (userId: string, text?: string) => Promise<void> {
  const account = useActiveAccount();
  const go = useNav((s) => s.go);
  const close = useProfiles((s) => s.close);
  const send = useEngine((s) => s.send);
  const loadDms = useEngine((s) => s.loadDms);
  return async (userId, text) => {
    if (!account) return;
    const known = useEngine.getState().dms.find((c) => c.kind === "dm" && c.recipients[0]?.id === userId);
    let channelId = known?.id ?? null;
    if (!channelId) {
      const r = await commands.dmOpen(account.id, userId);
      if (r.status !== "ok") return;
      channelId = r.data.id;
      void loadDms(account.id);
    }
    if (text?.trim()) await send(account.id, channelId, text.trim());
    close();
    go({ kind: "dms", channelId });
  };
}
