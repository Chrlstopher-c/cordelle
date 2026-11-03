// Fichiers joints : limites, encodage base64 pour le moteur, messages d'erreur d'envoi.
import type { EngineError } from "../../contract/bindings";
import type { OutgoingFile } from "./api";
import type { PendingFile } from "./use-pending-files";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;

const CHUNK = 0x8000;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export async function encodeBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function toOutgoingFiles(files: PendingFile[]): Promise<OutgoingFile[]> {
  return Promise.all(files.map(async (f) => ({ filename: f.file.name, bytes_b64: await encodeBase64(f.file) })));
}

export function describeSendError(error: EngineError): string {
  switch (error.kind) {
    case "internal":
    case "discord":
      return error.message;
    case "network":
      return "Connexion perdue : l'envoi n'a pas abouti, réessaie.";
    case "rate_limited":
      return "Discord limite les envois pour l'instant, réessaie dans un instant.";
    default:
      return "Envoi impossible. Les fichiers restent joints, réessaie.";
  }
}
