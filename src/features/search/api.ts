// Adaptateur des commandes de la zone recherche. Appel direct via invoke : les types du contrat sont recopiés ici
// (bindings.ts sera régénéré à la fusion). Erreurs : le moteur rejette avec un EngineError, ramené à un message.
import { invoke } from "@tauri-apps/api/core";
import type { Message } from "../../contract/bindings";

export type Outcome<T> = { ok: true; data: T } | { ok: false; message: string };

export interface SearchPage {
  total: number;
  messages: Message[];
}

export interface ThreadSummary {
  id: string;
  name: string;
  message_count: number;
  member_count: number;
  last_message_id: string | null;
  archived: boolean;
  owner_id: string | null;
}

export const SEARCH_PAGE_SIZE = 25;

export interface MessageSearchArgs {
  accountId: string;
  guildId: string | null;
  channelId: string;
  content: string;
  offset: number;
}

function errorText(error: unknown): string {
  const kind = typeof error === "object" && error !== null && "kind" in error ? String(error.kind) : "";
  return kind === "rate_limited" ? "Discord limite les requêtes, réessaie dans un instant." : "Discord n'a pas répondu.";
}

async function call<T>(command: string, args: Record<string, unknown>): Promise<Outcome<T>> {
  try {
    const data = await invoke<T>(command, args);
    return { ok: true, data };
  } catch (error) {
    console.error(`[recherche] ${command}`, error);
    return { ok: false, message: errorText(error) };
  }
}

export function searchMessages(args: MessageSearchArgs): Promise<Outcome<SearchPage>> {
  const query = { content: args.content, author_id: null, has: [], offset: args.offset };
  return call<SearchPage>("messages_search", {
    accountId: args.accountId, guildId: args.guildId, channelId: args.channelId, query,
  });
}

export function listPins(accountId: string, channelId: string): Promise<Outcome<Message[]>> {
  return call<Message[]>("pins_list", { accountId, channelId });
}

export function listThreads(accountId: string, channelId: string, archived: boolean): Promise<Outcome<ThreadSummary[]>> {
  return call<ThreadSummary[]>("threads_list", { accountId, channelId, archived });
}

export function createThread(
  accountId: string,
  channelId: string,
  name: string,
  content: string | null,
): Promise<Outcome<ThreadSummary>> {
  return call<ThreadSummary>("thread_create", { accountId, channelId, name, content });
}
