// Faux moteur de la zone compose (mode démo) : données FICTIVES, aucun envoi réel.
import * as F from "./fixtures";
import type { Handler } from "./mock-tauri";

const str = (a: Record<string, unknown>, k: string): string => String(a[k] ?? "");

function fileNames(value: unknown): string[] {
  const items: unknown[] = Array.isArray(value) ? value : [];
  return items.map((f) => (typeof f === "object" && f !== null && "filename" in f ? String(f.filename) : "fichier"));
}

export const handlers: Record<string, Handler> = {
  message_send_files: (args) => {
    const names = fileNames(args.files);
    return {
      ...F.MESSAGES["301"][0],
      id: String(Date.now()),
      author: F.ME,
      content: str(args, "content"),
      timestamp: new Date().toISOString(),
      attachments: names.map((filename, i) => ({
        id: String(i), filename, url: "", content_type: null, size: 0, width: null, height: null,
      })),
    };
  },
  guild_emojis: () => [
    { id: "900", name: "molky_gg", animated: false },
    { id: "901", name: "molky_port", animated: true },
  ],
};
