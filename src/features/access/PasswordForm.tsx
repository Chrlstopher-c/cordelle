// Formulaire identifiant et mot de passe ; affiche le captcha quand le moteur le demande.
import { useId, useState } from "react";
import { CaptchaBox } from "./CaptchaBox";
import { CTA_STYLE, ERROR_STYLE, FIELD_STYLE, LABEL_STYLE, LINK_STYLE } from "./access-styles";
import type { PasswordLogin } from "./use-password-login";

const COLUMN: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };

function EyeIcon(): React.JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
}

function PasswordField({ id, value, onChange }: PasswordFieldProps): React.JSX.Element {
  const [shown, setShown] = useState(false);
  return (
    <div style={COLUMN}>
      <label htmlFor={id} style={LABEL_STYLE}>Mot de passe</label>
      <div style={{ position: "relative", display: "flex" }}>
        <input id={id} style={{ ...FIELD_STYLE, paddingRight: 44 }} value={value} autoComplete="current-password"
          type={shown ? "text" : "password"} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          style={{ ...LINK_STYLE, position: "absolute", right: 6, top: 6, width: 30, height: 30, display: "flex",
            alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          <EyeIcon />
        </button>
      </div>
    </div>
  );
}

export function PasswordForm({ pw }: { pw: PasswordLogin }): React.JSX.Element {
  const loginId = useId();
  const passwordId = useId();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const captcha = pw.step.kind === "captcha" ? pw.step.challenge : null;
  const canSubmit = login.trim() !== "" && password !== "" && !pw.busy;

  const submit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (canSubmit) pw.submit(login.trim(), password);
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={COLUMN}>
        <label htmlFor={loginId} style={LABEL_STYLE}>E-mail ou téléphone</label>
        <input id={loginId} style={FIELD_STYLE} value={login} autoComplete="username" autoFocus
          onChange={(e) => setLogin(e.target.value)} />
      </div>
      <PasswordField id={passwordId} value={password} onChange={setPassword} />
      {pw.error && <p role="alert" style={ERROR_STYLE}>{pw.error}</p>}
      {captcha && (
        <CaptchaBox key={captcha.rqtoken ?? captcha.sitekey} challenge={captcha}
          onSolved={(key) => pw.solveCaptcha(key, captcha.rqtoken ?? null)} />
      )}
      <button type="submit" disabled={!canSubmit} style={{ ...CTA_STYLE, opacity: canSubmit ? 1 : 0.55 }}>
        Se connecter
      </button>
    </form>
  );
}
