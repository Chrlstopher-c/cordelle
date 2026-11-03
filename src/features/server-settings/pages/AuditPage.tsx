// Journal d'audit : entrées dépliables (détail des changements), recherche par acteur ou action.
import { useMemo, useState } from "react";
import { srv } from "../api";
import type { AuditEntry } from "../server-contract";
import { Avatar } from "../../../shared/ui/Avatar";
import { attempt, type PageProps } from "../api";
import { actionLabel, clock } from "../format";
import { Empty, Section } from "../kit";
import { useLoad } from "../use-load";

export function AuditPage({ acc, guildId }: PageProps): React.JSX.Element {
  const { data, message } = useLoad(() => attempt(srv.auditLog(acc, guildId)), [acc, guildId]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => filterEntries(data ?? [], query), [data, query]);
  if (message) return <Empty>{message}</Empty>;
  if (!data) return <Empty>Chargement…</Empty>;
  return (
    <div className="ss-page">
      <h1>Journal d'audit</h1>
      <p className="ss-sub">Chaque action de modération et de configuration récente.</p>
      <div className="ss-tools">
        <input className="ss-input wide" placeholder="Rechercher par membre ou action"
          aria-label="Rechercher dans le journal"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Section>
        {shown.map((e) => (
          <AuditRow key={e.id} entry={e} expanded={open === e.id}
            onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
        {shown.length === 0 && <Empty>Aucune action ne correspond à ces filtres.</Empty>}
      </Section>
    </div>
  );
}

function AuditRow({ entry, expanded, onToggle }: {
  entry: AuditEntry; expanded: boolean; onToggle: () => void;
}): React.JSX.Element {
  const name = entry.actor?.global_name ?? entry.actor?.username ?? "Un membre";
  return (
    <div className="ss-audit">
      <button type="button" className="ss-audit-head" aria-expanded={expanded} onClick={onToggle}>
        <Avatar id={entry.actor?.id ?? entry.id} name={name} url={entry.actor?.avatar_url} size={28} />
        <span className="ss-audit-line"><b>{name}</b> {actionLabel(entry.action_type)}</span>
        <span className="ss-h">{clock(entry.created_ms)}</span>
      </button>
      {expanded && (
        <div className="ss-audit-detail">
          {entry.target_id && <span className="ss-h">Cible : <code className="ss-code">{entry.target_id}</code></span>}
          {entry.reason && <span className="ss-h">Raison : {entry.reason}</span>}
          {entry.changes.map((c) => (
            <span key={`${c.key}-${c.old ?? ""}-${c.new ?? ""}`} className="ss-change">
              <b>{c.key}</b> {c.old ?? "∅"} → {c.new ?? "∅"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function filterEntries(entries: AuditEntry[], query: string): AuditEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => {
    const who = `${e.actor?.username ?? ""} ${e.actor?.global_name ?? ""}`;
    return `${who} ${actionLabel(e.action_type)}`.toLowerCase().includes(q);
  });
}
