// Ligne d'un compte : avatar, état de connexion, puis « Actif », « Basculer » ou « Retirer » selon le mode.
import type { AccountSummary, ConnectionState } from "../../contract/bindings";
import { Avatar } from "../../shared/ui/Avatar";
import { SECONDARY_STYLE } from "./access-styles";
import { displayName } from "./access-user";

const DOT: Record<ConnectionState, string> = {
  ready: "var(--success)",
  connecting: "#e0a63a",
  resuming: "#e0a63a",
  failed: "var(--danger)",
  disconnected: "var(--text-faint)",
};

const STATE_TEXT: Record<ConnectionState, string> = {
  ready: "Connecté",
  connecting: "Connexion…",
  resuming: "Reconnexion…",
  failed: "Hors ligne",
  disconnected: "Déconnecté",
};

export interface AccountRowProps {
  account: AccountSummary;
  connection: ConnectionState | undefined;
  manage: boolean;
  onPick: () => void;
  onRemove: () => void;
}

export function AccountRow({ account, connection, manage, onPick, onRemove }: AccountRowProps): React.JSX.Element {
  const state = connection ?? account.connection;
  const name = displayName(account.user);
  return (
    <div role="listitem" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: "var(--r-md)", background: account.active ? "var(--surface-frame)" : "none" }}>
      <span style={{ position: "relative", display: "flex" }}>
        <Avatar id={account.id} name={name} url={account.user.avatar_url} size={40} />
        <span style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: "50%",
          background: DOT[state], border: "3px solid var(--surface-raised)", boxSizing: "border-box" }} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{STATE_TEXT[state]}</span>
      </span>
      {manage ? (
        <button type="button" onClick={onRemove} style={{ ...SECONDARY_STYLE, color: "var(--danger-text)" }}>
          Retirer
        </button>
      ) : account.active ? (
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--success-text)" }}>Actif</span>
      ) : (
        <button type="button" onClick={onPick} style={SECONDARY_STYLE}>Basculer</button>
      )}
    </div>
  );
}
