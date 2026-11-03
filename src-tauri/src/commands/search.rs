//! Commandes recherche, épingles et fils. Corps dans `engine/search.rs`.

use super::{Eng, Res};
use contract::{
    AccountId, Snowflake,
    message::Message,
    search::{SearchPage, SearchQuery, ThreadSummary},
};

/// Recherche dans un serveur (`guild_id`) ou dans un salon / MP (`channel_id`).
#[tauri::command]
#[specta::specta]
pub async fn messages_search(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Option<Snowflake>,
    channel_id: Option<Snowflake>,
    query: SearchQuery,
) -> Res<SearchPage> {
    engine
        .messages_search(&account_id, guild_id.as_ref(), channel_id.as_ref(), &query)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn pins_list(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
) -> Res<Vec<Message>> {
    engine.pins_list(&account_id, &channel_id).await
}

/// Fils actifs (`archived` faux) ou archivés, les plus récemment actifs d'abord.
#[tauri::command]
#[specta::specta]
pub async fn threads_list(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    archived: bool,
) -> Res<Vec<ThreadSummary>> {
    engine
        .threads_list(&account_id, &channel_id, archived)
        .await
}

/// Crée un fil ; `content` renseigné = publication de forum.
#[tauri::command]
#[specta::specta]
pub async fn thread_create(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    name: String,
    content: Option<String>,
) -> Res<ThreadSummary> {
    engine
        .thread_create(&account_id, &channel_id, &name, content.as_deref())
        .await
}
