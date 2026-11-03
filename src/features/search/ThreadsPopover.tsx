// Popover « Fils » : fils actifs ou archivés du salon, et création d'un fil (nom).
import { useState, type FormEvent } from "react";
import { formatStamp, snowflakeTime } from "./snowflake";
import type { Outcome, ThreadSummary } from "./api";

interface Props {
  archived: boolean;
  list: Outcome<ThreadSummary[]> | null;
  creating: string | null;
  createError: string | null;
  onTab: (archived: boolean) => void;
  onOpen: (thread: ThreadSummary) => void;
  onCreate: (name: string) => void;
}

function ThreadRow({ thread, onOpen }: { thread: ThreadSummary; onOpen: () => void }): React.JSX.Element {
  const last = thread.last_message_id ? formatStamp(snowflakeTime(thread.last_message_id)) : "Aucun message";
  return (
    <button className="sx-thread" onClick={onOpen}>
      <span className="sx-thread-name"># {thread.name}</span>
      <span className="sx-thread-meta">{thread.message_count} message{thread.message_count > 1 ? "s" : ""} · {last}</span>
    </button>
  );
}

function ThreadList({ list, onOpen }: { list: Outcome<ThreadSummary[]> | null; onOpen: (t: ThreadSummary) => void }): React.JSX.Element {
  if (!list) return <p className="sx-empty">Chargement…</p>;
  if (!list.ok) return <p className="sx-empty">{list.message}</p>;
  if (list.data.length === 0) return <p className="sx-empty">Aucun fil dans ce salon.</p>;
  return <>{list.data.map((t) => <ThreadRow key={t.id} thread={t} onOpen={() => onOpen(t)} />)}</>;
}

export function ThreadsPopover(props: Props): React.JSX.Element {
  const { archived, list, creating, createError, onTab, onOpen, onCreate } = props;
  const [name, setName] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const clean = name.trim();
    if (clean && !creating) onCreate(clean);
  };
  return (
    <div className="sx-pop sx-threads" role="dialog" aria-label="Fils du salon">
      <div className="sx-pop-head">
        <span className="sx-panel-title">Fils</span>
        <div className="sx-seg" role="group" aria-label="Fils actifs ou archivés">
          <button aria-pressed={!archived} onClick={() => onTab(false)}>Actifs</button>
          <button aria-pressed={archived} onClick={() => onTab(true)}>Archivés</button>
        </div>
      </div>
      <div className="sx-list"><ThreadList list={list} onOpen={onOpen} /></div>
      <form className="sx-create" onSubmit={submit}>
        <input aria-label="Nom du nouveau fil" placeholder="Nom du fil" maxLength={100} value={name}
          onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={!name.trim() || creating !== null}>
          {creating ? "Création…" : "Créer un fil"}
        </button>
      </form>
      {createError && <p className="sx-error">{createError}</p>}
    </div>
  );
}
