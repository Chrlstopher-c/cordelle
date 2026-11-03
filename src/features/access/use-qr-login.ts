// Connexion par QR code : suit l'événement authQr et expose l'état affiché (prêt, scanné, expiré, échec).
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { commands, events, type QrAuthEvent, type User } from "../../contract/bindings";
import { engineErrorText } from "./engine-error";

export type QrView =
  | { kind: "loading" }
  | { kind: "ready"; image: string }
  | { kind: "scanned"; user: User }
  | { kind: "expired" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

export interface QrLoginState {
  view: QrView;
  restart: () => void;
}

type SetView = (v: QrView) => void;

const QR_WIDTH_PX = 156;

function viewFromEvent(ev: QrAuthEvent): QrView | null {
  switch (ev.step) {
    case "scanned":
      return { kind: "scanned", user: ev.user };
    case "expired":
      return { kind: "expired" };
    case "cancelled":
      return { kind: "cancelled" };
    case "failed":
      return { kind: "failed", message: ev.message };
    default:
      return null;
  }
}

function showReadyCode(url: string, setView: SetView): void {
  QRCode.toDataURL(url, { margin: 2, width: QR_WIDTH_PX })
    .then((image) => setView({ kind: "ready", image }))
    .catch((err: unknown) => {
      console.error("[access] génération du QR", err);
      setView({ kind: "failed", message: "Code illisible, réessaie." });
    });
}

function applyEvent(ev: QrAuthEvent, setView: SetView, done: (accountId: string) => void): void {
  if (ev.step === "ready") {
    showReadyCode(ev.url, setView);
    return;
  }
  if (ev.step === "completed") {
    done(ev.account_id);
    return;
  }
  const next = viewFromEvent(ev);
  if (next) setView(next);
}

function startQr(setView: SetView): void {
  setView({ kind: "loading" });
  void commands.authQrStart().then((r) => {
    if (r.status === "error") setView({ kind: "failed", message: engineErrorText(r.error) });
  });
}

export function useQrLogin(onDone: (accountId: string) => void): QrLoginState {
  const [view, setView] = useState<QrView>({ kind: "loading" });
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const unlisten = events.authQr.listen((e) => applyEvent(e.payload, setView, (id) => doneRef.current(id)));
    startQr(setView);
    return () => {
      void unlisten.then((f) => f());
      void commands.authQrCancel();
    };
  }, []);

  return { view, restart: () => startQr(setView) };
}
