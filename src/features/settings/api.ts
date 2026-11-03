// Adaptateur des commandes « réglages » : mêmes noms et formes que le contrat Rust (snake_case, arguments camelCase).
// À remplacer par `commands.*` de bindings.ts à la prochaine régénération (pnpm bindings).
import { invoke } from "@tauri-apps/api/core";
import type { EngineError } from "../../contract/bindings";
import type { Outcome } from "./remote";

export interface DeviceSession {
  id_hash: string;
  client: string;
  os: string;
  location: string | null;
  last_active: string | null;
}

export interface LinkedService {
  kind: string;
  id: string;
  name: string;
  verified: boolean;
  visible: boolean;
}

export interface Subscription {
  id: string;
  status: string;
  period_end: string | null;
  canceled: boolean;
}

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<Outcome<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { status: "ok", data };
  } catch (e) {
    // Tauri rejette avec la valeur sérialisée EngineError définie par le contrat.
    return { status: "error", error: e as EngineError };
  }
}

export const settingsApi = {
  sessionsList: (accountId: string) => call<DeviceSession[]>("sessions_list", { accountId }),
  sessionsLogout: (accountId: string, sessionIdHashes: string[]) =>
    call<null>("sessions_logout", { accountId, sessionIdHashes }),
  connectionsList: (accountId: string) => call<LinkedService[]>("connections_list", { accountId }),
  connectionRemove: (accountId: string, kind: string, id: string) =>
    call<null>("connection_remove", { accountId, kind, id }),
  subscriptionsList: (accountId: string) => call<Subscription[]>("subscriptions_list", { accountId }),
};
