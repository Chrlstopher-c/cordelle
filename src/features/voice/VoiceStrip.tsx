// Ligne « vocal connecté » au-dessus du profil : nom du salon, état, raccrocher. Un clic sur le nom rouvre l'appel.
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { PhoneOffIcon } from "./icons";
import { voice } from "./api";
import { useVoiceChannel } from "./voice-lookup";
import { useVoiceStore } from "./voice-store";
import type { VoiceConnection } from "./types";

const STATE_LABEL: Record<VoiceConnection, string> = {
  disconnected: "",
  connecting: "Connexion…",
  connected: "Connecté",
  failed: "Échec de la connexion",
};

export function VoiceStrip(): React.JSX.Element | null {
  const account = useActiveAccount();
  const session = useVoiceStore((s) => s.session);
  const channel = useVoiceChannel(session?.guild_id ?? null, session?.channel_id ?? null);
  const go = useNav((s) => s.go);
  if (!account || !session || session.account_id !== account.id) return null;
  const channelId = session.channel_id;
  if (channelId === null || session.connection === "disconnected") return null;
  const state = session.connection === "failed" && session.error ? session.error : STATE_LABEL[session.connection];
  return (
    <div className="vstrip">
      <button className="vstrip-open" onClick={() => go({ kind: "call", guildId: session.guild_id, channelId })}>
        <span className="vstrip-title">{channel?.name ?? channelId}</span>
        <span className="vstrip-state">{state}</span>
      </button>
      <button className="vstrip-leave" aria-label="Quitter le vocal" onClick={() => void voice.leave(account.id)}>
        <PhoneOffIcon size={17} />
      </button>
    </div>
  );
}
