// Barre d'actions au survol d'un message : réagir (choix rapide), répondre, modifier et supprimer (ses messages).
import { useState } from "react";

const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];
const I = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

interface Props {
  mine: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MessageTools({ mine, onReact, onReply, onEdit, onDelete }: Props): React.JSX.Element {
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={`msg-tools${picker || confirm ? " open" : ""}`} onMouseLeave={() => { setPicker(false); setConfirm(false); }}>
      {picker && (
        <div className="quick-react">
          {QUICK.map((e) => <button key={e} onClick={() => { onReact(e); setPicker(false); }}>{e}</button>)}
        </div>
      )}
      {confirm ? (
        <>
          <span style={{ fontSize: 13, padding: "0 6px", color: "var(--text-secondary)" }}>Supprimer ?</span>
          <button className="tool-txt danger" onClick={onDelete}>Oui</button>
          <button className="tool-txt" onClick={() => setConfirm(false)}>Non</button>
        </>
      ) : (
        <>
          <button className="ib" aria-label="Ajouter une réaction" onClick={() => setPicker((p) => !p)}>
            <svg {...I}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>
          </button>
          <button className="ib" aria-label="Répondre" onClick={onReply}>
            <svg {...I}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v4" /></svg>
          </button>
          {mine && (
            <button className="ib" aria-label="Modifier" onClick={onEdit}>
              <svg {...I}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
            </button>
          )}
          {mine && (
            <button className="ib" aria-label="Supprimer" style={{ color: "var(--danger-text)" }}
              onClick={(e) => (e.shiftKey ? onDelete() : setConfirm(true))}>
              <svg {...I}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}
