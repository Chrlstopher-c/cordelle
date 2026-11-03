// Fenêtre principale : barre de titre, rail, barre latérale (salons ou MP), vue principale, surcouches.
import { lazy, Suspense } from "react";
import { useNav, type MainView } from "../../shared/data/nav-store";
import { ConversationView } from "../chat";
import { ActivityView, ExploreView, FriendsView } from "../home";
import { CallView } from "../voice";
import { ChannelList } from "./ChannelList";
import { DmList } from "./DmList";
import { Rail } from "./Rail";
import { Titlebar } from "./Titlebar";
import { UserBar } from "./UserBar";
import "./shell.css";

const SettingsScreen = lazy(() => import("../settings").then((m) => ({ default: m.SettingsScreen })));
const ServerSettingsScreen = lazy(() => import("../server-settings").then((m) => ({ default: m.ServerSettingsScreen })));
const AccountsOverlay = lazy(() => import("../access").then((m) => ({ default: m.AccountsOverlay })));

function Sidebar({ view }: { view: MainView }): React.JSX.Element {
  const guildId = view.kind === "guild" ? view.guildId : view.kind === "call" ? view.guildId : null;
  const channelId = view.kind === "guild" || view.kind === "call" || view.kind === "dms" ? view.channelId : null;
  return (
    <aside className="side">
      {guildId ? <ChannelList guildId={guildId} channelId={channelId} /> : <DmList channelId={channelId} />}
      <UserBar />
    </aside>
  );
}

function Main({ view }: { view: MainView }): React.JSX.Element {
  switch (view.kind) {
    case "guild":
      return view.channelId ? <ConversationView guildId={view.guildId} channelId={view.channelId} /> : <div />;
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
      <div className="app-body">
        <Rail />
        <Sidebar view={view} />
        <main className="app-main"><Main view={view} /></main>
      </div>
      {overlay.kind === "accounts" && <Suspense fallback={null}><AccountsOverlay onClose={close} /></Suspense>}
    </div>
  );
}
