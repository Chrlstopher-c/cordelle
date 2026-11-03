// Serveurs publics : recherche avec délai de frappe, pages de 24, réponses périmées ignorées.
import { useCallback, useEffect, useRef, useState } from "react";
import { discoverableGuilds, type DiscoverableGuild } from "./api";

const PAGE = 24;
const DEBOUNCE_MS = 250;

export interface Discoverable {
  query: string;
  setQuery: (value: string) => void;
  guilds: DiscoverableGuild[];
  loading: boolean;
  hasMore: boolean;
  more: () => void;
}

export function useDiscoverable(accountId: string | undefined): Discoverable {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [guilds, setGuilds] = useState<DiscoverableGuild[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const latest = useRef(0);

  const fetchPage = useCallback(async (q: string, offset: number): Promise<void> => {
    if (!accountId) return;
    const id = ++latest.current;
    setLoading(true);
    try {
      const r = await discoverableGuilds(accountId, q, offset);
      if (id !== latest.current) return;
      const page = r.status === "ok" ? r.data : [];
      if (r.status === "error") console.error("[explorer] liste impossible", r.error);
      setGuilds((prev) => (offset === 0 ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE);
    } catch (e) {
      console.error("[explorer] liste impossible", e);
      if (id === latest.current) setGuilds([]);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => { void fetchPage(term, 0); }, [term, fetchPage]);

  const more = (): void => { void fetchPage(term, guilds.length); };

  return { query, setQuery, guilds, loading, hasMore, more };
}
