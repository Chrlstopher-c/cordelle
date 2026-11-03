// Bouton « Épinglés » de l'en-tête et son popover : messages épinglés du salon, avec « Aller au message ».
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../../contract/bindings";
import { Avatar } from "../../shared/ui/Avatar";
import { openChannelView } from "./navigate-to";
import { listPins, type Outcome } from "./api";
import { formatStamp, snowflakeTime } from "./snowflake";
import { useDismiss } from "./use-dismiss";

interface Props {
  accountId: string;
  guildId: string | null;
  channelId: string;
}

function PinRow({ message, onOpen }: { message: Message; onOpen: () => void }): React.JSX.Element {
  const name = message.author.global_name ?? message.author.username;
  return (
    <article className="sx-result">
      <div className="sx-result-head">
        <Avatar id={message.author.id} name={name} url={message.author.avatar_url} size={32} />
        <div className="sx-result-body">
          <div className="sx-result-meta"><span className="sx-result-name">{name}</span>
            <span className="sx-result-date">{formatStamp(snowflakeTime(message.id))}</span></div>
          <p className="sx-result-text">{message.content || "Pièce jointe"}</p>
        </div>
      </div>
      <button className="sx-go" onClick={onOpen}>Aller au message</button>
    </article>
  );
}

function PinsBody({ outcome, onOpen }: { outcome: Outcome<Message[]> | null; onOpen: (m: Message) => void }): React.JSX.Element {
  if (!outcome) return <p className="sx-empty">Chargement…</p>;
  if (!outcome.ok) return <p className="sx-empty">{outcome.message}</p>;
  if (outcome.data.length === 0) return <p className="sx-empty">Aucun message épinglé dans ce salon.</p>;
  return <>{outcome.data.map((m) => <PinRow key={m.id} message={m} onOpen={() => onOpen(m)} />)}</>;
}

export function PinsButton({ accountId, guildId, channelId }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState<Outcome<Message[]> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close);

  const load = useCallback(async (): Promise<void> => {
    setPins(await listPins(accountId, channelId));
  }, [accountId, channelId]);

  useEffect(() => {
    setPins(null);
    void load();
  }, [load]);

  const toggle = (): void => {
    if (!open) void load();
    setOpen(!open);
  };
  const count = pins?.ok ? pins.data.length : null;
  const openMessage = (m: Message): void => {
    openChannelView(accountId, guildId, m.channel_id);
    setOpen(false);
  };

  return (
    <div className="sx-anchor" ref={wrapRef}>
      <button className="cv-tool" aria-expanded={open} onClick={toggle}>
        Épinglés{count !== null && <span className="sx-count">{count}</span>}
      </button>
      {open && (
        <div className="sx-pop sx-pins" role="dialog" aria-label={`Messages épinglés`}>
          <div className="sx-pop-head"><span className="sx-panel-title">Messages épinglés</span></div>
          <div className="sx-list"><PinsBody outcome={pins} onOpen={openMessage} /></div>
        </div>
      )}
    </div>
  );
}
