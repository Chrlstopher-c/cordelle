// Confirmation d'une action destructrice (supprimer, quitter, bloquer) : modale courte, Échap annule, Entrée confirme.
import { useEffect } from "react";
import { create } from "zustand";

interface Ask { title: string; body: string; action: string; run: () => void }
interface ConfirmState { ask: Ask | null; confirm: (a: Ask) => void; close: () => void }

export const useConfirm = create<ConfirmState>((set) => ({
  ask: null,
  confirm: (ask) => set({ ask }),
  close: () => set({ ask: null }),
}));

export function ConfirmLayer(): React.JSX.Element | null {
  const ask = useConfirm((s) => s.ask);
  const close = useConfirm((s) => s.close);
  useEffect(() => {
    if (!ask) return;
    const k = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
      if (e.key === "Enter") { close(); ask.run(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [ask, close]);
  if (!ask) return null;
  return (
    <div className="cf-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="cf-box" role="alertdialog" aria-label={ask.title}>
        <h2>{ask.title}</h2>
        <p>{ask.body}</p>
        <div className="cf-actions">
          <button className="cf-cancel" onClick={close}>Annuler</button>
          <button className="cf-ok" autoFocus onClick={() => { close(); ask.run(); }}>{ask.action}</button>
        </div>
      </div>
    </div>
  );
}
