//! Commandes exposées à l'interface. Signatures = contrat (CONTRACT.md) ; corps branchés crate par crate.

pub mod compose;
pub mod home;
pub mod settings;
pub use compose::*;
pub mod search;
pub mod voice;

use tauri_specta::Event as _;

use crate::engine::Engine as Core;
use contract::{
    AccountId, EngineError, Snowflake,
    account::AccountSummary,
    auth::{LoginOutcome, MfaMethod, PasswordLogin, QrAuthEvent},
    events::EngineEvent,
    guild::{ChannelSummary, GuildSummary},
    message::{Message, MessagePage, OutgoingMessage},
    profile::UserProfile,
};

pub mod server;

pub(crate) type Res<T> = Result<T, EngineError>;
pub(crate) type Eng<'a> = tauri::State<'a, &'static Core>;

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

/// Profil complet : bannière, bio, badges, connexions, serveurs et amis en commun, note.
#[tauri::command]
#[specta::specta]
pub async fn user_profile(
    engine: Eng<'_>,
    account_id: AccountId,
    user_id: Snowflake,
    guild_id: Option<Snowflake>,
) -> Res<UserProfile> {
    engine.profile(&account_id, &user_id, guild_id).await
}

/// Ouvre (ou retrouve) le MP avec un utilisateur.
#[tauri::command]
#[specta::specta]
pub async fn dm_open(
    engine: Eng<'_>,
    account_id: AccountId,
    user_id: Snowflake,
) -> Res<ChannelSummary> {
    engine.open_dm(&account_id, &user_id).await
}

/// Note personnelle sur un utilisateur (visible par soi seul).
#[tauri::command]
#[specta::specta]
pub async fn note_set(
    engine: Eng<'_>,
    account_id: AccountId,
    user_id: Snowflake,
    note: String,
) -> Res<()> {
    engine.set_note(&account_id, &user_id, &note).await
}

#[tauri::command]
#[specta::specta]
pub async fn message_edit(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    message_id: Snowflake,
    content: String,
) -> Res<()> {
    engine
        .edit(&account_id, &channel_id, &message_id, &content)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn message_delete(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    message_id: Snowflake,
) -> Res<()> {
    engine.delete(&account_id, &channel_id, &message_id).await
}

/// Ajoute (`add`) ou retire sa réaction. `emoji` : caractère unicode, ou `nom:id` pour un emoji personnalisé.
#[tauri::command]
#[specta::specta]
pub async fn reaction_set(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    message_id: Snowflake,
    emoji: String,
    add: bool,
) -> Res<()> {
    engine
        .react(&account_id, &channel_id, &message_id, &emoji, add)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn relationships_list(
    engine: Eng<'_>,
    account_id: AccountId,
) -> Res<Vec<contract::social::Relationship>> {
    engine.relationships(&account_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn relationship_set(
    engine: Eng<'_>,
    account_id: AccountId,
    user_id: Snowflake,
    action: contract::social::RelationshipAction,
) -> Res<()> {
    engine.relationship_set(&account_id, &user_id, action).await
}

#[tauri::command]
#[specta::specta]
pub async fn friend_request(engine: Eng<'_>, account_id: AccountId, username: String) -> Res<()> {
    engine.friend_request(&account_id, &username).await
}

#[tauri::command]
#[specta::specta]
pub async fn mentions_recent(
    engine: Eng<'_>,
    account_id: AccountId,
) -> Res<Vec<contract::social::Mention>> {
    engine.mentions(&account_id).await
}

/// Abonne au panneau Membres d'un salon ; la liste arrive par l'événement `member_list`.
#[tauri::command]
#[specta::specta]
pub async fn members_subscribe(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    channel_id: Snowflake,
) -> Res<()> {
    engine
        .subscribe_members(&account_id, &guild_id, &channel_id)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn status_set(
    engine: Eng<'_>,
    account_id: AccountId,
    status: contract::user::PresenceStatus,
) -> Res<()> {
    engine.set_status(&account_id, status).await
}

#[tauri::command]
#[specta::specta]
pub async fn profile_update(
    engine: Eng<'_>,
    account_id: AccountId,
    edit: contract::profile::ProfileEdit,
) -> Res<()> {
    engine.update_profile(&account_id, &edit).await
}

/// Statuts connus (amis et présences reçues), par id d'utilisateur.
#[tauri::command]
#[specta::specta]
pub async fn presences_get(
    engine: Eng<'_>,
    account_id: AccountId,
) -> Res<std::collections::HashMap<String, contract::user::PresenceStatus>> {
    engine.presences(&account_id)
}

#[tauri::command]
#[specta::specta]
pub async fn channel_ack(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    message_id: Snowflake,
) -> Res<()> {
    engine
        .ack_channel(&account_id, &channel_id, &message_id)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn guild_ack(engine: Eng<'_>, account_id: AccountId, guild_id: Snowflake) -> Res<()> {
    engine.ack_guild(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn message_pin(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    message_id: Snowflake,
    pinned: bool,
) -> Res<()> {
    engine
        .pin(&account_id, &channel_id, &message_id, pinned)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn guild_leave(engine: Eng<'_>, account_id: AccountId, guild_id: Snowflake) -> Res<()> {
    engine.leave_guild(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn dm_close(engine: Eng<'_>, account_id: AccountId, channel_id: Snowflake) -> Res<()> {
    engine.close_dm(&account_id, &channel_id).await
}
