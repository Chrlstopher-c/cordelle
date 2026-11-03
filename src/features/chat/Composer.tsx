// Zone de saisie : joindre (+) à gauche, emoji à droite, aperçus de fichiers, collage et glisser-déposer,
// saisie assistée (@ # :). Entrée envoie, Maj+Entrée va à la ligne, Échap annule la réponse ou ferme le sélecteur,
// flèche haut modifie le dernier message ; « X écrit… » sous le champ.
import { useRef, useState } from "react";
import type { ChannelSummary, Message, User } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { CompletionPopup } from "../compose/CompletionPopup";
import { DropOverlay } from "../compose/DropOverlay";
import { EmojiPicker } from "../compose/EmojiPicker";
import { PendingAttachments } from "../compose/PendingAttachments";
import { useComposerSubmit } from "../compose/use-composer-submit";
import { useFileDrop } from "../compose/use-file-drop";
import { useGuildEmojis, useGuildIdOf } from "../compose/use-guild-scope";
import { usePendingFiles } from "../compose/use-pending-files";
import "../compose/compose.css";
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

const NO_CHANNELS: ChannelSummary[] = [];

const PLUS_ICON = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
  </svg>
);

const SMILE_ICON = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
  </svg>
);

export function Composer(props: Props): React.JSX.Element {
  const { accountId, channelId, placeholder, replyTo, onCancelReply, typingNames, onEditLast } = props;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const guildId = useGuildIdOf(channelId);
  const channels = useEngine((s) => (guildId ? s.channelsByGuild[guildId] : undefined)) ?? NO_CHANNELS;
  const guildEmojis = useGuildEmojis(accountId, guildId);
  const mention = useMentionComplete({
    messages: props.messages, recipients: props.recipients, isGuild: props.isGuild, channels, emojis: guildEmojis,
  });
  const files = usePendingFiles();
  const draft = drafts[channelId] ?? "";
  const setDraft = (v: string): void => setDrafts((d) => ({ ...d, [channelId]: v }));

  const apply = (text: string, caret: number): void => {
    setDraft(text);
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(caret, caret); });
  };

  const sender = useComposerSubmit({
    accountId, channelId, replyTo, draft, encode: mention.encode, files,
    onSent: () => { setDraft(""); mention.reset(); onCancelReply(); },
  });

  const dragging = useFileDrop((dropped, sendNow) => {
    const added = files.add(dropped);
    if (sendNow) void sender.submit(added);
  });

  const channelName = channels.find((c) => c.id === channelId)?.name;

  const insert = (text: string): void => {
    const caret = area.current?.selectionStart ?? draft.length;
    apply(draft.slice(0, caret) + text + draft.slice(caret), caret + text.length);
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>): void => {
    files.add(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length === 0) return;
    e.preventDefault();
    files.add(pasted);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mention.onKey(e, draft, apply)) return;
    if (picker && e.key === "Escape") { setPicker(false); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sender.submit(); }
    else if (e.key === "Escape") onCancelReply();
    else if (e.key === "ArrowUp" && draft === "") { e.preventDefault(); onEditLast(); }
  };

  return (
    <div className="composer" style={{ position: "relative" }}>
      {mention.open && (
        <CompletionPopup title={mention.title} items={mention.items} index={mention.index}
          onPick={(c) => mention.pick(c, draft, apply)} />
      )}
      {picker && <EmojiPicker guildEmojis={guildEmojis} onPick={insert} onClose={() => setPicker(false)} />}
      {replyTo && (
        <div className="composer-reply">
          <span style={{ flex: 1 }}>Réponse à <b>{replyTo.author.global_name ?? replyTo.author.username}</b></span>
          <button className="ib" aria-label="Annuler la réponse" onClick={onCancelReply}>✕</button>
        </div>
      )}
      <div className="compose-card" style={replyTo ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : undefined}>
        {files.list.length > 0 && <PendingAttachments files={files.list} onRemove={files.remove} />}
        <div className="composer-box">
          <button className="ib compose-btn" aria-label="Joindre un fichier" disabled={sender.busy}
            onClick={() => fileInput.current?.click()}>
            {PLUS_ICON}
          </button>
          <input ref={fileInput} type="file" multiple hidden onChange={onPickFiles} />
          <textarea ref={area} rows={1} value={draft} placeholder={placeholder} autoFocus
            onChange={(e) => { setDraft(e.target.value); mention.update(e.target.value, e.target.selectionStart); }}
            onKeyDown={onKey} onPaste={onPaste} onClick={(e) => mention.update(draft, e.currentTarget.selectionStart)}
            style={{ height: Math.min(6, draft.split("\n").length) * 22 + 14 }} />
          <button className="ib compose-btn" aria-label="Emoji" aria-pressed={picker} onClick={() => setPicker((p) => !p)}>
            {SMILE_ICON}
          </button>
        </div>
      </div>
      {(sender.error || files.notice) && (
        <div className="compose-error" role="alert">{sender.error ?? files.notice}</div>
      )}
      <div className="typing">
        {sender.busy ? "Envoi en cours…" : typingNames.length > 0 && `${typingNames.join(", ")} ${typingNames.length > 1 ? "écrivent" : "est en train d'écrire"}…`}
      </div>
      {dragging && <DropOverlay channelName={channelName} />}
    </div>
  );
}
