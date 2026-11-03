// Relations d'amitié du compte actif : chargement, actions, demande par nom d'utilisateur.
import { useCallback, useEffect, useState } from "react";
import { commands, type Relationship, type RelationshipAction } from "../../contract/bindings";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { useEngine } from "../../shared/data/engine-store";

export interface Friends {
  list: Relationship[];
  loading: boolean;
  act: (userId: string, action: RelationshipAction) => Promise<void>;
  request: (username: string) => Promise<string | null>;
}

export function useFriends(): Friends {
  const account = useActiveAccount();
  const [list, setList] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!account) return;
    const r = await commands.relationshipsList(account.id);
    if (r.status === "ok") {
      setList(r.data);
      useEngine.setState({ relationships: Object.fromEntries(r.data.map((x) => [x.user.id, x.kind])) });
    }
    setLoading(false);
  }, [account]);

  useEffect(() => { void reload(); }, [reload]);

  const act = async (userId: string, action: RelationshipAction): Promise<void> => {
    if (!account) return;
    const r = await commands.relationshipSet(account.id, userId, action);
    if (r.status === "error") console.error("[amis] action impossible", r.error);
    await reload();
  };

  /** Renvoie un message d'erreur lisible, ou null si la demande est partie. */
  const request = async (username: string): Promise<string | null> => {
    if (!account) return "Aucun compte";
    const r = await commands.friendRequest(account.id, username);
    if (r.status === "ok") { await reload(); return null; }
    return r.error.kind === "discord" ? r.error.message : "Demande impossible";
  };

  return { list, loading, act, request };
}
