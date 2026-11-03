// Réglages du serveur : nav (9 pages), contenu centré, Échap ferme (sauf si une modale est ouverte).
import { Fragment, useEffect, useState } from "react";
import { srv } from "./api";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { ConfirmLayer } from "../../shared/ui/confirm";
import { Avatar } from "../../shared/ui/Avatar";
import { attempt, type PageProps } from "./api";
import { Empty, Flash, useFlash } from "./kit";
import { AuditPage } from "./pages/AuditPage";
import { AutomodPage } from "./pages/AutomodPage";
import { BansPage } from "./pages/BansPage";
import { EmojiPage } from "./pages/EmojiPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { InvitesPage } from "./pages/InvitesPage";
import { MembersPage } from "./pages/MembersPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RolesPage } from "./pages/RolesPage";
import { useLoad } from "./use-load";
import "./server-settings.css";

interface Props { guildId: string; page: string; onClose: () => void }

const NAV: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: "Serveur",
    items: [{ id: "vue", label: "Vue d'ensemble" }, { id: "roles", label: "Rôles" }, { id: "emoji", label: "Emoji" }],
  },
  {
    group: "Membres",
    items: [
      { id: "membres", label: "Membres" }, { id: "invitations", label: "Invitations" },
      { id: "bans", label: "Bannissements" },
    ],
  },
  {
    group: "Modération",
    items: [
      { id: "automod", label: "AutoMod" }, { id: "audit", label: "Journal d'audit" },
      { id: "integrations", label: "Intégrations et bots" },
    ],
  },
];

function renderPage(id: string, props: PageProps): React.JSX.Element {
  switch (id) {
    case "roles": return <RolesPage {...props} />;
    case "emoji": return <EmojiPage {...props} />;
    case "membres": return <MembersPage {...props} />;
    case "invitations": return <InvitesPage {...props} />;
    case "bans": return <BansPage {...props} />;
    case "automod": return <AutomodPage {...props} />;
    case "audit": return <AuditPage {...props} />;
    case "integrations": return <IntegrationsPage {...props} />;
    default: return <OverviewPage {...props} />;
  }
}

export function ServerSettingsScreen({ guildId, page, onClose }: Props): React.JSX.Element {
  const acc = useActiveAccount()?.id ?? "";
  const [current, setCurrent] = useState(page);
  const info = useLoad(() => attempt(srv.guildInfo(acc, guildId)), [acc, guildId]);
  const { message: toast, flash } = useFlash();

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !document.querySelector(".ss-veil, .cf-veil")) onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const guild = info.data;
  return (
    <div className="ss">
      <nav className="ss-nav" aria-label="Réglages du serveur">
        <div className="ss-me">
          <Avatar id={guildId} name={guild?.name ?? "…"} url={guild?.icon_url} size={40} radius={10} />
          <div className="ss-me-txt"><b>{guild?.name ?? "…"}</b><span>Réglages du serveur</span></div>
        </div>
        {NAV.map((group) => (
          <Fragment key={group.group}>
            <div className="ss-group">{group.group}</div>
            {group.items.map((item) => (
              <button key={item.id} type="button" aria-current={current === item.id ? "page" : undefined}
                className={`ss-item${current === item.id ? " on" : ""}`} onClick={() => setCurrent(item.id)}>
                {item.label}
              </button>
            ))}
          </Fragment>
        ))}
      </nav>
      <main className="ss-main">
        <button type="button" className="ss-close" onClick={onClose} aria-label="Fermer les réglages du serveur">
          <span>✕</span>ÉCHAP
        </button>
        {info.message && <Empty>{info.message}</Empty>}
        {guild && (
          <div className="ss-body" key={current}>
            {renderPage(current, { acc, guildId, perms: guild.permissions, flash })}
          </div>
        )}
        <Flash message={toast} />
      </main>
      <ConfirmLayer />
    </div>
  );
}
