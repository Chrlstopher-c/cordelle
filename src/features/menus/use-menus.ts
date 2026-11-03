// Contenu des menus contextuels par élément (message, personne, salon, serveur, MP). Uniquement des actions réelles.
import { commands, type ChannelSummary, type GuildSummary, type Message, type User } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { useNav } from "../../shared/data/nav-store";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { useConfirm } from "../../shared/ui/confirm";
import { item, sep, type MenuItem } from "../../shared/ui/context-menu";
import { useProfiles } from "../profile";
import { useOpenDm } from "../profile/use-profile-actions";

const copy = (text: string) => (): void => { void navigator.clipboard.writeText(text); };
const link = (guildId: string | null, channelId: string, messageId?: string): string =>
  `https://discord.com/channels/${guildId ?? "@me"}/${channelId}${messageId ? `/${messageId}` : ""}`;
const nameOf = (u: User): string => u.global_name ?? u.username;

export interface MessageMenuHandlers { reply: () => void; edit: () => void; react: (e: string) => void }

export function useMenus() {
  const account = useActiveAccount();
  const me = account?.user.id;
  const acc = account?.id ?? "";
  const confirm = useConfirm((s) => s.confirm);
  const openPopout = useProfiles((s) => s.openPopout);
  const openModal = useProfiles((s) => s.openModal);
  const openDm = useOpenDm();
  const nav = useNav.getState;
  const latest = (channelId: string): string | undefined => useEngine.getState().messages[channelId]?.[0]?.id;
  const markRead = (channelId: string): MenuItem[] => {
    const last = latest(channelId);
    return last ? [item("Marquer comme lu", () => void commands.channelAck(acc, channelId, last))] : [];
  };

  const message = (m: Message, guildId: string | null, h: MessageMenuHandlers): MenuItem[] => {
    const mine = m.author.id === me;
    return [
      item("Ajouter 👍", () => h.react("👍")), item("Ajouter ❤️", () => h.react("❤️")), sep,
      item("Répondre", h.reply),
      ...(mine ? [item("Modifier le message", h.edit)] : []),
      item(m.pinned ? "Désépingler" : "Épingler le message", () => void commands.messagePin(acc, m.channel_id, m.id, !m.pinned)),
      sep,
      ...(m.content ? [item("Copier le texte", copy(m.content))] : []),
      item("Copier le lien du message", copy(link(guildId, m.channel_id, m.id))),
      item("Copier l'identifiant du message", copy(m.id)),
      ...(mine ? [sep, item("Supprimer le message", () => confirm({
        title: "Supprimer le message", body: "Ce message sera supprimé pour tout le monde.", action: "Supprimer",
        run: () => void commands.messageDelete(acc, m.channel_id, m.id),
      }), { danger: true })] : []),
    ];
  };

  const rel = (id: string): string | undefined => useEngine.getState().relationships[id];
  const setRel = (u: User, action: "accept" | "remove"): void => {
    void commands.relationshipSet(acc, u.id, action).then(() => useEngine.getState().loadRelationships(acc));
  };
  const relationItems = (u: User): MenuItem[] => {
    switch (rel(u.id)) {
      case "friend": return [item("Retirer l'ami", () => confirm({
        title: `Retirer ${nameOf(u)}`, body: "Cette personne ne sera plus dans ta liste d'amis.", action: "Retirer",
        run: () => setRel(u, "remove"),
      }), { danger: true })];
      case "incoming": return [item("Accepter la demande d'ami", () => setRel(u, "accept")), item("Refuser", () => setRel(u, "remove"))];
      case "outgoing": return [item("Annuler la demande d'ami", () => setRel(u, "remove"))];
      case "blocked": return [item("Débloquer", () => setRel(u, "remove"))];
      default: return [item("Ajouter en ami", () => {
        void commands.friendRequest(acc, u.username).then(() => useEngine.getState().loadRelationships(acc));
      })];
    }
  };

  const user = (u: User, guildId: string | null, at: { x: number; y: number }): MenuItem[] => {
    const self = u.id === me;
    return [
      item("Profil", () => openPopout(u.id, guildId, at)),
      item("Profil complet", () => openModal(u.id, guildId)),
      ...(self ? [] : [item("Envoyer un message", () => void openDm(u.id))]),
      ...(self ? [] : [sep, ...relationItems(u)]),
      ...(self || rel(u.id) === "blocked" ? [] : [item("Bloquer", () => confirm({
        title: `Bloquer ${nameOf(u)}`, body: "Tu ne verras plus ses messages et cette personne ne pourra plus t'écrire.",
        action: "Bloquer", run: () => void commands.relationshipSet(acc, u.id, "block"),
      }), { danger: true })]),
      sep,
      item("Copier le nom d'utilisateur", copy(u.username)),
      item("Copier l'identifiant", copy(u.id)),
    ];
  };

  const channel = (c: ChannelSummary): MenuItem[] => [
    ...markRead(c.id),
    ...(c.guild_id ? [item("Ouvrir", () => nav().openChannel(c.guild_id ?? "", c.id))] : []),
    sep,
    item("Copier le lien du salon", copy(link(c.guild_id ?? null, c.id))),
    item("Copier l'identifiant du salon", copy(c.id)),
  ];

  const guild = (g: GuildSummary): MenuItem[] => [
    item("Marquer comme lu", () => void commands.guildAck(acc, g.id)),
    sep,
    item("Copier l'identifiant du serveur", copy(g.id)),
    sep,
    item("Quitter le serveur", () => confirm({
      title: `Quitter ${g.name}`, body: "Tu ne pourras pas revenir sans nouvelle invitation.", action: "Quitter le serveur",
      run: () => void commands.guildLeave(acc, g.id),
    }), { danger: true }),
  ];

  const dm = (c: ChannelSummary, at: { x: number; y: number }): MenuItem[] => {
    const other = c.kind === "dm" ? c.recipients[0] : undefined;
    return [
      ...(other ? [item("Profil", () => openPopout(other.id, null, at))] : []),
      ...markRead(c.id),
      sep,
      item("Copier l'identifiant", copy(c.id)),
      sep,
      item(other ? "Fermer le MP" : "Quitter le groupe", () => {
        const run = (): void => {
          void commands.dmClose(acc, c.id).then(() => {
            useEngine.setState((s) => ({ dms: s.dms.filter((d) => d.id !== c.id) }));
            const v = nav().view;
            if (v.kind === "dms" && v.channelId === c.id) nav().go({ kind: "friends" });
          });
        };
        if (other) run();
        else confirm({ title: "Quitter le groupe", body: "Tu ne recevras plus ses messages.", action: "Quitter", run });
      }, { danger: !other }),
    ];
  };

  return { message, user, channel, guild, dm };
}
