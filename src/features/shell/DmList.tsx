// Barre latérale des messages privés : Amis, puis les MP et groupes triés par activité.
import type { ChannelSummary } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { Avatar } from "../../shared/ui/Avatar";

const title = (c: ChannelSummary): string =>
  c.name || c.recipients.map((r) => r.global_name ?? r.username).join(", ") || "Conversation";

export function DmList({ channelId }: { channelId: string | null }): React.JSX.Element {
  const dms = useEngine((s) => s.dms);
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);

  return (
    <div className="side-list" style={{ paddingTop: 8 }}>
      <button className={`dm${view.kind === "friends" ? " on" : ""}`} onClick={() => go({ kind: "friends" })}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="9" cy="8" r="3.5" /><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 13.8c1.8.7 3 2.5 3 5.2" /></svg>
        <span style={{ fontWeight: 500 }}>Amis</span>
      </button>
      <div className="cat" style={{ marginTop: 14 }}>Messages privés</div>
      {dms.map((c) => {
        const who = c.recipients[0];
        return (
          <button key={c.id} onClick={() => go({ kind: "dms", channelId: c.id })}
            className={`dm${c.id === channelId ? " on" : c.unread ? " unread" : ""}`}>
            <Avatar id={who?.id ?? c.id} name={title(c)} url={c.kind === "dm" ? who?.avatar_url : null} size={32} />
            <span className="label" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title(c)}</span>
            {c.mention_count > 0 && <span className="mention">{c.mention_count}</span>}
          </button>
        );
      })}
    </div>
  );
}
