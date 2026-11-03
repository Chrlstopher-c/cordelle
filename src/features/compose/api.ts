// Adaptateur de la zone compose : appelle `message_send_files` et `guild_emojis` directement avec `invoke`,
// en attendant la régénération de bindings.ts à la fusion. Types recopiés de crates/contract/src/compose.rs.
import { invoke } from "@tauri-apps/api/core";
import type { EngineError, Message } from "../../contract/bindings";

export interface OutgoingFile {
  filename: string;
  bytes_b64: string;
}

export interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
}

export type ComposeResult<T> = { status: "ok"; data: T } | { status: "error"; error: EngineError };

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<ComposeResult<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { status: "ok", data };
  } catch (err) {
    // Tauri rejette avec l'EngineError sérialisé par le moteur.
    return { status: "error", error: err as EngineError };
  }
}

export function messageSendFiles(
  accountId: string,
  channelId: string,
  content: string,
  replyTo: string | null,
  files: OutgoingFile[],
): Promise<ComposeResult<Message>> {
  return call<Message>("message_send_files", { accountId, channelId, content, replyTo, files });
}

export function guildEmojis(accountId: string, guildId: string): Promise<ComposeResult<GuildEmoji[]>> {
  return call<GuildEmoji[]>("guild_emojis", { accountId, guildId });
}
