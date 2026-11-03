// Menu de périphérique d'un bouton de la barre d'appel : liste chargée à l'ouverture, fermée par clic dehors ou Échap.
import { useEffect, useRef, useState, type RefObject } from "react";
import { voice } from "./api";
import { useAudio } from "./audio-settings";
import type { AudioDevice, AudioDevices } from "./types";

export type DeviceKind = "input" | "output";

export function defaultOf(list: AudioDevice[]): string | null {
  return list.find((d) => d.is_default)?.id ?? list[0]?.id ?? null;
}

function listOf(devs: AudioDevices | null, kind: DeviceKind): AudioDevice[] {
  if (!devs) return [];
  return kind === "input" ? devs.inputs : devs.outputs;
}

export function useCloseOnOutside(open: boolean, ref: RefObject<HTMLDivElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onEvent = (e: MouseEvent | KeyboardEvent): void => {
      const inside = e.target instanceof Node && (ref.current?.contains(e.target) ?? false);
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !inside) close();
    };
    window.addEventListener("mousedown", onEvent);
    window.addEventListener("keydown", onEvent);
    return () => {
      window.removeEventListener("mousedown", onEvent);
      window.removeEventListener("keydown", onEvent);
    };
  }, [open, ref, close]);
}

export interface DeviceMenuState {
  ref: RefObject<HTMLDivElement | null>;
  open: boolean;
  list: AudioDevice[];
  selected: string | null;
  toggle: () => Promise<void>;
  pick: (id: string) => Promise<void>;
}

export function useDeviceMenu(kind: DeviceKind): DeviceMenuState {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [devs, setDevs] = useState<AudioDevices | null>(null);
  const chosenId = useAudio((s) => (kind === "input" ? s.settings.input_device : s.settings.output_device));
  const list = listOf(devs, kind);
  const close = (): void => setOpen(false);
  useCloseOnOutside(open, ref, close);

  const toggle = async (): Promise<void> => {
    if (open) return close();
    const r = await voice.devices();
    if (r.ok) setDevs(r.data);
    setOpen(true);
  };

  const pick = async (id: string): Promise<void> => {
    close();
    await useAudio.getState().patch(kind === "input" ? { input_device: id } : { output_device: id });
  };

  return { ref, open, list, selected: chosenId ?? defaultOf(list), toggle, pick };
}
