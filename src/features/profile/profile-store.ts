// Profils : cache par utilisateur, aperçu ancré au clic, profil complet en modale.
import { create } from "zustand";
import { commands, type EngineError, type UserProfile } from "../../contract/bindings";

interface Anchor { x: number; y: number }

interface ProfileState {
  cache: Record<string, UserProfile>;
  errors: Record<string, string>;
  popout: { userId: string; guildId: string | null; anchor: Anchor } | null;
  modal: { userId: string; guildId: string | null; tab: "activity" | "friends" | "guilds" } | null;
  load: (accountId: string, userId: string, guildId: string | null) => Promise<void>;
  openPopout: (userId: string, guildId: string | null, anchor: Anchor) => void;
  openModal: (userId: string, guildId: string | null) => void;
  close: () => void;
}

const describe = (e: EngineError): string =>
  e.kind === "discord" ? e.message : e.kind === "not_found" ? "Profil introuvable" : "Profil indisponible";

export const useProfiles = create<ProfileState>((set, get) => ({
  cache: {},
  errors: {},
  popout: null,
  modal: null,
  load: async (accountId, userId, guildId) => {
    const key = `${userId}:${guildId ?? ""}`;
    if (get().cache[key]) return;
    const r = await commands.userProfile(accountId, userId, guildId);
    if (r.status === "ok") set((s) => ({ cache: { ...s.cache, [key]: r.data } }));
    else set((s) => ({ errors: { ...s.errors, [key]: describe(r.error) } }));
  },
  openPopout: (userId, guildId, anchor) => set({ popout: { userId, guildId, anchor }, modal: null }),
  openModal: (userId, guildId) => set({ modal: { userId, guildId, tab: "activity" }, popout: null }),
  close: () => set({ popout: null, modal: null }),
}));

export const profileKey = (userId: string, guildId: string | null): string => `${userId}:${guildId ?? ""}`;
