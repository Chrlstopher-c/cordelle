//! Commandes exposées à l'interface. Signatures = contrat (CONTRACT.md) ; corps branchés crate par crate.

use contract::{
    AccountId, EngineError, Snowflake,
    account::AccountSummary,
    auth::{LoginOutcome, MfaMethod, PasswordLogin, QrAuthEvent},
    events::EngineEvent,
    guild::{ChannelSummary, GuildSummary},
    message::{Message, MessagePage, OutgoingMessage},
};

type Res<T> = Result<T, EngineError>;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, tauri_specta::Event)]
pub struct Engine(pub EngineEvent);

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, tauri_specta::Event)]
pub struct AuthQr(pub QrAuthEvent);

fn todo<T>(command: &str) -> Res<T> {
    tracing::warn!(command, "commande appelée mais pas encore implémentée");
    Err(EngineError::NotImplemented {
        command: command.into(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn accounts_list() -> Res<Vec<AccountSummary>> {
    todo("accounts_list")
}

#[tauri::command]
#[specta::specta]
pub async fn account_switch(account_id: AccountId) -> Res<()> {
    let _ = account_id;
    todo("account_switch")
}

#[tauri::command]
#[specta::specta]
pub async fn account_remove(account_id: AccountId) -> Res<()> {
    let _ = account_id;
    todo("account_remove")
}

/// Démarre une connexion QR ; la progression arrive par l'événement `AuthQr`.
#[tauri::command]
#[specta::specta]
pub async fn auth_qr_start() -> Res<()> {
    todo("auth_qr_start")
}

#[tauri::command]
#[specta::specta]
pub async fn auth_qr_cancel() -> Res<()> {
    todo("auth_qr_cancel")
}

#[tauri::command]
#[specta::specta]
pub async fn auth_password(login: PasswordLogin) -> Res<LoginOutcome> {
    let _ = login;
    todo("auth_password")
}

#[tauri::command]
#[specta::specta]
pub async fn auth_mfa(ticket: String, method: MfaMethod, code: String) -> Res<LoginOutcome> {
    let _ = (ticket, method, code);
    todo("auth_mfa")
}

#[tauri::command]
#[specta::specta]
pub async fn guilds_list(account_id: AccountId) -> Res<Vec<GuildSummary>> {
    let _ = account_id;
    todo("guilds_list")
}

#[tauri::command]
#[specta::specta]
pub async fn channels_list(account_id: AccountId, guild_id: Snowflake) -> Res<Vec<ChannelSummary>> {
    let _ = (account_id, guild_id);
    todo("channels_list")
}

#[tauri::command]
#[specta::specta]
pub async fn dms_list(account_id: AccountId) -> Res<Vec<ChannelSummary>> {
    let _ = account_id;
    todo("dms_list")
}

/// Page de messages, du plus récent au plus ancien ; `before` = id du plus ancien déjà affiché.
#[tauri::command]
#[specta::specta]
pub async fn messages_get(
    account_id: AccountId,
    channel_id: Snowflake,
    before: Option<Snowflake>,
    limit: u8,
) -> Res<MessagePage> {
    let _ = (account_id, channel_id, before, limit);
    todo("messages_get")
}

#[tauri::command]
#[specta::specta]
pub async fn message_send(
    account_id: AccountId,
    channel_id: Snowflake,
    message: OutgoingMessage,
) -> Res<Message> {
    let _ = (account_id, channel_id, message);
    todo("message_send")
}
