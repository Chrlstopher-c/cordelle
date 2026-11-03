// Navigation : où est l'utilisateur. Une seule vue principale à la fois, plus les surcouches (réglages, palette).
import { create } from "zustand";

export type MainView =
  | { kind: "dms"; channelId: string | null }
  | { kind: "activity" }
  | { kind: "friends" }
  | { kind: "explore" }
  | { kind: "guild"; guildId: string; channelId: string | null }
  | { kind: "call"; guildId: string | null; channelId: string };

export type Overlay =
  | { kind: "none" }
  | { kind: "settings"; page: string }
  | { kind: "server-settings"; guildId: string; page: string }
  | { kind: "palette" }
  | { kind: "accounts" }
  | { kind: "events"; guildId: string }
  | { kind: "channel-settings"; guildId: string; channelId: string }
  | { kind: "add-server" };

interface NavState {
  view: MainView;
  overlay: Overlay;
  /** Dernier salon ouvert par serveur, pour y revenir directement. */
  lastChannel: Record<string, string>;
  membersOpen: Record<string, boolean>;
  go: (view: MainView) => void;
  openGuild: (guildId: string) => void;
  openChannel: (guildId: string, channelId: string) => void;
  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
  toggleMembers: (channelId: string) => void;
}

export const useNav = create<NavState>((set, get) => ({
  view: { kind: "dms", channelId: null },
  overlay: { kind: "none" },
  lastChannel: {},
  membersOpen: {},
  go: (view) => set({ view }),
  openGuild: (guildId) => set({ view: { kind: "guild", guildId, channelId: get().lastChannel[guildId] ?? null } }),
  openChannel: (guildId, channelId) =>
    set((s) => ({ view: { kind: "guild", guildId, channelId }, lastChannel: { ...s.lastChannel, [guildId]: channelId } })),
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: { kind: "none" } }),
  toggleMembers: (channelId) => set((s) => {
    const v = s.view;
    const current = s.membersOpen[channelId] ?? (v.kind === "dms");
    return { membersOpen: { ...s.membersOpen, [channelId]: !current } };
  }),
}));
