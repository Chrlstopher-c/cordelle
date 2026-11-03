// Branche les événements vocaux de `engine` sur le store vocal ; à monter une fois dans la coque (App).
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { useAudio } from "./audio-settings";
import { applyVoiceEvent } from "./voice-events";

export function useVoiceBridge(): void {
  const accountId = useActiveAccount()?.id ?? null;
  useEffect(() => {
    void useAudio.getState().sync();
  }, []);
  useEffect(() => {
    const unlisten = listen<unknown>("engine", (e) => applyVoiceEvent(e.payload, accountId));
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [accountId]);
}
