// Widget hCaptcha affiché dans l'app ; le jeton résolu repart vers authPassword (via onSolved).
import { useEffect, useRef, useState } from "react";
import type { CaptchaChallenge } from "../../contract/bindings";
import { ERROR_STYLE, MUTED_STYLE } from "./access-styles";
import { loadHcaptcha } from "./hcaptcha";

interface CaptchaBoxProps {
  challenge: CaptchaChallenge;
  onSolved: (key: string) => void;
}

interface Mount {
  sitekey: string;
  rqdata?: string | null;
  solved: (key: string) => void;
  onFail: () => void;
}

function mountCaptcha(el: HTMLElement, m: Mount): () => void {
  let active = true;
  loadHcaptcha()
    .then((api) => {
      if (active) {
        api.render(el, {
          sitekey: m.sitekey,
          rqdata: m.rqdata ?? undefined,
          callback: m.solved,
          "error-callback": m.onFail,
        });
      }
    })
    .catch((err: unknown) => {
      console.error("[access] hCaptcha", err);
      if (active) m.onFail();
    });
  return () => {
    active = false;
  };
}

export function CaptchaBox({ challenge, onSolved }: CaptchaBoxProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const solvedRef = useRef(onSolved);
  const [failed, setFailed] = useState(false);
  const { sitekey, rqdata } = challenge;

  useEffect(() => {
    solvedRef.current = onSolved;
  }, [onSolved]);

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const solved = (key: string): void => solvedRef.current(key);
    return mountCaptcha(el, { sitekey, rqdata, solved, onFail: () => setFailed(true) });
  }, [sitekey, rqdata]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ ...MUTED_STYLE, textAlign: "left" }}>Une vérification est nécessaire avant de continuer.</span>
      <div ref={host} />
      {failed && <p role="alert" style={ERROR_STYLE}>Vérification indisponible. Réessaie.</p>}
    </div>
  );
}
