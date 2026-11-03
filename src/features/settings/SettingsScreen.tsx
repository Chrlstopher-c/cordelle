// Réglages plein écran (maquettes SettingsNav + Settings-*) : nav avec recherche, contenu centré, Échap ferme.
import { useEffect, useState } from "react";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";
import { AccountPage, ProfilePage } from "./pages-account";
import { AccessibilityPage, AppearancePage } from "./pages-app";
import { BillingPage, ConnectionsPage, SessionsPage } from "./pages-services";
import { VoicePage } from "./pages-voice";
import { NotificationsPage } from "./pages-notifications";
import { ShortcutsPage } from "./pages-shortcuts";
import { MessagesPage } from "./pages-messages";
import { AdvancedPage, ExtensionsPage } from "./pages-advanced";
import "./settings.css";
import "../home/home.css";

interface Page { id: string; group: string; label: string; keywords: string; footer?: boolean }
const PAGES: Page[] = [
  { id: "compte", group: "Compte", label: "Mon compte", keywords: "déconnexion comptes session" },
  { id: "profil", group: "Compte", label: "Profil", keywords: "bio pronoms nom affiché" },
  { id: "appareils", group: "Compte", label: "Appareils connectés",
    keywords: "sessions connexion déconnecter navigateur" },
  { id: "comptes-lies", group: "Compte", label: "Comptes liés",
    keywords: "twitch github youtube steam connexion profil" },
  { id: "voix", group: "Application", label: "Voix et vidéo",
    keywords: "micro haut-parleur casque volume bruit vumètre" },
  { id: "notifications", group: "Application", label: "Notifications", keywords: "bureau son mentions MP alertes" },
  { id: "raccourcis", group: "Application", label: "Raccourcis clavier", keywords: "touches ctrl échap entrée" },
  { id: "apparence", group: "Application", label: "Apparence",
    keywords: "thème clair sombre accent couleur taille texte densité zoom" },
  { id: "messages", group: "Application", label: "Messages", keywords: "embeds aperçus images réactions emoji" },
  { id: "accessibilite", group: "Application", label: "Accessibilité", keywords: "animations mouvement" },
  { id: "extensions", group: "Avancé", label: "Extensions et thèmes", keywords: "css thème personnalisé style" },
  { id: "avance", group: "Avancé", label: "Avancé", keywords: "développeur identifiant cache réinitialiser" },
  { id: "abonnement", group: "", label: "Abonnement et facturation",
    keywords: "facturation paiement abonnement", footer: true },
];

const VIEWS: Record<string, (onClose: () => void) => React.JSX.Element> = {
  compte: (close) => <AccountPage onClose={close} />,
  profil: () => <ProfilePage />,
  appareils: () => <SessionsPage />,
  "comptes-lies": () => <ConnectionsPage />,
  voix: () => <VoicePage />,
  notifications: () => <NotificationsPage />,
  raccourcis: () => <ShortcutsPage />,
  apparence: () => <AppearancePage />,
  messages: () => <MessagesPage />,
  accessibilite: () => <AccessibilityPage />,
  extensions: () => <ExtensionsPage />,
  avance: () => <AdvancedPage />,
  abonnement: () => <BillingPage />,
};

function NavItem({ page, active, onPick }: {
  page: Page; active: boolean; onPick: (id: string) => void;
}): React.JSX.Element {
  return (
    <button className={`st-item${active ? " on" : ""}`} onClick={() => onPick(page.id)}>{page.label}</button>
  );
}

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
  const main = shown.filter((p) => !p.footer);
  const groups = [...new Set(main.map((p) => p.group))];
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
            {main.filter((p) => p.group === g).map((p) => (
              <NavItem key={p.id} page={p} active={current === p.id} onPick={setCurrent} />
            ))}
          </div>
        ))}
        <div className="st-foot">
          {shown.filter((p) => p.footer).map((p) => (
            <NavItem key={p.id} page={p} active={current === p.id} onPick={setCurrent} />
          ))}
        </div>
      </nav>
      <div className="st-main">
        <button className="st-close" onClick={onClose} aria-label="Fermer les réglages"><span>✕</span>ÉCHAP</button>
        <div className="st-page" key={current}>
          {VIEWS[current]?.(onClose)}
        </div>
      </div>
    </div>
  );
}
