// Un message en disposition « confortable » : avatar 38, nom, heure, corps markdown, pièces jointes, embeds, réactions.
import { memo, useState } from "react";
import type { Attachment, Message } from "../../contract/bindings";
import { Avatar } from "../../shared/ui/Avatar";
import { useProfiles } from "../profile";
import { useContextMenu } from "../../shared/ui/context-menu";
import { useMenus } from "../menus";
import { Markdown } from "./markdown";
import { MessageTools } from "./MessageTools";
import { useMessagePrefs } from "../settings/local-prefs";
import type { MessageActions } from "./use-message-actions";
import { timeOf } from "./rows";

interface Props {
  message: Message;
  guildId: string | null;
  color: string | null;
  grouped: boolean;
  meId: string | null;
  replyText: string | null;
  onReply: (m: Message) => void;
  onImage: (url: string) => void;
  actions: MessageActions;
  editing: boolean;
  onEditing: (id: string | null) => void;
}

interface Embed { title?: string; description?: string; url?: string; color?: number; image?: { url: string };
  thumbnail?: { url: string } }

function parseEmbeds(json: string | null): Embed[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? (value as Embed[]) : []; // JSON produit par le moteur depuis l'API Discord
  } catch {
    return [];
  }
}

function Attachments({ items, onImage }: { items: Attachment[]; onImage: (u: string) => void }): React.JSX.Element {
  return (
    <div className="attach">
      {items.map((a) => a.content_type?.startsWith("image/")
        ? <img key={a.id} src={a.url} alt={a.filename} loading="lazy" onClick={() => onImage(a.url)} />
        : <a key={a.id} className="file" href={a.url} target="_blank" rel="noreferrer">📄 {a.filename}</a>)}
    </div>
  );
}

function Embeds({ json }: { json: string | null }): React.JSX.Element | null {
  const embeds = parseEmbeds(json);
  if (embeds.length === 0) return null;
  return (
    <>
      {embeds.map((e, i) => (
        <div key={i} className="embed" style={e.color ? { borderLeftColor: `#${e.color.toString(16).padStart(6, "0")}` } : undefined}>
          {e.title && (e.url ? <a className="e-title" href={e.url} target="_blank" rel="noreferrer">{e.title}</a>
            : <span className="e-title">{e.title}</span>)}
          {e.description && <span className="text"><Markdown text={e.description} /></span>}
          {(e.image ?? e.thumbnail) && <img src={(e.image ?? e.thumbnail)?.url ?? ""} alt="" loading="lazy" />}
        </div>
      ))}
    </>
  );
}

function Reactions({ message, onToggle }: { message: Message; onToggle: (emoji: string, add: boolean) => void }): React.JSX.Element | null {
  if (message.reactions.length === 0) return null;
  return (
    <div className="reactions">
      {message.reactions.map((r) => {
        const custom = /:(\d+)$/.exec(r.emoji);
        return (
          <button key={r.emoji} className={`reaction${r.me ? " me" : ""}`} onClick={() => onToggle(r.emoji, !r.me)}>
            {custom ? <img src={`https://cdn.discordapp.com/emojis/${custom[1]}.webp?size=32`} alt="" /> : r.emoji}
            {r.count}
          </button>
        );
      })}
    </div>
  );
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => void; onCancel: () => void }): React.JSX.Element {
  const [text, setText] = useState(initial);
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Escape") onCancel();
    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim() && text !== initial) onSave(text.trim()); else onCancel(); }
  };
  return (
    <div className="edit-box">
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
        onFocus={(e) => e.currentTarget.setSelectionRange(text.length, text.length)} />
      <div className="edit-hint">Échap pour <b>annuler</b> · Entrée pour <b>enregistrer</b></div>
    </div>
  );
}

function MessageItemInner(props: Props): React.JSX.Element {
  const { message: m, guildId, color, grouped, meId, replyText, onReply, onImage, actions, editing, onEditing } = props;
  const openPopout = useProfiles((s) => s.openPopout);
  const showProfile = (e: React.MouseEvent): void => openPopout(m.author.id, guildId, { x: e.clientX, y: e.clientY });
  const menus = useMenus();
  const openMenu = useContextMenu((s) => s.open);
  const userMenu = (e: React.MouseEvent): void => openMenu(e, menus.user(m.author, guildId, { x: e.clientX, y: e.clientY }));
  const msgMenu = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest("a, img.md-emoji")) return;
    openMenu(e, menus.message(m, guildId, { reply: () => onReply(m), edit: () => onEditing(m.id), react: (x) => actions.react(m.id, x, true) }));
  };
  const prefs = useMessagePrefs();
  const name = m.author.global_name ?? m.author.username;
  const mentionsMe = !!meId && m.content.includes(`<@${meId}>`);
  const body = (
    <>
      {editing ? (
        <EditBox initial={m.content} onCancel={() => onEditing(null)}
          onSave={(t) => { actions.edit(m.id, t); onEditing(null); }} />
      ) : m.content && <div className="text"><Markdown text={m.content} />
        {m.edited_timestamp && <span className="edited">(modifié)</span>}</div>}
      {m.attachments.length > 0 && (prefs.imagePreviews
        ? <Attachments items={m.attachments} onImage={onImage} />
        : <Attachments items={m.attachments.map((a) => ({ ...a, content_type: null }))} onImage={onImage} />)}
      {prefs.embeds && <Embeds json={m.embeds_json ?? null} />}
      {prefs.reactions && <Reactions message={m} onToggle={(e, add) => actions.react(m.id, e, add)} />}
    </>
  );
  return (
    <>
      {replyText !== null && <div className="msg-reply-wrap"><div className="reply" style={{ paddingTop: 6 }}>↱ {replyText}</div></div>}
      <div className={`msg${grouped ? " grouped" : ""}${mentionsMe ? " mentions-me" : ""}`} onContextMenu={msgMenu}>
        {!editing && (
          <MessageTools mine={m.author.id === meId} onReact={(e) => actions.react(m.id, e, true)} onReply={() => onReply(m)}
            onEdit={() => onEditing(m.id)} onDelete={() => actions.remove(m.id)} />
        )}
        {grouped ? (
          <><span className="gutter-time">{timeOf(m.timestamp)}</span><div className="body">{body}</div></>
        ) : (
          <>
            <span className="pf-clickable" onClick={showProfile} onContextMenu={userMenu} style={{ height: 38 }}>
              <Avatar id={m.author.id} name={name} url={m.author.avatar_url} size={38} />
            </span>
            <div className="body">
              <div className="meta"><span className="author pf-clickable" style={color ? { color } : undefined} onClick={showProfile} onContextMenu={userMenu}>{name}</span><span className="time">{timeOf(m.timestamp)}</span></div>
              {body}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export const MessageItem = memo(MessageItemInner);
