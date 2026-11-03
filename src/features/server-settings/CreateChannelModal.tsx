// Créer un salon (texte ou vocal) dans le serveur ; la liste des salons est rechargée après création.
import { useState } from "react";
import { srv } from "./api";
import type { NewChannelKind } from "./server-contract";
import { attempt } from "./api";
import { Modal, Segmented } from "./kit";
import { useEngine } from "../../shared/data/engine-store";

const KINDS: { v: NewChannelKind; label: string }[] = [{ v: "text", label: "Texte" }, { v: "voice", label: "Vocal" }];

export function CreateChannelModal({ acc, guildId, onClose, onError }: {
  acc: string; guildId: string; onClose: () => void; onError: (message: string) => void;
}): React.JSX.Element {
  const [kind, setKind] = useState<NewChannelKind>("text");
  const [name, setName] = useState("nouveau-salon");
  const [busy, setBusy] = useState(false);
  const loadChannels = useEngine((s) => s.loadChannels);

  const create = async (): Promise<void> => {
    if (!name.trim()) return;
    setBusy(true);
    const r = await attempt(srv.channelCreate(acc, guildId, name.trim(), kind));
    setBusy(false);
    if (r.ok) {
      void loadChannels(acc, guildId);
      onClose();
    } else onError(r.message);
  };

  return (
    <Modal title="Créer un salon" onClose={onClose} footer={(
      <>
        <button type="button" className="ss-btn" onClick={onClose} disabled={busy}>Annuler</button>
        <button type="button" className="ss-btn primary" onClick={() => void create()} disabled={busy || !name.trim()}>
          Créer le salon
        </button>
      </>
    )}>
      <span className="ss-label">Type de salon</span>
      <Segmented value={kind} options={KINDS} onChange={setKind} label="Type de salon" />
      <span className="ss-label">Nom du salon</span>
      <input className="ss-input wide" aria-label="Nom du salon" value={name} maxLength={100}
        onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
    </Modal>
  );
}
