//! Commandes de la zone compose : fichiers joints et emojis personnalisés du serveur.

use super::{Eng, Res};
use contract::{
    AccountId, Snowflake,
    compose::{GuildEmoji, OutgoingFile},
    message::Message,
};

/// Envoie un message avec des fichiers joints (contenu encodé en base64) ; la réponse est le message créé.
#[tauri::command]
#[specta::specta]
pub async fn message_send_files(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    content: String,
    reply_to: Option<Snowflake>,
    files: Vec<OutgoingFile>,
) -> Res<Message> {
    engine
        .send_files(
            &account_id,
            &channel_id,
            &content,
            reply_to.as_ref(),
            &files,
        )
        .await
}

/// Emojis personnalisés d'un serveur, pour le sélecteur et la saisie assistée.
#[tauri::command]
#[specta::specta]
pub async fn guild_emojis(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<GuildEmoji>> {
    engine.guild_emojis(&account_id, &guild_id).await
}
