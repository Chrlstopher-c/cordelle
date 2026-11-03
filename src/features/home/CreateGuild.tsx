// Créer un serveur vide : un nom (2 à 100 caractères), puis ouverture du serveur.
import { useState } from "react";
import { guildCreate } from "./api";
import { useNav } from "../../shared/data/nav-store";
import { errorText } from "./engine-error";

interface Props {
  accountId: string;
  onCreated: () => void;
}

const NAME_MIN = 2;
const NAME_MAX = 100;

export function CreateGuild({ accountId, onCreated }: Props): React.JSX.Element {
  const openGuild = useNav((s) => s.openGuild);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;

  const create = async (): Promise<void> => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await guildCreate(accountId, trimmed);
      if (r.status === "error") {
        setError(errorText(r.error));
        return;
      }
      onCreated();
      openGuild(r.data);
    } catch (e) {
      console.error("[accueil] création impossible", e);
      setError("Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dlg-body">
      <label className="dlg-label" htmlFor="guild-name">Nom du serveur</label>
      <input id="guild-name" className="dlg-input" autoFocus maxLength={NAME_MAX} value={name} placeholder="Mon serveur"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void create(); }} />
      <p className="dlg-muted">Entre {NAME_MIN} et {NAME_MAX} caractères. Tu pourras tout modifier ensuite.</p>
      {error && <p className="dlg-error">{error}</p>}
      <div className="dlg-foot">
        <button className="btn-accent" disabled={!valid || busy} onClick={() => void create()}>Créer</button>
      </div>
    </div>
  );
}
