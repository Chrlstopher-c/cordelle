// Adaptateur des commandes de l'accueil : appels directs à `invoke`, en attendant la régénération de bindings.ts.
// Les types recopient crates/contract/src/home.rs ; à remplacer par ceux de bindings.ts à la fusion.
import { invoke } from "@tauri-apps/api/core";
import type { EngineError } from "../../contract/bindings";

export type CallResult<T> = { status: "ok"; data: T } | { status: "error"; error: EngineError };

export interface InvitePreview {
  code: string;
  guild_id: string;
  guild_name: string;
  icon_url: string | null;
  member_count: number;
  online_count: number;
  channel_name: string | null;
}

export interface ScheduledEvent {
  id: string;
  name: string;
  description: string | null;
  start: string;
  end: string | null;
  channel_id: string | null;
  location: string | null;
  interested: number;
  live: boolean;
}

export interface DiscoverableGuild {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  member_count: number;
  online_count: number;
}

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<CallResult<T>> {
  try {
    return { status: "ok", data: await invoke<T>(cmd, args) };
  } catch (e) {
    // Tauri rejette avec l'EngineError sérialisé par la commande.
    return { status: "error", error: e as EngineError };
  }
}

export const inviteResolve = (accountId: string, code: string): Promise<CallResult<InvitePreview>> =>
  call("invite_resolve", { accountId, code });

export const inviteAccept = (accountId: string, code: string): Promise<CallResult<string>> =>
  call("invite_accept", { accountId, code });

export const guildCreate = (accountId: string, name: string): Promise<CallResult<string>> =>
  call("guild_create", { accountId, name });

export const scheduledEvents = (accountId: string, guildId: string): Promise<CallResult<ScheduledEvent[]>> =>
  call("scheduled_events", { accountId, guildId });

export const discoverableGuilds = (
  accountId: string, query: string, offset: number,
): Promise<CallResult<DiscoverableGuild[]>> => call("discoverable_guilds", { accountId, query, offset });
