// Activité (maquette Activite) : mentions récentes ; un clic ouvre le salon ou le MP concerné.
import { useEffect, useState } from "react";
import { commands, type Mention } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";
import "./home.css";

const when = (iso: string): string =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ActivityView(): React.JSX.Element {
  const account = useActiveAccount();
  const guilds = useEngine((s) => s.guilds);
  const openChannel = useNav((s) => s.openChannel);
  const go = useNav((s) => s.go);
  const [items, setItems] = useState<Mention[] | null>(null);

  useEffect(() => {
    if (!account) return;
    void commands.mentionsRecent(account.id).then((r) => setItems(r.status === "ok" ? r.data : []));
  }, [account]);

  const open = (m: Mention): void => {
    if (m.guild_id) openChannel(m.guild_id, m.message.channel_id);
    else go({ kind: "dms", channelId: m.message.channel_id });
  };

  return (
    <div className="hv">
      <header className="hv-head"><span className="t">Activité</span><span style={{ color: "var(--text-faint)", fontSize: 13 }}>Mentions récentes</span></header>
      <div className="hv-body">
        {items === null && <div className="hv-count">Chargement…</div>}
        {items?.length === 0 && <div className="empty"><b>Tu es à jour</b><span>Rien de nouveau ici.</span></div>}
        {items?.map((m) => {
          const a = m.message.author;
          const g = guilds.find((x) => x.id === m.guild_id);
          return (
            <div key={m.message.id} className="act-item" onClick={() => open(m)}>
              <Avatar id={a.id} name={a.global_name ?? a.username} url={a.avatar_url} size={36} />
              <div style={{ minWidth: 0 }}>
                <div className="where">{g ? g.name : "Message privé"} · {when(m.message.timestamp)}</div>
                <div><b>{a.global_name ?? a.username}</b></div>
                <div className="txt">{m.message.content || "Pièce jointe"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
