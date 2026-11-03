// Liste virtualisée ancrée en bas : ouverture au dernier message, suivi des nouveaux, chargement des anciens en haut
// sans saut (compensation de hauteur).
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Message } from "../../contract/bindings";
import { useEngine } from "../../shared/data/engine-store";
import { buildRows, type Row } from "./rows";

const EMPTY: Message[] = [];

export interface MessageList {
  rows: Row[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function useMessageList(accountId: string, channelId: string, lastReadId: string | null = null): MessageList {
  const messages = useEngine((s) => s.messages[channelId] ?? EMPTY);
  const hasMore = useEngine((s) => s.hasMore[channelId] ?? true);
  const loadMessages = useEngine((s) => s.loadMessages);
  const rows = useMemo(() => buildRows(messages, lastReadId), [messages, lastReadId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const loadingOlder = useRef(false);
  const prevHeight = useRef<number | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "date" || rows[i]?.kind === "new" ? 40 : rows[i]?.kind === "message" && rows[i].grouped ? 26 : 64),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 12,
  });

  useEffect(() => {
    atBottom.current = true;
    void loadMessages(accountId, channelId);
  }, [accountId, channelId, loadMessages]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop += virtualizer.getTotalSize() - prevHeight.current;
      prevHeight.current = null;
    } else if (atBottom.current && rows.length > 0) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    }
  }, [rows, virtualizer]);

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 300 && hasMore && !loadingOlder.current && messages.length > 0) {
      loadingOlder.current = true;
      prevHeight.current = virtualizer.getTotalSize();
      void loadMessages(accountId, channelId, true).finally(() => { loadingOlder.current = false; });
    }
  };

  return { rows, virtualizer, scrollRef, onScroll };
}
