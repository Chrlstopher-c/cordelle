// Panneau Membres 248 px (maquette Ecran-principal) : groupes par rôle / en ligne / hors ligne, avatar 32 + statut,
// nom coloré par rôle, activité. Abonnement au salon à l'ouverture.
import { useEffect } from "react";
import { commands, type MemberEntry, type MemberGroup, type PresenceStatus } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";
import { useProfiles } from "../profile";

const DOT: Record<PresenceStatus, string> = {
  online: "var(--success)", idle: "#e0a63a", dnd: "var(--danger)", invisible: "var(--text-faint)", offline: "var(--text-faint)",
};
const EMPTY: MemberGroup[] = [];
const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

function Row({ m, guildId }: { m: MemberEntry; guildId: string }): React.JSX.Element {
  const openPopout = useProfiles((s) => s.openPopout);
  const name = m.nick ?? m.user.global_name ?? m.user.username;
  const offline = m.status === "offline" || m.status === "invisible";
  return (
    <button className="mem-row" style={offline ? { opacity: 0.45 } : undefined}
      onClick={(e) => openPopout(m.user.id, guildId, { x: e.clientX - 360, y: e.clientY })}>
      <span style={{ position: "relative" }}>
        <Avatar id={m.user.id} name={name} url={m.user.avatar_url} size={32} />
        {!offline && <span className="ub-dot" style={{ background: DOT[m.status] }} />}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span className="mem-name" style={m.color ? { color: hex(m.color) } : undefined}>{name}</span>
        {m.activity && <span className="mem-act">{m.activity}</span>}
      </span>
    </button>
  );
}

export function MembersPanel({ guildId, channelId }: { guildId: string; channelId: string }): React.JSX.Element {
  const account = useActiveAccount();
  const groups = useEngine((s) => s.memberLists[guildId] ?? EMPTY);
  useEffect(() => {
    if (account) void commands.membersSubscribe(account.id, guildId, channelId);
  }, [account, guildId, channelId]);
  return (
    <aside className="mem-panel" aria-label="Membres">
      {groups.length === 0 && <div className="mem-group">Chargement…</div>}
      {groups.filter((g) => g.members.length > 0).map((g) => (
        <div key={g.id}>
          <div className="mem-group">{g.name} — {g.count}</div>
          {g.members.map((m) => <Row key={m.user.id} m={m} guildId={guildId} />)}
        </div>
      ))}
    </aside>
  );
}

/** Couleurs des noms par utilisateur, d'après la liste des membres connue. */
export function useMemberColors(guildId: string | null): Map<string, string> {
  const groups = useEngine((s) => (guildId ? s.memberLists[guildId] : undefined) ?? EMPTY);
  const map = new Map<string, string>();
  for (const g of groups) for (const m of g.members) if (m.color) map.set(m.user.id, hex(m.color));
  return map;
}
