// Zone de saisie 48 px : Entrée envoie, Maj+Entrée va à la ligne, Échap annule la réponse ; « X écrit… » dessous.
import { useState } from "react";
import type { Message } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";

interface Props {
  accountId: string;
  channelId: string;
  placeholder: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  typingNames: string[];
}

export function Composer({ accountId, channelId, placeholder, replyTo, onCancelReply, typingNames }: Props): React.JSX.Element {
  const send = useEngine((s) => s.send);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = drafts[channelId] ?? "";
  const setDraft = (v: string): void => setDrafts((d) => ({ ...d, [channelId]: v }));

  const submit = (): void => {
    const text = draft.trim();
    if (!text) return;
    void send(accountId, channelId, text, replyTo?.id ?? null);
    setDraft("");
    onCancelReply();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    else if (e.key === "Escape") onCancelReply();
  };

  return (
    <div className="composer">
      {replyTo && (
        <div className="composer-reply">
          <span style={{ flex: 1 }}>Réponse à <b>{replyTo.author.global_name ?? replyTo.author.username}</b></span>
          <button className="ib" aria-label="Annuler la réponse" onClick={onCancelReply}>✕</button>
        </div>
      )}
      <div className="composer-box" style={replyTo ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : undefined}>
        <textarea rows={1} value={draft} placeholder={placeholder} autoFocus
          onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
          style={{ height: Math.min(6, draft.split("\n").length) * 22 + 14 }} />
      </div>
      <div className="typing">
        {typingNames.length > 0 && `${typingNames.join(", ")} ${typingNames.length > 1 ? "écrivent" : "est en train d'écrire"}…`}
      </div>
    </div>
  );
}
