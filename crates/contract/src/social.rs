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

/// Un membre affiché dans le panneau Membres.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MemberEntry {
    pub user: crate::user::User,
    pub nick: Option<String>,
    /// Couleur du rôle le plus haut qui en a une (0xRRGGBB).
    pub color: Option<u32>,
    pub status: crate::user::PresenceStatus,
    /// « Joue à X », statut personnalisé…
    pub activity: Option<String>,
}

/// Groupe du panneau (rôle affiché à part, « En ligne », « Hors ligne »).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MemberGroup {
    pub id: String,
    pub name: String,
    pub count: u32,
    pub members: Vec<MemberEntry>,
}
