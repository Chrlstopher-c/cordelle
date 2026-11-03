// Adaptateur des commandes vocales du contrat fixé (noms snake_case côté Rust, arguments camelCase côté JS).
// Remplacer par `commands.*` dès que `pnpm bindings` les génère.
import { invoke } from "@tauri-apps/api/core";
import type { AudioDevices, StreamQuality, StreamState } from "./types";

export type VoiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Message lisible d'une erreur IPC (objet typé `kind` par le contrat, ou texte). */
export function errorText(err: unknown): string {
  if (typeof err === "string") return err;
  if (typeof err !== "object" || err === null) return "Action impossible.";
  const kind = "kind" in err ? err.kind : undefined;
  const message = "message" in err ? err.message : undefined;
  if (kind === "not_implemented") return "Partage d'écran pas encore disponible.";
  if (kind === "not_found" && "what" in err && typeof err.what === "string") return `Introuvable : ${err.what}`;
  return typeof message === "string" ? message : "Action impossible.";
}

async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<VoiceResult<T>> {
  try {
    return { ok: true, data: await invoke<T>(cmd, args) };
  } catch (err) {
    const error = errorText(err);
    console.error(`[voix] ${cmd} impossible`, error);
    return { ok: false, error };
  }
}

export const voice = {
  join: (accountId: string, guildId: string | null, channelId: string): Promise<VoiceResult<void>> =>
    call<void>("voice_join", { accountId, guildId, channelId }),
  leave: (accountId: string): Promise<VoiceResult<void>> => call<void>("voice_leave", { accountId }),
  setMute: (accountId: string, mute: boolean): Promise<VoiceResult<void>> =>
    call<void>("voice_set_mute", { accountId, mute }),
  setDeaf: (accountId: string, deaf: boolean): Promise<VoiceResult<void>> =>
    call<void>("voice_set_deaf", { accountId, deaf }),
  devices: (): Promise<VoiceResult<AudioDevices>> => call<AudioDevices>("voice_devices"),
  setDevices: (input: string | null, output: string | null): Promise<VoiceResult<void>> =>
    call<void>("voice_set_devices", { input, output }),
};

export const stream = {
  start: (accountId: string, quality: StreamQuality): Promise<VoiceResult<StreamState>> =>
    call<StreamState>("stream_start", { accountId, quality }),
  stop: (accountId: string): Promise<VoiceResult<StreamState>> => call<StreamState>("stream_stop", { accountId }),
};
