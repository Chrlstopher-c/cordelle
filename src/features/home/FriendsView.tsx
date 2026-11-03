// Amis (maquette Amis) : onglets Tous / En attente / Bloqués / Ajouter un ami ; recherche ; actions par ligne.
import { useState } from "react";
import type { Relationship } from "../../contract/bindings";
import { Avatar } from "../../shared/ui/Avatar";
import { useProfiles } from "../profile";
import { useOpenDm } from "../profile/use-profile-actions";
import { useFriends } from "./use-friends";
import "./home.css";

type Tab = "all" | "pending" | "blocked" | "add";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Tous" }, { id: "pending", label: "En attente" }, { id: "blocked", label: "Bloqués" },
];

const name = (r: Relationship): string => r.nickname ?? r.user.global_name ?? r.user.username;
const STATUS: Record<string, string> = { friend: "Ami", incoming: "Demande reçue", outgoing: "Demande envoyée", blocked: "Bloqué" };

function AddFriend({ request }: { request: (u: string) => Promise<string | null> }): React.JSX.Element {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async (): Promise<void> => {
    if (!value.trim()) { setMsg({ ok: false, text: "Saisis un nom d'utilisateur avant d'envoyer." }); return; }
    const err = await request(value);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: `Demande envoyée à ${value}. Elle apparaît dans « En attente ».` });
    if (!err) setValue("");
  };
  return (
    <div>
      <h3 style={{ margin: "0 0 4px" }}>Ajouter un ami</h3>
      <p style={{ margin: "0 0 14px", color: "var(--text-muted)", fontSize: 14 }}>Tu peux ajouter quelqu'un avec son nom d'utilisateur.</p>
      <div className="add-box">
        <input value={value} placeholder="Nom d'utilisateur" onChange={(e) => { setValue(e.target.value); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }} />
        <button className="btn-accent" disabled={!value.trim()} onClick={() => void send()}>Envoyer la demande</button>
      </div>
      {msg && <p style={{ fontSize: 13.5, color: msg.ok ? "var(--success-text)" : "var(--danger-text)" }}>{msg.text}</p>}
    </div>
  );
}

const Icon = ({ d }: { d: string }): React.JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);

function Row({ r, act }: { r: Relationship; act: (id: string, a: "accept" | "remove" | "block") => void }): React.JSX.Element {
  const openPopout = useProfiles((s) => s.openPopout);
  const openDm = useOpenDm();
  const show = (e: React.MouseEvent): void => openPopout(r.user.id, null, { x: e.clientX, y: e.clientY });
  return (
    <div className="fr-row">
      <span onClick={show} style={{ cursor: "pointer" }}><Avatar id={r.user.id} name={name(r)} url={r.user.avatar_url} size={36} /></span>
      <div className="who" onClick={show}><span className="n">{name(r)}</span><span className="s">{r.user.username} · {STATUS[r.kind]}</span></div>
      {r.kind === "friend" && <button className="round" aria-label="Message" onClick={() => void openDm(r.user.id)}><Icon d="M4 5h16v11H9l-5 4z" /></button>}
      {r.kind === "incoming" && <button className="round ok" aria-label="Accepter" onClick={() => act(r.user.id, "accept")}><Icon d="m5 12 5 5 9-10" /></button>}
      {r.kind !== "friend" && (
        <button className="round no" aria-label={r.kind === "blocked" ? "Débloquer" : "Refuser"} onClick={() => act(r.user.id, "remove")}>
          <Icon d="M6 6l12 12M18 6 6 18" />
        </button>
      )}
      {r.kind === "friend" && <button className="round no" aria-label="Retirer l'ami" onClick={() => act(r.user.id, "remove")}><Icon d="M6 6l12 12M18 6 6 18" /></button>}
    </div>
  );
}

export function FriendsView(): React.JSX.Element {
  const { list, loading, act, request } = useFriends();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const shown = list
    .filter((r) => (tab === "all" ? r.kind === "friend" : tab === "pending" ? r.kind === "incoming" || r.kind === "outgoing" : r.kind === "blocked"))
    .filter((r) => !q || name(r).toLowerCase().includes(q.toLowerCase()) || r.user.username.includes(q.toLowerCase()))
    .sort((a, b) => name(a).localeCompare(name(b)));
  const pending = list.filter((r) => r.kind === "incoming").length;
  return (
    <div className="hv">
      <header className="hv-head">
        <span className="t">Amis</span>
        {TABS.map((t) => (
          <button key={t.id} className="hv-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}{t.id === "pending" && pending > 0 ? ` (${pending})` : ""}
          </button>
        ))}
        <button className="hv-tab add" aria-selected={tab === "add"} onClick={() => setTab("add")}>Ajouter un ami</button>
      </header>
      <div className="hv-body">
        {tab === "add" ? <AddFriend request={request} /> : (
          <>
            <input className="hv-search" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="hv-count">{loading ? "Chargement…" : `${shown.length} — ${TABS.find((t) => t.id === tab)?.label}`}</div>
            {shown.map((r) => <Row key={r.user.id} r={r} act={(id, a) => void act(id, a)} />)}
          </>
        )}
      </div>
    </div>
  );
}
