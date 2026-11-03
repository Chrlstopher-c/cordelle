use crate::{Snowflake, user::User};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Attachment {
    pub id: Snowflake,
    pub filename: String,
    pub url: String,
    pub content_type: Option<String>,
    pub size: u32,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Reaction {
    /// Emoji unicode, ou `nom:id` pour un emoji personnalisé.
    pub emoji: String,
    pub count: u32,
    pub me: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Message {
    pub id: Snowflake,
    pub channel_id: Snowflake,
    pub author: User,
    /// Markdown Discord brut ; le rendu est fait côté interface.
    pub content: String,
    /// Horodatage ISO 8601.
    pub timestamp: String,
    pub edited_timestamp: Option<String>,
    pub reply_to: Option<Snowflake>,
    pub attachments: Vec<Attachment>,
    pub reactions: Vec<Reaction>,
    /// Embeds bruts (JSON Discord) tant que leur rendu n'est pas typé.
    pub embeds_json: Option<String>,
    pub pinned: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MessagePage {
    pub messages: Vec<Message>,
    /// Vrai si des messages plus anciens existent.
    pub has_more: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct OutgoingMessage {
    pub content: String,
    pub reply_to: Option<Snowflake>,
    /// Identifiant local pour réconcilier le message optimiste avec la réponse serveur.
    pub nonce: String,
}
