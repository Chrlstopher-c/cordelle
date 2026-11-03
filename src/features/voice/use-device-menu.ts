// Menu de périphérique d'un bouton de la barre d'appel : liste chargée à l'ouverture, fermée par clic dehors ou Échap.
import { useEffect, useRef, useState, type RefObject } from "react";
import { voice } from "./api";
import { useVoiceStore } from "./voice-store";
import type { AudioDevice, AudioDevices } from "./types";

export type DeviceKind = "input" | "output";

export function defaultOf(list: AudioDevice[]): string | null {
  return list.find((d) => d.is_default)?.id ?? list[0]?.id ?? null;
}

function listOf(devs: AudioDevices | null, kind: DeviceKind): AudioDevice[] {
  if (!devs) return [];
  return kind === "input" ? devs.inputs : devs.outputs;
}

function useCloseOnOutside(open: boolean, ref: RefObject<HTMLDivElement | null>, close: () => void): void {
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

/** Enregistre le choix (micro ou sortie) avec l'autre périphérique tel qu'il est actuellement. */
async function commitPick(kind: DeviceKind, id: string, devs: AudioDevices): Promise<void> {
  const { chosen, setChosen } = useVoiceStore.getState();
  const next = kind === "input"
    ? { input: id, output: chosen.output ?? defaultOf(devs.outputs) }
    : { input: chosen.input ?? defaultOf(devs.inputs), output: id };
  const r = await voice.setDevices(next.input, next.output);
  if (r.ok) setChosen(next);
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
  const chosenId = useVoiceStore((s) => (kind === "input" ? s.chosen.input : s.chosen.output));
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
    if (devs) await commitPick(kind, id, devs);
  };

  return { ref, open, list, selected: chosenId ?? defaultOf(list), toggle, pick };
}
