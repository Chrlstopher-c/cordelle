//! Commandes de l'accueil : invitations, création de serveur, événements, découverte.

use super::{Eng, Res};
use contract::{
    AccountId, Snowflake,
    home::{DiscoverableGuild, InvitePreview, ScheduledEvent},
};

/// Aperçu d'une invitation (`code` sans préfixe `discord.gg/`).
#[tauri::command]
#[specta::specta]
pub async fn invite_resolve(
    engine: Eng<'_>,
    account_id: AccountId,
    code: String,
) -> Res<InvitePreview> {
    engine.invite_resolve(&account_id, &code).await
}

/// Rejoint un serveur par invitation ; renvoie son id.
#[tauri::command]
#[specta::specta]
pub async fn invite_accept(engine: Eng<'_>, account_id: AccountId, code: String) -> Res<Snowflake> {
    engine.invite_accept(&account_id, &code).await
}

/// Crée un serveur vide et renvoie son id.
#[tauri::command]
#[specta::specta]
pub async fn guild_create(engine: Eng<'_>, account_id: AccountId, name: String) -> Res<Snowflake> {
    engine.guild_create(&account_id, &name).await
}

/// Événements à venir ou en cours d'un serveur.
#[tauri::command]
#[specta::specta]
pub async fn scheduled_events(
    engine: Eng<'_>,
    account_id: AccountId,
    guild_id: Snowflake,
) -> Res<Vec<ScheduledEvent>> {
    engine.scheduled_events(&account_id, &guild_id).await
}

/// Serveurs publics ; `query` vide = tous, `offset` pour la page suivante.
#[tauri::command]
#[specta::specta]
pub async fn discoverable_guilds(
    engine: Eng<'_>,
    account_id: AccountId,
    query: String,
    offset: u32,
) -> Res<Vec<DiscoverableGuild>> {
    engine
        .discoverable_guilds(&account_id, &query, offset)
        .await
}
