// Palette Ctrl K (maquette Palette) : aller à un serveur, un salon chargé ou un MP ; flèches + Entrée, Échap ferme.
import { useEffect, useMemo, useState } from "react";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import "./home.css";

interface Item { key: string; label: string; ctx: string; go: () => void }

function useItems(): Item[] {
  const guilds = useEngine((s) => s.guilds);
  const channels = useEngine((s) => s.channelsByGuild);
  const dms = useEngine((s) => s.dms);
  const nav = useNav();
  return useMemo(() => {
    const out: Item[] = [];
    for (const d of dms) {
      const label = d.name || d.recipients.map((r) => r.global_name ?? r.username).join(", ");
      out.push({ key: d.id, label: `@${label}`, ctx: "Message privé", go: () => nav.go({ kind: "dms", channelId: d.id }) });
    }
    for (const g of guilds) {
      out.push({ key: g.id, label: g.name, ctx: "Serveur", go: () => nav.openGuild(g.id) });
      for (const c of channels[g.id] ?? []) {
        if (c.kind === "category") continue;
        out.push({ key: c.id, label: `# ${c.name}`, ctx: g.name, go: () => nav.openChannel(g.id, c.id) });
      }
    }
    return out;
  }, [guilds, channels, dms, nav]);
}

export function CommandPalette({ onClose }: { onClose: () => void }): React.JSX.Element {
  const all = useItems();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const items = useMemo(() => {
    const n = q.toLowerCase().replace(/^[#@]/, "");
    return (n ? all.filter((x) => x.label.toLowerCase().includes(n)) : all).slice(0, 50);
  }, [all, q]);
  useEffect(() => setI(0), [q]);

  const choose = (x: Item | undefined): void => { if (x) { x.go(); onClose(); } };
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
    else if (e.key === "Enter") choose(items[i]);
  };

  return (
    <div className="pal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pal" role="dialog" aria-label="Aller à">
        <input autoFocus value={q} placeholder="Où veux-tu aller ?" onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        <div className="pal-list" role="listbox">
          {items.map((x, n) => (
            <button key={x.key} role="option" aria-selected={n === i} className={`pal-item${n === i ? " on" : ""}`}
              onMouseEnter={() => setI(n)} onClick={() => choose(x)}>
              <span>{x.label}</span><span className="ctx">{x.ctx}</span>
            </button>
          ))}
          {items.length === 0 && <div className="pal-item">Aucun résultat</div>}
        </div>
        <div className="pal-foot">↑↓ pour naviguer · Entrée pour ouvrir · Échap pour fermer</div>
      </div>
    </div>
  );
}

/** Ctrl K (ou Cmd K) ouvre la palette depuis n'importe où. */
export function usePaletteShortcut(): void {
  const openOverlay = useNav((s) => s.openOverlay);
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openOverlay({ kind: "palette" }); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [openOverlay]);
}
