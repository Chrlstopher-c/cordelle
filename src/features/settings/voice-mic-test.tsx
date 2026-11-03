// Test du micro : niveau traité en direct (moteur), seuil de détection réglable en glissant sur la jauge, s'écouter.
import { useEffect, useRef } from "react";
import { useAudio } from "../voice/audio-settings";

const FLOOR_DB = -80;
const pctOf = (db: number): number => Math.min(100, Math.max(0, ((db - FLOOR_DB) / -FLOOR_DB) * 100));
const dbOf = (pct: number): number => Math.round(FLOOR_DB + (pct / 100) * -FLOOR_DB);

function useThresholdDrag(): { ref: React.RefObject<HTMLDivElement | null>; onPointerDown: (e: React.PointerEvent) => void } {
  const ref = useRef<HTMLDivElement>(null);
  const patch = useAudio((s) => s.patch);
  const setFrom = (clientX: number): void => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    void patch({ vad_auto: false, vad_threshold_db: dbOf(((clientX - box.left) / box.width) * 100) });
  };
  const onPointerDown = (e: React.PointerEvent): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFrom(e.clientX);
    const move = (ev: PointerEvent): void => setFrom(ev.clientX);
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return { ref, onPointerDown };
}

export function MicTest(): React.JSX.Element {
  const { settings, level, testing, setTesting } = useAudio();
  const drag = useThresholdDrag();
  useEffect(() => () => void useAudio.getState().setTesting(false), []);
  const threshold = settings.vad_auto && level ? level.threshold_db : settings.vad_threshold_db;
  const open = level?.gate_open ?? false;
  return (
    <div className={`vx-test${testing ? " live" : ""}`}>
      <div className="vx-test-head">
        <button className="vx-test-btn" onClick={() => void setTesting(!testing)}>
          <span className="vx-rec" aria-hidden />{testing ? "Arrêter le test" : "Tester mon micro"}
        </button>
        <span className={`vx-state${open ? " open" : ""}`}>
          {!level ? "Micro au repos" : open ? "Voix transmise" : "Sous le seuil"}
        </span>
      </div>
      <div className="vx-meter" ref={drag.ref} onPointerDown={drag.onPointerDown} role="slider"
        aria-label="Seuil de détection de la voix" aria-valuemin={FLOOR_DB} aria-valuemax={0}
        aria-valuenow={Math.round(threshold)} tabIndex={0}
        onKeyDown={(e) => {
          const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (step) void useAudio.getState().patch({ vad_auto: false, vad_threshold_db: Math.round(threshold) + step });
        }}>
        <div className="vx-meter-mute" style={{ width: `${pctOf(threshold)}%` }} />
        <div className={`vx-meter-fill${open ? " open" : ""}`} style={{ width: `${level ? pctOf(level.level_db) : 0}%` }} />
        <div className={`vx-thumb${settings.vad_auto ? " auto" : ""}`} style={{ left: `${pctOf(threshold)}%` }}>
          <span>{Math.round(threshold)} dB</span>
        </div>
      </div>
      <div className="vx-scale"><span>Silence</span><span>Glisse le curseur : sous lui, rien n'est transmis</span><span>Fort</span></div>
      <p className="vx-hint">
        {testing ? "Tu t'entends dans la sortie choisie, avec la réduction de bruit et le seuil appliqués."
          : "Lance le test pour t'entendre comme les autres t'entendent."}
      </p>
    </div>
  );
}
