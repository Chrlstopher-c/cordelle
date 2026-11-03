//! Réglages du compte : appareils connectés, comptes liés, abonnements.

/// Session ouverte sur un appareil (`GET /auth/sessions`).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct DeviceSession {
    /// Empreinte de la session ; sert à la déconnecter.
    pub id_hash: String,
    pub client: String,
    pub os: String,
    /// Lieu approximatif, si Discord le fournit.
    pub location: Option<String>,
    /// Dernière activité, ISO 8601.
    pub last_active: Option<String>,
}

/// Compte externe lié au profil (Twitch, GitHub…).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct LinkedService {
    /// Type du service, ex. `github` : fait partie de l'URL de retrait.
    pub kind: String,
    pub id: String,
    pub name: String,
    pub verified: bool,
    pub visible: bool,
}

/// Abonnement Discord (lecture seule).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Subscription {
    pub id: String,
    pub status: String,
    /// Fin de la période en cours, ISO 8601.
    pub period_end: Option<String>,
    /// Résiliation demandée (la période se termine sans renouvellement).
    pub canceled: bool,
}
