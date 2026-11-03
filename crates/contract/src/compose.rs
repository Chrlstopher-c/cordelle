//! Composition : fichiers joints envoyés et emojis personnalisés d'un serveur.

use crate::Snowflake;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct OutgoingFile {
    pub filename: String,
    /// Contenu du fichier, encodé en base64 standard.
    pub bytes_b64: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GuildEmoji {
    pub id: Snowflake,
    pub name: String,
    pub animated: bool,
}
