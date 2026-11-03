// États vocaux : qui est dans quel salon vocal (par serveur, « dm » pour les appels MP) et sa propre session.
import { create } from "zustand";
import type { VoiceMember, VoiceSession } from "./types";

const DM_KEY = "dm";

export const voiceKey = (guildId: string | null): string => guildId ?? DM_KEY;

/** Membres présents dans un salon vocal donné. */
export function membersIn(states: VoiceMember[] | undefined, channelId: string): VoiceMember[] {
  return (states ?? []).filter((m) => m.channel_id === channelId);
}

export interface VoiceStoreState {
  statesByGuild: Record<string, VoiceMember[]>;
  session: VoiceSession | null;
  /** Instant de connexion de l'appel courant (ms), pour la durée affichée. */
  startedAt: number | null;
  setStates: (guildId: string | null, states: VoiceMember[]) => void;
  setSession: (session: VoiceSession) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  statesByGuild: {},
  session: null,
  startedAt: null,
  setStates: (guildId, states) =>
    set((s) => ({ statesByGuild: { ...s.statesByGuild, [voiceKey(guildId)]: states } })),
  setSession: (session) => {
    const prev = get().session;
    const connected = session.connection === "connected";
    const sameCall = prev?.connection === "connected" && prev.channel_id === session.channel_id;
    set({ session, startedAt: connected ? (sameCall ? get().startedAt : Date.now()) : null });
  },
}));
