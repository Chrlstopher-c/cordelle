//! Administration d'un serveur : détail, rôles, membres, bannissements, invitations, emoji, AutoMod, journal, intégrations.
//! Les écritures renvoient `EngineError::Discord` (code 50013) quand la permission manque.

use crate::{Snowflake, user::User};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GuildDetail {
    pub id: Snowflake,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub banner_url: Option<String>,
    pub owner_id: Snowflake,
    pub member_count: Option<u32>,
    pub online_count: Option<u32>,
    /// Permissions de l'utilisateur sur le serveur (bits Discord en décimal, calculés depuis les rôles).
    pub permissions: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GuildEdit {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Role {
    pub id: Snowflake,
    pub name: String,
    pub color: u32,
    pub hoist: bool,
    pub mentionable: bool,
    pub position: i32,
    pub permissions: String,
    pub managed: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct RoleEdit {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hoist: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mentionable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MemberSummary {
    pub user: User,
    pub nick: Option<String>,
    pub roles: Vec<Snowflake>,
    pub joined_at: Option<String>,
    pub timed_out_until: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Ban {
    pub user: User,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Invite {
    pub code: String,
    pub inviter: Option<User>,
    pub channel_id: Snowflake,
    pub channel_name: Option<String>,
    pub uses: u32,
    /// 0 = illimité.
    pub max_uses: u32,
    pub created_at: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GuildEmoji {
    pub id: Snowflake,
    pub name: String,
    pub animated: bool,
    pub creator: Option<String>,
    pub image_url: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct AutomodRule {
    pub id: Snowflake,
    pub name: String,
    pub enabled: bool,
    /// Type de déclencheur Discord (1 mots-clés, 3 spam, 4 listes prédéfinies, 5 mentions massives).
    pub trigger_type: u32,
    pub keywords: Vec<String>,
    /// Types d'action Discord (1 bloquer, 2 alerter, 3 exclure temporairement).
    pub actions: Vec<u32>,
    pub exempt_roles: Vec<Snowflake>,
    pub exempt_channels: Vec<Snowflake>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Integration {
    pub id: Snowflake,
    pub name: String,
    pub kind: String,
    pub enabled: bool,
    pub account_name: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct AuditChange {
    pub key: String,
    pub old: Option<String>,
    pub new: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct AuditEntry {
    pub id: Snowflake,
    /// Code d'action Discord (ex. 22 = bannissement, 20 = expulsion), traduit côté interface.
    pub action_type: u32,
    pub actor: Option<User>,
    pub target_id: Option<Snowflake>,
    pub reason: Option<String>,
    pub changes: Vec<AuditChange>,
    /// Date de l'entrée, en millisecondes depuis l'epoch (déduite de l'identifiant).
    pub created_ms: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChannelDetail {
    pub id: Snowflake,
    pub guild_id: Option<Snowflake>,
    pub name: String,
    pub topic: Option<String>,
    pub nsfw: bool,
    /// Mode lent, en secondes (0 = désactivé).
    pub rate_limit_per_user: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChannelEdit {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nsfw: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_limit_per_user: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum NewChannelKind {
    Text,
    Voice,
}
