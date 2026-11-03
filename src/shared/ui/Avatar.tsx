// Avatar rond : image si disponible, sinon initiales sur une couleur stable dérivée de l'id.
const PALETTE = ["#3B4A74", "#5C4A2E", "#23503A", "#3E3560", "#2F4B57", "#5A4721", "#4A2E3B", "#2C2D33"];

function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

interface Props {
  id: string;
  name: string;
  url?: string | null;
  size?: number;
  radius?: number | string;
}

export function Avatar({ id, name, url, size = 32, radius = "50%" }: Props): React.JSX.Element {
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: radius, flexShrink: 0, objectFit: "cover",
    background: colorFor(id), color: "#F1F2F4", fontSize: Math.round(size * 0.36), fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  return url ? <img src={url} alt="" style={style} draggable={false} /> : <span style={style} aria-hidden>{initials(name)}</span>;
}
