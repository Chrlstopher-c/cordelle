// Liste des salons d'un serveur : bannière, catégories repliables, salons (lu / non lu / mention / actif).
import { useEffect, useMemo, useState } from "react";
import type { ChannelSummary } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { ChannelIcon } from "./ChannelIcon";
import { useContextMenu } from "../../shared/ui/context-menu";
import { useMenus } from "../menus";

interface Group { category: ChannelSummary | null; channels: ChannelSummary[] }

function group(channels: ChannelSummary[]): Group[] {
  const cats = channels.filter((c) => c.kind === "category");
  const loose = channels.filter((c) => c.kind !== "category" && !c.parent_id);
  return [
    { category: null, channels: loose },
    ...cats.map((cat) => ({ category: cat, channels: channels.filter((c) => c.parent_id === cat.id) })),
  ].filter((g) => g.category || g.channels.length > 0);
}

export function ChannelList({ guildId, channelId }: { guildId: string; channelId: string | null }): React.JSX.Element {
  const account = useActiveAccount();
  const guild = useEngine((s) => s.guilds.find((g) => g.id === guildId));
  const channels = useEngine((s) => s.channelsByGuild[guildId]);
  const loadChannels = useEngine((s) => s.loadChannels);
  const openChannel = useNav((s) => s.openChannel);
  const go = useNav((s) => s.go);
  const openOverlay = useNav((s) => s.openOverlay);
  const menus = useMenus();
  const openMenu = useContextMenu((s) => s.open);
  const counts = useEngine((s) => {
    const groups = s.memberLists[guildId];
    if (!groups) return null;
    const offline = groups.find((g) => g.id === "offline")?.count ?? 0;
    const total = groups.reduce((n, g) => n + g.count, 0);
    return { online: total - offline, total };
  });
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => group(channels ?? []), [channels]);

  useEffect(() => {
    if (account && !channels) void loadChannels(account.id, guildId);
  }, [account, channels, guildId, loadChannels]);

  useEffect(() => {
    if (channelId || !channels) return;
    const first = channels.find((c) => c.kind === "text" || c.kind === "announcement");
    if (first) openChannel(guildId, first.id);
  }, [channelId, channels, guildId, openChannel]);

  const open = (c: ChannelSummary): void => {
    if (c.kind === "voice" || c.kind === "stage") go({ kind: "call", guildId, channelId: c.id });
    else openChannel(guildId, c.id);
  };

  return (
    <>
      <button className="side-head" onClick={() => openOverlay({ kind: "server-settings", guildId, page: "vue" })}
        style={guild?.icon_url ? { backgroundImage: `linear-gradient(transparent, rgba(0,0,0,.55)), url(${guild.icon_url})` } : undefined}>
        <span className="name">
          {guild?.name ?? "…"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ marginLeft: "auto" }}><path d="m6 9 6 6 6-6" /></svg>
        </span>
        {counts && (
          <span className="sub">
            <span className="online-dot" />{counts.online.toLocaleString("fr-FR")} en ligne · {counts.total.toLocaleString("fr-FR")} membres
          </span>
        )}
      </button>
      <div className="side-list">
        {groups.map((g) => {
          const id = g.category?.id ?? "_";
          const isClosed = closed[id];
          return (
            <div key={id} style={{ display: "contents" }}>
              {g.category && (
                <button className={`cat${isClosed ? " closed" : ""}`} aria-expanded={!isClosed}
                  onClick={() => setClosed((s) => ({ ...s, [id]: !s[id] }))}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                  {g.category.name}
                </button>
              )}
              {g.channels
                .filter((c) => !isClosed || c.id === channelId || c.mention_count > 0)
                .map((c) => (
                  <button key={c.id} onClick={() => open(c)} onContextMenu={(e) => openMenu(e, menus.channel(c))}
                    className={`ch${c.id === channelId ? " on" : c.unread ? " unread" : ""}`}>
                    <ChannelIcon kind={c.kind} />
                    <span className="label">{c.name}</span>
                    {c.mention_count > 0 && <span className="mention">{c.mention_count}</span>}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
