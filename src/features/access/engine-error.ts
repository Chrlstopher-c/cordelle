// Texte affiché pour une erreur moteur dans les écrans d'accès.
import type { EngineError } from "../../contract/bindings";

export function engineErrorText(err: EngineError): string {
  switch (err.kind) {
    case "network":
      return "Connexion impossible. Vérifie ta connexion internet.";
    case "rate_limited":
      return `Trop de requêtes, réessaie dans ${Math.ceil(err.retry_after_ms / 1000)} s.`;
    default:
      console.warn("[access] erreur moteur", err);
      return "Une erreur est survenue. Réessaie.";
  }
}
