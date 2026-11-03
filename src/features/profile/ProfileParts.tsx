// Briques communes à l'aperçu et au profil complet : en-tête (bannière, avatar, décoration, nom, badges) et sections.
import type { UserProfile } from "../../contract/bindings";
import { Avatar } from "../../shared/ui/Avatar";

const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

/** Fond du profil : couleurs du thème Nitro si présentes, sinon la surface des menus. */
export function themeStyle(p: UserProfile | undefined): React.CSSProperties {
  const t = p?.theme_colors;
  return t && t.length >= 2 ? { background: `linear-gradient(${hex(t[0] ?? 0)}, ${hex(t[1] ?? 0)})` } : {};
}

export function ProfileHeader({ p, tall }: { p: UserProfile; tall?: boolean }): React.JSX.Element {
  const name = p.guild_nick ?? p.user.global_name ?? p.user.username;
  const bannerStyle: React.CSSProperties = p.banner_url
    ? { backgroundImage: `url(${p.banner_url})` }
    : { background: p.accent_color != null ? hex(p.accent_color) : "#3b4a74" };
  return (
    <>
      <div className={`pf-banner${tall ? " tall" : ""}`} style={bannerStyle} />
      <div className="pf-avatar">
        <Avatar id={p.user.id} name={name} url={p.user.avatar_url} size={80} />
        {p.avatar_decoration_url && <img className="deco" src={p.avatar_decoration_url} alt="" />}
      </div>
      <div className="pf-body" style={{ paddingBottom: 0 }}>
        <div>
          <div className="pf-name">{name}</div>
          <div className="pf-sub">
            <span>{p.user.username}</span>
            {p.pronouns && <><span>•</span><span>{p.pronouns}</span></>}
            {p.badges.length > 0 && (
              <span className="pf-badges">
                {p.badges.map((b) => <img key={b.id} src={b.icon_url} alt={b.description} title={b.description} />)}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return <div className="pf-section"><h4>{title}</h4>{children}</div>;
}

const fmtDate = (ms: number): string => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export function ProfileDetails({ p, full }: { p: UserProfile; full?: boolean }): React.JSX.Element {
  return (
    <>
      {p.bio && <Section title="Bio"><div className="v">{p.bio}</div></Section>}
      <Section title="Membre depuis"><div className="v">{fmtDate(p.created_at_ms ?? 0)}</div></Section>
      {p.joined_guild_at && (
        <Section title="Sur ce serveur depuis"><div className="v">{fmtDate(Date.parse(p.joined_guild_at))}</div></Section>
      )}
      {full && p.connected_accounts.length > 0 && (
        <Section title="Connexions">
          {p.connected_accounts.map((c) => (
            <div key={`${c.kind}-${c.name}`} className="pf-conn">
              <span style={{ textTransform: "capitalize", color: "var(--text-faint)", width: 64 }}>{c.kind}</span>
              {c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.name} ↗</a> : <span>{c.name}</span>}
              {c.verified && <span title="Vérifié" style={{ color: "var(--success)" }}>✓</span>}
            </div>
          ))}
        </Section>
      )}
      <Section title="Note (seulement visible par toi)">
        <div className="v" style={{ color: p.note ? "var(--text)" : "var(--text-faint)", fontStyle: p.note ? "normal" : "italic" }}>
          {p.note ?? "Aucune note"}
        </div>
      </Section>
    </>
  );
}
