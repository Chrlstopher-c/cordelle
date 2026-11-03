// Page « Voix et vidéo » : périphériques PipeWire du moteur vocal, test du micro (s'écouter, niveau, seuil), traitement.
import { useAudio } from "../voice/audio-settings";
import { Card, Row, Slider, Toggle } from "./controls";
import { DeviceTiles, useEngineDevices } from "./voice-devices";
import { MicTest } from "./voice-mic-test";

const pct = (v: number): number => Math.round(v * 100);

export function VoicePage(): React.JSX.Element {
  const settings = useAudio((s) => s.settings);
  const patch = useAudio((s) => s.patch);
  const { devices, error, reload } = useEngineDevices();
  return (
    <>
      <h1>Voix et vidéo</h1>
      <div className="st-sub">
        Appliqué tout de suite, même pendant un appel.
        <button onClick={reload}>Actualiser les périphériques</button>
      </div>
      {error && <div className="vx-error">{error}</div>}
      <section className="st-sec">
        <h3>Entrée</h3>
        {devices && <DeviceTiles kind="input" list={devices.inputs} value={settings.input_device}
          onPick={(input_device) => void patch({ input_device })} />}
        <MicTest />
        <Card>
          <Row title="Sensibilité automatique" hint="Le seuil suit le bruit de ta pièce. Désactivé, il reste où tu le poses.">
            <Toggle label="Sensibilité automatique" on={settings.vad_auto} onChange={(vad_auto) => void patch({ vad_auto })} />
          </Row>
          <Row title="Réduction de bruit" hint="Retire clavier, ventilateur et souffle avant l'envoi (RNNoise).">
            <Toggle label="Réduction de bruit" on={settings.noise_suppression}
              onChange={(noise_suppression) => void patch({ noise_suppression })} />
          </Row>
          <Row title="Volume du micro">
            <Slider label="Volume du micro" value={pct(settings.input_volume)} min={0} max={200} step={5} unit=" %"
              onChange={(v) => void patch({ input_volume: v / 100 })} />
          </Row>
        </Card>
      </section>
      <section className="st-sec">
        <h3>Sortie</h3>
        {devices && <DeviceTiles kind="output" list={devices.outputs} value={settings.output_device}
          onPick={(output_device) => void patch({ output_device })} />}
        <Card>
          <Row title="Volume des voix">
            <Slider label="Volume des voix" value={pct(settings.output_volume)} min={0} max={200} step={5} unit=" %"
              onChange={(v) => void patch({ output_volume: v / 100 })} />
          </Row>
        </Card>
      </section>
    </>
  );
}
