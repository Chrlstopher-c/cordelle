// Sélecteur d'emojis (maquette Emoji-picker) : recherche, catégories, emojis du serveur, récents.
// Un clic insère le texte à la position du curseur ; un emoji personnalisé s'insère sous sa forme `<:nom:id>`.
import { useMemo, useState } from "react";
import type { GuildEmoji } from "./api";
import { ALL_EMOJIS, EMOJI_CATEGORIES, RECENT_ICON, type EmojiEntry } from "./emoji-data";
import { pushRecent, readRecent } from "./recent-emojis";

interface Props {
  guildEmojis: GuildEmoji[];
  onPick: (text: string) => void;
  onClose: () => void;
}

interface Cell {
  key: string;
  name: string;
  search: string;
  glyph: string;
  insert: string;
  custom: boolean;
}

interface Section {
  id: string;
  title: string;
  icon: string;
  cells: Cell[];
}

const BY_CHAR = new Map<string, EmojiEntry>(ALL_EMOJIS.map((e) => [e.char, e]));

function unicodeCell(e: EmojiEntry): Cell {
  return { key: `u-${e.char}`, name: `:${e.name.split(" ")[0]}:`, search: e.name.toLowerCase(), glyph: e.char, insert: e.char, custom: false };
}

function recentCell(char: string): Cell {
  const entry = BY_CHAR.get(char);
  return entry ? unicodeCell(entry) : { key: `r-${char}`, name: char, search: "", glyph: char, insert: char, custom: false };
}

function customCell(e: GuildEmoji): Cell {
  return {
    key: `c-${e.id}`, name: `:${e.name}:`, search: e.name.toLowerCase(), glyph: e.name.slice(0, 2).toUpperCase(),
    insert: `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`, custom: true,
  };
}

export function buildSections(query: string, guildEmojis: GuildEmoji[], recents: string[]): Section[] {
  const q = query.toLowerCase().replace(/:/g, "").trim();
  const sections: Section[] = [
    { id: "recent", title: "Récents", icon: RECENT_ICON, cells: q ? [] : recents.map(recentCell) },
    { id: "serveur", title: "Serveur", icon: "", cells: guildEmojis.map(customCell) },
    ...EMOJI_CATEGORIES.map((c) => ({ id: c.id, title: c.title, icon: c.icon, cells: c.entries.map(unicodeCell) })),
  ];
  return sections
    .map((s) => ({ ...s, cells: s.cells.filter((cell) => cell.search.includes(q)) }))
    .filter((s) => s.cells.length > 0);
}

const jumpTo = (id: string): void => {
  document.getElementById(`emoji-sec-${id}`)?.scrollIntoView({ block: "start" });
};

export function EmojiPicker({ guildEmojis, onPick, onClose }: Props): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(readRecent);
  const [hover, setHover] = useState<Cell | null>(null);
  const sections = useMemo(() => buildSections(query, guildEmojis, recents), [query, guildEmojis, recents]);
  const foot = hover ?? sections[0]?.cells[0] ?? null;

  const choose = (cell: Cell): void => {
    onPick(cell.insert);
    if (!cell.custom) setRecents(pushRecent(cell.insert));
  };

  return (
    <>
      <button className="emoji-veil" aria-label="Fermer le sélecteur" onClick={onClose} />
      <div className="emoji-pop" role="dialog" aria-label="Choisir un emoji" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="emoji-search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un emoji"
            aria-label="Rechercher un emoji" autoFocus />
        </div>
        <div className="emoji-body">
          <nav className="emoji-cats" aria-label="Catégories d'emoji">
            {sections.map((s) => (
              <button key={s.id} className="emoji-cat" aria-label={s.title} onClick={() => jumpTo(s.id)}>
                {s.icon ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={s.icon} />
                  </svg>
                ) : (
                  <span className="compl-glyph" aria-hidden="true">S</span>
                )}
              </button>
            ))}
          </nav>
          <div className="emoji-scroll">
            {sections.map((s) => (
              <section key={s.id} id={`emoji-sec-${s.id}`}>
                <div className="emoji-sec">{s.title}</div>
                <div className="emoji-grid">
                  {s.cells.map((cell) => (
                    <button key={cell.key} className="emoji-btn" aria-label={cell.name}
                      onMouseEnter={() => setHover(cell)} onFocus={() => setHover(cell)} onClick={() => choose(cell)}>
                      {cell.custom ? <span className="emoji-custom">{cell.glyph}</span> : cell.glyph}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {sections.length === 0 && <p className="emoji-none">Aucun emoji pour « {query} ».</p>}
          </div>
        </div>
        <div className="emoji-foot">
          {foot && (
            <>
              <span className="emoji-foot-glyph" aria-hidden="true">{foot.glyph}</span>
              <span className="emoji-foot-name">{foot.name}</span>
            </>
          )}
          <span style={{ flex: 1 }} />
          <span className="emoji-hint">Clic pour l'ajouter</span>
        </div>
      </div>
    </>
  );
}
