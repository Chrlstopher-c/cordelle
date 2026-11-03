// Fichiers en attente d'envoi : validation (taille, nombre), aperçus d'images, libération des URL.
import { useEffect, useRef, useState } from "react";
import { MAX_FILE_BYTES, MAX_FILES, formatSize } from "./attachments";

export interface PendingFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

export interface PendingFileList {
  list: PendingFile[];
  notice: string | null;
  add: (incoming: File[]) => PendingFile[];
  remove: (id: string) => void;
  clear: () => void;
}

let sequence = 0;

function toPending(file: File): PendingFile {
  sequence += 1;
  const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
  return { id: `pending-${sequence}`, file, previewUrl };
}

function revoke(files: PendingFile[]): void {
  for (const f of files) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
}

function checkIncoming(incoming: File[], current: number): { accepted: File[]; notice: string | null } {
  const small = incoming.filter((f) => f.size <= MAX_FILE_BYTES);
  const heavy = incoming.find((f) => f.size > MAX_FILE_BYTES);
  const room = Math.max(0, MAX_FILES - current);
  const accepted = small.slice(0, room);
  if (heavy) {
    return { accepted, notice: `« ${heavy.name} » pèse ${formatSize(heavy.size)} : la limite est de 10 Mo par fichier.` };
  }
  if (small.length > room) return { accepted, notice: `Maximum ${MAX_FILES} fichiers par message.` };
  return { accepted, notice: null };
}

export function usePendingFiles(): PendingFileList {
  const [list, setList] = useState<PendingFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const latest = useRef<PendingFile[]>(list);
  latest.current = list;

  useEffect(() => () => revoke(latest.current), []);

  const add = (incoming: File[]): PendingFile[] => {
    const checked = checkIncoming(incoming, latest.current.length);
    const fresh = checked.accepted.map(toPending);
    setNotice(checked.notice);
    if (fresh.length > 0) setList((prev) => [...prev, ...fresh]);
    return fresh;
  };

  const remove = (id: string): void => {
    const gone = latest.current.filter((f) => f.id === id);
    revoke(gone);
    setList((prev) => prev.filter((f) => f.id !== id));
    setNotice(null);
  };

  const clear = (): void => {
    revoke(latest.current);
    setList([]);
    setNotice(null);
  };

  return { list, notice, add, remove, clear };
}
