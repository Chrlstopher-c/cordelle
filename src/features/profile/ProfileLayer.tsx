// Couche des profils montée une fois dans la coque : aperçu ancré au clic et profil complet en modale.
import { useEffect, useRef } from "react";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";
import { ProfileDetails, ProfileHeader, themeStyle } from "./ProfileParts";
import { profileKey, useProfiles } from "./profile-store";
import "./profile.css";

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const k = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
}

function useLoaded(userId: string, guildId: string | null) {
  const account = useActiveAccount();
  const load = useProfiles((s) => s.load);
  const key = profileKey(userId, guildId);
  const profile = useProfiles((s) => s.cache[key]);
  const error = useProfiles((s) => s.errors[key]);
  useEffect(() => { if (account) void load(account.id, userId, guildId); }, [account, load, userId, guildId]);
  return { profile, error };
}

function useDmWith(userId: string): string | null {
  return useEngine((s) => s.dms.find((c) => c.kind === "dm" && c.recipients[0]?.id === userId)?.id ?? null);
}

function Popout(): React.JSX.Element | null {
  const pop = useProfiles((s) => s.popout);
  const close = useProfiles((s) => s.close);
  const openModal = useProfiles((s) => s.openModal);
  const go = useNav((s) => s.go);
  const ref = useRef<HTMLDivElement>(null);
  const { profile, error } = useLoaded(pop?.userId ?? "", pop?.guildId ?? null);
  const dm = useDmWith(pop?.userId ?? "");
  useEscape(close);
  useEffect(() => {
    const down = (e: MouseEvent): void => { if (!ref.current?.contains(e.target as Node)) close(); };
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, [close]);
  if (!pop) return null;
  const left = Math.min(pop.anchor.x + 12, window.innerWidth - 352);
  const top = Math.max(8, Math.min(pop.anchor.y - 40, window.innerHeight - 520));
  return (
    <div className="pf-pop" ref={ref} style={{ left, top, ...themeStyle(profile) }}>
      {!profile ? <div style={{ padding: 24, color: "var(--text-faint)" }}>{error ?? "Chargement…"}</div> : (
        <>
          <ProfileHeader p={profile} />
          <div className="pf-body">
            <ProfileDetails p={profile} />
            <div style={{ display: "flex", gap: 8 }}>
              {dm && <button className="pf-btn" onClick={() => { close(); go({ kind: "dms", channelId: dm }); }}>Envoyer un message</button>}
              <button className="pf-btn ghost" onClick={() => openModal(pop.userId, pop.guildId)}>Voir le profil complet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Modal(): React.JSX.Element | null {
  const modal = useProfiles((s) => s.modal);
  const close = useProfiles((s) => s.close);
  const openPopout = useProfiles((s) => s.openPopout);
  const setTab = (tab: "activity" | "friends" | "guilds"): void =>
    useProfiles.setState((s) => (s.modal ? { modal: { ...s.modal, tab } } : {}));
  const openGuild = useNav((s) => s.openGuild);
  const go = useNav((s) => s.go);
  const { profile, error } = useLoaded(modal?.userId ?? "", modal?.guildId ?? null);
  const dm = useDmWith(modal?.userId ?? "");
  useEscape(close);
  if (!modal) return null;
  const tabs = [
    { id: "activity" as const, label: "Activité" },
    { id: "friends" as const, label: `${profile?.mutual_friends.length ?? 0} amis en commun` },
    { id: "guilds" as const, label: `${profile?.mutual_guilds.length ?? 0} serveurs en commun` },
  ];
  return (
    <div className="pf-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="pf-modal">
        <button className="pf-close" aria-label="Fermer" onClick={close}>✕</button>
        {!profile ? <div style={{ padding: 40, color: "var(--text-faint)" }}>{error ?? "Chargement…"}</div> : (
          <>
            <div className="left" style={themeStyle(profile)}>
              <ProfileHeader p={profile} tall />
              <div className="pf-body">
                {dm && <button className="pf-btn" style={{ alignSelf: "flex-start" }}
                  onClick={() => { close(); go({ kind: "dms", channelId: dm }); }}>Envoyer un message</button>}
                <ProfileDetails p={profile} full />
              </div>
            </div>
            <div className="right">
              <div className="pf-tabs" role="tablist">
                {tabs.map((t) => <button key={t.id} role="tab" aria-selected={modal.tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
              </div>
              {modal.tab === "activity" && <div style={{ color: "var(--text-faint)" }}>Aucune activité en cours.</div>}
              {modal.tab === "friends" && profile.mutual_friends.map((u) => (
                <button key={u.id} className="pf-row" onClick={(e) => openPopout(u.id, null, { x: e.clientX, y: e.clientY })}>
                  <Avatar id={u.id} name={u.global_name ?? u.username} url={u.avatar_url} size={40} />
                  <span style={{ fontWeight: 600 }}>{u.global_name ?? u.username}</span>
                </button>
              ))}
              {modal.tab === "guilds" && profile.mutual_guilds.map((g) => (
                <button key={g.id} className="pf-row" onClick={() => { close(); openGuild(g.id); }}>
                  <Avatar id={g.id} name={g.name || "?"} url={g.icon_url} size={40} radius={12} />
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600 }}>{g.name || "Serveur"}</span>
                    {g.nick && <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{g.nick}</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ProfileLayer(): React.JSX.Element {
  return <><Popout /><Modal /></>;
}
