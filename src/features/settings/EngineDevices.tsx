// Périphériques utilisés en appel par le moteur vocal (cpal) : ceux que Cordelle ouvre vraiment pendant un vocal.
import { useEffect, useState } from "react";
import type { AudioDevice, AudioDevices } from "../voice/types";
import { voice } from "../voice/api";
import { useVoiceStore } from "../voice/voice-store";
import { Card, Row } from "./controls";

const defaultOf = (list: AudioDevice[]): string | null => list.find((d) => d.is_default)?.id ?? list[0]?.id ?? null;

function Select({ label, list, value, onChange }: {
  label: string; list: AudioDevice[]; value: string | null; onChange: (id: string) => void;
}): React.JSX.Element {
  return (
    <select className="st-input" aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {list.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_default ? " (par défaut)" : ""}</option>)}
    </select>
  );
}

export function EngineDevices(): React.JSX.Element {
  const [devs, setDevs] = useState<AudioDevices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = useVoiceStore((s) => s.chosen);
  const setChosen = useVoiceStore((s) => s.setChosen);
  useEffect(() => {
    void voice.devices().then((r) => (r.ok ? setDevs(r.data) : setError(r.error)));
  }, []);
  if (!devs) return <Card title="En appel"><Row title="Périphériques du moteur vocal" hint={error ?? "Chargement…"} /></Card>;
  const input = chosen.input ?? defaultOf(devs.inputs);
  const output = chosen.output ?? defaultOf(devs.outputs);
  const commit = (next: { input: string | null; output: string | null }): void => {
    void voice.setDevices(next.input, next.output).then((r) => (r.ok ? setChosen(next) : setError(r.error)));
  };
  return (
    <Card title="En appel">
      <Row title="Micro utilisé en vocal" hint={error ?? "Appliqué tout de suite, même pendant un appel."}>
        <Select label="Micro en vocal" list={devs.inputs} value={input} onChange={(id) => commit({ input: id, output })} />
      </Row>
      <Row title="Sortie utilisée en vocal">
        <Select label="Sortie en vocal" list={devs.outputs} value={output} onChange={(id) => commit({ input, output: id })} />
      </Row>
    </Card>
  );
}
