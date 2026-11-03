// Identifiants Discord : le moment de création est encodé dans les bits de poids fort.
const DISCORD_EPOCH_MS = 1420070400000n;

export function snowflakeTime(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH_MS));
}

/** Ordre croissant de deux snowflakes (null = le plus ancien). */
export function compareSnowflake(a: string | null, b: string | null): number {
  const x = BigInt(a ?? "0");
  const y = BigInt(b ?? "0");
  if (x === y) return 0;
  return x < y ? -1 : 1;
}

export function formatStamp(date: Date): string {
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
