// Couche des profils, montée une fois dans la coque : aperçu ancré au clic et profil complet en modale.
// Un clic dans la fenêtre ne la ferme jamais ; seuls un clic dehors ou Échap la ferment.
import { useEffect, useRef, useState } from "react";
import { useNav } from "../../shared/data/nav-store";
import { Avatar } from "../../shared/ui/Avatar";
import { About, Banner, Connections, displayName, Identity, Note, ProfileAvatar, useGuildName } from "./ProfileParts";
import { useProfiles } from "./profile-store";
import { useLoadedProfile, useOpenDm } from "./use-profile-actions";
import "./profile.css";

function useEscape(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const k = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [active, onClose]);
}

function Popout(): React.JSX.Element | null {
  const pop = useProfiles((s) => s.popout);
  const close = useProfiles((s) => s.close);
  const openModal = useProfiles((s) => s.openModal);
  const openDm = useOpenDm();
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const { profile, error } = useLoadedProfile(pop?.userId ?? null, pop?.guildId ?? null);
  const guildName = useGuildName(pop?.guildId ?? null);
  useEscape(!!pop, close);
  useEffect(() => {
    if (!pop) return;
    setDraft("");
    const down = (e: MouseEvent): void => { if (!ref.current?.contains(e.target as Node)) close(); };
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, [pop, close]);
  if (!pop) return null;
  const left = Math.min(pop.anchor.x + 12, window.innerWidth - 352);
  const top = Math.max(8, Math.min(pop.anchor.y - 60, window.innerHeight - 560));
  const full = (): void => openModal(pop.userId, pop.guildId);
  return (
    <div className="pf-pop" ref={ref} role="dialog" style={{ left, top }}>
      {!profile ? <div style={{ padding: 24, color: "var(--text-faint)" }}>{error ?? "Chargement…"}</div> : (
        <>
          <Banner p={profile} />
          <div className="pf-inner">
            <ProfileAvatar p={profile} onOpen={full} />
            <Identity p={profile} />
            <div className="pf-card">
              <About p={profile} guildName={guildName} />
              <Note p={profile} />
            </div>
            <div className="pf-dm">
              <input value={draft} placeholder={`Envoyer un message à @${displayName(profile)}`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) void openDm(pop.userId, draft); }} />
            </div>
            <button className="pf-full-btn" onClick={full}>Voir le profil complet</button>
          </div>
        </>
      )}
    </div>
  );
}

type Tab = "activity" | "friends" | "guilds";

function FullProfile(): React.JSX.Element | null {
  const modal = useProfiles((s) => s.modal);
  const close = useProfiles((s) => s.close);
  const openPopout = useProfiles((s) => s.openPopout);
  const openGuild = useNav((s) => s.openGuild);
  const openDm = useOpenDm();
  const [tab, setTab] = useState<Tab>("activity");
  const { profile, error } = useLoadedProfile(modal?.userId ?? null, modal?.guildId ?? null);
  const guildName = useGuildName(modal?.guildId ?? null);
  useEscape(!!modal, close);
  useEffect(() => setTab("activity"), [modal?.userId]);
  if (!modal) return null;
  const tabs: { id: Tab; label: string }[] = [
    { id: "activity", label: "À propos" },
    { id: "guilds", label: `Serveurs en commun (${profile?.mutual_guilds.length ?? 0})` },
    { id: "friends", label: `Amis en commun (${profile?.mutual_friends.length ?? 0})` },
  ];
  return (
    <div className="pf-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="pf-box" role="dialog" aria-label="Profil complet">
        <button className="pf-x" aria-label="Fermer" onClick={close}>✕</button>
        {!profile ? <div style={{ padding: 40, color: "var(--text-faint)" }}>{error ?? "Chargement…"}</div> : (
          <>
            <Banner p={profile} />
            <div className="pf-box-head">
              <ProfileAvatar p={profile} big />
              <div style={{ flex: 1 }} />
              <button className="pf-act" onClick={() => void openDm(profile.user.id)}>Envoyer un message</button>
            </div>
            <div style={{ padding: "8px 24px 0" }}><Identity p={profile} big /></div>
            <div className="pf-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} role="tab" className="pf-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <div className="pf-tabbody" key={tab}>
              {tab === "activity" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <About p={profile} guildName={guildName} />
                  <Connections p={profile} />
                  <Note p={profile} boxed />
                </div>
              )}
              {tab === "guilds" && profile.mutual_guilds.map((g) => (
                <button key={g.id} className="pf-li" onClick={() => { close(); openGuild(g.id); }}>
                  <Avatar id={g.id} name={g.name || "?"} url={g.icon_url} size={36} radius={10} />
                  <span style={{ flex: 1 }}>{g.name || "Serveur"}</span>
                  {g.nick && <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{g.nick}</span>}
                </button>
              ))}
              {tab === "friends" && profile.mutual_friends.map((u) => (
                <button key={u.id} className="pf-li" onClick={(e) => openPopout(u.id, null, { x: e.clientX, y: e.clientY })}>
                  <Avatar id={u.id} name={u.global_name ?? u.username} url={u.avatar_url} size={34} />
                  <span style={{ flex: 1 }}>{u.global_name ?? u.username}</span>
                </button>
              ))}
              {tab !== "activity" && (tab === "guilds" ? profile.mutual_guilds : profile.mutual_friends).length === 0 && (
                <div style={{ color: "var(--text-faint)" }}>Rien en commun pour l'instant.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ProfileLayer(): React.JSX.Element {
  return <><Popout /><FullProfile /></>;
}
