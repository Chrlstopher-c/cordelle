// Page « Voix et vidéo » : micro et sortie (enumerateDevices), vumètre en direct, volumes, suppression du bruit.
import { EngineDevices } from "./EngineDevices";
import { playBeep } from "./audio-beep";
import { Card, Row, Slider, Toggle } from "./controls";
import { usePrefs } from "./local-prefs";
import { useAudioDevices } from "./use-audio-devices";
import { useMicMeter } from "./use-mic-meter";

function DeviceSelect({ label, value, devices, onChange }: {
  label: string; value: string; devices: MediaDeviceInfo[]; onChange: (id: string) => void;
}): React.JSX.Element {
  return (
    <select className="st-input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Par défaut</option>
      {devices.map((d, i) => (
        <option key={d.deviceId} value={d.deviceId}>{d.label || `Périphérique ${i + 1}`}</option>
      ))}
    </select>
  );
}

function micHint(error: string | null, granted: boolean): string {
  if (error) return error;
  return granted ? "Parle pour voir le niveau." : "L'accès au micro est nécessaire.";
}

function Meter({ level }: { level: number }): React.JSX.Element {
  return (
    <div className="st-meter" role="meter" aria-label="Niveau du micro" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(level * 100)}>
      <div style={{ width: `${level * 100}%` }} />
    </div>
  );
}

export function VoicePage(): React.JSX.Element {
  const voice = usePrefs((s) => s.voice);
  const setVoice = usePrefs((s) => s.setVoice);
  const devices = useAudioDevices();
  const mic = useMicMeter({
    enabled: devices.granted,
    deviceId: voice.inputId,
    noiseSuppression: voice.noiseSuppression,
    gainPct: voice.inputVolume,
  });
  return (
    <>
      <h1>Voix et vidéo</h1>
      <div className="st-sub">« En appel » choisit ce que le vocal utilise ; « Test » sert à vérifier le micro et la sortie.</div>
      <EngineDevices />
      <Card title="Test du micro">
        <Row title="Micro à tester" hint="Vumètre et test de sortie ci-dessous.">
          <DeviceSelect label="Périphérique d'entrée" value={voice.inputId} devices={devices.inputs}
            onChange={(inputId) => setVoice({ inputId })} />
        </Row>
        <Row title="Niveau du micro" hint={micHint(mic.error, devices.granted)}>
          {devices.granted
            ? <Meter level={mic.level} />
            : <button className="btn-ghost" onClick={() => void devices.requestAccess()}>Autoriser le micro</button>}
        </Row>
        <Row title="Volume d'entrée" hint="Gain appliqué au micro.">
          <Slider label="Volume d'entrée" value={voice.inputVolume} min={0} max={200} step={5} unit=" %"
            onChange={(inputVolume) => setVoice({ inputVolume })} />
        </Row>
        <Row title="Suppression du bruit" hint="Filtre le bruit de fond côté navigateur."
          changed={!voice.noiseSuppression}>
          <Toggle label="Suppression du bruit" on={voice.noiseSuppression}
            onChange={(noiseSuppression) => setVoice({ noiseSuppression })} />
        </Row>
      </Card>
      <Card title="Test de la sortie">
        <Row title="Périphérique de sortie" hint="Haut-parleurs ou casque.">
          <DeviceSelect label="Périphérique de sortie" value={voice.outputId} devices={devices.outputs}
            onChange={(outputId) => setVoice({ outputId })} />
        </Row>
        <Row title="Volume de sortie" hint="Volume des voix et des sons.">
          <Slider label="Volume de sortie" value={voice.outputVolume} min={0} max={200} step={5} unit=" %"
            onChange={(outputVolume) => setVoice({ outputVolume })} />
        </Row>
        <Row title="Tester la sortie" hint="Joue un bip sur le périphérique choisi.">
          <button className="btn-ghost"
            onClick={() => playBeep(voice.outputVolume, voice.outputId)}>Jouer un bip</button>
        </Row>
      </Card>
    </>
  );
}
