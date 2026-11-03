// Réglages plein écran (maquette SettingsNav + Settings-*) : nav avec recherche, contenu centré, Échap ferme.
import { useEffect, useState } from "react";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";
import { AccountPage, ProfilePage } from "./pages-account";
import { AccessibilityPage, AppearancePage } from "./pages-app";
import "./settings.css";
import "../home/home.css";

interface Page { id: string; group: string; label: string; keywords: string }
const PAGES: Page[] = [
  { id: "compte", group: "Compte", label: "Mon compte", keywords: "déconnexion comptes session" },
  { id: "profil", group: "Compte", label: "Profil", keywords: "bio pronoms nom affiché" },
  { id: "apparence", group: "Application", label: "Apparence", keywords: "thème clair sombre accent couleur taille texte densité zoom" },
  { id: "accessibilite", group: "Application", label: "Accessibilité", keywords: "animations mouvement" },
];

export function SettingsScreen({ page, onClose }: { page: string; onClose: () => void }): React.JSX.Element {
  const account = useActiveAccount();
  const [current, setCurrent] = useState(PAGES.some((p) => p.id === page) ? page : "compte");
  const [q, setQ] = useState("");
  useEffect(() => {
    const k = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const shown = PAGES.filter((p) => !q || `${p.label} ${p.keywords}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(shown.map((p) => p.group))];
  const u = account?.user;
  return (
    <div className="st">
      <nav className="st-nav" aria-label="Réglages">
        {u && (
          <div className="st-me">
            <Avatar id={u.id} name={u.global_name ?? u.username} url={u.avatar_url} size={36} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <b>{u.global_name ?? u.username}</b><span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{u.username}</span>
            </div>
          </div>
        )}
        <input className="st-search" placeholder="Rechercher un réglage" value={q} onChange={(e) => setQ(e.target.value)} />
        {groups.map((g) => (
          <div key={g} style={{ display: "contents" }}>
            <div className="st-group">{g}</div>
            {shown.filter((p) => p.group === g).map((p) => (
              <button key={p.id} className={`st-item${current === p.id ? " on" : ""}`} onClick={() => setCurrent(p.id)}>{p.label}</button>
            ))}
          </div>
        ))}
      </nav>
      <div className="st-main">
        <button className="st-close" onClick={onClose} aria-label="Fermer les réglages"><span>✕</span>ÉCHAP</button>
        <div className="st-page" key={current}>
          {current === "compte" && <AccountPage onClose={onClose} />}
          {current === "profil" && <ProfilePage />}
          {current === "apparence" && <AppearancePage />}
          {current === "accessibilite" && <AccessibilityPage />}
        </div>
      </div>
    </div>
  );
}
