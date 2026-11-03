// Voile de dépôt : indique où les fichiers partiront. Ne capte pas la souris (le dépôt passe par la fenêtre).
interface Props {
  channelName: string | undefined;
}

export function DropOverlay({ channelName }: Props): React.JSX.Element {
  const target = channelName ? `#${channelName}` : "cette conversation";
  return (
    <div className="drop-veil" aria-hidden="true">
      <div className="drop-box">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8C96F5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15V4M7 9l5-5 5 5M4 15v4h16v-4" />
        </svg>
        <span className="drop-title">Dépose pour envoyer dans {target}</span>
        <span className="drop-sub">Tu pourras ajouter un message avant l'envoi. Maj en déposant envoie tout de suite.</span>
      </div>
    </div>
  );
}
