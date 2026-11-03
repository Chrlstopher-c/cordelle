// Barre de contrôle de l'appel : micro, son (flèche = choix du périphérique), raccrocher.
// Pas de caméra ni de partage d'écran tant que le moteur ne les gère pas.
import type { ReactNode } from "react";
import { voice } from "./api";
import { DeviceMenu } from "./DeviceMenu";
import { ChevronIcon, MicIcon, MicOffIcon, PhoneOffIcon, SpeakerIcon, SpeakerOffIcon } from "./icons";
import { type DeviceKind, useDeviceMenu } from "./use-device-menu";
import type { VoiceSession } from "./types";

export function CallControls({ accountId, session }: { accountId: string; session: VoiceSession }): React.JSX.Element {
  const mute = session.self_mute;
  const deaf = session.self_deaf;
  return (
    <div className="call-bar">
      <ControlGroup kind="input" title="Micro" off={mute}
        icon={mute ? <MicOffIcon /> : <MicIcon />}
        toggleLabel={mute ? "Réactiver le micro" : "Couper le micro"} chevronLabel="Choisir le micro"
        onToggle={() => void voice.setMute(accountId, !mute)} />
      <ControlGroup kind="output" title="Sortie audio" off={deaf}
        icon={deaf ? <SpeakerOffIcon /> : <SpeakerIcon />}
        toggleLabel={deaf ? "Réactiver le son" : "Couper le son"} chevronLabel="Choisir la sortie audio"
        onToggle={() => void voice.setDeaf(accountId, !deaf)} />
      <button className="cb-leave" aria-label="Quitter l'appel" onClick={() => void voice.leave(accountId)}>
        <PhoneOffIcon />
      </button>
    </div>
  );
}

interface GroupProps {
  kind: DeviceKind;
  title: string;
  off: boolean;
  icon: ReactNode;
  toggleLabel: string;
  chevronLabel: string;
  onToggle: () => void;
}

function ControlGroup({ kind, title, off, icon, toggleLabel, chevronLabel, onToggle }: GroupProps): React.JSX.Element {
  const menu = useDeviceMenu(kind);
  return (
    <div className="cb-group" ref={menu.ref}>
      <button className={`cb-btn${off ? " off" : ""}`} aria-pressed={off} aria-label={toggleLabel} onClick={onToggle}>
        {icon}
      </button>
      <button className="cb-chev" aria-haspopup="menu" aria-expanded={menu.open} aria-label={chevronLabel}
        onClick={() => void menu.toggle()}>
        <ChevronIcon />
      </button>
      {menu.open && (
        <DeviceMenu title={title} list={menu.list} selected={menu.selected} onPick={(id) => void menu.pick(id)} />
      )}
    </div>
  );
}
