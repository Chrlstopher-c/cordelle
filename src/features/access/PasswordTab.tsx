// Onglet mot de passe : formulaire, puis double authentification si le moteur la demande.
import { MfaScreen } from "./MfaScreen";
import { PasswordForm } from "./PasswordForm";
import { usePasswordLogin } from "./use-password-login";

export function PasswordTab({ onDone }: { onDone: (accountId: string) => void }): React.JSX.Element {
  const pw = usePasswordLogin(onDone);
  if (pw.step.kind !== "mfa") return <PasswordForm pw={pw} />;
  const { ticket, methods } = pw.step;
  return (
    <MfaScreen methods={methods} error={pw.error} busy={pw.busy}
      onSubmit={(method, code) => pw.submitMfa(ticket, method, code)} onBack={pw.back} />
  );
}
