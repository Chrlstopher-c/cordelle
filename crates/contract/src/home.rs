//! Accueil des serveurs : invitations, création, événements programmés, découverte publique.

use crate::Snowflake;

/// Aperçu d'une invitation, affiché avant d'accepter.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct InvitePreview {
    /// Code seul (sans le préfixe `discord.gg/`).
    pub code: String,
    pub guild_id: Snowflake,
    pub guild_name: String,
    pub icon_url: Option<String>,
    pub member_count: u32,
    pub online_count: u32,
    /// Salon visé par l'invitation, s'il y en a un.
    pub channel_name: Option<String>,
}

/// Événement programmé d'un serveur, à venir ou en cours.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ScheduledEvent {
    pub id: Snowflake,
    pub name: String,
    pub description: Option<String>,
    /// Début, ISO 8601.
    pub start: String,
    /// Fin, ISO 8601.
    pub end: Option<String>,
    /// Salon vocal ou scène qui héberge l'événement.
    pub channel_id: Option<Snowflake>,
    /// Lieu libre, pour un événement externe.
    pub location: Option<String>,
    /// Nombre de personnes intéressées.
    pub interested: u32,
    /// Vrai si l'événement a commencé.
    pub live: bool,
}

/// Serveur public listé dans l'exploration.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct DiscoverableGuild {
    pub id: Snowflake,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub member_count: u32,
    pub online_count: u32,
}
