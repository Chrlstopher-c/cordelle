use crate::{Snowflake, user::User};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Badge {
    pub id: String,
    pub description: String,
    pub icon_url: String,
    pub link: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ConnectedAccount {
    /// Type Discord : github, steam, twitch, spotify…
    pub kind: String,
    pub name: String,
    pub verified: bool,
    pub url: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MutualGuild {
    pub id: Snowflake,
    pub name: String,
    pub icon_url: Option<String>,
    pub nick: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct UserProfile {
    pub user: User,
    pub banner_url: Option<String>,
    /// Couleur d'accent (0xRRGGBB) quand il n'y a pas de bannière.
    pub accent_color: Option<u32>,
    /// Couleurs du thème de profil (Nitro), haut puis bas.
    pub theme_colors: Option<Vec<u32>>,
    pub avatar_decoration_url: Option<String>,
    pub bio: Option<String>,
    pub pronouns: Option<String>,
    pub badges: Vec<Badge>,
    pub connected_accounts: Vec<ConnectedAccount>,
    /// Création du compte en millisecondes depuis l'époque Unix (déduite de l'id).
    pub created_at_ms: f64,
    /// Arrivée sur le serveur demandé, si `guild_id` fourni.
    pub joined_guild_at: Option<String>,
    pub guild_nick: Option<String>,
    pub mutual_guilds: Vec<MutualGuild>,
    pub mutual_friends: Vec<User>,
    pub note: Option<String>,
}

/// Modification de son propre profil ; `None` = champ inchangé.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ProfileEdit {
    pub global_name: Option<String>,
    pub bio: Option<String>,
    pub pronouns: Option<String>,
}
