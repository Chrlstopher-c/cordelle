// Pictogrammes vocaux : trait 1.8, même famille que les autres icônes de l'interface.
import type { ReactNode } from "react";

interface GlyphProps {
  size: number;
  stroke?: number;
  children: ReactNode;
}

function Glyph({ size, stroke = 1.8, children }: GlyphProps): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

interface SizeProps {
  size?: number;
}

export function MicIcon({ size = 19 }: SizeProps): React.JSX.Element {
  return (
    <Glyph size={size}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Glyph>
  );
}

export function MicOffIcon({ size = 19 }: SizeProps): React.JSX.Element {
  return (
    <Glyph size={size}>
      <path d="M9 9v2a3 3 0 0 0 5 2.2M15 9.5V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.4M12 18v3M3 3l18 18" />
    </Glyph>
  );
}

function SpeakerBody(): React.JSX.Element {
  return (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </>
  );
}

export function SpeakerIcon({ size = 19 }: SizeProps): React.JSX.Element {
  return <Glyph size={size}><SpeakerBody /></Glyph>;
}

export function SpeakerOffIcon({ size = 19 }: SizeProps): React.JSX.Element {
  return (
    <Glyph size={size}>
      <SpeakerBody />
      <path d="M3 3l18 18" />
    </Glyph>
  );
}

export function PhoneOffIcon({ size = 22 }: SizeProps): React.JSX.Element {
  return <Glyph size={size}><path d="M3 14.5c5-4.5 13-4.5 18 0l-2 3-3.5-1.5v-2.5a10 10 0 0 0-7 0V16L5 17.5z" /></Glyph>;
}

export function ChevronIcon({ size = 12 }: SizeProps): React.JSX.Element {
  return <Glyph size={size} stroke={2.4}><path d="m6 15 6-6 6 6" /></Glyph>;
}

export function CheckIcon({ size = 15 }: SizeProps): React.JSX.Element {
  return <Glyph size={size} stroke={2.4}><path d="m5 12 5 5 9-10" /></Glyph>;
}
