// Champ de recherche de l'en-tête (210 px) : Entrée lance la recherche du salon, les résultats s'ouvrent à droite.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { SearchResults } from "./SearchResults";
import { useMessageSearch, type SearchScope } from "./use-message-search";

export function SearchField(scope: SearchScope): React.JSX.Element {
  const search = useMessageSearch(scope);
  const [draft, setDraft] = useState("");
  const [top, setTop] = useState(0);
  const fieldRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!search.open) return;
    const header = fieldRef.current?.closest(".cv-head");
    setTop(header?.getBoundingClientRect().bottom ?? 0);
  }, [search.open]);

  const onKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") search.submit(draft);
    if (event.key === "Escape") search.close();
  };

  return (
    <>
      <div className="sx-field" ref={fieldRef}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input aria-label="Rechercher dans le serveur" placeholder="Rechercher" value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
      </div>
      {search.open && (
        <SearchResults term={search.term} top={top} page={search.page} pages={search.pages} total={search.total}
          messages={search.messages} loading={search.loading} error={search.error} accountId={scope.accountId}
          guildId={scope.guildId} onPage={search.goToPage} onClose={search.close} />
      )}
    </>
  );
}
