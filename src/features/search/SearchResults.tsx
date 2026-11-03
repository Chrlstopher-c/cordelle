// Panneau de résultats à droite (440 px) : compteur, terme, résultats avec surlignage, pagination.
import { createPortal } from "react-dom";
import type { Message } from "../../contract/bindings";
import { Avatar } from "../../shared/ui/Avatar";
import { openChannelView } from "./navigate-to";
import { formatStamp, snowflakeTime } from "./snowflake";

interface Props {
  term: string;
  top: number;
  page: number;
  pages: number;
  total: number;
  messages: Message[];
  loading: boolean;
  error: string | null;
  accountId: string;
  guildId: string | null;
  onPage: (page: number) => void;
  onClose: () => void;
}

/** Numéros de page affichés : une fenêtre de 7 autour de la page courante. */
export function pageWindow(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - 3, pages - 6));
  const end = Math.min(pages, start + 6);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function Highlighted({ text, term }: { text: string; term: string }): React.JSX.Element {
  const parts = term ? text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i")) : [text];
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i} className="sx-hit">{part}</mark> : part))}
    </>
  );
}

function ResultRow({ message, term, onOpen }: { message: Message; term: string; onOpen: (m: Message) => void }): React.JSX.Element {
  const name = message.author.global_name ?? message.author.username;
  return (
    <article className="sx-result">
      <div className="sx-result-head">
        <Avatar id={message.author.id} name={name} url={message.author.avatar_url} size={32} />
        <div className="sx-result-body">
          <div className="sx-result-meta"><span className="sx-result-name">{name}</span>
            <span className="sx-result-date">{formatStamp(snowflakeTime(message.id))}</span></div>
          <p className="sx-result-text"><Highlighted text={message.content || "Pièce jointe"} term={term} /></p>
        </div>
      </div>
      <button className="sx-go" onClick={() => onOpen(message)}>Aller au message</button>
    </article>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }): React.JSX.Element | null {
  if (pages <= 1) return null;
  return (
    <nav className="sx-pager" aria-label="Pages de résultats">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente">‹</button>
      {pageWindow(page, pages).map((n) => (
        <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>{n}</button>
      ))}
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante">›</button>
    </nav>
  );
}

function resultsLabel(total: number, loading: boolean): string {
  if (loading) return "Recherche…";
  return total === 1 ? "1 résultat" : `${total} résultats`;
}

export function SearchResults(props: Props): React.JSX.Element {
  const { term, top, page, pages, total, messages, loading, error, accountId, guildId, onPage, onClose } = props;
  const open = (message: Message): void => openChannelView(accountId, guildId, message.channel_id);
  return createPortal(
    <aside className="sx-panel" style={{ top }} aria-label="Résultats de recherche">
      <div className="sx-panel-head">
        <span className="sx-panel-title">{resultsLabel(total, loading)}</span>
        <span className="sx-term">« {term} »</span>
        <button className="sx-icon" onClick={onClose} aria-label="Fermer les résultats">✕</button>
      </div>
      <div className="sx-list">
        {error && <p className="sx-empty">{error}</p>}
        {!error && !loading && messages.length === 0 && <p className="sx-empty">Aucun message ne correspond.</p>}
        {messages.map((m) => <ResultRow key={m.id} message={m} term={term} onOpen={open} />)}
      </div>
      <Pager page={page} pages={pages} onPage={onPage} />
    </aside>,
    document.body,
  );
}
