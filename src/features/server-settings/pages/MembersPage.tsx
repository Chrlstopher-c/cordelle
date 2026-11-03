// Membres : recherche par pseudo ou identifiant, expulsion (confirmation), bannissement (modale).
import { useEffect, useState } from "react";
import { srv } from "../api";
import type { MemberSummary } from "../server-contract";
import { Avatar } from "../../../shared/ui/Avatar";
import { useConfirm } from "../../../shared/ui/confirm";
import { attempt, can, PERM, type PageProps } from "../api";
import { shortDate } from "../format";
import { Empty, Flash, useFlash } from "../kit";
import { useLoad } from "../use-load";
import { BanModal } from "./BanModal";

const PAGE_SIZE = 25;

export function MembersPage(props: PageProps): React.JSX.Element {
  const { acc, guildId, perms, flash } = props;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [banning, setBanning] = useState<MemberSummary | null>(null);
  const { message: toast, flash: note } = useFlash();
  const askKick = useConfirm((s) => s.confirm);
  const roles = useLoad(() => attempt(srv.rolesList(acc, guildId)), [acc, guildId]);
  const members = useLoad(
    () => attempt(srv.guildMembersSearch(acc, guildId, debounced, PAGE_SIZE)),
    [acc, guildId, debounced],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const roleName = (id: string): string | undefined => roles.data?.find((r) => r.id === id)?.name;
  const canKick = can(perms, PERM.KICK_MEMBERS);
  const canBan = can(perms, PERM.BAN_MEMBERS);

  const kick = (m: MemberSummary): void => askKick({
    title: `Expulser ${m.user.username}`,
    body: "Cette personne quitte le serveur mais pourra revenir avec une invitation.",
    action: "Expulser",
    run: () => void attempt(srv.memberKick(acc, guildId, m.user.id)).then((r) => {
      if (r.ok) members.reload(); else note(r.message);
    }),
  });

  return (
    <div className="ss-page">
      <h1>Membres</h1>
      <div className="ss-tools">
        <input className="ss-input wide" placeholder="Rechercher par pseudo ou identifiant"
          aria-label="Rechercher un membre"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {members.message && <Empty>{members.message}</Empty>}
      {!members.data && !members.message && <Empty>Chargement…</Empty>}
      {members.data && (
        <table className="ss-table">
          <thead>
            <tr><th scope="col">Membre</th><th scope="col">Rôles</th><th scope="col">Arrivé le</th>
              {(canKick || canBan) && <th scope="col"><span className="sr">Actions</span></th>}</tr>
          </thead>
          <tbody>
            {members.data.map((m) => (
              <MemberRow key={m.user.id} member={m} roleName={roleName} canKick={canKick} canBan={canBan}
                onKick={() => kick(m)} onBan={() => setBanning(m)} />
            ))}
          </tbody>
        </table>
      )}
      {members.data?.length === 0 && <Empty>Aucun membre ne correspond.</Empty>}
      {banning && (
        <BanModal acc={acc} guildId={guildId} userId={banning.user.id} name={banning.user.username}
          onClose={() => setBanning(null)}
          onDone={(r) => { if (r.ok) { flash("Membre banni"); members.reload(); } else note(r.message); }} />
      )}
      <Flash message={toast} />
    </div>
  );
}

function MemberRow({ member, roleName, canKick, canBan, onKick, onBan }: {
  member: MemberSummary; roleName: (id: string) => string | undefined; canKick: boolean; canBan: boolean;
  onKick: () => void; onBan: () => void;
}): React.JSX.Element {
  const name = member.nick ?? member.user.global_name ?? member.user.username;
  const roles = member.roles.map((id) => roleName(id)).filter(Boolean).slice(0, 3).join(", ");
  return (
    <tr>
      <td>
        <span className="ss-who">
          <Avatar id={member.user.id} name={name} url={member.user.avatar_url} size={32} />
          <span className="ss-who-txt"><b>{name}</b><span>@{member.user.username}</span></span>
        </span>
      </td>
      <td>{roles || "—"}</td>
      <td>{shortDate(member.joined_at)}</td>
      {(canKick || canBan) && (
        <td className="ss-actions">
          {canKick && <button type="button" className="ss-btn" onClick={onKick}>Expulser</button>}
          {canBan && <button type="button" className="ss-btn danger" onClick={onBan}>Bannir</button>}
        </td>
      )}
    </tr>
  );
}
