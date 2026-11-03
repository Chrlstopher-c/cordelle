// Bandeau discret en haut de la coque pendant la connexion du compte actif (démarrage, reprise, hors ligne).
import type { ConnectionState } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";

const TEXT: Partial<Record<ConnectionState, string>> = {
  connecting: "Connexion au serveur…",
  resuming: "Reconnexion en cours…",
  failed: "Hors ligne.",
};

export function ConnectionBanner(): React.JSX.Element | null {
  const state = useEngine((s) => {
    const active = s.accounts.find((a) => a.active);
    return active ? s.connection[active.id] : undefined;
  });
  const text = state ? TEXT[state] : undefined;
  if (!text) return null;
  return (
    <div role="status" style={{ height: 28, flexShrink: 0, display: "flex", alignItems: "center",
      justifyContent: "center",
      background: "var(--surface-raised)", color: state === "failed" ? "var(--danger-text)" : "var(--text-muted)",
      fontSize: "var(--fs-small)" }}>
      {text}
    </div>
  );
}
