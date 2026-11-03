// Pages « Compte » : Mon compte (infos, comptes, déconnexion) et Profil (nom affiché, bio, pronoms → Discord).
import { useEffect, useState } from "react";
import { commands } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";
import { useProfiles } from "../profile";
import { Card, Row } from "./controls";

export function AccountPage({ onClose }: { onClose: () => void }): React.JSX.Element | null {
  const account = useActiveAccount();
  const openOverlay = useNav((s) => s.openOverlay);
  const refresh = useEngine((s) => s.refreshAccounts);
  const [confirm, setConfirm] = useState(false);
  if (!account) return null;
  const u = account.user;
  const logout = async (): Promise<void> => { await commands.accountRemove(account.id); onClose(); await refresh(); };
  return (
    <>
      <h1>Mon compte</h1>
      <div className="st-sub">Les informations de ton compte Discord.</div>
      <Card>
        <Row title={u.global_name ?? u.username} hint={`Nom d'utilisateur : ${u.username}`}>
          <Avatar id={u.id} name={u.global_name ?? u.username} url={u.avatar_url} size={56} />
        </Row>
        <Row title="Comptes" hint="Ajouter un compte ou passer de l'un à l'autre.">
          <button className="btn-ghost" onClick={() => openOverlay({ kind: "accounts" })}>Gérer les comptes</button>
        </Row>
      </Card>
      <Card title="Session">
        <Row title="Se déconnecter" hint="Retire ce compte de Cordelle et efface son jeton de cette machine.">
          {confirm ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
              <button className="btn-accent" style={{ background: "var(--danger)" }} onClick={() => void logout()}>Se déconnecter</button>
            </div>
          ) : <button className="btn-ghost" style={{ color: "var(--danger-text)" }} onClick={() => setConfirm(true)}>Se déconnecter</button>}
        </Row>
      </Card>
    </>
  );
}

interface Draft { global_name: string; bio: string; pronouns: string }

export function ProfilePage(): React.JSX.Element | null {
  const account = useActiveAccount();
  const load = useProfiles((s) => s.load);
  const cached = useProfiles((s) => (account ? s.cache[`${account.user.id}:`] : undefined));
  const [initial, setInitial] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { if (account) void load(account.id, account.user.id, null); }, [account, load]);
  useEffect(() => {
    if (!cached || initial) return;
    const d = { global_name: cached.user.global_name ?? "", bio: cached.bio ?? "", pronouns: cached.pronouns ?? "" };
    setInitial(d); setDraft(d);
  }, [cached, initial]);
  if (!account || !draft || !initial) return <><h1>Profil</h1><div className="st-sub">Chargement…</div></>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const save = async (): Promise<void> => {
    const edit = {
      global_name: draft.global_name !== initial.global_name ? draft.global_name : null,
      bio: draft.bio !== initial.bio ? draft.bio : null,
      pronouns: draft.pronouns !== initial.pronouns ? draft.pronouns : null,
    };
    const r = await commands.profileUpdate(account.id, edit);
    if (r.status === "ok") { setInitial(draft); setStatus("Profil enregistré."); useProfiles.setState({ cache: {} }); }
    else setStatus(r.error.kind === "discord" ? r.error.message : "Enregistrement impossible.");
  };
  const field = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setDraft({ ...draft, [k]: e.target.value }); setStatus(null);
  };
  return (
    <>
      <h1>Profil</h1>
      <div className="st-sub">{status ?? "Ce que les autres voient en ouvrant ton profil."}</div>
      <Card>
        <Row title="Nom affiché" hint="Visible partout à la place de ton nom d'utilisateur.">
          <input className="st-input" value={draft.global_name} maxLength={32} onChange={field("global_name")} />
        </Row>
        <Row title="Pronoms"><input className="st-input" value={draft.pronouns} maxLength={40} onChange={field("pronouns")} /></Row>
        <div className="st-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <span className="st-t">À propos de moi</span>
          <textarea className="st-area" value={draft.bio} maxLength={190} onChange={field("bio")} />
        </div>
      </Card>
      {dirty && (
        <div className="st-bar">
          <span>Modifications non enregistrées</span>
          <button className="btn-ghost" onClick={() => setDraft(initial)}>Annuler</button>
          <button className="btn-accent" onClick={() => void save()}>Enregistrer</button>
        </div>
      )}
    </>
  );
}
