// Onglet « QR code » : code à scanner avec l'app Discord, compte scanné, code expiré, échec.
import { Avatar } from "../../shared/ui/Avatar";
import { CTA_STYLE, MUTED_STYLE, TITLE_STYLE } from "./access-styles";
import { displayName } from "./access-user";
import { useQrLogin, type QrView } from "./use-qr-login";

const CODE_PX = 180;

const BOX_STYLE: React.CSSProperties = {
  width: CODE_PX,
  height: CODE_PX,
  borderRadius: "var(--r-lg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-frame)",
  boxSizing: "border-box",
};

export function QrLogin({ onDone }: { onDone: (accountId: string) => void }): React.JSX.Element {
  const { view, restart } = useQrLogin(onDone);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <QrFrame view={view} />
      <QrCaption view={view} onRestart={restart} />
    </div>
  );
}

function QrFrame({ view }: { view: QrView }): React.JSX.Element {
  if (view.kind === "ready") {
    return (
      <img src={view.image} alt="QR code de connexion" width={CODE_PX} height={CODE_PX}
        style={{ borderRadius: "var(--r-lg)", background: "#fff", padding: 12, boxSizing: "border-box" }} />
    );
  }
  if (view.kind === "scanned") {
    return (
      <div style={BOX_STYLE}>
        <Avatar id={view.user.id} name={displayName(view.user)} url={view.user.avatar_url} size={96} />
      </div>
    );
  }
  return <div style={BOX_STYLE} aria-hidden />;
}

interface Caption {
  title: string;
  text?: string;
  retry?: string;
}

function captionFor(view: QrView): Caption {
  switch (view.kind) {
    case "loading":
      return { title: "Connexion par QR code", text: "Préparation du code…" };
    case "ready":
      return {
        title: "Connexion par QR code",
        text: "Scanne-le avec l'app mobile, depuis Réglages › Scanner un QR code.",
      };
    case "scanned":
      return { title: displayName(view.user), text: "Valide sur ton téléphone." };
    case "expired":
      return { title: "Code expiré", retry: "Nouveau code" };
    case "cancelled":
      return { title: "Connexion annulée", retry: "Nouveau code" };
    case "failed":
      return { title: "Échec de la connexion", text: view.message, retry: "Réessayer" };
  }
}

function QrCaption({ view, onRestart }: { view: QrView; onRestart: () => void }): React.JSX.Element {
  const copy = captionFor(view);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <h2 style={{ ...TITLE_STYLE, fontSize: 19 }}>{copy.title}</h2>
      {copy.text && <p style={MUTED_STYLE}>{copy.text}</p>}
      {copy.retry && (
        <button type="button" onClick={onRestart}
          style={{ ...CTA_STYLE, width: "auto", padding: "0 18px", height: 36, fontSize: 13.5 }}>
          {copy.retry}
        </button>
      )}
    </div>
  );
}
