// Faux moteur du partage d'écran (mode démo) : données FICTIVES, aucun flux réel.
import type { Handler } from "./mock-tauri";
import type { StreamQuality, StreamState } from "../features/voice/types";

const str = (a: Record<string, unknown>, k: string): string => String(a[k] ?? "");
const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function qualityOf(value: unknown): StreamQuality {
  const q: Record<string, unknown> = typeof value === "object" && value !== null ? { ...value } : {};
  return { width: num(q.width), height: num(q.height), fps: num(q.fps) };
}

export const handlers: Record<string, Handler> = {
  stream_start: (a): StreamState => ({
    account_id: str(a, "accountId"), streaming: true, quality: qualityOf(a.quality),
  }),
  stream_stop: (a): StreamState => ({ account_id: str(a, "accountId"), streaming: false, quality: null }),
};
