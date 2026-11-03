// Menu du serveur (clic sur la bannière de la liste des salons) :
// inviter, réglages, créer un salon, marquer comme lu, quitter.
import { useState } from "react";
import { srv } from "./api";
import { markChannel, useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { useConfirm } from "../../shared/ui/confirm";
import { attempt, can, PERM } from "./api";
import { CreateChannelModal } from "./CreateChannelModal";
import { InviteDialog } from "./InviteDialog";
import { useLoad } from "./use-load";
import "./server-settings.css";

interface Props { guildId: string; onClose: () => void }
type Dialog = "invite" | "channel" | null;

export function ServerMenu({ guildId, onClose }: Props): React.JSX.Element {
  const acc = useActiveAccount()?.id ?? "";
  const info = useLoad(() => attempt(srv.guildInfo(acc, guildId)), [acc, guildId]);
  const channels = useLoad(() => attempt(srv.channelsList(acc, guildId)), [acc, guildId]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const askConfirm = useConfirm((s) => s.confirm);
  const openOverlay = useNav((s) => s.openOverlay);
  const inviteChannel = channels.data?.find((c) => c.kind === "text" || c.kind === "announcement")?.id;

  const askError = (message: string): void => askConfirm({
    title: "Action impossible", body: message, action: "OK", run: () => undefined,
  });

  if (dialog === "channel") {
    return <CreateChannelModal acc={acc} guildId={guildId} onClose={onClose} onError={askError} />;
  }
  if (dialog === "invite" && inviteChannel) {
    return <InviteDialog guildId={guildId} channelId={inviteChannel} onClose={onClose} />;
  }

  const guild = info.data;
  const openSettings = (): void => {
    onClose();
    openOverlay({ kind: "server-settings", guildId, page: "vue" });
  };

  const markRead = (): void => {
    onClose();
    void attempt(srv.guildAck(acc, guildId)).then((r) => { if (!r.ok) askError(r.message); });
    useEngine.setState((s) => {
      let next: Partial<typeof s> = {};
      for (const c of s.channelsByGuild[guildId] ?? []) {
        next = { ...next, ...markChannel({ ...s, ...next }, c.id, false, 0) };
      }
      const guilds = (next.guilds ?? s.guilds).map((x) =>
        (x.id === guildId ? { ...x, unread: false, mention_count: 0 } : x));
      return { ...next, guilds };
    });
  };

  const leave = (): void => {
    if (!guild) return;
    onClose();
    askConfirm({
      title: `Quitter ${guild.name}`,
      body: "Tu ne pourras pas revenir sans nouvelle invitation.",
      action: "Quitter le serveur",
      run: () => void attempt(srv.guildLeave(acc, guildId)).then((r) => {
        if (r.ok) useNav.getState().go({ kind: "friends" }); else askError(r.message);
      }),
    });
  };

  return (
    <>
      <button type="button" className="ss-veil-clear" aria-label="Fermer le menu" onClick={onClose} />
      <div className="ss-menu" role="menu" aria-label="Menu du serveur">
        {guild && (
          <>
            {inviteChannel && can(guild.permissions, PERM.CREATE_INVITE) && (
              <MenuItem label="Inviter des gens" accent onClick={() => setDialog("invite")} />
            )}
            <MenuItem label="Réglages du serveur" onClick={openSettings} />
            <div className="ss-sep" />
            {can(guild.permissions, PERM.MANAGE_CHANNELS) && (
              <MenuItem label="Créer un salon" onClick={() => setDialog("channel")} />
            )}
            <MenuItem label="Marquer comme lu" onClick={markRead} />
            {guild.owner_id !== acc && (
              <>
                <div className="ss-sep" />
                <MenuItem label="Quitter le serveur" danger onClick={leave} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function MenuItem({ label, onClick, danger, accent }: {
  label: string; onClick: () => void; danger?: boolean; accent?: boolean;
}): React.JSX.Element {
  const cls = ["ss-mi", danger ? "danger" : "", accent ? "accent" : ""].filter(Boolean).join(" ");
  return <button type="button" role="menuitem" className={cls} onClick={onClick}>{label}</button>;
}
