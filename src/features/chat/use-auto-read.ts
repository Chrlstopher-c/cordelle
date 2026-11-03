// Lecture automatique : le salon affiché (fenêtre au premier plan) est marqué lu jusqu'au dernier message,
// comme dans Discord ; mise à jour locale immédiate, acquittement envoyé au plus une fois par seconde.
import { useEffect, useRef } from "react";
import { commands } from "../../contract/bindings";
import { markChannel, useEngine } from "../../shared/data/engine-store";

export function markRead(accountId: string, channelId: string, messageId: string): void {
  useEngine.setState((s) => markChannel(s, channelId, false, 0));
  void commands.channelAck(accountId, channelId, messageId);
}

export function useAutoRead(accountId: string, channelId: string): void {
  const latest = useEngine((s) => s.messages[channelId]?.[0]?.id);
  const acked = useRef<string | null>(null);
  useEffect(() => {
    if (!accountId || !latest || acked.current === latest) return;
    const t = setTimeout(() => {
      if (!document.hasFocus()) return;
      acked.current = latest;
      markRead(accountId, channelId, latest);
    }, 1000);
    return () => clearTimeout(t);
  }, [accountId, channelId, latest]);

  useEffect(() => {
    const onFocus = (): void => {
      const last = useEngine.getState().messages[channelId]?.[0]?.id;
      if (accountId && last && acked.current !== last) { acked.current = last; markRead(accountId, channelId, last); }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [accountId, channelId]);
}
