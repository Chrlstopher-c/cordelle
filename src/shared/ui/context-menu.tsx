// Menu contextuel unique de l'app : ouvert au clic droit à la position de la souris, recalé dans la fenêtre,
// fermé par un clic dehors, Échap, la molette ou un choix. Flèches + Entrée au clavier.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";

export type MenuItem =
  | { kind: "item"; label: string; run: () => void; danger?: boolean; hint?: string }
  | { kind: "sep" };

interface MenuState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  open: (e: React.MouseEvent, items: MenuItem[]) => void;
  close: () => void;
}

export const useContextMenu = create<MenuState>((set) => ({
  menu: null,
  open: (e, items) => {
    e.preventDefault();
    e.stopPropagation();
    if (items.length > 0) set({ menu: { x: e.clientX, y: e.clientY, items } });
  },
  close: () => set({ menu: null }),
}));

export const item = (label: string, run: () => void, extra?: { danger?: boolean; hint?: string }): MenuItem =>
  ({ kind: "item", label, run, ...extra });
export const sep: MenuItem = { kind: "sep" };

/** Retire les séparateurs en tête, en fin et doublés. */
function tidy(items: MenuItem[]): MenuItem[] {
  return items.filter((it, i, a) => it.kind !== "sep" || (i > 0 && i < a.length - 1 && a[i - 1].kind !== "sep"));
}

function useDismiss(close: () => void, ref: React.RefObject<HTMLDivElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const down = (e: MouseEvent): void => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent): void => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", down, true);
    window.addEventListener("keydown", key);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", down, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("wheel", close);
      window.removeEventListener("blur", close);
    };
  }, [active, close, ref]);
}

export function ContextMenuLayer(): React.JSX.Element | null {
  const menu = useContextMenu((s) => s.menu);
  const close = useContextMenu((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [focus, setFocus] = useState(-1);
  useDismiss(close, ref, !!menu);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(menu.x, window.innerWidth - r.width - 8), y: Math.min(menu.y, window.innerHeight - r.height - 8) });
    setFocus(-1);
    ref.current.focus();
  }, [menu]);

  if (!menu) return null;
  const items = tidy(menu.items);
  const actionable = items.map((it, i) => (it.kind === "item" ? i : -1)).filter((i) => i >= 0);
  const run = (it: MenuItem): void => { if (it.kind === "item") { close(); it.run(); } };
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
    e.preventDefault();
    if (e.key === "Enter") { const it = items[focus]; if (it) run(it); return; }
    const at = actionable.indexOf(focus);
    const next = e.key === "ArrowDown" ? actionable[(at + 1) % actionable.length] : actionable[(at - 1 + actionable.length) % actionable.length];
    setFocus(next ?? -1);
  };
  return (
    <div ref={ref} className="ctx-menu" role="menu" tabIndex={-1} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos.x, top: pos.y }}>
      {items.map((it, i) => it.kind === "sep" ? <div key={i} className="ctx-sep" /> : (
        <button key={i} role="menuitem" className={`ctx-item${it.danger ? " danger" : ""}${focus === i ? " on" : ""}`}
          onMouseEnter={() => setFocus(i)} onClick={() => run(it)}>
          <span>{it.label}</span>{it.hint && <span className="ctx-hint">{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}
