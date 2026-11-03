// Scène d'appel (maquette Appel) : fond surface-call, en-tête, participants, barre de contrôle.
// Hors de ce salon : grand bouton « Rejoindre le vocal ».
import { useState } from "react";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { voice } from "./api";
import { CallControls } from "./CallControls";
import { CallHeader } from "./CallHeader";
import { CallStage, type CallLayout, type ShareInfo } from "./CallStage";
import { useVoiceChannel } from "./voice-lookup";
import { stopShare, useStreamStore } from "./stream-store";
import { membersIn, useVoiceStore, voiceKey } from "./voice-store";

export function CallView({ guildId, channelId }: { guildId: string | null; channelId: string }): React.JSX.Element {
  const account = useActiveAccount();
  const session = useVoiceStore((s) => s.session);
  const startedAt = useVoiceStore((s) => s.startedAt);
  const states = useVoiceStore((s) => s.statesByGuild[voiceKey(guildId)]);
  const channel = useVoiceChannel(guildId, channelId);
  const streaming = useStreamStore((s) => s.state?.streaming ?? false);
  const [layout, setLayout] = useState<CallLayout>("focus");
  const [joinError, setJoinError] = useState<string | null>(null);
  const name = channel?.name ?? channelId;
  const members = membersIn(states, channelId);

  if (!account) return <section className="call" aria-label={`Appel ${name}`} />;
  const here = session !== null && session.account_id === account.id && session.channel_id === channelId;
  const inCall = here && session?.connection === "connected";
  const share: ShareInfo | null = streaming ? { selfId: account.id, onStop: () => void stopShare(account.id) } : null;

  return (
    <section className="call" aria-label={`Appel ${name}`}>
      <CallHeader name={name} count={members.length} ping={inCall ? (session?.ping_ms ?? null) : null}
        since={inCall ? startedAt : null} layout={layout} onLayout={setLayout} />
      {inCall && session ? (
        <>
          <CallStage key={layout} guildId={guildId} members={members} speaking={session.speaking} layout={layout}
            share={share} />
          <CallControls accountId={account.id} session={session} />
        </>
      ) : (
        <JoinPanel accountId={account.id} guildId={guildId} channelId={channelId} name={name}
          connecting={here && session?.connection === "connecting"}
          error={joinError ?? (here ? (session?.error ?? null) : null)} onJoinError={setJoinError} />
      )}
    </section>
  );
}

interface JoinProps {
  accountId: string;
  guildId: string | null;
  channelId: string;
  name: string;
  connecting: boolean;
  error: string | null;
  onJoinError: (error: string | null) => void;
}

function JoinPanel(props: JoinProps): React.JSX.Element {
  const { accountId, guildId, channelId, name, connecting, error, onJoinError } = props;
  const join = async (): Promise<void> => {
    const r = await voice.join(accountId, guildId, channelId);
    onJoinError(r.ok ? null : r.error);
  };
  return (
    <div className="call-join">
      <span className="call-join-name">{name}</span>
      {error && <p className="call-error" role="alert">{error}</p>}
      <button className="call-join-btn" disabled={connecting} onClick={() => void join()}>
        {connecting ? "Connexion…" : "Rejoindre le vocal"}
      </button>
    </div>
  );
}
