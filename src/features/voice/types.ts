// Types du contrat vocal (crates/contract/src/voice.rs), recopiés tant que src/contract/bindings.ts ne les génère pas.

export type VoiceConnection = "disconnected" | "connecting" | "connected" | "failed";

export interface VoiceMember {
  user_id: string;
  channel_id: string;
  mute: boolean;
  deaf: boolean;
  streaming: boolean;
  video: boolean;
}

export interface VoiceSession {
  account_id: string;
  guild_id: string | null;
  channel_id: string | null;
  connection: VoiceConnection;
  self_mute: boolean;
  self_deaf: boolean;
  ping_ms: number | null;
  speaking: string[];
  error: string | null;
}

export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
}

export interface AudioDevices {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
}

/** Définition du partage (crates/contract/src/stream.rs). */
export interface StreamQuality {
  width: number;
  height: number;
  fps: number;
}

/** Partage en cours de ma personne ; `quality` absente quand rien n'est partagé. */
export interface StreamState {
  account_id: string;
  streaming: boolean;
  quality: StreamQuality | null;
}

/** Réglages audio du moteur (contrat `AudioSettings`) ; volumes 0 à 2, seuil en dBFS. */
export interface AudioSettings {
  input_device: string | null;
  output_device: string | null;
  input_volume: number;
  output_volume: number;
  noise_suppression: boolean;
  vad_auto: boolean;
  vad_threshold_db: number;
}

/** Niveau du micro traité (événement `voice_level`). */
export interface MicLevel {
  level_db: number;
  threshold_db: number;
  gate_open: boolean;
}
