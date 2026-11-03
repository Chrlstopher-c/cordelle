// Code d'invitation extrait d'un lien (discord.gg/x, discord.com/invite/x) ou saisi seul ; null si invalide.
const INVITE_PATTERN = /^(?:(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/)?([A-Za-z0-9-]{2,64})\/?$/;

export function inviteCode(raw: string): string | null {
  return INVITE_PATTERN.exec(raw.trim())?.[1] ?? null;
}
