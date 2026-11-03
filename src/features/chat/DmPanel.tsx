// Panneau de droite en MP (maquette MP) : profil du correspondant (MP à deux) ou participants (groupe).
import type { ChannelSummary, User } from "../../contract/bindings";
import { useNav } from "../../shared/data/nav-store";
import { usePresence } from "../../shared/data/use-presence";
import { Avatar } from "../../shared/ui/Avatar";
import { StatusAvatar } from "../../shared/ui/StatusAvatar";
import { useProfiles } from "../profile";
import { About, Banner, Identity, Note, ProfileAvatar } from "../profile/ProfileParts";
import { useLoadedProfile } from "../profile/use-profile-actions";
import "../profile/profile.css";

function Participant({ u }: { u: User }): React.JSX.Element {
  const status = usePresence(u.id);
  const openPopout = useProfiles((s) => s.openPopout);
  return (
    <button className="mem-row" onClick={(e) => openPopout(u.id, null, { x: e.clientX - 360, y: e.clientY })}>
      <StatusAvatar id={u.id} name={u.global_name ?? u.username} url={u.avatar_url} size={32} status={status} />
      <span className="mem-name">{u.global_name ?? u.username}</span>
    </button>
  );
}

function OneToOne({ user }: { user: User }): React.JSX.Element {
  const { profile, error } = useLoadedProfile(user.id, null);
  const openModal = useProfiles((s) => s.openModal);
  const openGuild = useNav((s) => s.openGuild);
  if (!profile) return <div className="mem-group">{error ?? "Chargement…"}</div>;
  return (
    <>
      <Banner p={profile} />
      <div className="pf-inner">
        <ProfileAvatar p={profile} onOpen={() => openModal(user.id, null)} />
        <Identity p={profile} />
        <div className="pf-card">
          <About p={profile} guildName={null} />
          <Note p={profile} />
        </div>
        {profile.mutual_guilds.length > 0 && (
          <div className="pf-card" style={{ gap: 2 }}>
            <span className="pf-lab">Serveurs en commun — {profile.mutual_guilds.length}</span>
            {profile.mutual_guilds.map((g) => (
              <button key={g.id} className="mem-row" onClick={() => openGuild(g.id)}>
                <Avatar id={g.id} name={g.name || "?"} url={g.icon_url} size={28} radius={8} />
                <span className="mem-name">{g.name || "Serveur"}</span>
              </button>
            ))}
          </div>
        )}
        {profile.mutual_friends.length > 0 && (
          <div className="pf-card" style={{ gap: 2 }}>
            <span className="pf-lab">Amis en commun — {profile.mutual_friends.length}</span>
            {profile.mutual_friends.map((u) => <Participant key={u.id} u={u} />)}
          </div>
        )}
        <button className="pf-full-btn" onClick={() => openModal(user.id, null)}>Voir le profil complet</button>
      </div>
    </>
  );
}

export function DmPanel({ channel }: { channel: ChannelSummary }): React.JSX.Element {
  const one = channel.kind === "dm" ? channel.recipients[0] : undefined;
  return (
    <aside className="mem-panel dm-panel" aria-label={one ? "Profil" : "Participants"} style={one ? { padding: 0, width: 300 } : undefined}>
      {one ? <OneToOne user={one} /> : (
        <>
          <div className="mem-group">Participants — {channel.recipients.length + 1}</div>
          {channel.recipients.map((u) => <Participant key={u.id} u={u} />)}
        </>
      )}
    </aside>
  );
}
