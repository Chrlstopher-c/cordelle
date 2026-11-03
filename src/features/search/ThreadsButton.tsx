// Bouton « Fils (n) » de l'en-tête : charge les fils du salon, ouvre un fil comme un salon, crée un fil.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadSummary } from "./api";
import { openChannelView } from "./navigate-to";
import { createThread, listThreads, type Outcome } from "./api";
import { ThreadsPopover } from "./ThreadsPopover";
import { useDismiss } from "./use-dismiss";

interface Props {
  accountId: string;
  guildId: string;
  channelId: string;
}

export function ThreadsButton({ accountId, guildId, channelId }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [archived, setArchived] = useState(false);
  const [list, setList] = useState<Outcome<ThreadSummary[]> | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const request = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close);

  const load = useCallback(async (archivedNow: boolean): Promise<void> => {
    const id = ++request.current;
    const outcome = await listThreads(accountId, channelId, archivedNow);
    if (id !== request.current) return;
    setList(outcome);
    if (!archivedNow && outcome.ok) setActiveCount(outcome.data.length);
  }, [accountId, channelId]);

  useEffect(() => {
    setArchived(false);
    setList(null);
    setActiveCount(null);
    setCreateError(null);
    void load(false);
  }, [load]);

  const toggle = (): void => {
    if (!open) void load(archived);
    setOpen(!open);
  };
  const onTab = (next: boolean): void => {
    setArchived(next);
    setList(null);
    void load(next);
  };
  const onCreate = async (name: string): Promise<void> => {
    setCreating(name);
    setCreateError(null);
    const outcome = await createThread(accountId, channelId, name, null);
    setCreating(null);
    if (outcome.ok) {
      openChannelView(accountId, guildId, outcome.data.id);
      setOpen(false);
    } else {
      setCreateError(outcome.message);
    }
  };

  return (
    <div className="sx-anchor" ref={wrapRef}>
      <button className="cv-tool" aria-expanded={open} onClick={toggle}>
        Fils{activeCount !== null && <span className="sx-count">{activeCount}</span>}
      </button>
      {open && (
        <ThreadsPopover archived={archived} list={list} creating={creating} createError={createError}
          onTab={onTab} onCreate={(name) => void onCreate(name)}
          onOpen={(t) => { openChannelView(accountId, guildId, t.id); setOpen(false); }} />
      )}
    </div>
  );
}
