// Actions sur les comptes (bascule, retrait) : appels moteur, vidage des données affichées, retours à l'utilisateur.
import { commands } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useConfirm } from "../../shared/ui/confirm";
import { engineErrorText } from "./engine-error";
import { showToast } from "./toast";

export async function switchAccount(accountId: string): Promise<boolean> {
  const r = await commands.accountSwitch(accountId);
  if (r.status === "error") {
    showToast(engineErrorText(r.error));
    return false;
  }
  useEngine.setState({ guilds: [], channelsByGuild: {}, dms: [], messages: {} });
  await useEngine.getState().refreshAccounts();
  return true;
}

export async function removeAccount(accountId: string): Promise<boolean> {
  const r = await commands.accountRemove(accountId);
  if (r.status === "error") {
    showToast(engineErrorText(r.error));
    return false;
  }
  await useEngine.getState().refreshAccounts();
  return true;
}

export function pickAccount(accountId: string, name: string): void {
  void switchAccount(accountId).then((ok) => {
    if (ok) showToast(`Connecté en tant que ${name}`);
  });
}

export function confirmRemove(accountId: string, name: string, active: boolean): void {
  if (active) {
    showToast("Bascule d'abord sur un autre compte pour retirer celui-ci.");
    return;
  }
  useConfirm.getState().confirm({
    title: "Retirer ce compte ?",
    body: `${name} est retiré de cet appareil. Tu pourras le rajouter en te reconnectant.`,
    action: "Retirer",
    run: () => {
      void removeAccount(accountId).then((ok) => {
        if (ok) showToast(`${name} retiré de cet appareil`);
      });
    },
  });
}
