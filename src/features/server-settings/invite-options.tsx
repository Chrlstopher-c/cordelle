// Options d'une invitation (durée, utilisations) : partagées entre la modale Inviter et la page Invitations.
import { Segmented } from "./kit";

export const DURATIONS = [
  { v: 1800, label: "30 minutes" }, { v: 3600, label: "1 heure" }, { v: 21600, label: "6 heures" },
  { v: 43200, label: "12 heures" }, { v: 86400, label: "1 jour" }, { v: 604800, label: "7 jours" },
  { v: 0, label: "Jamais" },
];

export const USES = [
  { v: 0, label: "Illimité" }, { v: 1, label: "1" }, { v: 5, label: "5" }, { v: 10, label: "10" },
  { v: 25, label: "25" }, { v: 50, label: "50" }, { v: 100, label: "100" },
];

export function durationLabel(seconds: number): string {
  return DURATIONS.find((d) => d.v === seconds)?.label.toLowerCase() ?? "";
}

export function InviteOptions({ maxAge, maxUses, onAge, onUses }: {
  maxAge: number; maxUses: number; onAge: (v: number) => void; onUses: (v: number) => void;
}): React.JSX.Element {
  return (
    <div className="ss-invite-opts">
      <span className="ss-label">Expire après</span>
      <Segmented value={maxAge} options={DURATIONS} onChange={onAge} label="Expire après" />
      <span className="ss-label">Nombre max d'utilisations</span>
      <Segmented value={maxUses} options={USES} onChange={onUses} label="Nombre max d'utilisations" />
    </div>
  );
}
