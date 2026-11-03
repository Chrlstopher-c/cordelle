use crate::{Snowflake, message::Message, user::User};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum RelationshipKind {
    Friend,
    Blocked,
    Incoming,
    Outgoing,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Relationship {
    pub user: User,
    pub kind: RelationshipKind,
    pub nickname: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum RelationshipAction {
    /// Accepter une demande reçue.
    Accept,
    /// Retirer un ami, refuser ou annuler une demande, débloquer.
    Remove,
    Block,
}

/// Mention récente (onglet Activité), avec où elle a eu lieu.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct Mention {
    pub message: Message,
    pub guild_id: Option<Snowflake>,
}
