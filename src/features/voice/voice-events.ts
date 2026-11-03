// Décode les événements vocaux reçus sur `engine` (voice_states / voice_session / voice_level) et les range dans le store.
import type { VoiceConnection, VoiceMember, VoiceSession } from "./types";
import { useAudio } from "./audio-settings";
import { useVoiceStore, voiceKey } from "./voice-store";

type Raw = Record<string, unknown>;

const CONNECTIONS: readonly VoiceConnection[] = ["disconnected", "connecting", "connected", "failed"];

const isRaw = (v: unknown): v is Raw => typeof v === "object" && v !== null;
const isNullableStr = (v: unknown): v is string | null => v === null || typeof v === "string";

function parseMember(v: unknown): VoiceMember | null {
  if (!isRaw(v)) return null;
  const { user_id, channel_id, mute, deaf, streaming, video } = v;
  if (typeof user_id !== "string" || typeof channel_id !== "string") return null;
  if (typeof mute !== "boolean" || typeof deaf !== "boolean") return null;
  if (typeof streaming !== "boolean" || typeof video !== "boolean") return null;
  return { user_id, channel_id, mute, deaf, streaming, video };
}

function parseSession(v: unknown): VoiceSession | null {
  if (!isRaw(v)) return null;
  const connection = CONNECTIONS.find((c) => c === v.connection);
  const { account_id, guild_id, channel_id, self_mute, self_deaf, ping_ms, speaking, error } = v;
  if (connection === undefined || typeof account_id !== "string") return null;
  if (!isNullableStr(guild_id) || !isNullableStr(channel_id) || !isNullableStr(error)) return null;
  if (typeof self_mute !== "boolean" || typeof self_deaf !== "boolean") return null;
  if (!Array.isArray(speaking) || !speaking.every((s) => typeof s === "string")) return null;
  const ping = typeof ping_ms === "number" ? ping_ms : null;
  return {
    account_id, guild_id, channel_id, connection, self_mute, self_deaf,
    ping_ms: ping, speaking, error,
  };
}

/** Derniers états vocaux reçus par compte puis par serveur, gardés même si le compte n'est pas (encore) actif. */
const statesCache = new Map<string, Map<string, { guildId: string | null; states: VoiceMember[] }>>();

/** Rejoue les états connus du compte devenu actif (ceux reçus au démarrage arrivent avant qu'il soit connu). */
export function replayVoiceStates(accountId: string | null): void {
  const byGuild = accountId ? statesCache.get(accountId) : undefined;
  useVoiceStore.setState({ statesByGuild: {} });
  for (const { guildId, states } of byGuild?.values() ?? []) useVoiceStore.getState().setStates(guildId, states);
}

/** Applique un événement vocal brut ; ignore ce qui ne concerne pas le compte actif. */
export function applyVoiceEvent(raw: unknown, activeAccount: string | null): void {
  if (!isRaw(raw)) return;
  if (raw.type === "voice_level") {
    const { level_db, threshold_db, gate_open } = raw;
    if (typeof gate_open !== "boolean") return;
    const db = (v: unknown): number => (typeof v === "number" ? v : -100);
    useAudio.getState().setLevel({ level_db: db(level_db), threshold_db: db(threshold_db), gate_open });
    return;
  }
  if (raw.type === "voice_states") {
    const { account_id, guild_id } = raw;
    if (typeof account_id !== "string" || !isNullableStr(guild_id) || !Array.isArray(raw.states)) return;
    const states = raw.states.map(parseMember).filter((m): m is VoiceMember => m !== null);
    const byGuild = statesCache.get(account_id) ?? new Map();
    byGuild.set(voiceKey(guild_id), { guildId: guild_id, states });
    statesCache.set(account_id, byGuild);
    if (account_id === activeAccount) useVoiceStore.getState().setStates(guild_id, states);
    return;
  }
  if (raw.type === "voice_session") {
    const session = parseSession(raw.session);
    if (session && session.account_id === activeAccount) useVoiceStore.getState().setSession(session);
  }
}
