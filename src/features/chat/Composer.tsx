// Zone de saisie 48 px : Entrée envoie, Maj+Entrée va à la ligne, Échap annule la réponse, flèche haut modifie
// le dernier message ; « @ » ouvre l'autocomplétion des mentions ; « X écrit… » dessous.
import { useRef, useState } from "react";
import type { Message, User } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { Avatar } from "../../shared/ui/Avatar";
import { useMentionComplete } from "./use-mention-complete";

interface Props {
  accountId: string;
  channelId: string;
  placeholder: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  typingNames: string[];
  onEditLast: () => void;
  messages: Message[];
  recipients: User[];
  isGuild: boolean;
}

export function Composer(props: Props): React.JSX.Element {
  const { accountId, channelId, placeholder, replyTo, onCancelReply, typingNames, onEditLast } = props;
  const send = useEngine((s) => s.send);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const area = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionComplete(props.messages, props.recipients, props.isGuild);
  const draft = drafts[channelId] ?? "";
  const setDraft = (v: string): void => setDrafts((d) => ({ ...d, [channelId]: v }));

  const apply = (text: string, caret: number): void => {
    setDraft(text);
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(caret, caret); });
  };

  const submit = (): void => {
    const text = mention.encode(draft.trim());
    if (!text) return;
    void send(accountId, channelId, text, replyTo?.id ?? null);
    setDraft("");
    mention.reset();
    onCancelReply();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mention.onKey(e, draft, apply)) return;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    else if (e.key === "Escape") onCancelReply();
    else if (e.key === "ArrowUp" && draft === "") { e.preventDefault(); onEditLast(); }
  };

  return (
    <div className="composer" style={{ position: "relative" }}>
      {mention.open && (
        <div className="mention-pop" role="listbox">
          <div className="mention-head">Membres</div>
          {mention.items.map((c, i) => (
            <button key={c.id} role="option" aria-selected={i === mention.index} className={`mention-item${i === mention.index ? " on" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); mention.pick(c, draft, apply); }}>
              {c.user ? <Avatar id={c.user.id} name={c.label} url={c.user.avatar_url} size={24} /> : <span style={{ width: 24, textAlign: "center" }}>@</span>}
              <span style={{ fontWeight: 500 }}>{c.user ? c.label : `@${c.label}`}</span>
              {c.user && <span className="u">{c.user.username}</span>}
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="composer-reply">
          <span style={{ flex: 1 }}>Réponse à <b>{replyTo.author.global_name ?? replyTo.author.username}</b></span>
          <button className="ib" aria-label="Annuler la réponse" onClick={onCancelReply}>✕</button>
        </div>
      )}
      <div className="composer-box" style={replyTo ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : undefined}>
        <textarea ref={area} rows={1} value={draft} placeholder={placeholder} autoFocus
          onChange={(e) => { setDraft(e.target.value); mention.update(e.target.value, e.target.selectionStart); }}
          onKeyDown={onKey} onClick={(e) => mention.update(draft, e.currentTarget.selectionStart)}
          style={{ height: Math.min(6, draft.split("\n").length) * 22 + 14 }} />
      </div>
      <div className="typing">
        {typingNames.length > 0 && (
          <><span className="typing-dots"><i /><i /><i /></span>
            <b>{typingNames.join(", ")}</b> {typingNames.length > 1 ? "écrivent…" : "est en train d'écrire…"}</>
        )}
      </div>
    </div>
  );
}
