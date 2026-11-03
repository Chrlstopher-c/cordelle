// Réglages locaux à ce poste (persistés) : voix, notifications, messages, mode développeur, CSS personnalisé.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULTS as APP_DEFAULTS, useSettings } from "./settings-store";

export interface VoicePrefs {
  inputId: string;
  outputId: string;
  inputVolume: number;
  outputVolume: number;
  noiseSuppression: boolean;
}

export interface NotificationPrefs {
  desktop: boolean;
  sound: boolean;
  mentionsOnly: boolean;
}

export interface MessagePrefs {
  embeds: boolean;
  imagePreviews: boolean;
  reactions: boolean;
  previewEmoji: boolean;
}

export interface CustomCssPrefs {
  enabled: boolean;
  css: string;
}

export interface LocalPrefs {
  voice: VoicePrefs;
  notifications: NotificationPrefs;
  messages: MessagePrefs;
  devMode: boolean;
  customCss: CustomCssPrefs;
}

export const DEFAULT_PREFS: LocalPrefs = {
  voice: { inputId: "", outputId: "", inputVolume: 100, outputVolume: 100, noiseSuppression: true },
  notifications: { desktop: false, sound: false, mentionsOnly: false },
  messages: { embeds: true, imagePreviews: true, reactions: true, previewEmoji: true },
  devMode: false,
  customCss: { enabled: false, css: "" },
};

const PREFS_KEY = "cordelle-prefs";
const APP_SETTINGS_KEY = "cordelle-settings";

interface PrefsStore extends LocalPrefs {
  setVoice: (patch: Partial<VoicePrefs>) => void;
  setNotifications: (patch: Partial<NotificationPrefs>) => void;
  setMessages: (patch: Partial<MessagePrefs>) => void;
  setDevMode: (on: boolean) => void;
  setCustomCss: (patch: Partial<CustomCssPrefs>) => void;
}

export const usePrefs = create<PrefsStore>()(persist((set) => ({
  ...DEFAULT_PREFS,
  setVoice: (patch) => set((s) => ({ voice: { ...s.voice, ...patch } })),
  setNotifications: (patch) => set((s) => ({ notifications: { ...s.notifications, ...patch } })),
  setMessages: (patch) => set((s) => ({ messages: { ...s.messages, ...patch } })),
  setDevMode: (devMode) => set({ devMode }),
  setCustomCss: (patch) => set((s) => ({ customCss: { ...s.customCss, ...patch } })),
}), { name: PREFS_KEY }));

export function useMessagePrefs(): MessagePrefs {
  return usePrefs((s) => s.messages);
}

export function useDevMode(): boolean {
  return usePrefs((s) => s.devMode);
}

/** Remet les réglages par défaut puis vide le stockage local des réglages (les comptes ne sont pas touchés). */
export function clearLocalSettings(): void {
  usePrefs.setState({ ...DEFAULT_PREFS });
  useSettings.setState({ ...APP_DEFAULTS });
  try {
    window.localStorage.removeItem(PREFS_KEY);
    window.localStorage.removeItem(APP_SETTINGS_KEY);
  } catch (e) {
    console.error("effacement du stockage local impossible", e);
  }
}
