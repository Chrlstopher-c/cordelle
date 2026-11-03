// Liste de la saisie assistée au-dessus de la saisie : membres, salons ou emojis selon le déclencheur.
import { Avatar } from "../../shared/ui/Avatar";
import type { Candidate } from "./candidates";

interface Props {
  title: string;
  items: Candidate[];
  index: number;
  onPick: (c: Candidate) => void;
}

export function CompletionPopup({ title, items, index, onPick }: Props): React.JSX.Element {
  return (
    <div className="mention-pop" role="listbox" aria-label={title}>
      <div className="mention-head">{title}</div>
      {items.map((c, i) => (
        <button key={c.key} role="option" aria-selected={i === index} className={`mention-item${i === index ? " on" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onPick(c); }}>
          {c.user ? (
            <Avatar id={c.user.id} name={c.label} url={c.user.avatar_url} size={24} />
          ) : (
            <span className="compl-glyph" aria-hidden="true">{c.glyph}</span>
          )}
          <span className="compl-label">{c.label}</span>
          {c.sub && <span className="u">{c.sub}</span>}
        </button>
      ))}
    </div>
  );
}
