// Faux moteur de la zone access (mode démo) : comptes, connexion mot de passe, captcha et 2FA simulés.
// Données fictives uniquement. `?acces=vide` démarre sans compte pour voir l'écran de connexion.
import type { Handler } from "./mock-tauri";

const TEST_SITEKEY = "10000000-ffff-ffff-ffff-000000000001";
const SMS_CODE = "123456";

function user(id: string, name: string): Record<string, unknown> {
  return { id, username: name, global_name: null, avatar_url: null, bot: false };
}

function account(id: string, name: string, active: boolean): Record<string, unknown> {
  return { id, user: user(id, name), active, connection: "ready" };
}

const startEmpty = new URLSearchParams(location.search).get("acces") === "vide";
let accounts: Record<string, unknown>[] = startEmpty
  ? []
  : [account("1001", "demo_un", true), account("1002", "demo_deux", false)];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Argument `login` (objet PasswordLogin) lu tel que reçu de l'IPC. */
function loginField(args: Record<string, unknown>, key: string): string {
  const login = args.login as Record<string, unknown> | undefined; // justifié : argument IPC non typé
  return str(login?.[key]);
}

function setActive(id: string): void {
  accounts = accounts.map((a) => ({ ...a, active: a.id === id }));
}

function addAccount(name: string): string {
  const id = String(1000 + accounts.length + 1);
  accounts = [...accounts.map((a) => ({ ...a, active: false })), account(id, name, true)];
  return id;
}

function passwordOutcome(args: Record<string, unknown>): unknown {
  const password = loginField(args, "password");
  const login = loginField(args, "login");
  if (loginField(args, "captcha_key") !== "") return { outcome: "success", account_id: addAccount(login) };
  if (password === "captcha") {
    const challenge = { service: "hcaptcha", sitekey: TEST_SITEKEY, rqdata: null, rqtoken: "demo" };
    return { outcome: "captcha_required", challenge };
  }
  if (password === "mfa") {
    return { outcome: "mfa_required", ticket: "demo-ticket", methods: ["sms", "totp", "backup"] };
  }
  if (login.includes("@") && password.length > 0) return { outcome: "success", account_id: addAccount("demo_nouveau") };
  return { outcome: "invalid_credentials" };
}

function mfaOutcome(args: Record<string, unknown>): unknown {
  const ok = str(args.code) === SMS_CODE || str(args.code).length === 8;
  return ok ? { outcome: "success", account_id: addAccount("demo_mfa") } : { outcome: "invalid_credentials" };
}

export const handlers: Record<string, Handler> = {
  accounts_list: () => accounts,
  account_switch: (args) => {
    setActive(str(args.accountId));
    return null;
  },
  account_remove: (args) => {
    accounts = accounts.filter((a) => a.id !== str(args.accountId));
    return null;
  },
  auth_qr_start: () => null,
  auth_qr_cancel: () => null,
  auth_password: passwordOutcome,
  auth_mfa: mfaOutcome,
};
