// Pages « Extensions et thèmes » (CSS personnalisé local) et « Avancé » (mode développeur,
// réinitialisation du cache local).
import { Card, Row, Toggle } from "./controls";
import { clearLocalSettings, usePrefs } from "./local-prefs";
import { useConfirm } from "../../shared/ui/confirm";

export function ExtensionsPage(): React.JSX.Element {
  const custom = usePrefs((s) => s.customCss);
  const setCustom = usePrefs((s) => s.setCustomCss);
  return (
    <>
      <h1>Extensions et thèmes</h1>
      <div className="st-sub">Le CSS ci-dessous est appliqué à toute l'interface, sur ce poste uniquement.</div>
      <Card title="CSS personnalisé">
        <Row title="Activer le CSS personnalisé" hint="Désactivé, le CSS n'est pas injecté." changed={custom.enabled}>
          <Toggle label="Activer le CSS personnalisé" on={custom.enabled}
            onChange={(enabled) => setCustom({ enabled })} />
        </Row>
        <div className="st-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <span className="st-t">Feuille de style</span>
          <textarea className="st-area st-code" spellCheck={false} maxLength={20000} value={custom.css}
            placeholder=":root { --accent: #3FB97A; }"
            onChange={(e) => setCustom({ css: e.target.value })} />
          <span className="st-h">Injecté dans une balise style id « cordelle-custom-css ».</span>
        </div>
      </Card>
    </>
  );
}

export function AdvancedPage(): React.JSX.Element {
  const devMode = usePrefs((s) => s.devMode);
  const setDevMode = usePrefs((s) => s.setDevMode);
  const confirm = useConfirm((s) => s.confirm);
  const reset = (): void => confirm({
    title: "Réinitialiser le cache local ?",
    body: "Les réglages de ce poste reviennent aux valeurs par défaut. Les comptes ne sont pas touchés.",
    action: "Réinitialiser",
    run: clearLocalSettings,
  });
  return (
    <>
      <h1>Avancé</h1>
      <div className="st-sub">Options pour les développeurs et la maintenance locale.</div>
      <Card title="Développeur">
        <Row title="Mode développeur" hint="Ajoute « Copier l'identifiant » aux menus contextuels." changed={devMode}>
          <Toggle label="Mode développeur" on={devMode} onChange={setDevMode} />
        </Row>
      </Card>
      <Card title="Données locales">
        <Row title="Réinitialiser le cache local"
          hint="Efface les réglages stockés sur ce poste : apparence, voix, notifications, messages, CSS.">
          <button className="btn-ghost" style={{ color: "var(--danger-text)" }} onClick={reset}>Réinitialiser</button>
        </Row>
      </Card>
    </>
  );
}
