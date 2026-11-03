// Événements programmés d'un serveur : chargés à chaque changement de serveur, réponses périmées ignorées.
import { useEffect, useState } from "react";
import { scheduledEvents, type ScheduledEvent } from "./api";

export interface ScheduledEventsState {
  events: ScheduledEvent[];
  loading: boolean;
}

export function useScheduledEvents(accountId: string | undefined, guildId: string): ScheduledEventsState {
  const [state, setState] = useState<ScheduledEventsState>({ events: [], loading: true });

  useEffect(() => {
    if (!accountId) {
      setState({ events: [], loading: false });
      return;
    }
    let stale = false;
    setState({ events: [], loading: true });
    void load(accountId, guildId).then((events) => {
      if (!stale) setState({ events, loading: false });
    });
    return () => { stale = true; };
  }, [accountId, guildId]);

  return state;
}

async function load(accountId: string, guildId: string): Promise<ScheduledEvent[]> {
  try {
    const r = await scheduledEvents(accountId, guildId);
    if (r.status === "ok") return r.data;
    console.error("[événements] liste impossible", r.error);
    return [];
  } catch (e) {
    console.error("[événements] liste impossible", e);
    return [];
  }
}
