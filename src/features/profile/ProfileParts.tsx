// Briques communes à l'aperçu et au profil complet (maquette Profil-membre).
import { useEffect, useState } from "react";
import { commands, type UserProfile } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { Avatar } from "../../shared/ui/Avatar";

const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export const displayName = (p: UserProfile): string => p.guild_nick ?? p.user.global_name ?? p.user.username;

function bannerColor(p: UserProfile): string {
  if (p.accent_color != null) return hex(p.accent_color);
  const first = p.theme_colors?.[0];
  return first != null ? hex(first) : "#3b4a74";
}

export function Banner({ p }: { p: UserProfile }): React.JSX.Element {
  const style: React.CSSProperties = p.banner_url ? { backgroundImage: `url(${p.banner_url})` } : { background: bannerColor(p) };
  return <div className="pf-banner" style={style} />;
}

export function ProfileAvatar({ p, big, onOpen }: { p: UserProfile; big?: boolean; onOpen?: () => void }): React.JSX.Element {
  const inner = (
    <>
      <Avatar id={p.user.id} name={displayName(p)} url={p.user.avatar_url} size={big ? 112 : 80} />
      {p.avatar_decoration_url && <img className="deco" src={p.avatar_decoration_url} alt="" />}
    </>
  );
  return onOpen
    ? <button className={`pf-av${big ? " big" : ""}`} onClick={onOpen} aria-label="Voir le profil complet">{inner}</button>
    : <span className={`pf-av${big ? " big" : ""}`}>{inner}</span>;
}

export function Identity({ p, big }: { p: UserProfile; big?: boolean }): React.JSX.Element {
  return (
    <div className="pf-id">
      <span className="n" style={big ? { fontSize: 24 } : undefined}>{displayName(p)}</span>
      <span className="u">
        {p.user.username}{p.pronouns && <> · {p.pronouns}</>}
        {p.badges.length > 0 && (
          <span className="pf-badges">
            {p.badges.map((b) => <img key={b.id} src={b.icon_url} alt={b.description} title={b.description} />)}
          </span>
        )}
      </span>
    </div>
  );
}

export function About({ p, guildName }: { p: UserProfile; guildName: string | null }): React.JSX.Element {
  return (
    <>
      {p.bio && <div className="pf-field"><span className="pf-lab">À propos</span><p>{p.bio}</p></div>}
      <div className="pf-dates">
        <div className="pf-field">
          <span className="pf-lab">Sur Discord depuis</span><span className="v">{fmtDate(p.created_at_ms ?? 0)}</span>
        </div>
        {p.joined_guild_at && guildName && (
          <div className="pf-field">
            <span className="pf-lab">Sur {guildName} depuis</span>
            <span className="v">{fmtDate(Date.parse(p.joined_guild_at))}</span>
          </div>
        )}
      </div>
    </>
  );
}

export function Connections({ p }: { p: UserProfile }): React.JSX.Element | null {
  if (p.connected_accounts.length === 0) return null;
  return (
    <div className="pf-field">
      <span className="pf-lab">Comptes liés</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {p.connected_accounts.map((c) => {
          const label = `${c.kind.charAt(0).toUpperCase()}${c.kind.slice(1)} · ${c.name}${c.verified ? " ✓" : ""}`;
          return c.url
            ? <a key={`${c.kind}${c.name}`} className="pf-chip" href={c.url} target="_blank" rel="noreferrer">{label}</a>
            : <span key={`${c.kind}${c.name}`} className="pf-chip">{label}</span>;
        })}
      </div>
    </div>
  );
}

/** Note personnelle, enregistrée quand le champ perd le focus. */
export function Note({ p, boxed }: { p: UserProfile; boxed?: boolean }): React.JSX.Element {
  const account = useActiveAccount();
  const [value, setValue] = useState(p.note ?? "");
  useEffect(() => setValue(p.note ?? ""), [p.note]);
  const save = (): void => {
    if (account && value !== (p.note ?? "")) void commands.noteSet(account.id, p.user.id, value);
  };
  return (
    <div className="pf-field">
      <label className="pf-lab" htmlFor={`note-${p.user.id}`}>{boxed ? "Note (visible par toi seul)" : "Note"}</label>
      <input id={`note-${p.user.id}`} className={`pf-note${boxed ? " boxed" : ""}`} value={value}
        placeholder="Clique pour ajouter une note" onChange={(e) => setValue(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
    </div>
  );
}

export function useGuildName(guildId: string | null): string | null {
  return useEngine((s) => (guildId ? s.guilds.find((g) => g.id === guildId)?.name ?? null : null));
}
