// Vue d'ensemble : nom et description (Gérer le serveur), identité et compteurs.
import { useState } from "react";
import { srv } from "../api";
import type { GuildDetail } from "../server-contract";
import { Avatar } from "../../../shared/ui/Avatar";
import { attempt, can, PERM, type PageProps } from "../api";
import { Empty, Notice, Row, SaveBar, Section } from "../kit";
import { useLoad } from "../use-load";

const DESC_MAX = 300;

export function OverviewPage({ acc, guildId, perms, flash }: PageProps): React.JSX.Element {
  const { data: guild, message, reload } = useLoad(() => attempt(srv.guildInfo(acc, guildId)), [acc, guildId]);
  if (message) return <Empty>{message}</Empty>;
  if (!guild) return <Empty>Chargement…</Empty>;
  return (
    <OverviewForm key={`${guild.name}|${guild.description ?? ""}`} acc={acc} guild={guild}
      editable={can(perms, PERM.MANAGE_GUILD)} owned={guild.owner_id === acc} flash={flash} reload={reload} />
  );
}

function OverviewForm({ acc, guild, editable, owned, flash, reload }: {
  acc: string; guild: GuildDetail; editable: boolean; owned: boolean; flash: (m: string) => void; reload: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(guild.name);
  const [desc, setDesc] = useState(guild.description ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== guild.name || desc.trim() !== (guild.description ?? "");

  const reset = (): void => { setName(guild.name); setDesc(guild.description ?? ""); };

  const save = async (): Promise<void> => {
    setBusy(true);
    const r = await attempt(srv.guildUpdate(acc, guild.id, {
      name: name.trim() || guild.name,
      description: desc.trim() || null,
    }));
    setBusy(false);
    if (r.ok) { flash("Serveur mis à jour"); reload(); } else flash(r.message);
  };

  return (
    <div className="ss-page">
      <h1>Vue d'ensemble</h1>
      <div className="ss-sub">
        {guild.member_count != null && <span>{guild.member_count} membres</span>}
        {guild.online_count != null && <span>{guild.online_count} en ligne</span>}
      </div>
      {!editable && <Notice>Lecture seule : il faut la permission Gérer le serveur pour modifier ces réglages.</Notice>}
      <Section title="Identité">
        <Row title="Icône" hint="Affichée dans la barre des serveurs.">
          <Avatar id={guild.id} name={guild.name} url={guild.icon_url} size={56} radius={14} />
        </Row>
        <Row title="Nom du serveur">
          <input className="ss-input" aria-label="Nom du serveur" value={name} disabled={!editable}
            maxLength={100} onChange={(e) => setName(e.target.value)} />
        </Row>
        <div className="ss-row ss-row-block">
          <div className="ss-txt">
            <span className="ss-t">Description</span>
            <span className="ss-h">Visible dans Explorer et sur les invitations.</span>
          </div>
          <textarea className="ss-area" aria-label="Description du serveur" value={desc} disabled={!editable}
            maxLength={DESC_MAX} onChange={(e) => setDesc(e.target.value)} />
          <span className="ss-count">{desc.length} / {DESC_MAX}</span>
        </div>
      </Section>
      <Section title="Informations">
        <Row title="Identifiant du serveur"><code className="ss-code">{guild.id}</code></Row>
        <Row title="Propriétaire" hint={owned ? "C'est toi." : undefined}>
          {!owned && <code className="ss-code">{guild.owner_id}</code>}
        </Row>
      </Section>
      {editable && dirty && (
        <SaveBar busy={busy} onReset={reset} onSave={() => void save()} />
      )}
    </div>
  );
}
