// En-tête de l'appel : nom, nombre de personnes, durée et ping ; bascule Focus / Grille quand l'appel est actif.
import { useEffect, useState } from "react";
import type { CallLayout } from "./CallStage";
import { SpeakerIcon } from "./icons";

interface Props {
  name: string;
  count: number;
  ping: number | null;
  since: number | null;
  layout: CallLayout;
  onLayout: (layout: CallLayout) => void;
}

const LAYOUTS: { id: CallLayout; label: string }[] = [
  { id: "focus", label: "Focus" },
  { id: "grid", label: "Grille" },
];

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function Elapsed({ since }: { since: number }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{formatDuration(now - since)}</>;
}

export function CallHeader({ name, count, ping, since, layout, onLayout }: Props): React.JSX.Element {
  const active = since !== null;
  return (
    <header className="call-head">
      <SpeakerIcon size={18} />
      <h1 className="call-title">{name}</h1>
      <span className="call-meta">
        {count} {count === 1 ? "personne" : "personnes"}
        {since !== null && <> · <Elapsed since={since} /></>}
        {ping !== null && ` · ${ping} ms`}
      </span>
      <div className="call-spacer" />
      {active && (
        <div className="seg" role="group" aria-label="Disposition">
          {LAYOUTS.map((l) => (
            <button key={l.id} className={layout === l.id ? "on" : ""} aria-pressed={layout === l.id}
              onClick={() => onLayout(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
