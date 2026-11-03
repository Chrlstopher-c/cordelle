// Branche les événements du moteur sur le store, une seule fois à la racine de l'app.
import { useEffect } from "react";
import { commands, events, type EngineEvent } from "../../contract/bindings";
import { useEngine } from "./engine-store";
import { useActiveAccount } from "./use-active-account";

export function useEngineBridge(): void {
  const accountId = useActiveAccount()?.id ?? null;
  const apply = useEngine((s) => s.apply);
  const loadGuilds = useEngine((s) => s.loadGuilds);
  const loadDms = useEngine((s) => s.loadDms);

  useEffect(() => {
    if (!accountId) return;
    void loadGuilds(accountId);
    void loadDms(accountId);
    const sync = (): void => {
      void commands.presencesGet(accountId).then((r) => {
        if (r.status === "ok") useEngine.setState((s) => ({ presences: { ...r.data, ...s.presences } }));
      });
    };
    sync();
    const t = setTimeout(sync, 4000);
    return () => clearTimeout(t);
  }, [accountId, loadGuilds, loadDms]);

  useEffect(() => {
    const unlisten = events.engine.listen((e) => {
      const ev = e.payload as EngineEvent;
      apply(ev, accountId);
      if (ev.type === "connection" && ev.state === "ready" && ev.account_id === accountId) {
        void loadGuilds(accountId);
        void loadDms(accountId);
      }
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [accountId, apply, loadGuilds, loadDms]);
}
