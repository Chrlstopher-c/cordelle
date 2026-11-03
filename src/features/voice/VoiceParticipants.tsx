// Participants d'un salon vocal, sous son nom dans la liste : avatar 22, anneau vert qui pulse quand la personne
// parle, micro coupé, badge LIVE si elle partage son écran.
import { Avatar } from "../../shared/ui/Avatar";
import { MicOffIcon } from "./icons";
import { displayName, useKnownUser } from "./voice-lookup";
import { membersIn, useVoiceStore, voiceKey } from "./voice-store";
import type { VoiceMember } from "./types";

interface ListProps {
  guildId: string | null;
  channelId: string;
}

export function VoiceParticipants({ guildId, channelId }: ListProps): React.JSX.Element | null {
  const states = useVoiceStore((s) => s.statesByGuild[voiceKey(guildId)]);
  const session = useVoiceStore((s) => s.session);
  const members = membersIn(states, channelId);
  if (members.length === 0) return null;
  const talking = session?.channel_id === channelId ? session.speaking : [];
  return (
    <div className="vp-list">
      {members.map((m) => (
        <VoiceParticipant key={m.user_id} guildId={guildId} member={m} speaking={talking.includes(m.user_id)} />
      ))}
    </div>
  );
}

interface ParticipantProps {
  guildId: string | null;
  member: VoiceMember;
  speaking: boolean;
}

function VoiceParticipant({ guildId, member, speaking }: ParticipantProps): React.JSX.Element {
  const user = useKnownUser(guildId, member.user_id);
  const name = displayName(user, member.user_id);
  return (
    <div className="vp" title={name}>
      <span className={`vp-avatar${speaking ? " talking" : ""}`}>
        <Avatar id={member.user_id} name={name} url={user?.avatar_url ?? null} size={22} />
      </span>
      <span className="vp-name">{name}</span>
      {member.mute && <span className="vp-mute"><MicOffIcon size={12} /></span>}
      {member.streaming && <span className="vp-live">LIVE</span>}
    </div>
  );
}
