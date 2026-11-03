// Vumètre du micro en direct : flux du périphérique choisi → AnalyserNode → niveau 0..1 à chaque image.
import { useEffect, useRef, useState } from "react";

const METER_SCALE = 4;

interface MeterOptions {
  enabled: boolean;
  deviceId: string;
  noiseSuppression: boolean;
  gainPct: number;
}

async function openMeter(
  deviceId: string,
  noiseSuppression: boolean,
  getGain: () => number,
  onLevel: (level: number) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, noiseSuppression },
  });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let frame = 0;
  const tick = (): void => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const x of samples) sum += x * x;
    onLevel(Math.min(1, Math.sqrt(sum / samples.length) * METER_SCALE * getGain()));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(frame);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}

/** Niveau du micro (0..1) ; le volume d'entrée s'applique au vumètre sans rouvrir le flux. */
export function useMicMeter(opts: MeterOptions): { level: number; error: string | null } {
  const { enabled, deviceId, noiseSuppression, gainPct } = opts;
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const gainRef = useRef(gainPct);

  useEffect(() => {
    gainRef.current = gainPct;
  }, [gainPct]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let stop: (() => void) | null = null;
    setError(null);
    openMeter(deviceId, noiseSuppression, () => gainRef.current / 100, (v) => {
      if (alive) setLevel(v);
    })
      .then((close) => {
        if (alive) stop = close;
        else close();
      })
      .catch((e: unknown) => {
        console.error("vumètre du micro impossible", e);
        if (alive) setError("Micro indisponible.");
      });
    return () => {
      alive = false;
      stop?.();
      setLevel(0);
    };
  }, [enabled, deviceId, noiseSuppression]);

  return { level, error };
}
