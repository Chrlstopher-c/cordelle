// Publications d'un forum : fils actifs et archivés réunis, puis triés par récence ou par activité.
import type { ThreadSummary } from "./api";
import { compareSnowflake } from "./snowflake";
import { listThreads, type Outcome } from "./api";

export type PostSort = "recent" | "active";

export async function loadForumPosts(accountId: string, channelId: string): Promise<Outcome<ThreadSummary[]>> {
  const [active, archived] = await Promise.all([
    listThreads(accountId, channelId, false),
    listThreads(accountId, channelId, true),
  ]);
  if (!active.ok) return active;
  if (!archived.ok) return archived;
  return { ok: true, data: [...active.data, ...archived.data] };
}

export function sortPosts(posts: ThreadSummary[], sort: PostSort): ThreadSummary[] {
  if (sort === "active") return [...posts].sort((a, b) => b.message_count - a.message_count);
  return [...posts].sort((a, b) => compareSnowflake(b.last_message_id, a.last_message_id));
}
