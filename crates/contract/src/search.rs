//! Recherche, messages épinglés, fils et publications de forum.

use crate::{Snowflake, message::Message};

/// Filtre `has:` de la recherche de messages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum SearchHas {
    Link,
    Embed,
    File,
    Video,
    Image,
    Sound,
    Sticker,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct SearchQuery {
    /// Texte recherché ; vide pour ne filtrer que par `has` ou par auteur.
    pub content: String,
    pub author_id: Option<Snowflake>,
    pub has: Vec<SearchHas>,
    /// Décalage en messages, pour la pagination (25 résultats par page côté Discord).
    pub offset: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct SearchPage {
    pub total: u32,
    /// Un message par résultat (le message trouvé, sans son contexte).
    pub messages: Vec<Message>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ThreadSummary {
    /// Un fil est un salon : son id s'ouvre comme un salon.
    pub id: Snowflake,
    pub name: String,
    pub message_count: u32,
    pub member_count: u32,
    pub last_message_id: Option<Snowflake>,
    pub archived: bool,
    pub owner_id: Option<Snowflake>,
}
