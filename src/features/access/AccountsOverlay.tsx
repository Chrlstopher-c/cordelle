// Comptes : liste avec état de connexion, bascule, ajout (écran de connexion dans la modale), retrait confirmé.
import { useState } from "react";
import { useConfirm } from "../../shared/ui/confirm";
import { useEngine } from "../../shared/data/engine-store";
import { AccessScreen } from "./AccessScreen";
import { AccountRow } from "./AccountRow";
import { confirmRemove, pickAccount, switchAccount } from "./account-actions";
import { displayName } from "./access-user";
import { SECONDARY_STYLE, TITLE_STYLE } from "./access-styles";

const DIALOG_STYLE: React.CSSProperties = {
  width: 460,
  maxWidth: "calc(100vw - 32px)",
  borderRadius: "var(--r-xl)",
  background: "var(--surface-menu)",
  boxShadow: "0 24px 60px rgba(0,0,0,.5)",
  padding: 24,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

export function AccountsOverlay({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState(false);

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape" && !useConfirm.getState().ask) onClose();
  };
  const added = (accountId: string): void => {
    setAdding(false);
    void switchAccount(accountId);
  };

  return (
    <div className="cf-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Comptes" onKeyDown={onKey} style={DIALOG_STYLE}>
        {adding ? (
          <AccessScreen embedded onDone={added} onCancel={() => setAdding(false)} />
        ) : (
          <AccountsPanel manage={manage} onToggleManage={() => setManage((v) => !v)}
            onAdd={() => setAdding(true)} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

interface AccountsPanelProps {
  manage: boolean;
  onToggleManage: () => void;
  onAdd: () => void;
  onClose: () => void;
}

function AccountsPanel({ manage, onToggleManage, onAdd, onClose }: AccountsPanelProps): React.JSX.Element {
  const accounts = useEngine((s) => s.accounts);
  const connection = useEngine((s) => s.connection);
  return (
    <>
      <PanelHeader manage={manage} onClose={onClose} />
      <div role="list" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} connection={connection[a.id]} manage={manage}
            onPick={() => pickAccount(a.id, displayName(a.user))}
            onRemove={() => confirmRemove(a.id, displayName(a.user), a.active)} />
        ))}
      </div>
      <button type="button" onClick={onAdd}
        style={{ ...SECONDARY_STYLE, height: 44, width: "100%", border: "1px dashed var(--border)",
          background: "none" }}>
        Ajouter un compte
      </button>
      <PanelFooter manage={manage} onToggleManage={onToggleManage} />
    </>
  );
}

function PanelHeader({ manage, onClose }: { manage: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ ...TITLE_STYLE, textAlign: "left", fontSize: 20 }}>
          {manage ? "Gérer les comptes" : "Changer de compte"}
        </h1>
        <span style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)" }}>
          {manage ? "Retire un compte de cet appareil." : "Passe d'un compte à l'autre sans te reconnecter."}
        </span>
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer (Échap)"
        style={{ ...SECONDARY_STYLE, width: 32, height: 32, padding: 0, background: "none" }}>×</button>
    </div>
  );
}

function PanelFooter({ manage, onToggleManage }: { manage: boolean; onToggleManage: () => void }): React.JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
        Les jetons restent dans le trousseau du système.
      </span>
      <button type="button" onClick={onToggleManage}
        style={{ ...SECONDARY_STYLE, background: manage ? "var(--accent)" : undefined,
          color: manage ? "#fff" : undefined }}>
        {manage ? "Terminé" : "Gérer"}
      </button>
    </div>
  );
}
