// Glisser-déposer de fichiers sur la conversation (la saisie reste montée tant que le salon est affiché).
// Maj en déposant : envoi immédiat. Renvoie vrai pendant le survol avec des fichiers.
import { useEffect, useRef, useState } from "react";

type DropHandler = (files: File[], sendNow: boolean) => void;

function carriesFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

export function useFileDrop(onDrop: DropHandler): boolean {
  const [active, setActive] = useState(false);
  const handler = useRef<DropHandler>(onDrop);
  handler.current = onDrop;

  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      depth += 1;
      setActive(true);
    };
    const leave = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const over = (e: DragEvent): void => {
      if (carriesFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      handler.current(Array.from(e.dataTransfer?.files ?? []), e.shiftKey);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return active;
}
