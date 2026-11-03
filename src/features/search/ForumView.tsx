// Vue d'un salon forum : liste des publications (fils), recherche par nom, nouvelle publication.
import { useEffect, useMemo, useState } from "react";
import type { ThreadSummary } from "./api";
import { useEngine } from "../../shared/data/engine-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { ChannelIcon } from "../shell/ChannelIcon";
import { openChannelView } from "./navigate-to";
import { createThread, type Outcome } from "./api";
import { formatStamp, snowflakeTime } from "./snowflake";
import { loadForumPosts, sortPosts, type PostSort } from "./forum-posts";
import { NewPostForm } from "./NewPostForm";

interface Props {
  guildId: string;
  channelId: string;
}

function PostCard({ post, onOpen }: { post: ThreadSummary; onOpen: () => void }): React.JSX.Element {
  const last = post.last_message_id ? formatStamp(snowflakeTime(post.last_message_id)) : formatStamp(snowflakeTime(post.id));
  return (
    <button className="fv-card" onClick={onOpen}>
      <h2 className="fv-card-title">{post.name}</h2>
      <div className="fv-card-meta">
        <span>{post.message_count} réponse{post.message_count > 1 ? "s" : ""}</span>
        <span>Dernière activité {last}</span>
        {post.archived && <span className="fv-archived">Archivé</span>}
      </div>
    </button>
  );
}

function PostList({ outcome, onOpen }: { outcome: Outcome<ThreadSummary[]> | null; onOpen: (p: ThreadSummary) => void }): React.JSX.Element {
  if (!outcome) return <p className="fv-empty">Chargement…</p>;
  if (!outcome.ok) return <p className="fv-empty">{outcome.message}</p>;
  if (outcome.data.length === 0) return <p className="fv-empty">Aucune publication pour l'instant.</p>;
  return <>{outcome.data.map((p) => <PostCard key={p.id} post={p} onOpen={() => onOpen(p)} />)}</>;
}

export function ForumView({ guildId, channelId }: Props): React.JSX.Element | null {
  const account = useActiveAccount();
  const channel = useEngine((s) => s.channelsByGuild[guildId]?.find((c) => c.id === channelId));
  const [posts, setPosts] = useState<Outcome<ThreadSummary[]> | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<PostSort>("recent");
  const [composing, setComposing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!accountId) return;
    setPosts(null);
    void loadForumPosts(accountId, channelId).then(setPosts);
  }, [accountId, channelId]);

  const visible = useMemo(() => {
    if (!posts?.ok) return null;
    const needle = filter.trim().toLowerCase();
    const matching = posts.data.filter((p) => !needle || p.name.toLowerCase().includes(needle));
    return { ok: true as const, data: sortPosts(matching, sort) };
  }, [posts, filter, sort]);

  const publish = async (title: string, body: string): Promise<void> => {
    if (!accountId) return;
    setPosting(true);
    setPostError(null);
    const outcome = await createThread(accountId, channelId, title, body);
    setPosting(false);
    if (outcome.ok) {
      setComposing(false);
      openChannelView(accountId, guildId, outcome.data.id);
    } else {
      setPostError(outcome.message);
    }
  };

  if (!accountId || !channel) return null;
  return (
    <section className="fv" aria-label={`Publications de ${channel.name}`}>
      <header className="fv-head">
        <ChannelIcon kind={channel.kind} />
        <h1 className="fv-title">{channel.name}</h1>
        {channel.topic && <><span className="fv-sep" /><span className="fv-topic">{channel.topic}</span></>}
        <button className="fv-primary" onClick={() => setComposing(!composing)} aria-expanded={composing}>Nouvelle publication</button>
      </header>
      <div className="fv-body">
        <div className="fv-toolbar">
          <input className="fv-search" aria-label="Rechercher une publication" placeholder="Rechercher une publication…"
            value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="sx-seg" role="group" aria-label="Trier">
            <button aria-pressed={sort === "recent"} onClick={() => setSort("recent")}>Récent</button>
            <button aria-pressed={sort === "active"} onClick={() => setSort("active")}>Activité</button>
          </div>
        </div>
        {composing && (
          <NewPostForm busy={posting} error={postError} onCancel={() => setComposing(false)} onPublish={publish} />
        )}
        <div className="fv-list">
          <PostList outcome={visible} onOpen={(p) => openChannelView(accountId, guildId, p.id)} />
        </div>
      </div>
    </section>
  );
}
