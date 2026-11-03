// Partage d'écran de ma personne : état renvoyé par le moteur, dernière qualité choisie, actions start / stop.
import { create } from "zustand";
import { stream } from "./api";
import type { StreamQuality, StreamState } from "./types";

export interface QualityChoice {
  id: string;
  label: string;
  quality: StreamQuality;
}

/** Qualités proposées dans le menu de partage (maquette Partage-source). */
export const QUALITY_CHOICES: readonly QualityChoice[] = [
  { id: "720p30", label: "720p · 30 images/s", quality: { width: 1280, height: 720, fps: 30 } },
  { id: "1080p60", label: "1080p · 60 images/s", quality: { width: 1920, height: 1080, fps: 60 } },
];

export const DEFAULT_QUALITY = QUALITY_CHOICES[1];

interface StreamStoreState {
  state: StreamState | null;
  chosen: QualityChoice;
  setState: (state: StreamState) => void;
  setChosen: (choice: QualityChoice) => void;
}

export const useStreamStore = create<StreamStoreState>((set) => ({
  state: null,
  chosen: DEFAULT_QUALITY,
  setState: (state) => set({ state }),
  setChosen: (chosen) => set({ chosen }),
}));

/** Démarre le partage ; renvoie le message d'erreur à afficher, ou `null`. */
export async function startShare(accountId: string, choice: QualityChoice): Promise<string | null> {
  useStreamStore.getState().setChosen(choice);
  const r = await stream.start(accountId, choice.quality);
  if (r.ok) {
    useStreamStore.getState().setState(r.data);
    return null;
  }
  return r.error;
}

/** Arrête le partage ; renvoie le message d'erreur à afficher, ou `null`. */
export async function stopShare(accountId: string): Promise<string | null> {
  const r = await stream.stop(accountId);
  if (r.ok) {
    useStreamStore.getState().setState(r.data);
    return null;
  }
  return r.error;
}

/** Redémarre le partage avec une autre qualité ; renvoie le message d'erreur, ou `null`. */
export async function restartShare(accountId: string, choice: QualityChoice): Promise<string | null> {
  const stopped = await stopShare(accountId);
  return stopped ?? startShare(accountId, choice);
}
