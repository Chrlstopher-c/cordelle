// Applique les réglages locaux à la racine : thème (data-theme), accent, taille du texte, densité, zoom, animations.
import { useEffect, useState } from "react";
import { ACCENTS, useSettings } from "./settings-store";

function useSystemDark(): boolean {
  const q = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = (e: MediaQueryListEvent): void => setDark(e.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark;
}

export function useApplySettings(): void {
  const s = useSettings();
  const systemDark = useSystemDark();
  useEffect(() => {
    const root = document.documentElement;
    const light = s.theme === "light" || (s.theme === "system" && !systemDark);
    const a = ACCENTS.find((x) => x.hex === s.accent) ?? ACCENTS[0];
    root.dataset.theme = light ? "light" : "dark";
    root.dataset.density = s.density;
    root.dataset.motion = s.reduceMotion ? "reduce" : "full";
    root.style.setProperty("--accent", a.hex);
    root.style.setProperty("--accent-text", light ? a.lightText : a.text);
    root.style.setProperty("--mention-pill-bg", light ? "#E8EAF6" : a.soft);
    root.style.setProperty("--fs-message", `${s.fontSize}px`);
    root.style.setProperty("--group-gap", `${s.groupGap}px`);
    (document.getElementById("root") as HTMLElement | null)?.style.setProperty("zoom", String(s.zoom / 100));
  }, [s, systemDark]);
}
