// État de la recherche d'un salon : terme envoyé, page courante, résultats. Une réponse périmée est ignorée.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../../contract/bindings";
import { searchMessages, SEARCH_PAGE_SIZE } from "./api";

export interface SearchScope {
  accountId: string;
  guildId: string | null;
  channelId: string;
}

export interface MessageSearch {
  open: boolean;
  term: string;
  page: number;
  total: number;
  pages: number;
  messages: Message[];
  loading: boolean;
  error: string | null;
  submit: (text: string) => void;
  goToPage: (page: number) => void;
  close: () => void;
}

interface Results {
  total: number;
  messages: Message[];
}

export function useMessageSearch(scope: SearchScope): MessageSearch {
  const { accountId, guildId, channelId } = scope;
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Results>({ total: 0, messages: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const fetchPage = useCallback(async (content: string, target: number): Promise<void> => {
    const request = ++latest.current;
    setLoading(true);
    setPage(target);
    const outcome = await searchMessages({
      accountId, guildId, channelId, content, offset: (target - 1) * SEARCH_PAGE_SIZE,
    });
    if (request !== latest.current) return;
    setLoading(false);
    if (outcome.ok) {
      setResults({ total: outcome.data.total, messages: outcome.data.messages });
      setError(null);
    } else {
      setError(outcome.message);
    }
  }, [accountId, guildId, channelId]);

  useEffect(() => {
    latest.current++;
    setOpen(false);
    setLoading(false);
  }, [channelId]);

  const submit = useCallback((text: string): void => {
    const content = text.trim();
    if (!content) return;
    setTerm(content);
    setOpen(true);
    void fetchPage(content, 1);
  }, [fetchPage]);

  const goToPage = useCallback((target: number): void => {
    if (term) void fetchPage(term, target);
  }, [fetchPage, term]);

  const close = useCallback((): void => {
    latest.current++;
    setOpen(false);
    setLoading(false);
  }, []);

  return {
    open, term, page, total: results.total, pages: Math.ceil(results.total / SEARCH_PAGE_SIZE),
    messages: results.messages, loading, error, submit, goToPage, close,
  };
}
