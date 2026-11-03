// Interface de travail brute : sera remplacée par le design (instance dédiée). Seul src/contract/ est la frontière.
import { useCallback, useEffect, useState } from "react";
import { commands, type AccountSummary } from "../contract/bindings";
import { useGpuRenderer } from "./use-gpu-renderer";
import { useQrLogin } from "./use-qr-login";

export function App(): React.JSX.Element {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [status, setStatus] = useState("chargement…");

  const refresh = useCallback(() => {
    void commands.accountsList().then((res) => {
      if (res.status === "ok") {
        setAccounts(res.data);
        setStatus(`${res.data.length} compte(s)`);
      } else {
        setStatus(`moteur : ${res.error.kind}`);
      }
    });
  }, []);

  useEffect(refresh, [refresh]);
  const gpu = useGpuRenderer();
  const qr = useQrLogin(refresh);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, color: "#ddd", background: "#111", minHeight: "100vh" }}>
      <h1>Cordelle</h1>
      <p>{status}</p>
      <p data-testid="gpu">GPU : {gpu}</p>
      <ul>
        {accounts.map((a) => (
          <li key={a.id}>
            {a.user.global_name ?? a.user.username} {a.active ? "(actif)" : ""}
          </li>
        ))}
      </ul>
      <button onClick={qr.start}>Connexion QR</button>
      <p>{qr.step}</p>
      {qr.image && <img src={qr.image} alt="QR de connexion" />}
    </main>
  );
}
