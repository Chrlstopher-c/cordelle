// AutoMod en lecture : règles, mots filtrés, actions. La modification se fait dans l'app Discord pour l'instant.
import { srv } from "../api";
import { attempt, type PageProps } from "../api";
import { AUTOMOD_ACTIONS, TRIGGERS } from "../format";
import { Empty, Notice, Row, Section } from "../kit";
import { useLoad } from "../use-load";

export function AutomodPage({ acc, guildId }: PageProps): React.JSX.Element {
  const { data, message } = useLoad(() => attempt(srv.automodRules(acc, guildId)), [acc, guildId]);
  if (message) return <Empty>{message}</Empty>;
  if (!data) return <Empty>Chargement…</Empty>;
  const active = data.filter((r) => r.enabled).length;
  return (
    <div className="ss-page">
      <h1>AutoMod</h1>
      <p className="ss-sub">
        Des règles qui filtrent les messages avant qu'ils n'arrivent.
        {active} active{active > 1 ? "s" : ""} sur {data.length}.
      </p>
      <Notice>Lecture seule : les règles se modifient dans l'app Discord pour l'instant.</Notice>
      {data.length === 0 && <Empty>Aucune règle AutoMod.</Empty>}
      {data.map((rule) => (
        <Section key={rule.id} title={rule.name}>
          <Row title={rule.enabled ? "Activée" : "Désactivée"}
            hint={TRIGGERS[rule.trigger_type] ?? "Déclencheur inconnu"} />
          {rule.keywords.length > 0 && (
            <div className="ss-row ss-row-block">
              <div className="ss-txt"><span className="ss-t">Mots et expressions</span></div>
              <div className="ss-chips">
                {rule.keywords.map((w) => <span key={w} className="ss-chip-static">{w}</span>)}
              </div>
            </div>
          )}
          <Row title="Actions"
            hint={rule.actions.map((a) => AUTOMOD_ACTIONS[a] ?? `Action ${a}`).join(" · ") || "Aucune"} />
          <Row title="Exemptés" hint={`${rule.exempt_roles.length} rôle(s), ${rule.exempt_channels.length} salon(s)`} />
        </Section>
      ))}
    </div>
  );
}
