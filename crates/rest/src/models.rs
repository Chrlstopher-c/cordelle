//! Formes JSON de l'API Discord, telles que reçues ou envoyées (sans traduction vers le contrat).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct ApiUser {
    pub id: String,
    pub username: String,
    pub global_name: Option<String>,
    pub avatar: Option<String>,
    #[serde(default)]
    pub discriminator: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApiMessage {
    pub id: String,
    pub channel_id: String,
    pub content: String,
    pub timestamp: String,
    pub edited_timestamp: Option<String>,
    pub author: ApiUser,
    pub nonce: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FingerprintResponse {
    pub fingerprint: String,
}

#[derive(Debug, Serialize)]
pub struct MessageReference<'a> {
    pub message_id: &'a str,
}

#[derive(Debug, Serialize)]
pub struct SendMessageBody<'a> {
    pub content: &'a str,
    pub nonce: &'a str,
    pub tts: bool,
    pub flags: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_reference: Option<MessageReference<'a>>,
}

/// Corps d'une réponse 429 : `retry_after` en secondes flottantes, `global` pour une pause de tout le compte.
#[derive(Debug, Deserialize)]
pub struct RateLimitBody {
    pub retry_after: f64,
    #[serde(default)]
    pub global: bool,
}

/// Corps d'une erreur Discord : `{"code": …, "message": …}`.
#[derive(Debug, Deserialize)]
pub struct ApiErrorBody {
    #[serde(default)]
    pub code: i32,
    #[serde(default)]
    pub message: String,
}
