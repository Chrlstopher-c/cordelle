// Actions du partage d'écran de la barre d'appel : bascule, choix d'une qualité (redémarre si on partage), arrêt.
import { useState } from "react";
import { type QualityChoice, restartShare, startShare, stopShare, useStreamStore } from "./stream-store";

export interface ShareActions {
  streaming: boolean;
  chosen: QualityChoice;
  error: string | null;
  toggle: () => void;
  pick: (choice: QualityChoice) => void;
  stop: () => void;
}

export function useShare(accountId: string, onDone: () => void): ShareActions {
  const streaming = useStreamStore((s) => s.state?.streaming ?? false);
  const chosen = useStreamStore((s) => s.chosen);
  const [error, setError] = useState<string | null>(null);
  const apply = (action: Promise<string | null>): void => {
    onDone();
    void action.then(setError);
  };
  return {
    streaming,
    chosen,
    error,
    toggle: () => apply(streaming ? stopShare(accountId) : startShare(accountId, chosen)),
    pick: (choice) => apply(streaming ? restartShare(accountId, choice) : startShare(accountId, choice)),
    stop: () => apply(stopShare(accountId)),
  };
}
