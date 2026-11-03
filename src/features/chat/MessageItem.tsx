// Un message en disposition « confortable » : avatar 38, nom, heure, corps markdown, pièces jointes, embeds, réactions.
import { memo } from "react";
import type { Attachment, Message } from "../../contract/bindings";
import { Avatar } from "../../shared/ui/Avatar";
import { useProfiles } from "../profile";
import { Markdown } from "./markdown";
import { timeOf } from "./rows";

interface Props {
  message: Message;
  guildId: string | null;
  grouped: boolean;
  meId: string | null;
  replyText: string | null;
  onReply: (m: Message) => void;
  onImage: (url: string) => void;
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

function Reactions({ message }: { message: Message }): React.JSX.Element | null {
  if (message.reactions.length === 0) return null;
  return (
    <div className="reactions">
      {message.reactions.map((r) => {
        const custom = /:(\d+)$/.exec(r.emoji);
        return (
          <span key={r.emoji} className={`reaction${r.me ? " me" : ""}`}>
            {custom ? <img src={`https://cdn.discordapp.com/emojis/${custom[1]}.webp?size=32`} alt="" /> : r.emoji}
            {r.count}
          </span>
        );
      })}
    </div>
  );
}

function MessageItemInner({ message: m, guildId, grouped, meId, replyText, onReply, onImage }: Props): React.JSX.Element {
  const openPopout = useProfiles((s) => s.openPopout);
  const showProfile = (e: React.MouseEvent): void => openPopout(m.author.id, guildId, { x: e.clientX, y: e.clientY });
  const name = m.author.global_name ?? m.author.username;
  const mentionsMe = !!meId && m.content.includes(`<@${meId}>`);
  const body = (
    <>
      {m.content && <div className="text"><Markdown text={m.content} />
        {m.edited_timestamp && <span className="edited">(modifié)</span>}</div>}
      {m.attachments.length > 0 && <Attachments items={m.attachments} onImage={onImage} />}
      <Embeds json={m.embeds_json ?? null} />
      <Reactions message={m} />
    </>
  );
  return (
    <>
      {replyText !== null && <div className="msg-reply-wrap"><div className="reply" style={{ paddingTop: 6 }}>↱ {replyText}</div></div>}
      <div className={`msg${grouped ? " grouped" : ""}${mentionsMe ? " mentions-me" : ""}`}>
        <div className="msg-tools">
          <button className="ib" aria-label="Répondre" onClick={() => onReply(m)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v4" /></svg>
          </button>
        </div>
        {grouped ? (
          <><span className="gutter-time">{timeOf(m.timestamp)}</span><div className="body">{body}</div></>
        ) : (
          <>
            <span className="pf-clickable" onClick={showProfile} style={{ height: 38 }}>
              <Avatar id={m.author.id} name={name} url={m.author.avatar_url} size={38} />
            </span>
            <div className="body">
              <div className="meta"><span className="author pf-clickable" onClick={showProfile}>{name}</span><span className="time">{timeOf(m.timestamp)}</span></div>
              {body}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export const MessageItem = memo(MessageItemInner);
