// Page « Notifications » : notifications de bureau réelles (autorisation système), son, filtre mentions et MP.
import { useState } from "react";
import { Card, Row, Toggle } from "./controls";
import { usePrefs } from "./local-prefs";
import { hasNotifyPermission, requestNotifyPermission, showDesktopNotification } from "./desktop-notifications";

const DENIED = "Notifications refusées par le système : autorise Cordelle dans ses notifications, puis réessaie.";

export function NotificationsPage(): React.JSX.Element {
  const prefs = usePrefs((s) => s.notifications);
  const setPrefs = usePrefs((s) => s.setNotifications);
  const [note, setNote] = useState<string | null>(null);

  const toggleDesktop = async (on: boolean): Promise<void> => {
    if (!on) {
      setPrefs({ desktop: false });
      setNote(null);
      return;
    }
    const granted = await requestNotifyPermission();
    setPrefs({ desktop: granted });
    setNote(granted ? null : DENIED);
  };

  const sendTest = async (): Promise<void> => {
    if (!(await hasNotifyPermission())) {
      setNote(DENIED);
      return;
    }
    showDesktopNotification("Cordelle", "Les notifications de bureau fonctionnent.");
    setNote("Notification de test envoyée.");
  };

  return (
    <>
      <h1>Notifications</h1>
      <div className="st-sub">{note ?? "Les notifications ne partent que lorsque la fenêtre n'a pas le focus."}</div>
      <Card title="Alertes">
        <Row title="Notifications de bureau" changed={prefs.desktop}
          hint="Une notification système pour chaque message reçu.">
          <Toggle label="Notifications de bureau" on={prefs.desktop} onChange={(on) => void toggleDesktop(on)} />
        </Row>
        <Row title="Son" hint="Joue un bip quand une notification est due." changed={prefs.sound}>
          <Toggle label="Son" on={prefs.sound} onChange={(sound) => setPrefs({ sound })} />
        </Row>
        <Row title="Seulement les mentions et les MP" changed={prefs.mentionsOnly}
          hint="Ignore les autres messages des salons.">
          <Toggle label="Seulement les mentions et les MP" on={prefs.mentionsOnly}
            onChange={(mentionsOnly) => setPrefs({ mentionsOnly })} />
        </Row>
      </Card>
      <Card>
        <Row title="Notification de test" hint="Vérifie que le système affiche bien les notifications.">
          <button className="btn-ghost" onClick={() => void sendTest()}>Envoyer</button>
        </Row>
      </Card>
    </>
  );
}
