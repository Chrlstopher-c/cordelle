// Ferme un panneau au clic extérieur ou sur Échap, tant qu'il est ouvert.
import { useEffect, type RefObject } from "react";

export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onDown = (event: MouseEvent): void => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) onDismiss();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, active, onDismiss]);
}
