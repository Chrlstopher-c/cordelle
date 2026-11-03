// Kit de réglages (HANDOFF « Réglages ») : carte, ligne ≥ 64 px, interrupteur 40×22, segmenté, curseur avec valeur.

export function Card({ title, children }: { title?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="st-sec">
      {title && <h3>{title}</h3>}
      <div className="st-card">{children}</div>
    </section>
  );
}

export function Row({ title, hint, changed, children }: {
  title: string; hint?: string; changed?: boolean; children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="st-row">
      <div className="st-txt">
        <span className="st-t">{title}{changed && <span className="st-dot" title="Modifié" />}</span>
        {hint && <span className="st-h">{hint}</span>}
      </div>
      <div className="st-ctl">{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }): React.JSX.Element {
  return <button role="switch" aria-checked={on} aria-label={label} className={`st-toggle${on ? " on" : ""}`} onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}): React.JSX.Element {
  return (
    <div className="st-seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ value, min, max, step = 1, unit, onChange, label }: {
  value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; label: string;
}): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="st-slider">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
        style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, var(--surface-selected) ${pct}%)` }}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span>{value}{unit}</span>
    </div>
  );
}
