// Double authentification : code à 6 chiffres (application ou SMS) ou code de secours, méthode au choix.
import { useState } from "react";
import type { MfaMethod } from "../../contract/bindings";
import { CTA_STYLE, ERROR_STYLE, FIELD_STYLE, LINK_STYLE, MUTED_STYLE, TITLE_STYLE } from "./access-styles";
import { CODE_LENGTH, CodeCells } from "./CodeCells";

type SupportedMethod = Extract<MfaMethod, "totp" | "sms" | "backup">;

const ORDER: SupportedMethod[] = ["totp", "sms", "backup"];
const BACKUP_LENGTH = 8;

const COPY: Record<SupportedMethod, { label: string; hint: string }> = {
  totp: { label: "Application d'authentification", hint: "Saisis le code de ton application d'authentification." },
  sms: { label: "SMS", hint: "Saisis le code reçu par SMS." },
  backup: { label: "Code de secours", hint: "Saisis un de tes codes de secours, utilisable une seule fois." },
};

export interface MfaScreenProps {
  methods: MfaMethod[];
  error: string | null;
  busy: boolean;
  onSubmit: (method: MfaMethod, code: string) => void;
  onBack: () => void;
}

const emptyDigits = (): string[] => Array.from({ length: CODE_LENGTH }, () => "");
const codeLength = (m: SupportedMethod): number => (m === "backup" ? BACKUP_LENGTH : CODE_LENGTH);

export function MfaScreen({ methods, error, busy, onSubmit, onBack }: MfaScreenProps): React.JSX.Element {
  const available = ORDER.filter((m) => methods.includes(m));
  if (available.length === 0) return <NoMethod onBack={onBack} />;
  return <MfaForm available={available} error={error} busy={busy} onSubmit={onSubmit} onBack={onBack} />;
}

function NoMethod({ onBack }: { onBack: () => void }): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={ERROR_STYLE}>Aucune méthode de vérification prise en charge ici.</p>
      <button type="button" onClick={onBack} style={LINK_STYLE}>Retour</button>
    </div>
  );
}

interface MfaFormProps extends Omit<MfaScreenProps, "methods"> {
  available: SupportedMethod[];
}

function MfaForm({ available, error, busy, onSubmit, onBack }: MfaFormProps): React.JSX.Element {
  const [method, setMethod] = useState<SupportedMethod>(available[0] ?? "totp");
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [backup, setBackup] = useState("");

  const code = method === "backup" ? backup.replace(/[\s-]/g, "") : digits.join("");
  const complete = code.length === codeLength(method);
  const submit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (complete && !busy) onSubmit(method, code);
  };
  const choose = (m: SupportedMethod): void => {
    setMethod(m);
    setDigits(emptyDigits());
    setBackup("");
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={onBack} style={{ ...LINK_STYLE, alignSelf: "flex-start" }}>Retour</button>
      <MfaTitle hint={COPY[method].hint} />
      {method === "backup" ? (
        <BackupInput value={backup} invalid={error !== null} onChange={setBackup} />
      ) : (
        <CodeCells digits={digits} onChange={setDigits} invalid={error !== null} />
      )}
      {error && <p role="alert" style={ERROR_STYLE}>{error}</p>}
      <button type="submit" disabled={!complete || busy}
        style={{ ...CTA_STYLE, opacity: complete && !busy ? 1 : 0.55 }}>
        Valider
      </button>
      <MethodChoice available={available} current={method} onChoose={choose} />
    </form>
  );
}

interface BackupInputProps {
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
}

function MfaTitle({ hint }: { hint: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h2 style={TITLE_STYLE}>Double authentification</h2>
      <p style={MUTED_STYLE}>{hint}</p>
    </div>
  );
}

function BackupInput({ value, invalid, onChange }: BackupInputProps): React.JSX.Element {
  return (
    <input aria-label="Code de secours" value={value} placeholder="XXXX-XXXX" autoComplete="one-time-code" autoFocus
      maxLength={BACKUP_LENGTH + 1} onChange={(e) => onChange(e.target.value)}
      style={{ ...FIELD_STYLE, textAlign: "center", fontSize: 18, fontWeight: 600, letterSpacing: ".2em",
        borderColor: invalid ? "var(--danger)" : "var(--border)" }} />
  );
}

interface MethodChoiceProps {
  available: SupportedMethod[];
  current: SupportedMethod;
  onChoose: (m: SupportedMethod) => void;
}

function MethodChoice({ available, current, onChoose }: MethodChoiceProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)",
      paddingTop: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase",
        color: "var(--text-faint)", padding: "0 0 6px 4px" }}>Autre méthode</span>
      {available.map((m) => (
        <button key={m} type="button" aria-pressed={m === current} onClick={() => onChoose(m)}
          style={{ padding: "10px 12px", borderRadius: "var(--r-md)", textAlign: "left", fontFamily: "inherit",
            fontSize: "var(--fs-small)", color: "var(--text)", border: 0, cursor: "pointer",
            background: m === current ? "var(--surface-selected)" : "none" }}>
          {COPY[m].label}
        </button>
      ))}
    </div>
  );
}
