// Inviter : lien d'invitation créé à l'ouverture, copie, durée et utilisations modifiables.
import { useEffect, useState } from "react";
import { srv } from "./api";
import type { Invite } from "./server-contract";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { attempt } from "./api";
import { fromIso } from "./format";
import { DURATIONS, InviteOptions } from "./invite-options";
import { Modal } from "./kit";
import { inviteLink } from "./pages/InvitesPage";
import { useLoad } from "./use-load";
import "./server-settings.css";

interface Props { guildId: string; channelId: string; onClose: () => void }

export function InviteDialog({ guildId, channelId, onClose }: Props): React.JSX.Element {
  const acc = useActiveAccount()?.id ?? "";
  const guild = useLoad(() => attempt(srv.guildInfo(acc, guildId)), [acc, guildId]);
  const channel = useLoad(() => attempt(srv.channelInfo(acc, channelId)), [acc, channelId]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [options, setOptions] = useState(false);
  const [maxAge, setMaxAge] = useState(DURATIONS[5].v);
  const [maxUses, setMaxUses] = useState(0);
  const [copied, setCopied] = useState(false);

  const create = async (age: number, uses: number): Promise<void> => {
    const r = await attempt(srv.inviteCreate(acc, channelId, age, uses));
    if (r.ok) { setInvite(r.data); setFailure(null); } else setFailure(r.message);
  };

  useEffect(() => { void create(maxAge, maxUses); }, []);

  const copy = (): void => {
    if (!invite) return;
    void navigator.clipboard.writeText(inviteLink(invite.code));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async (): Promise<void> => {
    await create(maxAge, maxUses);
    setOptions(false);
  };

  const link = invite ? inviteLink(invite.code) : "";
  const title = `Inviter des gens sur ${guild.data?.name ?? "le serveur"}`;
  const footer = options ? (
    <>
      <button type="button" className="ss-btn" onClick={() => setOptions(false)}>Retour</button>
      <button type="button" className="ss-btn primary" onClick={() => void regenerate()}>
        Générer un nouveau lien
      </button>
    </>
  ) : (
    <button type="button" className="ss-btn primary" onClick={onClose}>Terminé</button>
  );

  return (
    <Modal title={options ? "Réglages du lien d'invitation" : title} onClose={onClose} footer={footer}>
      {!options ? (
        <>
          <p className="ss-modal-text">
            Ils arriveront dans <span className="ss-strong">#{channel.data?.name ?? "…"}</span>
          </p>
          <div className="ss-link">
            <input readOnly aria-label="Lien d'invitation" value={link} placeholder={failure ?? "Création du lien…"} />
            <button type="button" className="ss-btn primary" onClick={copy} disabled={!invite}>
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          {failure && <p className="ss-notice">{failure}</p>}
          <p className="ss-h">
            Expire {fromIso(invite?.expires_at)}{" "}
            <button type="button" className="ss-inline" onClick={() => setOptions(true)}>Modifier le lien</button>
          </p>
        </>
      ) : (
        <>
          <InviteOptions maxAge={maxAge} maxUses={maxUses} onAge={setMaxAge} onUses={setMaxUses} />
        </>
      )}
    </Modal>
  );
}
