// Menu des périphériques (micro, sortie) : choix coché, ouvert au-dessus de la barre d'appel (160 ms).
import { CheckIcon } from "./icons";
import type { AudioDevice } from "./types";

interface Props {
  title: string;
  list: AudioDevice[];
  selected: string | null;
  onPick: (id: string) => void;
}

export function DeviceMenu({ title, list, selected, onPick }: Props): React.JSX.Element {
  return (
    <div className="menu dev-menu" role="menu" aria-label={title}>
      <span className="dev-title">{title}</span>
      {list.length === 0 && <span className="dev-empty">Aucun périphérique</span>}
      {list.map((d) => (
        <button key={d.id} className="menu-item" role="menuitemradio" aria-checked={d.id === selected}
          onClick={() => onPick(d.id)}>
          <span className="dev-check">{d.id === selected && <CheckIcon />}</span>
          <span className="dev-name">{d.name}</span>
        </button>
      ))}
    </div>
  );
}
