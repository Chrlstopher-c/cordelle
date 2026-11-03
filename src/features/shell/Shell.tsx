// Fenêtre principale : barre de titre, rail, barre latérale (salons ou MP), vue principale, surcouches.
import { lazy, Suspense } from "react";
import { useNav, type MainView } from "../../shared/data/nav-store";
import { ConversationView } from "../chat";
import { ActivityView, AddServerDialog, CommandPalette, EventsPanel, ExploreView, FriendsView, usePaletteShortcut } from "../home";
import { ChannelSettingsScreen } from "../server-settings";
import { ForumView } from "../search";
import { useEngine } from "../../shared/data/engine-store";
import { ProfileLayer } from "../profile";
import { ConnectionBanner, Toasts } from "../access";
import { ConfirmLayer } from "../../shared/ui/confirm";
import { ContextMenuLayer } from "../../shared/ui/context-menu";
import { CallView, VoiceStrip } from "../voice";
import { ChannelList } from "./ChannelList";
import { DmList } from "./DmList";
import { Rail } from "./Rail";
import { Titlebar } from "./Titlebar";
import { UserBar } from "./UserBar";
import "./shell.css";

const SettingsScreen = lazy(() => import("../settings").then((m) => ({ default: m.SettingsScreen })));
const ServerSettingsScreen = lazy(() => import("../server-settings").then((m) => ({ default: m.ServerSettingsScreen })));
const AccountsOverlay = lazy(() => import("../access/AccountsOverlay").then((m) => ({ default: m.AccountsOverlay })));

function Sidebar({ view }: { view: MainView }): React.JSX.Element {
  const guildId = view.kind === "guild" ? view.guildId : view.kind === "call" ? view.guildId : null;
  const channelId = view.kind === "guild" || view.kind === "call" || view.kind === "dms" ? view.channelId : null;
  return (
    <aside className="side">
      {guildId ? <ChannelList guildId={guildId} channelId={channelId} /> : <DmList channelId={channelId} />}
      <VoiceStrip />
      <UserBar />
    </aside>
  );
}

/** Salon de serveur : forum (liste de publications) ou conversation. */
function GuildChannel({ guildId, channelId }: { guildId: string; channelId: string }): React.JSX.Element {
  const kind = useEngine((s) => s.channelsByGuild[guildId]?.find((c) => c.id === channelId)?.kind);
  return kind === "forum" || kind === "media"
    ? <ForumView guildId={guildId} channelId={channelId} />
    : <ConversationView guildId={guildId} channelId={channelId} />;
}

function Main({ view }: { view: MainView }): React.JSX.Element {
  switch (view.kind) {
    case "guild":
      return view.channelId ? <GuildChannel guildId={view.guildId} channelId={view.channelId} /> : <div />;
    case "dms":
      return view.channelId ? <ConversationView guildId={null} channelId={view.channelId} /> : <FriendsView />;
    case "friends":
      return <FriendsView />;
    case "activity":
      return <ActivityView />;
    case "explore":
      return <ExploreView />;
    case "call":
      return <CallView guildId={view.guildId} channelId={view.channelId} />;
  }
}

export function Shell(): React.JSX.Element {
  const view = useNav((s) => s.view);
  const overlay = useNav((s) => s.overlay);
  const close = useNav((s) => s.closeOverlay);
  usePaletteShortcut();

  if (overlay.kind === "settings" || overlay.kind === "server-settings") {
    return (
      <div className="app">
        <Titlebar label={overlay.kind === "settings" ? "Réglages" : "Réglages du serveur"} />
        <Suspense fallback={null}>
          {overlay.kind === "settings"
            ? <SettingsScreen page={overlay.page} onClose={close} />
            : <ServerSettingsScreen guildId={overlay.guildId} page={overlay.page} onClose={close} />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app">
      <Titlebar />
      <ConnectionBanner />
      <div className="app-body">
        <Rail />
        <Sidebar view={view} />
        <main className="app-main"><Main view={view} /></main>
      </div>
      {overlay.kind === "accounts" && <Suspense fallback={null}><AccountsOverlay onClose={close} /></Suspense>}
      <ProfileLayer />
      <ContextMenuLayer />
      <ConfirmLayer />
      <Toasts />
      {overlay.kind === "palette" && <CommandPalette onClose={close} />}
      {overlay.kind === "add-server" && <AddServerDialog onClose={close} />}
      {overlay.kind === "events" && (
        <div className="ov-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="ov-box"><EventsPanel guildId={overlay.guildId} /></div>
        </div>
      )}
      {overlay.kind === "channel-settings" && (
        <div className="ov-full"><ChannelSettingsScreen guildId={overlay.guildId} channelId={overlay.channelId} onClose={close} /></div>
      )}
    </div>
  );
}
