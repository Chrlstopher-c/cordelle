// Ouvre un salon, un fil ou un MP depuis la zone recherche, et précharge ses messages.
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";

export function openChannelView(accountId: string, guildId: string | null, channelId: string): void {
  void useEngine.getState().loadMessages(accountId, channelId);
  const nav = useNav.getState();
  if (guildId) nav.openChannel(guildId, channelId);
  else nav.go({ kind: "dms", channelId });
}
