// Pages « Appareils connectés », « Comptes liés » et « Abonnement » : données Discord du compte actif.
import { useState } from "react";
import { settingsApi as api, type DeviceSession, type LinkedService, type Subscription } from "./api";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { useConfirm } from "../../shared/ui/confirm";
import { Card, Row } from "./controls";
import { formatWhen, useRemote, type Remote } from "./remote";

function sessionSummary(count: number, loading: boolean): string {
  if (loading) return "Chargement…";
  return `${count} session${count > 1 ? "s" : ""} ouverte${count > 1 ? "s" : ""}.`;
}

function sessionHint(s: DeviceSession): string {
  return `${s.os || "OS inconnu"} · ${s.location ?? "lieu inconnu"} · dernière activité ${formatWhen(s.last_active)}`;
}

function serviceHint(c: LinkedService): string {
  const verified = c.verified ? "Vérifié" : "Non vérifié";
  const visible = c.visible ? "Affiché sur ton profil" : "Masqué sur ton profil";
  return `${serviceLabel(c.kind)} · ${verified} · ${visible}`;
}

function NoAccount(): React.JSX.Element {
  return <div className="st-sub">Aucun compte actif.</div>;
}

function Problem({ message }: { message: string | null }): React.JSX.Element | null {
  return message ? <div className="st-sub">{message}</div> : null;
}

const DANGER = { color: "var(--danger-text)" } as const;

export function SessionsPage(): React.JSX.Element {
  const accountId = useActiveAccount()?.id ?? null;
  return (
    <>
      <h1>Appareils connectés</h1>
      {accountId ? <SessionsBody accountId={accountId} /> : <NoAccount />}
    </>
  );
}

function SessionsBody({ accountId }: { accountId: string }): React.JSX.Element {
  const remote = useRemote(`sessions:${accountId}`, () => api.sessionsList(accountId));
  const [status, setStatus] = useState<string | null>(null);
  const confirm = useConfirm((s) => s.confirm);
  const logout = (s: DeviceSession): void => confirm({
    title: "Déconnecter cet appareil ?",
    body: `${s.client} (${s.os || "OS inconnu"}) sera déconnecté de ton compte.`,
    action: "Déconnecter",
    run: () => void runLogout(accountId, s.id_hash, remote, setStatus),
  });
  const sessions = remote.data ?? [];
  return (
    <>
      <div className="st-sub">{status ?? sessionSummary(sessions.length, remote.loading)}</div>
      <Problem message={remote.error} />
      <Card>
        {sessions.map((s) => (
          <Row key={s.id_hash} title={s.client} hint={sessionHint(s)}>
            <button className="btn-ghost" style={DANGER} onClick={() => logout(s)}>Déconnecter</button>
          </Row>
        ))}
      </Card>
    </>
  );
}

async function runLogout(
  accountId: string,
  hash: string,
  remote: Remote<DeviceSession[]>,
  setStatus: (s: string | null) => void,
): Promise<void> {
  const r = await api.sessionsLogout(accountId, [hash]);
  if (r.status === "ok") setStatus("Appareil déconnecté.");
  else setStatus("Déconnexion impossible.");
  remote.reload();
}

const SERVICE_LABELS: Record<string, string> = {
  github: "GitHub", twitch: "Twitch", youtube: "YouTube", steam: "Steam", spotify: "Spotify", reddit: "Reddit",
  twitter: "X", facebook: "Facebook", xbox: "Xbox", playstation: "PlayStation", battlenet: "Battle.net",
  epicgames: "Epic Games", riotgames: "Riot Games", crunchyroll: "Crunchyroll", ebay: "eBay", paypal: "PayPal",
  bluesky: "Bluesky", tiktok: "TikTok", domain: "Domaine",
};

export function serviceLabel(kind: string): string {
  return SERVICE_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function ConnectionsPage(): React.JSX.Element {
  const accountId = useActiveAccount()?.id ?? null;
  return (
    <>
      <h1>Comptes liés</h1>
      {accountId ? <ConnectionsBody accountId={accountId} /> : <NoAccount />}
    </>
  );
}

function ConnectionsBody({ accountId }: { accountId: string }): React.JSX.Element {
  const remote = useRemote(`connections:${accountId}`, () => api.connectionsList(accountId));
  const [status, setStatus] = useState<string | null>(null);
  const confirm = useConfirm((s) => s.confirm);
  const remove = (c: LinkedService): void => confirm({
    title: "Retirer ce compte lié ?",
    body: `${c.name} (${serviceLabel(c.kind)}) disparaît de ton profil Discord.`,
    action: "Retirer",
    run: () => void runRemove(accountId, c, remote, setStatus),
  });
  const items = remote.data ?? [];
  return (
    <>
      <div className="st-sub">{status ?? "Comptes connectés à ton profil Discord."}</div>
      <Problem message={remote.error} />
      {!remote.loading && items.length === 0 && !remote.error && <div className="st-sub">Aucun compte lié.</div>}
      <Card>
        {items.map((c) => (
          <Row key={`${c.kind}:${c.id}`} title={c.name || serviceLabel(c.kind)}
            hint={serviceHint(c)}>
            <button className="btn-ghost" style={DANGER} onClick={() => remove(c)}>Retirer</button>
          </Row>
        ))}
      </Card>
    </>
  );
}

async function runRemove(
  accountId: string,
  c: LinkedService,
  remote: Remote<LinkedService[]>,
  setStatus: (s: string | null) => void,
): Promise<void> {
  const r = await api.connectionRemove(accountId, c.kind, c.id);
  setStatus(r.status === "ok" ? "Compte lié retiré." : "Retrait impossible.");
  remote.reload();
}

const STATUS_LABELS: Record<string, string> = {
  active: "Actif", past_due: "Paiement en retard", canceled: "Résilié", ended: "Terminé",
};

function subscriptionTitle(s: Subscription): string {
  const label = STATUS_LABELS[s.status] ?? s.status;
  return s.canceled ? `${label} · résiliation demandée` : label;
}

export function BillingPage(): React.JSX.Element {
  const accountId = useActiveAccount()?.id ?? null;
  return (
    <>
      <h1>Abonnement et facturation</h1>
      <div className="st-sub">Lecture seule : Cordelle n'effectue aucun paiement.</div>
      {accountId ? <BillingBody accountId={accountId} /> : <NoAccount />}
    </>
  );
}

function BillingBody({ accountId }: { accountId: string }): React.JSX.Element {
  const remote = useRemote(`subscriptions:${accountId}`, () => api.subscriptionsList(accountId));
  const items = remote.data ?? [];
  if (!remote.loading && !remote.error && items.length === 0) return <div className="st-sub">Aucun abonnement.</div>;
  return (
    <>
      <Problem message={remote.error} />
      <Card>
        {items.map((s) => (
          <Row key={s.id} title={subscriptionTitle(s)} hint={`Fin de la période : ${formatWhen(s.period_end)}`} />
        ))}
      </Card>
    </>
  );
}
