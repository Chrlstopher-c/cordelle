// Actions sur les messages d'un salon : réagir, modifier, supprimer. Le résultat revient par la gateway.
import { useMemo } from "react";
import { commands } from "../../contract/bindings";

export interface MessageActions {
  react: (messageId: string, emoji: string, add: boolean) => void;
  edit: (messageId: string, content: string) => void;
  remove: (messageId: string) => void;
}

const report = (what: string) => (r: { status: string; error?: unknown }): void => {
  if (r.status === "error") console.error(`[chat] ${what} impossible`, r.error);
};

export function useMessageActions(accountId: string, channelId: string): MessageActions {
  return useMemo(() => ({
    react: (messageId, emoji, add) =>
      void commands.reactionSet(accountId, channelId, messageId, emoji, add).then(report("réaction")),
    edit: (messageId, content) =>
      void commands.messageEdit(accountId, channelId, messageId, content).then(report("modification")),
    remove: (messageId) =>
      void commands.messageDelete(accountId, channelId, messageId).then(report("suppression")),
  }), [accountId, channelId]);
}
