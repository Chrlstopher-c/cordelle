// Explorer (maquette Explorer) : recherche et grille des serveurs publics ; état vide quand rien ne correspond.
import type { DiscoverableGuild } from "./api";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";
import { useDiscoverable } from "./use-discoverable";
import "./home.css";

const count = (n: number): string => n.toLocaleString("fr-FR");

function DiscoverCard({ guild }: { guild: DiscoverableGuild }): React.JSX.Element {
  return (
    <article className="ex-card">
      <div className="ex-top">
        <Avatar id={guild.id} name={guild.name} url={guild.icon_url} size={44} radius={12} />
        <div className="ex-title">
          <b>{guild.name}</b>
          <span className="dlg-muted">{count(guild.online_count)} en ligne · {count(guild.member_count)} membres</span>
        </div>
      </div>
      {guild.description && <p className="ex-desc">{guild.description}</p>}
    </article>
  );
}

export function ExploreView(): React.JSX.Element {
  const account = useActiveAccount();
  const d = useDiscoverable(account?.id);
  const empty = !d.loading && d.guilds.length === 0;

  return (
    <div className="hv">
      <header className="hv-head"><span className="t">Explorer</span></header>
      <div className="hv-body">
        <section className="ex-hero">
          <h1>Trouve ta communauté</h1>
          <p>Des serveurs publics pour jouer, apprendre ou discuter.</p>
          <input className="ex-search" aria-label="Rechercher un serveur" placeholder="Rechercher un serveur"
            value={d.query} onChange={(e) => d.setQuery(e.target.value)} />
        </section>
        {empty && (
          <div className="empty"><b>Aucun serveur trouvé</b><span>Essaie un autre mot.</span></div>
        )}
        <div className="ex-grid">
          {d.guilds.map((g) => <DiscoverCard key={g.id} guild={g} />)}
        </div>
        {d.hasMore && (
          <div className="ex-more"><button className="btn-ghost" disabled={d.loading} onClick={d.more}>Voir plus</button></div>
        )}
      </div>
    </div>
  );
}
