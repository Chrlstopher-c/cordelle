// Écran de connexion (version minimale fonctionnelle) : QR généré au chargement, état du scan, nouvel essai.
import { useEffect } from "react";
import { useEngine } from "../../shared/data/engine-store";
import { useQrLogin } from "./use-qr-login";

const STEP_TEXT: Record<string, string> = {
  "": "Préparation du code…",
  "démarrage…": "Préparation du code…",
  ready: "Scanne ce code avec l'app Discord de ton téléphone (Paramètres → Scanner le QR code).",
  expired: "Le code a expiré.",
  cancelled: "Connexion annulée.",
};

export function AccessScreen(): React.JSX.Element {
  const refreshAccounts = useEngine((s) => s.refreshAccounts);
  const qr = useQrLogin(() => void refreshAccounts());

  useEffect(() => {
    qr.start();
    // Démarrage unique au montage ; un nouvel essai passe par le bouton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = qr.step === "expired" || qr.step === "cancelled" || qr.step.startsWith("échec") || qr.step.startsWith("erreur");

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-chat)" }}>
      <div style={{ width: 420, padding: 32, borderRadius: "var(--r-xl)", background: "var(--surface-raised)", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Connexion à Discord</h1>
        <p style={{ margin: "0 0 20px", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          {STEP_TEXT[qr.step] ?? qr.step}
        </p>
        <div style={{ width: 220, height: 220, margin: "0 auto", borderRadius: "var(--r-lg)", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {qr.image ? <img src={qr.image} alt="QR de connexion" width={220} height={220} style={{ borderRadius: "var(--r-lg)" }} />
            : <span style={{ color: "#888", fontSize: 13 }}>…</span>}
        </div>
        {retry && (
          <button onClick={qr.start} style={{ marginTop: 20, height: 36, padding: "0 16px", borderRadius: "var(--r-md)",
            background: "var(--accent)", color: "#fff", fontWeight: 600 }}>Nouveau code</button>
        )}
      </div>
    </div>
  );
}
