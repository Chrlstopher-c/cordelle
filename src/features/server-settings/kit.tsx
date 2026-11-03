// Kit des réglages du serveur : carte, ligne 64 px, interrupteur, segmenté, barre de modifications, modale, notice.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function Section({ title, children }: { title?: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="ss-sec">
      {title && <h3>{title}</h3>}
      <div className="ss-card">{children}</div>
    </section>
  );
}

export function Row({ title, hint, children }: {
  title: string; hint?: string; children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="ss-row">
      <div className="ss-txt">
        <span className="ss-t">{title}</span>
        {hint && <span className="ss-h">{hint}</span>}
      </div>
      {children && <div className="ss-ctl">{children}</div>}
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled }: {
  on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean;
}): React.JSX.Element {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`ss-toggle${on ? " on" : ""}`} onClick={() => onChange(!on)} />
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label, disabled }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string; disabled?: boolean;
}): React.JSX.Element {
  return (
    <div className="ss-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} disabled={disabled}
          className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SaveBar({ onReset, onSave, busy }: {
  onReset: () => void; onSave: () => void; busy: boolean;
}): React.JSX.Element {
  return (
    <div className="ss-bar" role="status">
      <span>Modifications non enregistrées</span>
      <button type="button" className="ss-btn" onClick={onReset} disabled={busy}>Annuler</button>
      <button type="button" className="ss-btn primary" onClick={onSave} disabled={busy}>Enregistrer</button>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, width = 460 }: {
  title: string; onClose: () => void; children: ReactNode; footer: ReactNode; width?: number;
}): React.JSX.Element {
  useEffect(() => {
    const key = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="ss-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ss-modal" role="dialog" aria-modal="true" aria-label={title} style={{ width }}>
        <div className="ss-modal-body">
          <h2>{title}</h2>
          {children}
        </div>
        <div className="ss-modal-foot">{footer}</div>
      </div>
    </div>
  );
}

export function useFlash(): { message: string | null; flash: (text: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flash = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { message, flash };
}

export function Flash({ message }: { message: string | null }): React.JSX.Element | null {
  return message ? <div className="ss-toast" role="status">{message}</div> : null;
}

export function Notice({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="ss-notice">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="ss-empty">{children}</p>;
}
