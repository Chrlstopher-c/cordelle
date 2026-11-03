// Connexion par identifiant et mot de passe : enchaîne captcha et second facteur selon la réponse du moteur.
import { useRef, useState } from "react";
import {
  commands,
  type CaptchaChallenge,
  type EngineError,
  type LoginOutcome,
  type MfaMethod,
} from "../../contract/bindings";
import { engineErrorText } from "./engine-error";

export type PasswordStep =
  | { kind: "form" }
  | { kind: "captcha"; challenge: CaptchaChallenge }
  | { kind: "mfa"; ticket: string; methods: MfaMethod[] };

export interface PasswordLogin {
  step: PasswordStep;
  busy: boolean;
  error: string | null;
  submit: (login: string, password: string) => void;
  solveCaptcha: (key: string, rqtoken: string | null) => void;
  submitMfa: (ticket: string, method: MfaMethod, code: string) => void;
  back: () => void;
}

type Reply = { status: "ok"; data: LoginOutcome } | { status: "error"; error: EngineError };
type Context = "password" | "mfa";
interface Credentials { login: string; password: string }
interface Next { step?: PasswordStep; error: string | null; accountId?: string }
interface Setters {
  setStep: (s: PasswordStep) => void;
  setError: (e: string | null) => void;
  setBusy: (b: boolean) => void;
  onDone: (accountId: string) => void;
}

const WRONG_PASSWORD = "Identifiant ou mot de passe incorrect.";
const WRONG_CODE = "Code incorrect.";

export function interpretReply(r: Reply, context: Context): Next {
  if (r.status === "error") return { error: engineErrorText(r.error) };
  const o = r.data;
  switch (o.outcome) {
    case "success":
      return { error: null, accountId: o.account_id };
    case "mfa_required":
      return { error: null, step: { kind: "mfa", ticket: o.ticket, methods: o.methods } };
    case "captcha_required":
      return { error: null, step: { kind: "captcha", challenge: o.challenge } };
    case "invalid_credentials":
      return { error: context === "mfa" ? WRONG_CODE : WRONG_PASSWORD };
  }
}

function settle(r: Reply, context: Context, s: Setters): void {
  s.setBusy(false);
  const next = interpretReply(r, context);
  s.setError(next.error);
  if (next.step) s.setStep(next.step);
  if (next.accountId) s.onDone(next.accountId);
}

export function usePasswordLogin(onDone: (accountId: string) => void): PasswordLogin {
  const [step, setStep] = useState<PasswordStep>({ kind: "form" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creds = useRef<Credentials | null>(null);

  const run = (call: Promise<Reply>, context: Context): void => {
    setBusy(true);
    setError(null);
    void call.then((r) => settle(r, context, { setStep, setError, setBusy, onDone }));
  };

  const solveCaptcha = (key: string, rqtoken: string | null): void => {
    const c = creds.current;
    if (!c) return;
    run(commands.authPassword({ ...c, captcha_key: key, captcha_rqtoken: rqtoken }), "password");
  };

  return {
    step,
    busy,
    error,
    submit: (login, password) => {
      creds.current = { login, password };
      run(commands.authPassword({ login, password, captcha_key: null, captcha_rqtoken: null }), "password");
    },
    solveCaptcha,
    submitMfa: (ticket, method, code) => run(commands.authMfa(ticket, method, code), "mfa"),
    back: () => {
      creds.current = null;
      setError(null);
      setStep({ kind: "form" });
    },
  };
}
