use crate::{AccountId, user::User};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Ready,
    Resuming,
    Failed,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct AccountSummary {
    pub id: AccountId,
    pub user: User,
    pub active: bool,
    pub connection: ConnectionState,
}
