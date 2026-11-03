// Envoi depuis la saisie : texte seul par le moteur (avec affichage optimiste), ou texte et fichiers par message_send_files.
// En cas d'échec, les fichiers restent joints pour une nouvelle tentative.
import { useState } from "react";
import type { Message } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { messageSendFiles } from "./api";
import { describeSendError, toOutgoingFiles } from "./attachments";
import type { PendingFile, PendingFileList } from "./use-pending-files";

interface Options {
  accountId: string;
  channelId: string;
  replyTo: Message | null;
  draft: string;
  encode: (text: string) => string;
  files: PendingFileList;
  onSent: () => void;
}

export interface ComposerSubmit {
  busy: boolean;
  error: string | null;
  submit: (extra?: PendingFile[]) => Promise<void>;
}

export function useComposerSubmit(opts: Options): ComposerSubmit {
  const send = useEngine((s) => s.send);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (extra: PendingFile[] = []): Promise<void> => {
    const text = opts.encode(opts.draft.trim());
    const list = [...opts.files.list, ...extra];
    const replyId = opts.replyTo?.id ?? null;
    if (list.length === 0) {
      if (!text) return;
      void send(opts.accountId, opts.channelId, text, replyId);
      opts.onSent();
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const outgoing = await toOutgoingFiles(list);
      const result = await messageSendFiles(opts.accountId, opts.channelId, text, replyId, outgoing);
      if (result.status === "error") {
        setError(describeSendError(result.error));
        return;
      }
      opts.files.clear();
      opts.onSent();
    } catch (err) {
      console.error("envoi de fichiers impossible", err);
      setError("Envoi impossible : un fichier n'a pas pu être lu.");
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, submit };
}
