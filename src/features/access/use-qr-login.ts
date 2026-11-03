// Connexion QR de l'écran de travail : suit l'événement authQr et rend le QR en data URL.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { commands, events, type QrAuthEvent } from "../../contract/bindings";

export interface QrLogin {
  image: string | null;
  step: string;
  start: () => void;
}

export function useQrLogin(onDone: () => void): QrLogin {
  const [image, setImage] = useState<string | null>(null);
  const [step, setStep] = useState("");

  useEffect(() => {
    const unlisten = events.authQr.listen((e) => {
      const ev = e.payload as QrAuthEvent;
      setStep(ev.step);
      if (ev.step === "ready") {
        void QRCode.toDataURL(ev.url, { margin: 2, width: 260 }).then(setImage);
      } else if (ev.step === "scanned") {
        setImage(null);
        setStep(`scanné par ${ev.user.username}, valide sur le téléphone`);
      } else if (ev.step === "completed") {
        onDone();
      } else if (ev.step === "failed") {
        setStep(`échec : ${ev.message}`);
      }
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [onDone]);

  const start = (): void => {
    setStep("démarrage…");
    void commands.authQrStart().then((r) => {
      if (r.status === "error") setStep(`erreur : ${JSON.stringify(r.error)}`);
    });
  };

  return { image, step, start };
}
