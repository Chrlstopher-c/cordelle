// Notifications de bureau réelles (plugin Tauri) et bip, déclenchés par les messages reçus
// quand la fenêtre n'a pas le focus.
// Hook à monter une seule fois à la racine de l'app : useDesktopNotifications().
import { useEffect } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { events, type EngineEvent, type Message } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { playBeep } from "./audio-beep";
import { usePrefs } from "./local-prefs";

const PREVIEW_MAX = 140;

export async function hasNotifyPermission(): Promise<boolean> {
  try {
    return await isPermissionGranted();
  } catch (e) {
    console.error("lecture de l'autorisation de notification impossible", e);
    return false;
  }
}

export async function requestNotifyPermission(): Promise<boolean> {
  try {
    return (await requestPermission()) === "granted";
  } catch (e) {
    console.error("demande d'autorisation de notification impossible", e);
    return false;
  }
}

export function showDesktopNotification(title: string, body: string): void {
  try {
    sendNotification({ title, body });
  } catch (e) {
    console.error("notification de bureau impossible", e);
  }
}

/** Vrai si le message mentionne `userId` (`<@id>` ou `<@!id>`). */
export function mentionsUser(content: string, userId: string): boolean {
  return content.includes(`<@${userId}>`) || content.includes(`<@!${userId}>`);
}

function previewOf(message: Message): string {
  const text = message.content.trim();
  if (!text) return "Pièce jointe";
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text;
}

async function notifyMessage(accountId: string, message: Message): Promise<void> {
  const prefs = usePrefs.getState().notifications;
  if (!prefs.desktop && !prefs.sound) return;
  const me = useEngine.getState().accounts.find((a) => a.id === accountId)?.user.id;
  if (!me || message.author.id === me || document.hasFocus()) return;
  const isDm = useEngine.getState().dms.some((c) => c.id === message.channel_id);
  if (prefs.mentionsOnly && !isDm && !mentionsUser(message.content, me)) return;
  if (prefs.sound) playBeep(usePrefs.getState().voice.outputVolume, usePrefs.getState().voice.outputId);
  if (prefs.desktop && (await hasNotifyPermission())) {
    showDesktopNotification(message.author.global_name ?? message.author.username, previewOf(message));
  }
}

export function useDesktopNotifications(): void {
  useEffect(() => {
    const unlisten = events.engine.listen((e) => {
      const ev = e.payload as EngineEvent;
      if (ev.type === "message_create") void notifyMessage(ev.account_id, ev.message);
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, []);
}
