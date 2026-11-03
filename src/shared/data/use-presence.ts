// Statut connu d'un utilisateur : le sien (choisi dans la barre de profil) ou celui vu dans une liste de membres.
import type { PresenceStatus } from "../../contract/bindings";
import { useEngine } from "./engine-store";
import { useActiveAccount } from "./use-active-account";

export function usePresence(userId: string | null): PresenceStatus | null {
  const me = useActiveAccount()?.user.id;
  return useEngine((s) => {
    if (!userId) return null;
    if (userId === me) return s.myStatus;
    for (const groups of Object.values(s.memberLists)) {
      for (const g of groups) {
        const m = g.members.find((x) => x.user.id === userId);
        if (m) return m.status;
      }
    }
    return null;
  });
}
