// Écran de connexion : onglets QR code et mot de passe, sur la carte des maquettes Connexion.
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEngine } from "../../shared/data/engine-store";
import { CARD_STYLE, LINK_STYLE, MUTED_STYLE, TITLE_STYLE } from "./access-styles";
import { PasswordTab } from "./PasswordTab";
import { QrLogin } from "./QrLogin";

const REGISTER_URL = "https://discord.com/register";

export interface AccessScreenProps {
  /** Dans une modale (ajout de compte) : carte seule, sans plein écran. */
  embedded?: boolean;
  /** Connexion réussie : le compte est déjà enregistré côté moteur. */
  onDone?: (accountId: string) => void;
  onCancel?: () => void;
}

type Tab = "qr" | "password";

async function openRegister(): Promise<void> {
  try {
    await openUrl(REGISTER_URL);
  } catch (err: unknown) {
    console.error("[access] ouverture de la page d'inscription", err);
  }
}

export function AccessScreen({ embedded = false, onDone, onCancel }: AccessScreenProps): React.JSX.Element {
  const finish = (accountId: string): void => {
    void useEngine.getState().refreshAccounts();
    onDone?.(accountId);
  };
  const card = <AccessCard onDone={finish} onCancel={onCancel} />;
  if (embedded) return card;
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--surface-chat)" }}>
      {card}
    </div>
  );
}

interface AccessCardProps {
  onDone: (accountId: string) => void;
  onCancel?: () => void;
}

function AccessCard({ onDone, onCancel }: AccessCardProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("qr");
  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={TITLE_STYLE}>Content de te revoir</h1>
        <p style={MUTED_STYLE}>Connecte-toi pour retrouver tes serveurs.</p>
      </div>
      <TabBar tab={tab} onChange={setTab} />
      {tab === "qr" ? <QrLogin onDone={onDone} /> : <PasswordTab onDone={onDone} />}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, fontSize: "var(--fs-small)",
        color: "var(--text-muted)" }}>
        <span>Besoin d'un compte ?</span>
        <button type="button" onClick={() => void openRegister()} style={LINK_STYLE}>Créer un compte</button>
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ ...LINK_STYLE, alignSelf: "center" }}>Annuler</button>
      )}
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "qr", label: "QR code" },
  { id: "password", label: "Mot de passe" },
];

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }): React.JSX.Element {
  return (
    <div role="tablist" aria-label="Méthode de connexion"
      style={{ display: "flex", gap: 4, padding: 4, borderRadius: "var(--r-md)", background: "var(--surface-frame)" }}>
      {TABS.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onChange(t.id)}
          style={{ flex: 1, height: 34, borderRadius: "var(--r-sm)", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: "var(--fs-small)", fontWeight: 600,
            background: tab === t.id ? "var(--surface-selected)" : "none",
            color: tab === t.id ? "var(--text-strong)" : "var(--text-muted)" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
