//! Réglages du compte : appareils, comptes liés, abonnements (lecture seule côté facturation).

use super::{Eng, Res};
use contract::{
    AccountId,
    settings::{DeviceSession, LinkedService, Subscription},
};

#[tauri::command]
#[specta::specta]
pub async fn sessions_list(engine: Eng<'_>, account_id: AccountId) -> Res<Vec<DeviceSession>> {
    engine.device_sessions(&account_id).await
}

/// Déconnecte les sessions données (empreintes issues de `sessions_list`).
#[tauri::command]
#[specta::specta]
pub async fn sessions_logout(
    engine: Eng<'_>,
    account_id: AccountId,
    session_id_hashes: Vec<String>,
) -> Res<()> {
    engine.device_logout(&account_id, &session_id_hashes).await
}

#[tauri::command]
#[specta::specta]
pub async fn connections_list(engine: Eng<'_>, account_id: AccountId) -> Res<Vec<LinkedService>> {
    engine.linked_services(&account_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn connection_remove(
    engine: Eng<'_>,
    account_id: AccountId,
    kind: String,
    id: String,
) -> Res<()> {
    engine.linked_service_remove(&account_id, &kind, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn subscriptions_list(engine: Eng<'_>, account_id: AccountId) -> Res<Vec<Subscription>> {
    engine.subscriptions(&account_id).await
}
