//! Commandes du partage d'écran (Go Live) : signatures du contrat, corps dans `engine::stream`.

use contract::{AccountId, stream::StreamQuality, stream::StreamState};

use super::{Eng, Res};

#[tauri::command]
#[specta::specta]
pub fn stream_start(
    engine: Eng<'_>,
    account_id: AccountId,
    quality: StreamQuality,
) -> Res<StreamState> {
    engine.stream_start(&account_id, quality)
}

#[tauri::command]
#[specta::specta]
pub fn stream_stop(engine: Eng<'_>, account_id: AccountId) -> Res<StreamState> {
    engine.stream_stop(&account_id)
}
