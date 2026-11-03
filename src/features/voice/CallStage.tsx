// Scène des participants : Focus (une grande tuile + vignettes) ou Grille 2 colonnes. Bascule en 220 ms.
import { Avatar } from "../../shared/ui/Avatar";
import { MicOffIcon } from "./icons";
import { displayName, useKnownUser } from "./voice-lookup";
import type { VoiceMember } from "./types";

export type CallLayout = "focus" | "grid";

interface StageProps {
  guildId: string | null;
  members: VoiceMember[];
  speaking: string[];
  layout: CallLayout;
}

export function CallStage({ guildId, members, speaking, layout }: StageProps): React.JSX.Element {
  return (
    <div className={`call-stage ${layout} swap`}>
      {layout === "focus"
        ? <FocusStage guildId={guildId} members={members} speaking={speaking} />
        : members.map((m) => (
          <CallTile key={m.user_id} guildId={guildId} member={m} speaking={speaking.includes(m.user_id)} size={80} />
        ))}
    </div>
  );
}

function FocusStage({ guildId, members, speaking }: Omit<StageProps, "layout">): React.JSX.Element {
  const main = members.find((m) => speaking.includes(m.user_id)) ?? members[0];
  if (!main) return <div className="call-empty">Personne dans le salon pour l'instant</div>;
  const rest = members.filter((m) => m.user_id !== main.user_id);
  return (
    <>
      <div className="call-main">
        <CallTile guildId={guildId} member={main} speaking={speaking.includes(main.user_id)} size={96} />
      </div>
      {rest.length > 0 && (
        <div className="call-thumbs">
          {rest.map((m) => (
            <CallTile key={m.user_id} guildId={guildId} member={m} speaking={speaking.includes(m.user_id)} size={48} />
          ))}
        </div>
      )}
    </>
  );
}

interface TileProps {
  guildId: string | null;
  member: VoiceMember;
  speaking: boolean;
  size: number;
}

function CallTile({ guildId, member, speaking, size }: TileProps): React.JSX.Element {
  const user = useKnownUser(guildId, member.user_id);
  const name = displayName(user, member.user_id);
  return (
    <div className={`call-tile${speaking ? " talking" : ""}`}>
      <Avatar id={member.user_id} name={name} url={user?.avatar_url ?? null} size={size} />
      <span className="call-tile-name">
        {member.mute && <MicOffIcon size={12} />}
        {name}
      </span>
    </div>
  );
}
