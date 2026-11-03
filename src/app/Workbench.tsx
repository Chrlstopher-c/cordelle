// Écran de travail brut (pas le design) : serveurs | salons | messages + envoi.
import { useState } from "react";
import { useWorkbench } from "./use-workbench";

const col: React.CSSProperties = { overflowY: "auto", borderRight: "1px solid #333", padding: 8 };
const item = (active: boolean): React.CSSProperties => ({
  cursor: "pointer", padding: "4px 6px", background: active ? "#2a2a2a" : "transparent", borderRadius: 4,
});

export function Workbench({ accountId }: { accountId: string }): React.JSX.Element {
  const wb = useWorkbench(accountId);
  const [draft, setDraft] = useState("");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 220px 1fr", height: "70vh", border: "1px solid #333" }}>
      <div style={col}>
        <div style={{ opacity: 0.6, fontSize: 12 }}>gateway : {wb.connection}</div>
        <div style={item(wb.guildId === null)} onClick={() => wb.selectGuild(null)}>Messages privés</div>
        {wb.guilds.map((g) => (
          <div key={g.id} style={item(wb.guildId === g.id)} onClick={() => wb.selectGuild(g.id)}>
            {g.unread ? "• " : ""}{g.name}
          </div>
        ))}
      </div>
      <div style={col}>
        {wb.channels.map((c) => (
          <div key={c.id} style={item(wb.channelId === c.id)} onClick={() => wb.selectChannel(c.id)}>
            {c.kind === "category" ? <b>{c.name}</b> : <>{c.unread ? "• " : ""}# {c.name || c.recipients.map((r) => r.username).join(", ")}</>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column-reverse", padding: 8 }}>
          {wb.messages.map((m) => (
            <div key={m.id} style={{ padding: "2px 0" }}>
              <b>{m.author.global_name ?? m.author.username}</b> {m.content}
              {m.attachments.length > 0 && <i> [{m.attachments.length} pièce(s) jointe(s)]</i>}
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); wb.send(draft); setDraft(""); }} style={{ padding: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message"
            style={{ width: "100%", padding: 6, background: "#222", color: "#ddd", border: "1px solid #444" }} />
        </form>
      </div>
    </div>
  );
}
