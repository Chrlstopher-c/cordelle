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
