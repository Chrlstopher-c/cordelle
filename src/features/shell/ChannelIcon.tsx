// Icône d'un salon selon son type (texte, annonces, forum, vocal…), couleur --text-faint.
import type { ChannelKind } from "../../contract/bindings";

const S = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-faint)", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function ChannelIcon({ kind }: { kind: ChannelKind }): React.JSX.Element {
  switch (kind) {
    case "voice":
    case "stage":
      return <svg {...S}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>;
    case "announcement":
      return <svg {...S}><path d="M4 10v4h3l6 4V6L7 10z" /><path d="M17 9a4 4 0 0 1 0 6" /></svg>;
    case "forum":
    case "media":
      return <svg {...S}><path d="M4 5h11v8H8l-4 3z" /><path d="M9 16h7l4 3v-9h-2" /></svg>;
    default:
      return <span className="hash" aria-hidden>#</span>;
  }
}
