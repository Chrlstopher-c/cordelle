// Rejoindre un serveur avec un lien d'invitation : aperçu du serveur, puis adhésion.
import { useState } from "react";
import { inviteAccept, type InvitePreview } from "./api";
import { useNav } from "../../shared/data/nav-store";
import { Avatar } from "../../shared/ui/Avatar";
import { errorText } from "./engine-error";
import { inviteCode } from "./invite-code";
import { useInvitePreview } from "./use-invite-preview";

interface Props {
  accountId: string;
  onJoined: () => void;
}

const count = (n: number): string => n.toLocaleString("fr-FR");

function PreviewCard({ preview }: { preview: InvitePreview }): React.JSX.Element {
  return (
    <div className="dlg-preview">
      <Avatar id={preview.guild_id} name={preview.guild_name} url={preview.icon_url} size={52} radius={14} />
      <div className="dlg-preview-text">
        <b>{preview.guild_name}</b>
        <span className="dlg-muted">
          {count(preview.online_count)} en ligne · {count(preview.member_count)} membres
          {preview.channel_name ? ` · #${preview.channel_name}` : ""}
        </span>
      </div>
    </div>
  );
}

export function JoinInvite({ accountId, onJoined }: Props): React.JSX.Element {
  const openGuild = useNav((s) => s.openGuild);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const code = inviteCode(link);
  const { preview, loading, error } = useInvitePreview(accountId, code);

  const join = async (): Promise<void> => {
    if (!code || !preview) return;
    setBusy(true);
    setJoinError(null);
    try {
      const r = await inviteAccept(accountId, code);
      if (r.status === "error") {
        setJoinError(errorText(r.error));
        return;
      }
      onJoined();
      openGuild(r.data);
    } catch (e) {
      console.error("[accueil] adhésion impossible", e);
      setJoinError("Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dlg-body">
      <label className="dlg-label" htmlFor="join-link">Lien d'invitation</label>
      <input id="join-link" className="dlg-input" autoFocus placeholder="https://discord.gg/hTKzmak" value={link}
        onChange={(e) => setLink(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void join(); }} />
      {link.trim() !== "" && code === null && <p className="dlg-error">Ce lien ne ressemble pas à une invitation.</p>}
      {loading && <p className="dlg-muted">Recherche de l'invitation…</p>}
      {error && <p className="dlg-error">{error}</p>}
      {preview && <PreviewCard preview={preview} />}
      {joinError && <p className="dlg-error">{joinError}</p>}
      <div className="dlg-foot">
        <button className="btn-accent" disabled={!preview || busy} onClick={() => void join()}>Rejoindre</button>
      </div>
    </div>
  );
}
