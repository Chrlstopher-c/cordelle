// Réglages d'un salon : nom, sujet, contenu sensible, mode lent (Gérer les salons).
import { useEffect, useState } from "react";
import { srv } from "./api";
import type { ChannelEdit } from "./server-contract";
import { useActiveAccount } from "../../shared/data/use-active-account";
import { attempt, can, PERM } from "./api";
import { Empty, Flash, Notice, Row, SaveBar, Section, Toggle, useFlash } from "./kit";
import { useLoad } from "./use-load";
import "./server-settings.css";

interface Props { guildId: string; channelId: string; onClose: () => void }

const SLOWMODES: { v: number; label: string }[] = [
  { v: 0, label: "Désactivé" }, { v: 5, label: "5 secondes" }, { v: 10, label: "10 secondes" },
  { v: 15, label: "15 secondes" }, { v: 30, label: "30 secondes" }, { v: 60, label: "1 minute" },
  { v: 120, label: "2 minutes" }, { v: 300, label: "5 minutes" }, { v: 600, label: "10 minutes" },
  { v: 900, label: "15 minutes" }, { v: 1800, label: "30 minutes" }, { v: 3600, label: "1 heure" },
  { v: 7200, label: "2 heures" }, { v: 21600, label: "6 heures" },
];
const TOPIC_MAX = 1024;

export function ChannelSettingsScreen({ guildId, channelId, onClose }: Props): React.JSX.Element {
  const acc = useActiveAccount()?.id ?? "";
  const channel = useLoad(() => attempt(srv.channelInfo(acc, channelId)), [acc, channelId]);
  const guild = useLoad(() => attempt(srv.guildInfo(acc, guildId)), [acc, guildId]);
  const { message: toast, flash } = useFlash();

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !document.querySelector(".ss-veil, .cf-veil")) onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const failure = channel.message ?? guild.message;
  if (failure) return <Empty>{failure}</Empty>;
  if (!channel.data || !guild.data) return <Empty>Chargement…</Empty>;
  const editable = can(guild.data.permissions, PERM.MANAGE_CHANNELS);
  return (
    <div className="ss">
      <nav className="ss-nav" aria-label="Réglages du salon">
        <div className="ss-me">
          <div className="ss-me-txt"><b># {channel.data.name}</b><span>{guild.data.name}</span></div>
        </div>
        <button type="button" className="ss-item on" aria-current="page">Vue d'ensemble</button>
      </nav>
      <main className="ss-main">
        <button type="button" className="ss-close" onClick={onClose} aria-label="Fermer les réglages du salon">
          <span>✕</span>ÉCHAP
        </button>
        <ChannelForm key={`${channel.data.name}|${channel.data.topic ?? ""}|${channel.data.rate_limit_per_user}`}
          acc={acc} channelId={channelId} initial={channel.data} editable={editable}
          onSaved={() => { flash("Salon mis à jour"); channel.reload(); }} onError={flash} />
        <Flash message={toast} />
      </main>
    </div>
  );
}

type Detail = { name: string; topic: string | null; nsfw: boolean; rate_limit_per_user: number };

function ChannelForm({ acc, channelId, initial, editable, onSaved, onError }: {
  acc: string; channelId: string; initial: Detail; editable: boolean;
  onSaved: () => void; onError: (m: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(initial.name);
  const [topic, setTopic] = useState(initial.topic ?? "");
  const [nsfw, setNsfw] = useState(initial.nsfw);
  const [slow, setSlow] = useState(initial.rate_limit_per_user);
  const [busy, setBusy] = useState(false);
  const dirty = name !== initial.name || topic !== (initial.topic ?? "") || nsfw !== initial.nsfw
    || slow !== initial.rate_limit_per_user;

  const reset = (): void => {
    setName(initial.name); setTopic(initial.topic ?? ""); setNsfw(initial.nsfw); setSlow(initial.rate_limit_per_user);
  };

  const save = async (): Promise<void> => {
    const edit: ChannelEdit = {};
    if (name.trim() && name !== initial.name) edit.name = name.trim();
    if (topic !== (initial.topic ?? "")) edit.topic = topic;
    if (nsfw !== initial.nsfw) edit.nsfw = nsfw;
    if (slow !== initial.rate_limit_per_user) edit.rate_limit_per_user = slow;
    setBusy(true);
    const r = await attempt(srv.channelUpdate(acc, channelId, edit));
    setBusy(false);
    if (r.ok) onSaved(); else onError(r.message);
  };

  return (
    <div className="ss-page">
      <h1>Vue d'ensemble</h1>
      {!editable && <Notice>Lecture seule : il faut la permission Gérer les salons.</Notice>}
      <Section>
        <Row title="Nom du salon" hint="Lettres minuscules, chiffres et tirets.">
          <input className="ss-input" aria-label="Nom du salon" value={name} disabled={!editable} maxLength={100}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
        </Row>
        <div className="ss-row ss-row-block">
          <div className="ss-txt">
            <span className="ss-t">Sujet</span>
            <span className="ss-h">Affiché dans l'en-tête du salon.</span>
          </div>
          <textarea className="ss-area" aria-label="Sujet du salon" value={topic} disabled={!editable}
            maxLength={TOPIC_MAX} onChange={(e) => setTopic(e.target.value)} />
          <span className="ss-count">{topic.length} / {TOPIC_MAX}</span>
        </div>
      </Section>
      <Section title="Rythme des messages">
        <Row title="Mode lent" hint="Délai entre deux messages d'un même membre. Les modérateurs ne sont pas limités.">
          <select className="ss-select" aria-label="Mode lent" value={slow} disabled={!editable}
            onChange={(e) => setSlow(Number(e.target.value))}>
            {SLOWMODES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </Row>
      </Section>
      <Section title="Contenu">
        <Row title="Salon à contenu sensible" hint="Les membres doivent confirmer avoir 18 ans avant d'y entrer.">
          <Toggle on={nsfw} disabled={!editable} onChange={setNsfw} label="Salon à contenu sensible" />
        </Row>
      </Section>
      {editable && dirty && (
        <SaveBar busy={busy} onReset={reset}
          onSave={() => void save()} />
      )}
    </div>
  );
}
