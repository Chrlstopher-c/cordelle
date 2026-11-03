// Aperçu d'une invitation : résolu dès que le lien contient un code valide, périmé si le code change.
import { useEffect, useState } from "react";
import { inviteResolve, type InvitePreview } from "./api";
import { errorText } from "./engine-error";

export interface InvitePreviewState {
  preview: InvitePreview | null;
  loading: boolean;
  error: string | null;
}

const IDLE: InvitePreviewState = { preview: null, loading: false, error: null };

export function useInvitePreview(accountId: string | undefined, code: string | null): InvitePreviewState {
  const [state, setState] = useState<InvitePreviewState>(IDLE);

  useEffect(() => {
    if (!accountId || !code) {
      setState(IDLE);
      return;
    }
    let stale = false;
    setState({ preview: null, loading: true, error: null });
    resolve(accountId, code).then((next) => {
      if (!stale) setState(next);
    });
    return () => { stale = true; };
  }, [accountId, code]);

  return state;
}

async function resolve(accountId: string, code: string): Promise<InvitePreviewState> {
  try {
    const r = await inviteResolve(accountId, code);
    if (r.status === "ok") return { preview: r.data, loading: false, error: null };
    return { preview: null, loading: false, error: errorText(r.error) };
  } catch (e) {
    console.error("[accueil] aperçu d'invitation impossible", e);
    return { preview: null, loading: false, error: "Action impossible." };
  }
}
