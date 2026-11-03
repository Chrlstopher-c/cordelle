// Réglages locaux de l'app (persistés), appliqués en direct sur les variables CSS de la racine.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light" | "system";
export type Density = "comfy" | "compact";

export interface AppSettings {
  theme: Theme;
  accent: string;
  fontSize: number;
  groupGap: number;
  density: Density;
  zoom: number;
  reduceMotion: boolean;
}

export const DEFAULTS: AppSettings = {
  theme: "dark", accent: "#5A66E8", fontSize: 15, groupGap: 16, density: "comfy", zoom: 100, reduceMotion: false,
};

interface Store extends AppSettings {
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  reset: (keys: (keyof AppSettings)[]) => void;
}

export const useSettings = create<Store>()(persist((set) => ({
  ...DEFAULTS,
  set: (key, value) => set({ [key]: value } as Pick<AppSettings, typeof key>), // clé typée, valeur du même champ
  reset: (keys) => set(Object.fromEntries(keys.map((k) => [k, DEFAULTS[k]]))),
}), { name: "cordelle-settings" }));

export const ACCENTS: { hex: string; label: string; text: string; soft: string; lightText: string }[] = [
  { hex: "#5A66E8", label: "Bleu violet", text: "#C9CEF8", soft: "#3A3F6E", lightText: "#3A45C2" },
  { hex: "#3FB97A", label: "Vert", text: "#A9EBC6", soft: "#1F4A33", lightText: "#1C7A4A" },
  { hex: "#E0A23B", label: "Ambre", text: "#F3D49A", soft: "#4E3C1C", lightText: "#8A5A0F" },
  { hex: "#D9468B", label: "Rose", text: "#F4B6D2", soft: "#4E2238", lightText: "#A2245F" },
  { hex: "#2F9FD6", label: "Bleu", text: "#A9DCF5", soft: "#1C3E52", lightText: "#1A6A94" },
];
