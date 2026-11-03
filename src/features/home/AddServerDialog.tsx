// Ajouter un serveur (maquette Ajouter-serveur) : rejoindre par invitation, ou créer. Échap et clic dehors ferment.
import { useEffect, useState } from "react";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { CreateGuild } from "./CreateGuild";
import { JoinInvite } from "./JoinInvite";
import "./home.css";

type Mode = "join" | "create";

interface Props {
  onClose: () => void;
}

export function AddServerDialog({ onClose }: Props): React.JSX.Element {
  const account = useActiveAccount();
  const [mode, setMode] = useState<Mode>("join");

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-label="Ajouter un serveur">
        <header className="dlg-head">
          <h2>Ajouter un serveur</h2>
          <button className="round" aria-label="Fermer (Échap)" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="dlg-tabs" role="tablist">
          <button role="tab" className="hv-tab" aria-selected={mode === "join"} onClick={() => setMode("join")}>Rejoindre avec une invitation</button>
          <button role="tab" className="hv-tab" aria-selected={mode === "create"} onClick={() => setMode("create")}>Créer un serveur</button>
        </div>
        {!account && <p className="dlg-muted dlg-body">Connecte un compte pour ajouter un serveur.</p>}
        {account && mode === "join" && <JoinInvite accountId={account.id} onJoined={onClose} />}
        {account && mode === "create" && <CreateGuild accountId={account.id} onCreated={onClose} />}
      </div>
    </div>
  );
}
