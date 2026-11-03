// Chargement d'une donnée moteur pour une page de réglages : état, erreur lisible, rechargement.
import { useCallback, useEffect, useState } from "react";
import type { EngineError } from "../../contract/bindings";

export type Outcome<T> = { status: "ok"; data: T } | { status: "error"; error: EngineError };

export interface Remote<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

interface RemoteState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function errorText(error: EngineError): string {
  switch (error.kind) {
    case "unauthorized": return "Session expirée : reconnecte ce compte.";
    case "rate_limited": return "Trop de demandes : réessaie dans un instant.";
    case "network": return "Discord est injoignable pour le moment.";
    case "discord": return error.message;
    case "not_found": return "Introuvable.";
    case "not_implemented": return "Non disponible.";
    case "internal": return error.message;
  }
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "date inconnue";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/** Charge `load` quand `key` change ; `reload` relance le chargement. */
export function useRemote<T>(key: string, load: () => Promise<Outcome<T>>): Remote<T> {
  const [state, setState] = useState<RemoteState<T>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((r) => {
        if (!alive) return;
        setState(r.status === "ok"
          ? { data: r.data, error: null, loading: false }
          : { data: null, error: errorText(r.error), loading: false });
      })
      .catch((e: unknown) => {
        console.error("chargement des réglages impossible", e);
        if (alive) setState({ data: null, error: "Chargement impossible.", loading: false });
      });
    return () => {
      alive = false;
    };
    // load est recréé à chaque rendu : seule la clé et le rechargement déclenchent une requête.
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
