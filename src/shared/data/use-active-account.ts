// Compte actif (celui dont on affiche les serveurs). null tant qu'aucun compte n'est connecté.
import type { AccountSummary } from "../../contract/bindings";
import { useEngine } from "./engine-store";

export function useActiveAccount(): AccountSummary | null {
  return useEngine((s) => s.accounts.find((a) => a.active) ?? null);
}
