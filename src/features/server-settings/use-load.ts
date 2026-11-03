// Chargement d'une donnée d'administration : résultat, message d'erreur, rechargement manuel.
import { useCallback, useEffect, useState } from "react";
import type { Outcome } from "./api";

interface Loaded<T> { data: T | null; message: string | null; reload: () => void }

export function useLoad<T>(load: () => Promise<Outcome<T>>, deps: unknown[]): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; message: string | null }>({ data: null, message: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void load().then((r) => {
      if (live) setState(r.ok ? { data: r.data, message: null } : { data: null, message: r.message });
    });
    return () => { live = false; };
    // Les dépendances sont celles de l'appelant (compte, serveur, salon) ; `tick` relance le chargement.
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
