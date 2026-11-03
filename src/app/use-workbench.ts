// État de l'écran de travail : sélection serveur/salon, messages en direct via l'événement engine.
import { useEffect, useState } from "react";
import {
  commands,
  events,
  type ChannelSummary,
  type EngineEvent,
  type GuildSummary,
  type Message,
} from "../contract/bindings";

export interface Workbench {
  guilds: GuildSummary[];
  channels: ChannelSummary[];
  messages: Message[];
  guildId: string | null;
  channelId: string | null;
  connection: string;
  selectGuild: (id: string | null) => void;
  selectChannel: (id: string) => void;
  send: (content: string) => void;
}

function useLiveEngine(accountId: string, channelId: string | null, setMessages: (f: (m: Message[]) => Message[]) => void,
  setConnection: (s: string) => void, reloadGuilds: () => void): void {
  useEffect(() => {
    const unlisten = events.engine.listen((e) => {
      const ev = e.payload as EngineEvent;
      if (ev.account_id !== accountId) return;
      if (ev.type === "connection") {
        setConnection(ev.state);
        if (ev.state === "ready") reloadGuilds();
      } else if (ev.type === "guild_upsert") {
        reloadGuilds();
      } else if (ev.type === "message_create" && ev.message.channel_id === channelId) {
        setMessages((m) => [ev.message, ...m.filter((x) => x.id !== ev.message.id)]);
      } else if (ev.type === "message_update" && ev.message.channel_id === channelId) {
        setMessages((m) => m.map((x) => (x.id === ev.message.id ? ev.message : x)));
      } else if (ev.type === "message_delete" && ev.channel_id === channelId) {
        setMessages((m) => m.filter((x) => x.id !== ev.message_id));
      }
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [accountId, channelId, setMessages, setConnection, reloadGuilds]);
}

export function useWorkbench(accountId: string): Workbench {
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [connection, setConnection] = useState("connecting");
  const [guildTick, setGuildTick] = useState(0);

  useEffect(() => {
    void commands.guildsList(accountId).then((r) => r.status === "ok" && setGuilds(r.data));
  }, [accountId, guildTick]);

  useEffect(() => {
    const load = guildId ? commands.channelsList(accountId, guildId) : commands.dmsList(accountId);
    void load.then((r) => r.status === "ok" && setChannels(r.data));
  }, [accountId, guildId, guildTick]);

  useEffect(() => {
    if (!channelId) return;
    const t0 = performance.now();
    void commands.messagesGet(accountId, channelId, null, 50).then((r) => {
      if (r.status === "ok") setMessages(r.data.messages);
      console.info(`[bench] salon ${channelId} : ${(performance.now() - t0).toFixed(1)} ms`);
    });
  }, [accountId, channelId]);

  useLiveEngine(accountId, channelId, setMessages, setConnection, () => setGuildTick((t) => t + 1));

  const send = (content: string): void => {
    if (!channelId || !content.trim()) return;
    void commands.messageSend(accountId, channelId, { content, reply_to: null, nonce: String(Date.now()) });
  };

  return {
    guilds, channels, messages, guildId, channelId, connection,
    selectGuild: (id) => { setGuildId(id); setChannelId(null); setMessages([]); },
    selectChannel: setChannelId,
    send,
  };
}
