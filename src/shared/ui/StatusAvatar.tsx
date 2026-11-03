// Avatar avec pastille de statut découpée dans l'avatar (masque), formes distinctes par statut :
// en ligne = rond plein, inactif = lune, ne pas déranger = barre, hors ligne = anneau.
import type { PresenceStatus } from "../../contract/bindings";
import { Avatar } from "./Avatar";

const COLOR: Record<PresenceStatus, string> = {
  online: "#3fb97a", idle: "#e0a63a", dnd: "#d93f45", invisible: "#80848e", offline: "#80848e",
};

const LABEL: Record<PresenceStatus, string> = {
  online: "En ligne", idle: "Inactif", dnd: "Ne pas déranger", invisible: "Invisible", offline: "Hors ligne",
};

function Dot({ status, d }: { status: PresenceStatus; d: number }): React.JSX.Element {
  const c = COLOR[status];
  const r = d / 2;
  return (
    <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} aria-hidden>
      {status === "online" && <circle cx={r} cy={r} r={r} fill={c} />}
      {status === "idle" && (
        <>
          <mask id={`moon-${d}`}><rect width={d} height={d} fill="#fff" /><circle cx={r * 0.55} cy={r * 0.55} r={r * 0.62} fill="#000" /></mask>
          <circle cx={r} cy={r} r={r} fill={c} mask={`url(#moon-${d})`} />
        </>
      )}
      {status === "dnd" && (
        <>
          <circle cx={r} cy={r} r={r} fill={c} />
          <rect x={d * 0.22} y={r - d * 0.09} width={d * 0.56} height={d * 0.18} rx={d * 0.09} fill="#fff" />
        </>
      )}
      {(status === "offline" || status === "invisible") && (
        <circle cx={r} cy={r} r={r * 0.7} fill="none" stroke={c} strokeWidth={r * 0.6} />
      )}
    </svg>
  );
}

interface Props {
  id: string;
  name: string;
  url?: string | null;
  size: number;
  status?: PresenceStatus | null;
}

export function StatusAvatar({ id, name, url, size, status }: Props): React.JSX.Element {
  if (!status) return <Avatar id={id} name={name} url={url} size={size} />;
  const d = Math.max(10, Math.round(size * 0.3));
  const gap = Math.max(2, Math.round(size * 0.06));
  const c = size - d / 2 - Math.round(size * 0.02);
  const mask = `radial-gradient(circle at ${c}px ${c}px, transparent ${d / 2 + gap}px, #000 ${d / 2 + gap + 0.5}px)`;
  return (
    <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-block" }} title={LABEL[status]}>
      <span style={{ display: "block", WebkitMaskImage: mask, maskImage: mask }}>
        <Avatar id={id} name={name} url={url} size={size} />
      </span>
      <span style={{ position: "absolute", left: c - d / 2, top: c - d / 2, width: d, height: d, display: "flex" }}>
        <Dot status={status} d={d} />
      </span>
    </span>
  );
}
