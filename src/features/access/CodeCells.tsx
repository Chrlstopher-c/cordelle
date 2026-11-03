// Cases à chiffre unique : saisie avec passage automatique, retour arrière et collage d'un code complet.
import { useRef } from "react";

export const CODE_LENGTH = 6;

const CELL_STYLE: React.CSSProperties = {
  width: 48,
  height: 58,
  boxSizing: "border-box",
  padding: 0,
  borderRadius: "var(--r-sm)",
  background: "var(--surface-frame)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 24,
  fontWeight: 600,
  textAlign: "center",
  outline: "none",
};

function withDigits(digits: string[], start: number, chars: string[]): string[] {
  const next = digits.slice();
  chars.forEach((c, k) => {
    next[start + k] = c;
  });
  return next;
}

interface CodeCellsProps {
  digits: string[];
  onChange: (next: string[]) => void;
  invalid: boolean;
}

interface CellProps {
  index: number;
  digit: string;
  invalid: boolean;
  setRef: (el: HTMLInputElement | null) => void;
  onType: (raw: string) => void;
  onBackspace: () => void;
  onPaste: (text: string) => void;
}

function CodeCell(p: CellProps): React.JSX.Element {
  return (
    <input ref={p.setRef} value={p.digit} aria-label={`Chiffre ${p.index + 1}`} inputMode="numeric"
      autoComplete={p.index === 0 ? "one-time-code" : "off"} autoFocus={p.index === 0}
      onChange={(e) => p.onType(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !p.digit) {
          e.preventDefault();
          p.onBackspace();
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        p.onPaste(e.clipboardData.getData("text"));
      }}
      style={{ ...CELL_STYLE, border: "1px solid", borderColor: p.invalid ? "var(--danger)" : "var(--border)" }} />
  );
}

export function CodeCells({ digits, onChange, invalid }: CodeCellsProps): React.JSX.Element {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAt = (i: number): void => refs.current[i]?.focus();

  return (
    <div role="group" aria-label="Code à 6 chiffres" style={{ display: "flex", justifyContent: "center", gap: 8 }}>
      {digits.map((digit, i) => (
        <CodeCell key={i} index={i} digit={digit} invalid={invalid}
          setRef={(el) => { refs.current[i] = el; }}
          onType={(raw) => {
            const d = raw.replace(/\D/g, "").slice(-1);
            onChange(withDigits(digits, i, [d]));
            if (d && i < CODE_LENGTH - 1) focusAt(i + 1);
          }}
          onBackspace={() => {
            if (i === 0) return;
            onChange(withDigits(digits, i - 1, [""]));
            focusAt(i - 1);
          }}
          onPaste={(text) => {
            const chars = text.replace(/\D/g, "").slice(0, CODE_LENGTH - i).split("");
            if (chars.length === 0) return;
            onChange(withDigits(digits, i, chars));
            focusAt(Math.min(i + chars.length, CODE_LENGTH - 1));
          }} />
      ))}
    </div>
  );
}
