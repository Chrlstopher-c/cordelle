//! Commandes vocales (CONTRACT.md, section Vocal). Les événements passent par `Engine`.

use contract::{AccountId, Snowflake, voice::AudioDevices};

use super::{Eng, Res};

/// Rejoint un salon vocal ; `guild_id` nul pour un appel MP.
#[tauri::command]
#[specta::specta]
pub async fn voice_join(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Option<Snowflake>,
    channel_id: Snowflake,
) -> Res<()> {
    engine.voice_join(&account_id, guild_id, channel_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn voice_leave(engine: Eng<'_>, account_id: AccountId) -> Res<()> {
    engine.voice_leave(&account_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn voice_set_mute(engine: Eng<'_>, account_id: AccountId, mute: bool) -> Res<()> {
    engine.voice_set_mute(&account_id, mute).await
}

#[tauri::command]
#[specta::specta]
pub async fn voice_set_deaf(engine: Eng<'_>, account_id: AccountId, deaf: bool) -> Res<()> {
    engine.voice_set_deaf(&account_id, deaf).await
}

#[tauri::command]
#[specta::specta]
pub async fn voice_devices(engine: Eng<'_>) -> Res<AudioDevices> {
    engine.voice_devices()
}

#[tauri::command]
#[specta::specta]
pub async fn voice_set_devices(
    engine: Eng<'_>,
    input_id: Option<Snowflake>,
    output_id: Option<Snowflake>,
) -> Res<()> {
    engine.voice_set_devices(input_id, output_id)
}
