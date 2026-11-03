// Dates et libellés du journal d'audit (codes d'action Discord).
const RTF = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function fromNow(ms: number): string {
  const diff = ms - Date.now();
  const size = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 864e5], ["hour", 36e5], ["minute", 6e4]];
  for (const [unit, step] of units) {
    if (size >= step) return RTF.format(Math.round(diff / step), unit);
  }
  return RTF.format(0, "second");
}

export function fromIso(iso: string | null | undefined): string {
  return iso ? fromNow(Date.parse(iso)) : "jamais";
}

export function shortDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ACTIONS: Record<number, string> = {
  1: "a modifié le serveur", 10: "a créé un salon", 11: "a modifié un salon", 12: "a supprimé un salon",
  20: "a expulsé un membre", 22: "a banni un membre", 23: "a débanni un membre", 24: "a modifié un membre",
  25: "a modifié les rôles d'un membre", 30: "a créé un rôle", 31: "a modifié un rôle", 32: "a supprimé un rôle",
  40: "a créé une invitation", 42: "a supprimé une invitation", 60: "a ajouté un emoji",
  61: "a modifié un emoji", 62: "a supprimé un emoji", 72: "a supprimé un message", 74: "a épinglé un message",
  140: "a créé une règle AutoMod", 141: "a modifié une règle AutoMod", 142: "a supprimé une règle AutoMod",
  143: "a bloqué un message (AutoMod)", 145: "a exclu un membre temporairement",
};

export function actionLabel(code: number): string {
  return ACTIONS[code] ?? `a effectué une action (code ${code})`;
}

export const TRIGGERS: Record<number, string> = {
  1: "Mots-clés", 3: "Spam", 4: "Listes prédéfinies", 5: "Mentions massives",
};

export const AUTOMOD_ACTIONS: Record<number, string> = {
  1: "Bloquer le message", 2: "Alerter dans un salon", 3: "Exclure temporairement",
};

export const KINDS: Record<string, string> = {
  discord: "Intégration Discord", twitch: "Twitch", youtube: "YouTube", bot: "Bot", webhook: "Webhook",
};
