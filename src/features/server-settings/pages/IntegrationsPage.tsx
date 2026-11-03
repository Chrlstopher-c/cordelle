// Intégrations et bots en lecture : ce qui peut lire ou écrire dans le serveur.
import { srv } from "../api";
import { attempt, type PageProps } from "../api";
import { KINDS } from "../format";
import { Empty, Notice, Row, Section } from "../kit";
import { useLoad } from "../use-load";

export function IntegrationsPage({ acc, guildId }: PageProps): React.JSX.Element {
  const { data, message } = useLoad(() => attempt(srv.integrationsList(acc, guildId)), [acc, guildId]);
  if (message) return <Empty>{message}</Empty>;
  if (!data) return <Empty>Chargement…</Empty>;
  return (
    <div className="ss-page">
      <h1>Intégrations et bots</h1>
      <p className="ss-sub">Ce qui peut lire ou écrire dans le serveur sans être une personne.</p>
      <Notice>Lecture seule : les intégrations se gèrent dans l'app Discord pour l'instant.</Notice>
      <Section title={`Intégrations · ${data.length}`}>
        {data.map((i) => (
          <Row key={i.id} title={i.name} hint={[KINDS[i.kind] ?? i.kind, i.account_name].filter(Boolean).join(" · ")}>
            <span className={`ss-tag${i.enabled ? " ok" : ""}`}>{i.enabled ? "Active" : "Désactivée"}</span>
          </Row>
        ))}
        {data.length === 0 && <Empty>Aucune intégration.</Empty>}
      </Section>
    </div>
  );
}
