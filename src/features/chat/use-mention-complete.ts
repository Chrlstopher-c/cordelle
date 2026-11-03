// Saisie assistée : « @ » membres et rôles, « # » salons, « : » + 2 lettres emojis (unicode et du serveur).
// Le texte affiche le nom choisi ; à l'envoi, chaque choix devient son code (`<@id>`, `<#id>`, `<:nom:id>`).
import { useMemo, useRef, useState } from "react";
import {
  applyChosen, buildPools, findToken, rankCandidates,
  type Candidate, type CompletionSources, type Token, type TokenKind,
} from "../compose/candidates";

type Apply = (text: string, caret: number) => void;

export interface MentionComplete {
  open: boolean;
  items: Candidate[];
  index: number;
  title: string;
  /** À appeler à chaque frappe avec le texte et la position du curseur. */
  update: (text: string, caret: number) => void;
  /** Gère flèches / Entrée / Tab / Échap ; renvoie vrai si la touche est consommée. */
  onKey: (e: React.KeyboardEvent, text: string, apply: Apply) => boolean;
  pick: (c: Candidate, text: string, apply: Apply) => void;
  /** Remplace les choix affichés par leur texte envoyé. */
  encode: (text: string) => string;
  reset: () => void;
}

const TITLES: Record<TokenKind, string> = { mention: "Membres", channel: "Salons", emoji: "Emoji" };

export function useMentionComplete(src: CompletionSources): MentionComplete {
  const [token, setToken] = useState<Token | null>(null);
  const [index, setIndex] = useState(0);
  const chosen = useRef(new Map<string, string>());
  const pools = useMemo(() => buildPools(src), [src.messages, src.recipients, src.isGuild, src.channels, src.emojis]);
  const items = useMemo(() => (token ? rankCandidates(pools, token) : []), [pools, token]);

  const update = (text: string, caret: number): void => {
    setToken(findToken(text, caret));
    setIndex(0);
  };

  const pick = (c: Candidate, text: string, apply: Apply): void => {
    if (!token) return;
    const end = token.start + 1 + token.q.length;
    if (c.display !== c.final) chosen.current.set(c.display, c.final);
    apply(text.slice(0, token.start) + c.display + " " + text.slice(end), token.start + c.display.length + 1);
    setToken(null);
  };

  const onKey = (e: React.KeyboardEvent, text: string, apply: Apply): boolean => {
    if (!token || items.length === 0) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(items[index], text, apply);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setToken(null);
      return true;
    }
    return false;
  };

  return {
    open: !!token && items.length > 0,
    items,
    index,
    title: TITLES[token?.kind ?? "mention"],
    update,
    onKey,
    pick,
    encode: (text: string): string => applyChosen(text, chosen.current),
    reset: () => {
      chosen.current.clear();
      setToken(null);
    },
  };
}
