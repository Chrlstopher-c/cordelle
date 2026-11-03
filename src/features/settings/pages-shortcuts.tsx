// Page « Raccourcis clavier » : liste en lecture seule des raccourcis réellement branchés dans l'interface.
import { Card, Row } from "./controls";

const SHORTCUTS: { title: string; hint: string; keys: string[] }[] = [
  { title: "Palette de commandes", hint: "Recherche et actions rapides.", keys: ["Ctrl", "K"] },
  { title: "Fermer ou annuler", hint: "Ferme les réglages, la palette et les menus ; annule une réponse.",
    keys: ["Échap"] },
  { title: "Modifier le dernier message", hint: "Dans le champ de saisie vide.", keys: ["↑"] },
  { title: "Envoyer le message", hint: "Dans le champ de saisie, ou valider une modification.", keys: ["Entrée"] },
  { title: "Saut de ligne", hint: "Dans le champ de saisie.", keys: ["Maj", "Entrée"] },
];

export function ShortcutsPage(): React.JSX.Element {
  return (
    <>
      <h1>Raccourcis clavier</h1>
      <div className="st-sub">Liste des raccourcis disponibles (lecture seule).</div>
      <Card>
        {SHORTCUTS.map((s) => (
          <Row key={s.title} title={s.title} hint={s.hint}>
            <span className="st-keys">
              {s.keys.map((k) => <kbd key={k}>{k}</kbd>)}
            </span>
          </Row>
        ))}
      </Card>
    </>
  );
}
