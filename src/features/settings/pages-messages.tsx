// Page « Messages » : affichage local des embeds, aperçus, réactions et emojis agrandis
// (lu par MessageItem via useMessagePrefs).
import { Card, Row, Toggle } from "./controls";
import { usePrefs } from "./local-prefs";

export function MessagesPage(): React.JSX.Element {
  const prefs = usePrefs((s) => s.messages);
  const setPrefs = usePrefs((s) => s.setMessages);
  return (
    <>
      <h1>Messages</h1>
      <div className="st-sub">Ce qui s'affiche dans le fil, sur ce poste uniquement.</div>
      <Card>
        <Row title="Afficher les embeds" changed={!prefs.embeds}
          hint="Liens enrichis, titres et images envoyés par les bots et les sites.">
          <Toggle label="Afficher les embeds" on={prefs.embeds} onChange={(embeds) => setPrefs({ embeds })} />
        </Row>
        <Row title="Aperçus des images" hint="Affiche les images directement dans le fil."
          changed={!prefs.imagePreviews}>
          <Toggle label="Aperçus des images" on={prefs.imagePreviews}
            onChange={(imagePreviews) => setPrefs({ imagePreviews })} />
        </Row>
        <Row title="Réactions" hint="Affiche les réactions sous les messages." changed={!prefs.reactions}>
          <Toggle label="Réactions" on={prefs.reactions} onChange={(reactions) => setPrefs({ reactions })} />
        </Row>
        <Row title="Prévisualiser les emojis" changed={!prefs.previewEmoji}
          hint="Un message composé seulement d'emojis les affiche en grand.">
          <Toggle label="Prévisualiser les emojis" on={prefs.previewEmoji}
            onChange={(previewEmoji) => setPrefs({ previewEmoji })} />
        </Row>
      </Card>
    </>
  );
}
