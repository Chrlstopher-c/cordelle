// Rendu du markdown Discord : blocs de code, citations, gras, italique, souligné, barré, code, spoiler,
// liens, mentions (<@id>, <#id>, <@&id>) et emojis personnalisés (<:nom:id>, <a:nom:id>).
import { Fragment, useState, type ReactNode } from "react";

type Rule = { re: RegExp; render: (m: RegExpExecArray, key: number) => ReactNode };

function Spoiler({ children }: { children: ReactNode }): React.JSX.Element {
  const [shown, setShown] = useState(false);
  return <span className={`md-spoiler${shown ? " shown" : ""}`} onClick={() => setShown(true)}>{children}</span>;
}

const INLINE: Rule[] = [
  { re: /`([^`]+)`/, render: (m, k) => <code key={k} className="md-code">{m[1]}</code> },
  { re: /\|\|([\s\S]+?)\|\|/, render: (m, k) => <Spoiler key={k}>{inline(m[1])}</Spoiler> },
  { re: /\*\*([\s\S]+?)\*\*/, render: (m, k) => <strong key={k}>{inline(m[1])}</strong> },
  { re: /__([\s\S]+?)__/, render: (m, k) => <u key={k}>{inline(m[1])}</u> },
  { re: /~~([\s\S]+?)~~/, render: (m, k) => <s key={k}>{inline(m[1])}</s> },
  { re: /(?:\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_)/, render: (m, k) => <em key={k}>{inline(m[1] ?? m[2])}</em> },
  { re: /<a?:(\w+):(\d+)>/, render: (m, k) => (
    <img key={k} className="md-emoji" alt={`:${m[1]}:`} title={`:${m[1]}:`}
      src={`https://cdn.discordapp.com/emojis/${m[2]}.webp?size=48`} />
  ) },
  { re: /<@!?(\d+)>/, render: (m, k) => <span key={k} className="md-mention">@{mentionName(m[1])}</span> },
  { re: /<@&(\d+)>/, render: (_m, k) => <span key={k} className="md-mention">@rôle</span> },
  { re: /<#(\d+)>/, render: (_m, k) => <span key={k} className="md-mention">#salon</span> },
  { re: /https?:\/\/[^\s<]+[^\s<.,:;"')\]]/, render: (m, k) => (
    <a key={k} href={m[0]} target="_blank" rel="noreferrer">{m[0]}</a>
  ) },
];

let names: Record<string, string> = {};
/** Noms connus pour afficher les mentions (fournis par la conversation). */
export function setMentionNames(map: Record<string, string>): void {
  names = map;
}
const mentionName = (id: string): string => names[id] ?? "utilisateur";

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length > 0) {
    let best: { rule: Rule; m: RegExpExecArray } | null = null;
    for (const rule of INLINE) {
      const m = rule.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { rule, m };
    }
    if (!best) { out.push(rest); break; }
    if (best.m.index > 0) out.push(rest.slice(0, best.m.index));
    out.push(best.rule.render(best.m, key++));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

export function Markdown({ text }: { text: string }): React.JSX.Element {
  const parts = text.split(/```(?:[\w+-]*\n)?([\s\S]*?)```/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <pre key={i} className="md-pre">{part}</pre> : <Lines key={i} text={part} />,
      )}
    </>
  );
}

function Lines({ text }: { text: string }): React.JSX.Element {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {line.startsWith("> ") ? <span className="md-quote">{inline(line.slice(2))}</span> : inline(line)}
          {i < lines.length - 1 && !line.startsWith("> ") && <br />}
        </Fragment>
      ))}
    </>
  );
}
