// Barre de titre maison (fenêtre sans décoration) : zone de glisser, recherche Ctrl K, boutons de fenêtre.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNav } from "../../shared/data/nav-store";

const win = (): ReturnType<typeof getCurrentWindow> => getCurrentWindow();

export function Titlebar({ label }: { label?: string }): React.JSX.Element {
  const openOverlay = useNav((s) => s.openOverlay);
  return (
    <header className="tb">
      <div className="tb-drag" data-tauri-drag-region onDoubleClick={() => void win().toggleMaximize()}>
        {label ? (
          <span style={{ flex: 1, paddingLeft: 16, fontSize: "var(--fs-meta)", color: "var(--text-faint)" }}>{label}</span>
        ) : (
          <button className="tb-search" onClick={() => openOverlay({ kind: "palette" })}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <span style={{ flex: 1, textAlign: "left" }}>Rechercher ou aller à un salon, une personne</span>
            <kbd>Ctrl K</kbd>
          </button>
        )}
      </div>
      <button className="tb-btn" aria-label="Réduire" onClick={() => void win().minimize()}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 12h14" /></svg>
      </button>
      <button className="tb-btn" aria-label="Agrandir" onClick={() => void win().toggleMaximize()}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
      </button>
      <button className="tb-btn close" aria-label="Fermer la fenêtre" onClick={() => void win().close()}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </header>
  );
}
