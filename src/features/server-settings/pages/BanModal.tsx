// Bannissement d'un membre : historique de messages à supprimer (0, 1 ou 7 jours).
import { useState } from "react";
import { srv } from "../api";
import { attempt } from "../api";
import { Modal, Segmented } from "../kit";

const HISTORY = [{ v: 0, label: "Aucun" }, { v: 1, label: "1 jour" }, { v: 7, label: "7 jours" }];

export function BanModal({ acc, guildId, userId, name, onClose, onDone }: {
  acc: string; guildId: string; userId: string; name: string; onClose: () => void;
  onDone: (outcome: { ok: true } | { ok: false; message: string }) => void;
}): React.JSX.Element {
  const [days, setDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const confirm = async (): Promise<void> => {
    setBusy(true);
    const r = await attempt(srv.memberBan(acc, guildId, userId, days));
    onDone(r.ok ? { ok: true } : { ok: false, message: r.message });
    onClose();
  };
  return (
    <Modal title={`Bannir ${name} ?`} onClose={onClose} footer={(
      <>
        <button type="button" className="ss-btn" onClick={onClose} disabled={busy}>Annuler</button>
        <button type="button" className="ss-btn danger" onClick={() => void confirm()} disabled={busy}>Bannir</button>
      </>
    )}>
      <p className="ss-modal-text">{name} quitte le serveur et ne peut plus revenir, même avec une invitation.</p>
      <span className="ss-label">Supprimer l'historique de messages</span>
      <Segmented value={days} options={HISTORY} onChange={setDays} label="Historique à supprimer" />
    </Modal>
  );
}
