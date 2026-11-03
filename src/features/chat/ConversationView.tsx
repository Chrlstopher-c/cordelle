// Conversation : en-tête (nom, sujet, outils), liste virtualisée, saisie. Changement de salon instantané depuis le cache.
import { useEffect, useMemo, useState } from "react";
import { commands, type Message } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { usePresence } from "../../shared/data/use-presence";
import { useProfiles } from "../profile";
import { ChannelIcon } from "../shell/ChannelIcon";
import { PinsButton, SearchField, ThreadsButton } from "../search";
import { Composer } from "./Composer";
import { setMentionNames } from "./markdown";
import { DmPanel } from "./DmPanel";
import { MembersPanel, useMemberColors } from "./MembersPanel";
import { MessageItem } from "./MessageItem";
import { useAutoRead } from "./use-auto-read";
import { useMessageActions } from "./use-message-actions";
import { useMessageList } from "./use-message-list";
import "./chat.css";

const TYPING_TTL_MS = 9000;
const STATUS_TEXT: Record<string, string> = {
  online: "En ligne", idle: "Inactif", dnd: "Ne pas déranger", offline: "Hors ligne", invisible: "Hors ligne",
};
const EMPTY: Message[] = [];

function useChannel(guildId: string | null, channelId: string) {
  return useEngine((s) => (guildId ? s.channelsByGuild[guildId] : s.dms)?.find((c) => c.id === channelId));
}

function useTypingNames(channelId: string, messages: Message[]): string[] {
  const typing = useEngine((s) => s.typing[channelId]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(t); }, []);
  const names = new Map(messages.map((m) => [m.author.id, m.author.global_name ?? m.author.username]));
  return (typing ?? []).filter((t) => now - t.at < TYPING_TTL_MS).map((t) => names.get(t.userId) ?? "Quelqu'un");
}

export function ConversationView({ guildId, channelId }: { guildId: string | null; channelId: string }): React.JSX.Element {
  const account = useActiveAccount();
  const channel = useChannel(guildId, channelId);
  const messages = useEngine((s) => s.messages[channelId] ?? EMPTY);
  const membersOpen = useNav((s) => s.membersOpen[channelId] ?? !guildId);
  const toggleMembers = useNav((s) => s.toggleMembers);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const actions = useMessageActions(account?.id ?? "", channelId);
  const openPopout = useProfiles((s) => s.openPopout);
  const onMentionClick = (e: React.MouseEvent): void => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-user-id]");
    if (el?.dataset.userId) openPopout(el.dataset.userId, guildId, { x: e.clientX, y: e.clientY });
  };
  const editLast = (): void => {
    const mine = messages.find((m) => m.author.id === account?.user.id);
    if (mine) setEditingId(mine.id);
  };
  const readMark = useReadMark(channelId, channel?.last_read_id ?? null);
  const list = useMessageList(account?.id ?? "", channelId, readMark);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const typingNames = useTypingNames(channelId, messages);
  const colors = useMemberColors(guildId);
  useAutoRead(account?.id ?? "", channelId);

  useEffect(() => {
    const names = Object.fromEntries(messages.map((m) => [m.author.id, m.author.global_name ?? m.author.username]));
    for (const u of channel?.recipients ?? []) names[u.id] = u.global_name ?? u.username;
    if (account) names[account.user.id] = account.user.global_name ?? account.user.username;
    setMentionNames(names);
  }, [messages, channel, account]);
  useEffect(() => setReplyTo(null), [channelId]);
  useEffect(() => {
    if (account && guildId) void commands.membersSubscribe(account.id, guildId, channelId);
  }, [account, guildId, channelId]);

  const dmUser = channel?.kind === "dm" ? channel.recipients[0] : undefined;
  const dmStatus = usePresence(dmUser?.id ?? null);
  const title = channel?.name || channel?.recipients.map((r) => r.global_name ?? r.username).join(", ") || "";
  const isDm = !guildId;

  return (
    <div className="cv-wrap">
    <div className="cv">
      <header className="cv-head">
        <span className="title">{isDm ? "@" : channel && <ChannelIcon kind={channel.kind} />}{title}</span>
        {channel?.topic && <span className="topic">{channel.topic}</span>}
        <span style={{ flex: channel?.topic ? 0 : 1 }} />
        {dmStatus && <span className="cv-status">{STATUS_TEXT[dmStatus]}</span>}
        {account && guildId && <ThreadsButton accountId={account.id} guildId={guildId} channelId={channelId} />}
        {account && <PinsButton accountId={account.id} guildId={guildId} channelId={channelId} />}
        <button className="cv-tool" aria-pressed={membersOpen} onClick={() => toggleMembers(channelId)}>
          {isDm ? (dmUser ? "Profil" : "Participants") : "Membres"}
        </button>
        {account && <SearchField accountId={account.id} guildId={guildId} channelId={channelId} />}
      </header>
      {!list.loaded && <LoadingRows />}
      <div className="cv-scroll" ref={list.scrollRef} onScroll={list.onScroll} onClick={onMentionClick}>
        <div style={{ height: list.virtualizer.getTotalSize(), position: "relative" }}>
          {list.virtualizer.getVirtualItems().map((v) => {
            const row = list.rows[v.index];
            return (
              <div key={v.key} data-index={v.index} ref={list.virtualizer.measureElement}
                style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` }}>
                {row.kind === "start" ? <ChannelStart title={title} isDm={isDm} topic={channel?.topic ?? null} />
                  : row.kind === "date" ? <div className="cv-date">{row.label}</div> : row.kind === "new" ? (
                  <div className="cv-new"><span>Nouveaux messages</span></div>
                ) : (
                  <MessageItem message={row.message} guildId={guildId} color={colors.get(row.message.author.id) ?? null} grouped={row.grouped} meId={account?.user.id ?? null}
                    replyText={row.message.reply_to ? replySnippet(byId.get(row.message.reply_to)) : null}
                    onReply={setReplyTo} onImage={setImage} actions={actions}
                    editing={editingId === row.message.id} onEditing={setEditingId} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {account && (
        <Composer accountId={account.id} channelId={channelId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)}
          placeholder={isDm ? `Envoyer un message à @${title}` : `Envoyer un message dans #${title}`} typingNames={typingNames} onEditLast={editLast}
          messages={messages} recipients={channel?.recipients ?? []} isGuild={!isDm} />
      )}
      {image && <div className="viewer" onClick={() => setImage(null)}><img src={image} alt="" /></div>}
    </div>
    {guildId && membersOpen && <MembersPanel guildId={guildId} channelId={channelId} />}
    {!guildId && membersOpen && channel && <DmPanel channel={channel} />}
    </div>
  );
}

/** Haut de l'historique : « Bienvenue dans #salon » ou « Début de ta conversation avec @x ». */
function ChannelStart({ title, isDm, topic }: { title: string; isDm: boolean; topic: string | null }): React.JSX.Element {
  return (
    <div className="cv-start">
      <div className="cv-start-icon">{isDm ? "@" : "#"}</div>
      <h2>{isDm ? title : `Bienvenue dans #${title}`}</h2>
      <p>{isDm ? `Début de ta conversation avec ${title}.` : topic ?? `C'est le tout début du salon #${title}.`}</p>
    </div>
  );
}

/** Lignes fantômes pendant le premier chargement d'un salon (rien ne clignote ensuite : le cache répond). */
function LoadingRows(): React.JSX.Element {
  return (
    <div className="cv-loading" aria-label="Chargement des messages">
      {[0.62, 0.44, 0.7, 0.36].map((w, i) => (
        <div key={i} className="cv-ghost"><span className="g-av" /><span className="g-lines">
          <span style={{ width: `${w * 40}%` }} /><span style={{ width: `${w * 100}%` }} />
        </span></div>
      ))}
    </div>
  );
}

/** Dernier lu figé à l'ouverture du salon : le séparateur reste tant qu'on ne change pas de salon. */
function useReadMark(channelId: string, lastRead: string | null): string | null {
  const [mark, setMark] = useState<{ channel: string; id: string | null } | null>(null);
  useEffect(() => {
    if (!mark || mark.channel !== channelId) setMark({ channel: channelId, id: lastRead });
  }, [channelId, lastRead, mark]);
  return mark?.channel === channelId ? mark.id : null;
}

function replySnippet(m: Message | undefined): string {
  if (!m) return "Message d'origine indisponible";
  const text = m.content.replace(/\s+/g, " ").slice(0, 120) || "Pièce jointe";
  return `${m.author.global_name ?? m.author.username} : ${text}`;
}
