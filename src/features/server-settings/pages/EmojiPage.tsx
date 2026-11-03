// Emoji du serveur : liste, filtre, suppression (Gérer les emoji). Pas d'envoi : l'upload n'est pas branché.
import { useMemo, useState } from "react";
import { srv } from "../api";
import type { GuildEmoji } from "../server-contract";
import { useConfirm } from "../../../shared/ui/confirm";
import { attempt, can, PERM, type PageProps } from "../api";
import { Empty, Flash, Section, useFlash } from "../kit";
import { useLoad } from "../use-load";

const LIMIT = 50;

export function EmojiPage({ acc, guildId, perms }: PageProps): React.JSX.Element {
  const { data, message, reload } = useLoad(
    () => attempt(srv.guildEmojisManage(acc, guildId, null)), [acc, guildId],
  );
  const [query, setQuery] = useState("");
  const { message: toast, flash } = useFlash();
  const askRemove = useConfirm((s) => s.confirm);
  const editable = can(perms, PERM.MANAGE_EMOJIS);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((e) => e.name.toLowerCase().includes(q));
  }, [data, query]);
  if (message) return <Empty>{message}</Empty>;
  if (!data) return <Empty>Chargement…</Empty>;

  const statics = data.filter((e) => !e.animated).length;
  const animated = data.length - statics;

  const remove = (emoji: GuildEmoji): void => askRemove({
    title: `Supprimer :${emoji.name}:`, body: "L'emoji disparaît pour tous les membres.", action: "Supprimer",
    run: () => void attempt(srv.guildEmojisManage(acc, guildId, emoji.id)).then((r) => {
      if (r.ok) { flash("Emoji supprimé"); reload(); } else flash(r.message);
    }),
  });

  return (
    <div className="ss-page">
      <h1>Emoji et autocollants</h1>
      <div className="ss-sub">
        <span>Emoji fixes {statics} / {LIMIT}</span>
        <span>Emoji animés {animated} / {LIMIT}</span>
      </div>
      <div className="ss-tools">
        <input className="ss-input" placeholder="Rechercher un emoji" aria-label="Rechercher un emoji"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Section title={`Emoji du serveur · ${shown.length}`}>
        {shown.map((emoji) => (
          <div key={emoji.id} className="ss-row">
            <img className="ss-emoji" src={emoji.image_url} alt="" />
            <div className="ss-txt">
              <span className="ss-t">:{emoji.name}:{emoji.animated && <span className="ss-tag">ANIMÉ</span>}</span>
              {emoji.creator && <span className="ss-h">Ajouté par {emoji.creator}</span>}
            </div>
            {editable && (
              <button type="button" className="ss-btn danger" onClick={() => remove(emoji)}>Supprimer</button>
            )}
          </div>
        ))}
        {shown.length === 0 && <Empty>Aucun emoji ne correspond.</Empty>}
      </Section>
      <Flash message={toast} />
    </div>
  );
}
