// Faux moteur vocal (démo VITE_MOCK=1) : données FICTIVES. Rejoindre émet une session connectée et trois participants.
import type { Handler } from "./mock-tauri";
import { applyVoiceEvent } from "../features/voice/voice-events";
import type { AudioDevices, VoiceMember, VoiceSession } from "../features/voice/types";

const str = (a: Record<string, unknown>, k: string): string => String(a[k] ?? "");
const nullableStr = (a: Record<string, unknown>, k: string): string | null =>
  a[k] === null || a[k] === undefined ? null : String(a[k]);

let levelTimer: ReturnType<typeof setInterval> | null = null;

const DEVICES: AudioDevices = {
  inputs: [
    { id: "in-1", name: "Micro USB fictif Analog Stereo", is_default: true },
    { id: "in-2", name: "Contrôleur audio fictif Analog Stereo", is_default: false },
    { id: "in-3", name: "Micro sans écho fictif", is_default: false },
  ],
  outputs: [
    { id: "out-1", name: "Casque fictif Analog Stereo", is_default: true },
    { id: "out-2", name: "Carte son fictive Analog Stereo", is_default: false },
    { id: "out-3", name: "Écran fictif HDMI", is_default: false },
  ],
};

let current: VoiceSession | null = null;

const emitSession = (session: VoiceSession): void => {
  current = session;
  applyVoiceEvent({ type: "voice_session", session }, session.account_id);
};

const fictiveStates = (channelId: string): VoiceMember[] => [
  { user_id: "101", channel_id: channelId, mute: false, deaf: false, streaming: false, video: false },
  { user_id: "102", channel_id: channelId, mute: true, deaf: false, streaming: false, video: false },
  { user_id: "103", channel_id: channelId, mute: false, deaf: false, streaming: false, video: false },
];

function patchSession(patch: Partial<VoiceSession>): void {
  if (current) emitSession({ ...current, ...patch });
}

export const handlers: Record<string, Handler> = {
  voice_join: (a) => {
    const accountId = str(a, "accountId");
    const guildId = nullableStr(a, "guildId");
    const channelId = str(a, "channelId");
    emitSession({
      account_id: accountId, guild_id: guildId, channel_id: channelId, connection: "connecting",
      self_mute: false, self_deaf: false, ping_ms: null, speaking: [], error: null,
    });
    setTimeout(() => {
      const states = fictiveStates(channelId);
      applyVoiceEvent({ type: "voice_states", account_id: accountId, guild_id: guildId, states }, accountId);
      emitSession({
        account_id: accountId, guild_id: guildId, channel_id: channelId, connection: "connected",
        self_mute: current?.self_mute ?? false, self_deaf: current?.self_deaf ?? false,
        ping_ms: 24, speaking: ["101"], error: null,
      });
    }, 400);
    return null;
  },
  voice_leave: () => {
    patchSession({ connection: "disconnected", channel_id: null, guild_id: null, speaking: [], ping_ms: null });
    return null;
  },
  voice_set_mute: (a) => {
    patchSession({ self_mute: a.mute === true });
    return null;
  },
  voice_set_deaf: (a) => {
    patchSession({ self_deaf: a.deaf === true });
    return null;
  },
  voice_devices: () => DEVICES,
  voice_set_devices: () => null,
  voice_set_audio_settings: () => null,
  voice_mic_test: (a) => {
    if (levelTimer) clearInterval(levelTimer);
    levelTimer = null;
    if (a.on !== true) return null;
    let t = 0;
    levelTimer = setInterval(() => {
      t += 1;
      const level_db = -62 + 30 * Math.abs(Math.sin(t / 6)) + (Math.random() * 6 - 3);
      applyVoiceEvent({ type: "voice_level", level_db, threshold_db: -48, gate_open: level_db > -48 }, null);
    }, 60);
    return null;
  },
};
