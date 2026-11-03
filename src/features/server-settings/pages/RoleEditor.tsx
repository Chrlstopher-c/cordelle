// Édition d'un rôle : onglet Affichage (nom, couleur, rubrique, mention) et Permissions (bits Discord).
import { useState } from "react";
import { srv } from "../api";
import type { Role } from "../server-contract";
import { attempt, colorCss, hasBit, ROLE_PERMS, withBit } from "../api";
import { Row, SaveBar, Section, Toggle } from "../kit";

const SWATCHES = [0, 0xe8c07a, 0x3fb97a, 0x5a66e8, 0xe5737a, 0x8fb8eb, 0xc07ae8, 0xe8a07a, 0x7ae8d6, 0x8b8e96];
type Tab = "affichage" | "permissions";

interface EditorProps {
  acc: string;
  guildId: string;
  role: Role;
  editable: boolean;
  onSaved: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
}

export function RoleEditor(props: EditorProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("affichage");
  const { role, editable } = props;
  return (
    <div className="ss-editor">
      <h2>Modifier le rôle — {role.name}</h2>
      <div className="ss-tabs" role="tablist" aria-label="Sections du rôle">
        <button type="button" role="tab" aria-selected={tab === "affichage"}
          onClick={() => setTab("affichage")}>Affichage</button>
        <button type="button" role="tab" aria-selected={tab === "permissions"}
          onClick={() => setTab("permissions")}>Permissions</button>
      </div>
      <RoleForm {...props} tab={tab} />
      {editable && (
        <button type="button" className="ss-btn danger ss-delete" onClick={props.onDelete}>Supprimer le rôle</button>
      )}
    </div>
  );
}

function RoleForm({ tab, ...props }: EditorProps & { tab: Tab }): React.JSX.Element {
  const { acc, guildId, role, editable, onSaved, onError } = props;
  const [draft, setDraft] = useState({
    name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable, permissions: role.permissions,
  });
  const [busy, setBusy] = useState(false);
  const dirty = draft.name.trim() !== role.name || draft.color !== role.color || draft.hoist !== role.hoist
    || draft.mentionable !== role.mentionable || draft.permissions !== role.permissions;
  const patch = (change: Partial<typeof draft>): void => setDraft((d) => ({ ...d, ...change }));

  const save = async (): Promise<void> => {
    setBusy(true);
    const r = await attempt(srv.roleUpdate(acc, guildId, role.id, {
      name: draft.name.trim() || role.name, color: draft.color, hoist: draft.hoist,
      mentionable: draft.mentionable, permissions: draft.permissions,
    }));
    setBusy(false);
    if (r.ok) onSaved(); else onError(r.message);
  };

  return (
    <>
      {tab === "affichage"
        ? <DisplayFields draft={draft} patch={patch} editable={editable} roleName={role.name} />
        : (
          <Section>
            {ROLE_PERMS.map((p) => (
              <Row key={p.label} title={p.label} hint={p.help}>
                <Toggle on={hasBit(draft.permissions, p.bit)} disabled={!editable} label={p.label}
                  onChange={(on) => patch({ permissions: withBit(draft.permissions, p.bit, on) })} />
              </Row>
            ))}
          </Section>
        )}
      {editable && dirty && (
        <SaveBar busy={busy} onReset={() => setDraft(pick(role))} onSave={() => void save()} />
      )}
    </>
  );
}

type Draft = { name: string; color: number; hoist: boolean; mentionable: boolean; permissions: string };

function pick(role: Role): Draft {
  return {
    name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable, permissions: role.permissions,
  };
}

function DisplayFields({ draft, patch, editable, roleName }: {
  draft: Draft; patch: (change: Partial<Draft>) => void; editable: boolean; roleName: string;
}): React.JSX.Element {
  return (
    <>
      <Section>
        <Row title="Nom du rôle">
          <input className="ss-input" aria-label="Nom du rôle" value={draft.name} disabled={!editable} maxLength={100}
            onChange={(e) => patch({ name: e.target.value })} />
        </Row>
        <div className="ss-row ss-row-block">
          <div className="ss-txt">
            <span className="ss-t">Couleur du rôle</span>
            <span className="ss-h">Le pseudo des membres prend la couleur de leur rôle le plus haut.</span>
          </div>
          <div className="ss-swatches">
            {SWATCHES.map((c) => (
              <button key={c} type="button" disabled={!editable}
                className={`ss-swatch${c === draft.color ? " on" : ""}`}
                aria-label={c === 0 ? "Aucune couleur" : `Couleur ${colorCss(c)}`} aria-pressed={c === draft.color}
                style={{ background: colorCss(c) }} onClick={() => patch({ color: c })} />
            ))}
          </div>
        </div>
      </Section>
      <Section>
        <Row title="Afficher séparément dans la liste des membres"
          hint="Le rôle a sa propre rubrique dans le panneau Membres.">
          <Toggle on={draft.hoist} disabled={!editable} label="Afficher séparément"
            onChange={(v) => patch({ hoist: v })} />
        </Row>
        <Row title="Tout le monde peut mentionner ce rôle"
          hint={`@${draft.name || roleName} prévient tous ses membres.`}>
          <Toggle on={draft.mentionable} disabled={!editable} label="Mentionnable"
            onChange={(v) => patch({ mentionable: v })} />
        </Row>
      </Section>
    </>
  );
}
