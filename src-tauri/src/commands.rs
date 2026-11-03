//! Commandes exposées à l'interface. Signatures = contrat (CONTRACT.md) ; corps branchés crate par crate.

use tauri_specta::Event as _;

use crate::engine::Engine as Core;
use contract::{
    AccountId, EngineError, Snowflake,
    account::AccountSummary,
    auth::{LoginOutcome, MfaMethod, PasswordLogin, QrAuthEvent},
    events::EngineEvent,
    guild::{ChannelSummary, GuildSummary},
    message::{Message, MessagePage, OutgoingMessage},
};

type Res<T> = Result<T, EngineError>;
type Eng<'a> = tauri::State<'a, &'static Core>;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, tauri_specta::Event)]
pub struct Engine(pub EngineEvent);

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, tauri_specta::Event)]
pub struct AuthQr(pub QrAuthEvent);

#[tauri::command]
#[specta::specta]
pub async fn accounts_list(engine: Eng<'_>) -> Res<Vec<AccountSummary>> {
    Ok(engine.account_summaries())
}

#[tauri::command]
#[specta::specta]
pub async fn account_switch(engine: Eng<'_>, account_id: AccountId) -> Res<()> {
    Ok(engine.accounts().set_active(&account_id)?)
}

#[tauri::command]
#[specta::specta]
pub async fn account_remove(engine: Eng<'_>, account_id: AccountId) -> Res<()> {
    engine.disconnect(&account_id);
    Ok(engine.accounts().remove(&account_id)?)
}

/// Démarre une connexion QR ; la progression arrive par l'événement `AuthQr`.
#[tauri::command]
#[specta::specta]
pub async fn auth_qr_start(app: tauri::AppHandle, engine: Eng<'_>) -> Res<()> {
    let engine: &'static Core = *engine;
    engine
        .start_qr(move |event| {
            if let Err(e) = AuthQr(event).emit(&app) {
                tracing::error!("émission auth-qr impossible : {e}");
            }
        })
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn auth_qr_cancel(engine: Eng<'_>) -> Res<()> {
    engine.cancel_qr().await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn auth_password(engine: Eng<'_>, login: PasswordLogin) -> Res<LoginOutcome> {
    (*engine).login_password(&login).await
}

#[tauri::command]
#[specta::specta]
pub async fn auth_mfa(
    engine: Eng<'_>,
    ticket: String,
    method: MfaMethod,
    code: String,
) -> Res<LoginOutcome> {
    (*engine).login_mfa(&ticket, method, &code).await
}

#[tauri::command]
#[specta::specta]
pub async fn guilds_list(engine: Eng<'_>, account_id: AccountId) -> Res<Vec<GuildSummary>> {
    engine.guilds(&account_id)
}

#[tauri::command]
#[specta::specta]
pub async fn channels_list(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<ChannelSummary>> {
    engine.channels(&account_id, &guild_id)
}

#[tauri::command]
#[specta::specta]
pub async fn dms_list(engine: Eng<'_>, account_id: AccountId) -> Res<Vec<ChannelSummary>> {
    engine.dms(&account_id)
}

/// Page de messages, du plus récent au plus ancien ; `before` = id du plus ancien déjà affiché.
#[tauri::command]
#[specta::specta]
pub async fn messages_get(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    before: Option<Snowflake>,
    limit: u8,
) -> Res<MessagePage> {
    engine
        .messages(&account_id, &channel_id, before, limit)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn message_send(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    message: OutgoingMessage,
) -> Res<Message> {
    engine.send(&account_id, &channel_id, &message).await
}
