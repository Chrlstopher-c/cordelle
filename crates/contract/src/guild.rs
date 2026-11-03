use crate::{Snowflake, user::User};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GuildSummary {
    pub id: Snowflake,
    pub name: String,
    pub icon_url: Option<String>,
    /// Position dans la barre latérale (dossiers compris), 0 = en haut.
    pub position: u32,
    pub folder_id: Option<String>,
    pub unread: bool,
    pub mention_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ChannelKind {
    Text,
    Voice,
    Category,
    Announcement,
    Stage,
    Forum,
    Media,
    Thread,
    Dm,
    GroupDm,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChannelSummary {
    pub id: Snowflake,
    pub guild_id: Option<Snowflake>,
    pub parent_id: Option<Snowflake>,
    pub kind: ChannelKind,
    pub name: String,
    pub topic: Option<String>,
    pub position: i32,
    pub nsfw: bool,
    pub unread: bool,
    pub mention_count: u32,
    /// Dernier message connu (pour marquer comme lu sans ouvrir le salon).
    pub last_message_id: Option<Snowflake>,
    /// Destinataires pour les MP et groupes, vide sinon.
    pub recipients: Vec<User>,
}
