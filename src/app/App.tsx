// Racine : relie le moteur, puis montre l'accès (aucun compte) ou la fenêtre principale.
import { useEffect } from "react";
import { AccessScreen } from "../features/access";
import { useApplySettings } from "../features/settings/use-apply-settings";
import { useVoiceBridge } from "../features/voice";
import { Shell } from "../features/shell/Shell";
import { useEngine } from "../shared/data/engine-store";
import { useEngineBridge } from "../shared/data/use-engine-bridge";
import "./styles/tokens.css";
import "./styles/base.css";

export function App(): React.JSX.Element | null {
  const loaded = useEngine((s) => s.accountsLoaded);
  const hasAccount = useEngine((s) => s.accounts.length > 0);
  const refreshAccounts = useEngine((s) => s.refreshAccounts);

  useEffect(() => {
    void refreshAccounts();
  }, [refreshAccounts]);
  useEngineBridge();
  useVoiceBridge();
  useApplySettings();

  if (!loaded) return null;
  return hasAccount ? <Shell /> : <AccessScreen />;
}
