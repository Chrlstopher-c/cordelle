// Rail des serveurs : MP et Activité en haut, serveurs (ordre du moteur), ajouter et explorer en bas.
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { initials } from "../../shared/ui/Avatar";

function Pill({ on, unread }: { on: boolean; unread?: boolean }): React.JSX.Element {
  return <span className={`pill${on ? " on" : unread ? " unread" : ""}`} />;
}

function Badge({ n }: { n: number }): React.JSX.Element | null {
  return n > 0 ? <span className="badge">{n > 99 ? "99+" : n}</span> : null;
}

export function Rail(): React.JSX.Element {
  const guilds = useEngine((s) => s.guilds);
  const dms = useEngine((s) => s.dms);
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);
  const openGuild = useNav((s) => s.openGuild);
  const dmMentions = dms.reduce((n, c) => n + c.mention_count, 0);
  const sorted = [...guilds].sort((a, b) => a.position - b.position);
  const accent = (on: boolean): React.CSSProperties => (on ? { background: "var(--accent)" } : {});

  return (
    <nav className="rail" aria-label="Serveurs">
      <div className="rail-item">
        <Pill on={view.kind === "dms"} />
        <button className={`sv${view.kind === "dms" ? " on" : ""}`} style={accent(view.kind === "dms")}
          aria-label="Messages privés" onClick={() => go({ kind: "dms", channelId: null })}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5h16v11H9l-5 4z" /></svg>
          <Badge n={dmMentions} />
        </button>
      </div>
      <div className="rail-item">
        <Pill on={view.kind === "activity"} />
        <button className={`sv${view.kind === "activity" ? " on" : ""}`} style={accent(view.kind === "activity")}
          aria-label="Activité" onClick={() => go({ kind: "activity" })}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 13h4l2 3h4l2-3h4" /><path d="M5.5 5h13L20 13v6H4v-6z" /></svg>
        </button>
      </div>
      <div className="rail-sep" />
      {sorted.map((g) => {
        const on = view.kind === "guild" && view.guildId === g.id;
        return (
          <div className="rail-item" key={g.id}>
            <Pill on={on} unread={g.unread} />
            <button className={`sv${on ? " on" : ""}`} aria-label={g.name} title={g.name} onClick={() => openGuild(g.id)}>
              {g.icon_url ? <img src={g.icon_url} alt="" draggable={false} /> : initials(g.name)}
              <Badge n={g.mention_count} />
            </button>
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      <button className="sv" aria-label="Ajouter un serveur" style={{ background: "#1e1f23", color: "var(--success)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button className={`sv${view.kind === "explore" ? " on" : ""}`} aria-label="Explorer les serveurs" onClick={() => go({ kind: "explore" })}
        style={view.kind === "explore" ? { background: "var(--success)", color: "#0f2318" } : { background: "#1e1f23", color: "var(--text-muted)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>
      </button>
    </nav>
  );
}
