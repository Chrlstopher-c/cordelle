//! Commandes d'administration d'un serveur (réglages, rôles, membres, bans, invitations, emoji, AutoMod, journal).

use super::{Eng, Res};
use contract::{
    AccountId, Snowflake,
    server::{
        AuditEntry, AutomodRule, Ban, ChannelDetail, ChannelEdit, GuildDetail, GuildEdit,
        Integration, Invite, MemberSummary, NewChannelKind, Role, RoleEdit, ServerEmoji,
    },
};

#[tauri::command]
#[specta::specta]
pub async fn guild_info(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<GuildDetail> {
    engine.guild_info(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn guild_update(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    edit: GuildEdit,
) -> Res<()> {
    engine.guild_update(&account_id, &guild_id, &edit).await
}

#[tauri::command]
#[specta::specta]
pub async fn roles_list(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<Role>> {
    engine.roles_list(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn role_create(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    name: String,
) -> Res<Role> {
    engine.role_create(&account_id, &guild_id, &name).await
}

#[tauri::command]
#[specta::specta]
pub async fn role_update(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    role_id: Snowflake,
    edit: RoleEdit,
) -> Res<()> {
    engine
        .role_update(&account_id, &guild_id, &role_id, &edit)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn role_delete(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    role_id: Snowflake,
) -> Res<()> {
    engine.role_delete(&account_id, &guild_id, &role_id).await
}

/// Rôles du plus haut au plus bas ; l'ordre devient les positions.
#[tauri::command]
#[specta::specta]
pub async fn role_reorder(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    order: Vec<Snowflake>,
) -> Res<()> {
    engine.role_reorder(&account_id, &guild_id, &order).await
}

#[tauri::command]
#[specta::specta]
pub async fn guild_members_search(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    query: String,
    limit: u16,
) -> Res<Vec<MemberSummary>> {
    engine
        .members_search(&account_id, &guild_id, &query, limit)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn member_kick(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    user_id: Snowflake,
) -> Res<()> {
    engine.member_kick(&account_id, &guild_id, &user_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn member_ban(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    user_id: Snowflake,
    delete_days: u8,
) -> Res<()> {
    engine
        .member_ban(&account_id, &guild_id, &user_id, delete_days)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn bans_list(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<Ban>> {
    engine.bans_list(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn ban_remove(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    user_id: Snowflake,
) -> Res<()> {
    engine.ban_remove(&account_id, &guild_id, &user_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn invites_list(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<Invite>> {
    engine.invites_list(&account_id, &guild_id).await
}

/// `max_age` en secondes (0 = jamais), `max_uses` 0 = illimité.
#[tauri::command]
#[specta::specta]
pub async fn invite_create(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    max_age: u32,
    max_uses: u32,
) -> Res<Invite> {
    engine
        .invite_create(&account_id, &channel_id, max_age, max_uses)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn invite_delete(engine: Eng<'_>, account_id: AccountId, code: String) -> Res<()> {
    engine.invite_delete(&account_id, &code).await
}

/// Supprime l'emoji `remove` si fourni, puis renvoie la liste à jour.
#[tauri::command]
#[specta::specta]
pub async fn guild_emojis_manage(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    remove: Option<Snowflake>,
) -> Res<Vec<ServerEmoji>> {
    engine
        .emojis_manage(&account_id, &guild_id, remove.as_ref())
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn audit_log(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<AuditEntry>> {
    engine.audit_log(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn automod_rules(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<AutomodRule>> {
    engine.automod_rules(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn integrations_list(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<Integration>> {
    engine.integrations_list(&account_id, &guild_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn channel_info(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
) -> Res<ChannelDetail> {
    engine.channel_info(&account_id, &channel_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn channel_update(
    engine: Eng<'_>,
    account_id: AccountId,
    channel_id: Snowflake,
    edit: ChannelEdit,
) -> Res<()> {
    engine.channel_update(&account_id, &channel_id, &edit).await
}

#[tauri::command]
#[specta::specta]
pub async fn channel_create(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
    name: String,
    kind: NewChannelKind,
) -> Res<()> {
    engine
        .channel_create(&account_id, &guild_id, &name, kind)
        .await
}
