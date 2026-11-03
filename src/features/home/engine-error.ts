// Message lisible pour une erreur du moteur : le texte de Discord n'est montré que s'il existe.
import type { EngineError } from "../../contract/bindings";

export function errorText(error: EngineError): string {
  switch (error.kind) {
    case "discord": return error.message;
    case "network": return "Connexion impossible. Vérifie ta connexion.";
    case "rate_limited": return "Trop de demandes. Réessaie dans un instant.";
    case "unauthorized": return "Session expirée : reconnecte ce compte.";
    case "not_found": return "Introuvable.";
    default: return "Action impossible.";
  }
}
