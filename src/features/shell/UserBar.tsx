// Ligne de profil 52 px : avatar + statut, menu de statut, micro, son, réglages.
import { useEffect, useRef, useState } from "react";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";

const STATUSES = [
  { id: "online", label: "En ligne", hint: "", color: "var(--success)" },
  { id: "idle", label: "Inactif", hint: "", color: "#e0a63a" },
  { id: "dnd", label: "Ne pas déranger", hint: "Aucune notification", color: "var(--danger)" },
  { id: "invisible", label: "Invisible", hint: "Tu apparais hors ligne", color: "var(--text-faint)" },
];

export function UserBar(): React.JSX.Element | null {
  const account = useActiveAccount();
  const openOverlay = useNav((s) => s.openOverlay);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("online");
  const [mic, setMic] = useState(true);
  const [sound, setSound] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent): void => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", close); };
  }, [open]);

  if (!account) return null;
  const u = account.user;
  const name = u.global_name ?? u.username;
  const current = STATUSES.find((s) => s.id === status) ?? STATUSES[0];

  return (
    <div className="ub" ref={ref}>
      <button className="ub-me" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span style={{ position: "relative" }}>
          <Avatar id={u.id} name={name} url={u.avatar_url} size={32} />
          <span className="ub-dot" style={{ background: current.color }} />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, fontSize: "var(--fs-small)" }}>{name}</span>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{current.label}</span>
        </span>
      </button>
      <button className={`ib${mic ? "" : " off"}`} aria-pressed={!mic} aria-label="Couper le micro" onClick={() => setMic((m) => !m)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />{!mic && <path d="M3 3l18 18" />}</svg>
      </button>
      <button className={`ib${sound ? "" : " off"}`} aria-pressed={!sound} aria-label="Couper le son" onClick={() => setSound((m) => !m)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" />{!sound && <path d="M3 3l18 18" />}</svg>
      </button>
      <button className="ib" aria-label="Réglages" onClick={() => openOverlay({ kind: "settings", page: "compte" })}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
      </button>
      {open && (
        <div className="menu" role="menu" style={{ left: 8, bottom: 58, width: 272 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 10px" }}>
            <Avatar id={u.id} name={name} url={u.avatar_url} size={40} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600 }}>{name}</span>
              <span style={{ fontSize: "var(--fs-meta)", color: "var(--text-faint)" }}>{u.username}</span>
            </div>
          </div>
          <div className="menu-sep" />
          {STATUSES.map((s) => (
            <button key={s.id} className="menu-item" role="menuitemradio" aria-checked={s.id === status}
              onClick={() => { setStatus(s.id); setOpen(false); }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 500 }}>{s.label}</span>
                {s.hint && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{s.hint}</span>}
              </span>
            </button>
          ))}
          <div className="menu-sep" />
          <button className="menu-item" onClick={() => { setOpen(false); openOverlay({ kind: "settings", page: "profil" }); }}>Modifier le profil</button>
          <button className="menu-item" onClick={() => { setOpen(false); openOverlay({ kind: "accounts" }); }}>Changer de compte</button>
        </div>
      )}
    </div>
  );
}
