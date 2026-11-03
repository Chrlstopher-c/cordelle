// Menu du partage : qualités (coche sur la qualité en cours) et « Arrêter le partage » pendant un partage.
import { CheckIcon } from "./icons";
import { QUALITY_CHOICES, type QualityChoice } from "./stream-store";

interface Props {
  streaming: boolean;
  chosen: QualityChoice;
  onPick: (choice: QualityChoice) => void;
  onStop: () => void;
}

export function ShareMenu({ streaming, chosen, onPick, onStop }: Props): React.JSX.Element {
  return (
    <div className="menu share-menu" role="menu" aria-label="Partage d'écran">
      <span className="dev-title">Qualité</span>
      {QUALITY_CHOICES.map((choice) => {
        const current = streaming && chosen.id === choice.id;
        return (
          <button key={choice.id} className="menu-item" role="menuitemradio" aria-checked={current}
            onClick={() => onPick(choice)}>
            <span className="dev-check">{current && <CheckIcon />}</span>
            <span className="dev-name">{choice.label}</span>
          </button>
        );
      })}
      {streaming && (
        <>
          <div className="share-sep" />
          <button className="menu-item share-stop" role="menuitem" onClick={onStop}>
            <span className="dev-name">Arrêter le partage</span>
          </button>
        </>
      )}
    </div>
  );
}
