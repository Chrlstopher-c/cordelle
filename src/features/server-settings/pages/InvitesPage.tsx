// Invitations du serveur : liste (créateur, utilisations, expiration), révocation, création sur un salon.
import { useState } from "react";
import { srv } from "../api";
import type { Invite } from "../server-contract";
import { attempt, can, PERM, type PageProps } from "../api";
import { fromIso } from "../format";
import { DURATIONS, InviteOptions } from "../invite-options";
import { Empty, Flash, Section, useFlash } from "../kit";
import { useLoad } from "../use-load";

export const inviteLink = (code: string): string => `https://discord.gg/${code}`;

export function InvitesPage({ acc, guildId, perms }: PageProps): React.JSX.Element {
  const { data, message, reload } = useLoad(() => attempt(srv.invitesList(acc, guildId)), [acc, guildId]);
  const [creating, setCreating] = useState(false);
  const { message: toast, flash } = useFlash();
  const canCreate = can(perms, PERM.CREATE_INVITE);
  const canRevoke = can(perms, PERM.MANAGE_GUILD) || can(perms, PERM.MANAGE_CHANNELS);
  if (message) return <Empty>{message}</Empty>;
  if (!data) return <Empty>Chargement…</Empty>;

  const revoke = async (invite: Invite): Promise<void> => {
    const r = await attempt(srv.inviteDelete(acc, invite.code));
    if (r.ok) { flash("Invitation révoquée"); reload(); } else flash(r.message);
  };

  return (
    <div className="ss-page">
      <div className="ss-head">
        <div>
          <h1>Invitations</h1>
          <p className="ss-sub">Les liens actifs, qui les a créés et combien de personnes ils ont fait entrer.</p>
        </div>
        {canCreate && (
          <button type="button" className="ss-btn primary" aria-expanded={creating}
            onClick={() => setCreating((v) => !v)}>
            {creating ? "Fermer" : "Créer une invitation"}
          </button>
        )}
      </div>
      {creating && (
        <CreatePanel acc={acc} guildId={guildId} onError={flash}
          onCreated={() => { reload(); flash("Invitation créée"); }} />
      )}
      <Section>
        <table className="ss-table">
          <thead>
            <tr><th scope="col">Créée par</th><th scope="col">Lien</th><th scope="col">Utilisations</th>
              <th scope="col">Expire</th>{canRevoke && <th scope="col"><span className="sr">Actions</span></th>}</tr>
          </thead>
          <tbody>
            {data.map((i) => (
              <tr key={i.code}>
                <td>
                  {i.inviter?.global_name ?? i.inviter?.username ?? "Inconnu"}
                  <span className="ss-h"> · vers #{i.channel_name ?? "?"}</span>
                </td>
                <td><code className="ss-code">{inviteLink(i.code)}</code></td>
                <td>{i.uses}{i.max_uses > 0 ? ` / ${i.max_uses}` : " / ∞"}</td>
                <td>{i.expires_at ? fromIso(i.expires_at) : "Jamais"}</td>
                {canRevoke && (
                  <td>
                    <button type="button" className="ss-btn danger" onClick={() => void revoke(i)}>Révoquer</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <Empty>Aucune invitation active.</Empty>}
      </Section>
      <Flash message={toast} />
    </div>
  );
}

function CreatePanel({ acc, guildId, onCreated, onError }: {
  acc: string; guildId: string; onCreated: () => void; onError: (m: string) => void;
}): React.JSX.Element {
  const channels = useLoad(() => attempt(srv.channelsList(acc, guildId)), [acc, guildId]);
  const targets = (channels.data ?? []).filter((c) => c.kind === "text" || c.kind === "announcement");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [maxAge, setMaxAge] = useState(DURATIONS[5].v);
  const [maxUses, setMaxUses] = useState(0);
  const [busy, setBusy] = useState(false);
  const chosen = channelId ?? targets[0]?.id ?? null;

  const create = async (): Promise<void> => {
    if (!chosen) return;
    setBusy(true);
    const r = await attempt(srv.inviteCreate(acc, chosen, maxAge, maxUses));
    setBusy(false);
    if (r.ok) onCreated(); else onError(r.message);
  };

  return (
    <div className="ss-card ss-create">
      <span className="ss-label">Salon d'arrivée</span>
      <select className="ss-select" aria-label="Salon d'arrivée" value={chosen ?? ""}
        onChange={(e) => setChannelId(e.target.value)}>
        {targets.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
      </select>
      <InviteOptions maxAge={maxAge} maxUses={maxUses} onAge={setMaxAge} onUses={setMaxUses} />
      <div className="ss-create-actions">
        <button type="button" className="ss-btn primary" onClick={() => void create()} disabled={!chosen || busy}>
          Créer le lien
        </button>
      </div>
    </div>
  );
}
