// Événements d'un serveur (maquette Evenements) : liste des événements à venir ou en cours, lien à copier.
import { useState } from "react";
import type { ChannelSummary } from "../../contract/bindings";
import type { ScheduledEvent } from "./api";
import { useEngine } from "../../shared/data/engine-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { useScheduledEvents } from "./use-scheduled-events";
import "./home.css";

interface Props {
  guildId: string;
}

const when = (iso: string): string =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const NO_CHANNELS: ChannelSummary[] = [];

const eventUrl = (guildId: string, eventId: string): string => `https://discord.com/events/${guildId}/${eventId}`;

function EventCard({ event, guildId, where }: { event: ScheduledEvent; guildId: string; where: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(eventUrl(guildId, event.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("[événements] copie impossible", e);
    }
  };

  return (
    <article className="ev-card">
      <div className="ev-meta">
        <span className="ev-when">{when(event.start)}</span>
        {event.live && <span className="ev-live">En cours</span>}
      </div>
      <b className="ev-name">{event.name}</b>
      <span className="dlg-muted">{where}</span>
      {event.description && <p className="ev-desc">{event.description}</p>}
      <div className="ev-foot">
        <span className="dlg-muted">{event.interested.toLocaleString("fr-FR")} intéressés</span>
        <button className="btn-ghost" onClick={() => void copy()}>{copied ? "Lien copié" : "Copier le lien"}</button>
      </div>
    </article>
  );
}

export function EventsPanel({ guildId }: Props): React.JSX.Element {
  const account = useActiveAccount();
  const channelMap = useEngine((s) => s.channelsByGuild[guildId]);
  const channels = channelMap ?? NO_CHANNELS;
  const { events, loading } = useScheduledEvents(account?.id, guildId);

  const placeOf = (event: ScheduledEvent): string => {
    if (event.location) return event.location;
    const channel = channels.find((c) => c.id === event.channel_id);
    return channel ? `#${channel.name}` : "Lieu non précisé";
  };

  return (
    <section className="ev">
      <header className="dlg-head"><h2>Événements</h2>{!loading && <span className="dlg-muted">{events.length}</span>}</header>
      {loading && <p className="hv-count">Chargement…</p>}
      {!loading && events.length === 0 && (
        <div className="empty"><b>Aucun événement à venir</b><span>Les événements programmés du serveur apparaîtront ici.</span></div>
      )}
      {events.map((e) => <EventCard key={e.id} event={e} guildId={guildId} where={placeOf(e)} />)}
    </section>
  );
}
