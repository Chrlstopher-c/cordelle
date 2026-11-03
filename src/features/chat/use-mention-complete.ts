// Autocomplétion « @ » de la saisie : candidats = auteurs récents du salon + destinataires du MP + @everyone/@here.
// Le texte affiche « @nom » ; à l'envoi, chaque mention choisie redevient `<@id>`.
import { useMemo, useRef, useState } from "react";
import type { Message, User } from "../../contract/bindings";

export interface Candidate { id: string; label: string; user: User | null }

export interface MentionComplete {
  open: boolean;
  items: Candidate[];
  index: number;
  /** À appeler à chaque frappe avec le texte et la position du curseur. */
  update: (text: string, caret: number) => void;
  /** Gère flèches / Entrée / Tab / Échap ; renvoie vrai si la touche est consommée. */
  onKey: (e: React.KeyboardEvent, text: string, apply: (t: string, caret: number) => void) => boolean;
  pick: (c: Candidate, text: string, apply: (t: string, caret: number) => void) => void;
  /** Remplace les « @nom » choisis par `<@id>` avant l'envoi. */
  encode: (text: string) => string;
  reset: () => void;
}

const nameOf = (u: User): string => u.global_name ?? u.username;

export function useMentionComplete(messages: Message[], recipients: User[], isGuild: boolean): MentionComplete {
  const [query, setQuery] = useState<{ q: string; start: number } | null>(null);
  const [index, setIndex] = useState(0);
  const chosen = useRef(new Map<string, string>());

  const pool = useMemo(() => {
    const seen = new Map<string, User>();
    for (const u of recipients) seen.set(u.id, u);
    for (const m of messages) if (!seen.has(m.author.id)) seen.set(m.author.id, m.author);
    const users: Candidate[] = [...seen.values()].map((u) => ({ id: u.id, label: nameOf(u), user: u }));
    const special: Candidate[] = isGuild ? [{ id: "everyone", label: "everyone", user: null }, { id: "here", label: "here", user: null }] : [];
    return [...users, ...special];
  }, [messages, recipients, isGuild]);

  const items = useMemo(() => {
    if (!query) return [];
    const q = query.q.toLowerCase();
    return pool.filter((c) => c.label.toLowerCase().includes(q) || c.user?.username.toLowerCase().includes(q)).slice(0, 8);
  }, [pool, query]);

  const update = (text: string, caret: number): void => {
    const m = /(?:^|\s)@([^\s@]{0,32})$/.exec(text.slice(0, caret));
    setQuery(m ? { q: m[1], start: caret - m[1].length - 1 } : null);
    setIndex(0);
  };

  const pick = (c: Candidate, text: string, apply: (t: string, caret: number) => void): void => {
    if (!query) return;
    const insert = `@${c.label} `;
    const end = query.start + 1 + query.q.length;
    if (c.user) chosen.current.set(c.label, c.id);
    apply(text.slice(0, query.start) + insert + text.slice(end), query.start + insert.length);
    setQuery(null);
  };

  const onKey = (e: React.KeyboardEvent, text: string, apply: (t: string, caret: number) => void): boolean => {
    if (!query || items.length === 0) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(items[index], text, apply); return true; }
    if (e.key === "Escape") { e.preventDefault(); setQuery(null); return true; }
    return false;
  };

  const encode = (text: string): string => {
    let out = text;
    const names = [...chosen.current.keys()].sort((a, b) => b.length - a.length);
    for (const n of names) out = out.split(`@${n}`).join(`<@${chosen.current.get(n)}>`);
    return out;
  };

  return {
    open: !!query && items.length > 0, items, index, update, onKey, pick, encode,
    reset: () => { chosen.current.clear(); setQuery(null); },
  };
}
