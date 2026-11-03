// Partage d'écran dans la barre d'appel : le bouton démarre (ou arrête) avec la dernière qualité ; la flèche ouvre
// le menu des qualités et « Arrêter le partage ». Changer de qualité pendant un partage le redémarre.
import { useRef, useState } from "react";
import { ChevronIcon, ScreenIcon } from "./icons";
import { ShareMenu } from "./ShareMenu";
import { useCloseOnOutside } from "./use-device-menu";
import { useShare } from "./use-share";

export function ShareControl({ accountId }: { accountId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnOutside(open, ref, () => setOpen(false));
  const share = useShare(accountId, () => setOpen(false));
  return (
    <>
      <div className="cb-group" ref={ref}>
        <button className={`cb-btn${share.streaming ? " on" : ""}`} aria-pressed={share.streaming}
          aria-label={share.streaming ? "Arrêter le partage d'écran" : "Partager l'écran"} onClick={share.toggle}>
          <ScreenIcon />
        </button>
        <button className="cb-chev" aria-haspopup="menu" aria-expanded={open} aria-label="Qualité du partage"
          onClick={() => setOpen((o) => !o)}>
          <ChevronIcon />
        </button>
        {open && (
          <ShareMenu streaming={share.streaming} chosen={share.chosen} onPick={share.pick} onStop={share.stop} />
        )}
      </div>
      {share.error && <span className="share-error" role="alert">{share.error}</span>}
    </>
  );
}
