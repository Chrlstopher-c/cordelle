// Pile des notifications en bas de la fenêtre, au-dessus des modales.
import { useToasts, type ToastItem } from "./toast";

export function Toasts(): React.JSX.Element | null {
  const items = useToasts((s) => s.items);
  if (items.length === 0) return null;
  return (
    <div aria-live="polite" style={{ position: "fixed", left: 0, right: 0, bottom: 28, display: "flex",
      flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", zIndex: 120 }}>
      {items.map((t) => <ToastCard key={t.id} item={t} />)}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }): React.JSX.Element {
  const dismiss = useToasts((s) => s.dismiss);
  const run = (): void => {
    item.action?.run();
    dismiss(item.id);
  };
  return (
    <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 8px 10px 14px",
      borderRadius: "var(--r-md)", background: "var(--surface-menu)", boxShadow: "0 12px 32px rgba(0,0,0,.45)",
      fontSize: "var(--fs-small)", color: "var(--text)" }}>
      <span>{item.text}</span>
      {item.action && (
        <button type="button" onClick={run} style={{ height: 28, padding: "0 12px", borderRadius: "var(--r-sm)",
          border: 0, background: "none", color: "var(--accent-text)", fontFamily: "inherit", fontWeight: 600,
          fontSize: 13, cursor: "pointer" }}>
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={() => dismiss(item.id)} aria-label="Fermer la notification"
        style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", border: 0, background: "none",
          color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>
        ×
      </button>
    </div>
  );
}
