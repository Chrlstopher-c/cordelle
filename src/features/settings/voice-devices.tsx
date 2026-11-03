// Liste des périphériques PipeWire en tuiles (noms du panneau son du système), « Suivre le système » en tête.
import { useEffect, useState } from "react";
import { voice } from "../voice/api";
import { CheckIcon, MicIcon, SpeakerIcon } from "../voice/icons";
import type { AudioDevice, AudioDevices } from "../voice/types";

export function useEngineDevices(): { devices: AudioDevices | null; error: string | null; reload: () => void } {
  const [devices, setDevices] = useState<AudioDevices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = (): void => {
    void voice.devices().then((r) => (r.ok ? (setDevices(r.data), setError(null)) : setError(r.error)));
  };
  useEffect(reload, []);
  return { devices, error, reload };
}

function Tile({ on, icon, name, sub, onPick }: {
  on: boolean; icon: React.ReactNode; name: string; sub: string | null; onPick: () => void;
}): React.JSX.Element {
  return (
    <button role="radio" aria-checked={on} className={`vx-dev${on ? " on" : ""}`} onClick={onPick}>
      <span className="vx-dev-ic">{icon}</span>
      <span className="vx-dev-txt">
        <span className="vx-dev-name">{name}</span>
        {sub && <span className="vx-dev-sub">{sub}</span>}
      </span>
      <span className="vx-dev-check" aria-hidden><CheckIcon size={14} /></span>
    </button>
  );
}

export function DeviceTiles({ kind, list, value, onPick }: {
  kind: "input" | "output"; list: AudioDevice[]; value: string | null; onPick: (id: string | null) => void;
}): React.JSX.Element {
  const icon = kind === "input" ? <MicIcon size={17} /> : <SpeakerIcon size={17} />;
  const system = list.find((d) => d.is_default)?.name ?? null;
  const known = value === null || list.some((d) => d.id === value);
  return (
    <div className="vx-devs" role="radiogroup" aria-label={kind === "input" ? "Entrée" : "Sortie"}>
      <Tile on={value === null || !known} icon={icon} name="Suivre le système" sub={system} onPick={() => onPick(null)} />
      {list.map((d) => (
        <Tile key={d.id} on={value === d.id} icon={icon} name={d.name}
          sub={d.is_default ? "Défaut du système" : null} onPick={() => onPick(d.id)} />
      ))}
    </div>
  );
}
