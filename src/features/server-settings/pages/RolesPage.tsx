// Rôles : liste ordonnée (Monter / Descendre), création, édition (affichage et permissions), suppression.
import { useMemo, useState } from "react";
import { srv } from "../api";
import type { Role } from "../server-contract";
import { useConfirm } from "../../../shared/ui/confirm";
import { attempt, can, colorCss, PERM, type PageProps } from "../api";
import { Empty, Flash, Notice, Section, useFlash } from "../kit";
import { useLoad } from "../use-load";
import { RoleEditor } from "./RoleEditor";

export function RolesPage({ acc, guildId, perms }: PageProps): React.JSX.Element {
  const { data, message, reload } = useLoad(() => attempt(srv.rolesList(acc, guildId)), [acc, guildId]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { message: toast, flash } = useFlash();
  const askConfirm = useConfirm((s) => s.confirm);
  const editable = can(perms, PERM.MANAGE_ROLES);
  const roles = useMemo(() => (data ?? []).filter((r) => r.id !== guildId), [data, guildId]);
  const shown = roles.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));
  const current = roles.find((r) => r.id === selected) ?? null;

  if (message) return <Empty>{message}</Empty>;
  if (!data) return <Empty>Chargement…</Empty>;

  /** step -1 = monter (vers l'index 0, le plus haut), +1 = descendre. */
  const move = async (role: Role, step: -1 | 1): Promise<void> => {
    const index = roles.findIndex((r) => r.id === role.id);
    const target = roles[index + step];
    if (!target) return;
    const order = roles.map((r) => r.id);
    order[index] = target.id;
    order[index + step] = role.id;
    const r = await attempt(srv.roleReorder(acc, guildId, order));
    if (r.ok) reload(); else flash(r.message);
  };

  const create = async (): Promise<void> => {
    const r = await attempt(srv.roleCreate(acc, guildId, "nouveau rôle"));
    if (!r.ok) return flash(r.message);
    setSelected(r.data.id);
    reload();
  };

  const remove = (role: Role): void => askConfirm({
    title: `Supprimer ${role.name}`,
    body: "Les membres perdent ce rôle. Ce n'est pas réversible.",
    action: "Supprimer",
    run: () => void attempt(srv.roleDelete(acc, guildId, role.id)).then((r) => {
      if (r.ok) { setSelected(null); reload(); } else flash(r.message);
    }),
  });

  return (
    <div className="ss-page ss-split">
      <div className="ss-col">
        <h1>Rôles</h1>
        <p className="ss-sub">L'ordre compte : un rôle plus haut l'emporte.</p>
        {!editable && <Notice>Lecture seule : il faut la permission Gérer les rôles.</Notice>}
        <div className="ss-tools">
          <input className="ss-input" placeholder="Rechercher un rôle" aria-label="Rechercher un rôle"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          {editable && (
            <button type="button" className="ss-btn primary" onClick={() => void create()}>Créer un rôle</button>
          )}
        </div>
        <Section>
          {shown.map((role) => (
            <RoleRow key={role.id} role={role} index={roles.indexOf(role)} count={roles.length}
              selected={role.id === selected} canMove={editable && !role.managed}
              onSelect={() => setSelected(role.id)} onMove={(step) => void move(role, step)} />
          ))}
          {shown.length === 0 && <Empty>Aucun rôle ne correspond.</Empty>}
        </Section>
      </div>
      <div className="ss-col">
        {current ? (
          <RoleEditor key={current.id} acc={acc} guildId={guildId} role={current}
            editable={editable && !current.managed}
            onSaved={() => { flash("Rôle enregistré"); reload(); }}
            onDelete={() => remove(current)} onError={flash} />
        ) : (
          <Empty>Choisis un rôle pour le modifier.</Empty>
        )}
      </div>
      <Flash message={toast} />
    </div>
  );
}

function RoleRow({ role, index, count, selected, canMove, onSelect, onMove }: {
  role: Role; index: number; count: number; selected: boolean; canMove: boolean;
  onSelect: () => void; onMove: (step: -1 | 1) => void;
}): React.JSX.Element {
  return (
    <div className={`ss-role${selected ? " on" : ""}`}>
      <button type="button" className="ss-role-name" aria-pressed={selected} onClick={onSelect}>
        <span className="ss-dot-color" style={{ background: role.color ? colorCss(role.color) : "#8B8E96" }} />
        <span>{role.name}</span>
      </button>
      {canMove && (
        <span className="ss-arrows">
          <button type="button" className="ss-btn ghost" aria-label={`Monter ${role.name}`}
            disabled={index <= 0} onClick={() => onMove(-1)}>▲</button>
          <button type="button" className="ss-btn ghost" aria-label={`Descendre ${role.name}`}
            disabled={index >= count - 1} onClick={() => onMove(1)}>▼</button>
        </span>
      )}
    </div>
  );
}
