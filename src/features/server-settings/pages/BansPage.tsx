// Bannissements : liste, recherche, révocation (confirmation).
import { useMemo, useState } from "react";
import { srv } from "../api";
import type { Ban } from "../server-contract";
import { Avatar } from "../../../shared/ui/Avatar";
import { useConfirm } from "../../../shared/ui/confirm";
import { attempt, can, PERM, type PageProps } from "../api";
import { Empty, Flash, Section, useFlash } from "../kit";
import { useLoad } from "../use-load";

export function BansPage({ acc, guildId, perms }: PageProps): React.JSX.Element {
  const { data, message, reload } = useLoad(() => attempt(srv.bansList(acc, guildId)), [acc, guildId]);
  const [query, setQuery] = useState("");
  const { message: toast, flash } = useFlash();
  const askRevoke = useConfirm((s) => s.confirm);
  const editable = can(perms, PERM.BAN_MEMBERS);
  const shown = useMemo(() => filterBans(data ?? [], query), [data, query]);
  if (message) return <Empty>{message}</Empty>;
  if (!data) return <Empty>Chargement…</Empty>;

  const revoke = (ban: Ban): void => askRevoke({
    title: `Révoquer le bannissement de ${ban.user.username}`,
    body: "La personne pourra revenir avec une invitation. Ses anciens messages ne reviennent pas.",
    action: "Révoquer",
    run: () => void attempt(srv.banRemove(acc, guildId, ban.user.id)).then((r) => {
      if (r.ok) { flash("Bannissement révoqué"); reload(); } else flash(r.message);
    }),
  });

  return (
    <div className="ss-page">
      <h1>Bannissements</h1>
      <p className="ss-sub">{data.length} {data.length > 1 ? "personnes bannies" : "personne bannie"}</p>
      <div className="ss-tools">
        <input className="ss-input wide" placeholder="Rechercher par pseudo, identifiant ou raison"
          aria-label="Rechercher un membre banni"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Section>
        {shown.map((ban) => (
          <div key={ban.user.id} className="ss-row">
            <Avatar id={ban.user.id} name={ban.user.username} url={ban.user.avatar_url} size={34} />
            <div className="ss-txt">
              <span className="ss-t">
                {ban.user.global_name ?? ban.user.username}
                <span className="ss-h"> @{ban.user.username}</span>
              </span>
              <span className="ss-h">{ban.reason ? `Raison : ${ban.reason}` : "Aucune raison donnée"}</span>
            </div>
            {editable && (
              <button type="button" className="ss-btn" onClick={() => revoke(ban)}>Révoquer le bannissement</button>
            )}
          </div>
        ))}
        {shown.length === 0 && (
          <Empty>{data.length === 0 ? "Aucun bannissement." : "Aucun membre banni ne correspond."}</Empty>
        )}
      </Section>
      <Flash message={toast} />
    </div>
  );
}

function filterBans(bans: Ban[], query: string): Ban[] {
  const q = query.trim().toLowerCase();
  if (!q) return bans;
  return bans.filter((b) => {
    const text = `${b.user.username} ${b.user.global_name ?? ""} ${b.user.id} ${b.reason ?? ""}`;
    return text.toLowerCase().includes(q);
  });
}
