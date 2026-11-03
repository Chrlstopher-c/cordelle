// Périphériques audio (micro et sortie) via enumerateDevices ; l'accès micro est demandé à la demande.
import { useCallback, useEffect, useState } from "react";

export interface AudioDevices {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
  granted: boolean;
  requestAccess: () => Promise<void>;
}

export function useAudioDevices(): AudioDevices {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [granted, setGranted] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setInputs(list.filter((d) => d.kind === "audioinput"));
      setOutputs(list.filter((d) => d.kind === "audiooutput"));
      setGranted(list.some((d) => d.kind === "audioinput" && d.label !== ""));
    } catch (e) {
      console.error("liste des périphériques audio impossible", e);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = (): void => void refresh();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, [refresh]);

  const requestAccess = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.error("accès au micro refusé", e);
    }
    await refresh();
  }, [refresh]);

  return { inputs, outputs, granted, requestAccess };
}
