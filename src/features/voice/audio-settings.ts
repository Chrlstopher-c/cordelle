// Réglages audio du moteur vocal (persistés sur ce poste) et niveau du micro en direct ; source unique pour la page
// « Voix et vidéo » et les menus de périphériques de l'appel.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { voice } from "./api";
import type { AudioSettings, MicLevel } from "./types";

export const DEFAULT_AUDIO: AudioSettings = {
  input_device: null,
  output_device: null,
  input_volume: 1,
  output_volume: 1,
  noise_suppression: true,
  vad_auto: true,
  vad_threshold_db: -50,
};

interface AudioState {
  settings: AudioSettings;
  level: MicLevel | null;
  testing: boolean;
  /** Envoie les réglages persistés au moteur (au démarrage). */
  sync: () => Promise<void>;
  patch: (next: Partial<AudioSettings>) => Promise<void>;
  setLevel: (level: MicLevel) => void;
  setTesting: (on: boolean) => Promise<void>;
}

export const useAudio = create<AudioState>()(persist((set, get) => ({
  settings: DEFAULT_AUDIO,
  level: null,
  testing: false,
  sync: async () => {
    await voice.setAudioSettings(get().settings);
  },
  patch: async (next) => {
    const settings = { ...get().settings, ...next };
    set({ settings });
    await voice.setAudioSettings(settings);
  },
  setLevel: (level) => set({ level }),
  setTesting: async (on) => {
    if (get().testing === on) return;
    const r = await voice.micTest(on);
    set({ testing: on && r.ok, level: on ? get().level : null });
  },
}), {
  name: "cordelle-audio",
  partialize: (s) => ({ settings: s.settings }),
}));
