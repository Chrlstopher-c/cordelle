//! Contrat moteur ↔ interface : seuls ces types traversent la frontière Tauri.
//! Les identifiants Discord (snowflakes) sont des chaînes : ils dépassent Number.MAX_SAFE_INTEGER.

pub mod account;
pub mod auth;
pub mod events;
pub mod guild;
pub mod message;
pub mod profile;
pub mod server;
pub mod social;
pub mod user;

pub type Snowflake = String;
pub type AccountId = Snowflake;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EngineError {
    NotFound { what: String },
    Unauthorized,
    RateLimited { retry_after_ms: u32 },
    Network { message: String },
    Discord { code: i32, message: String },
    Internal { message: String },
    NotImplemented { command: String },
}
