//! Endpoints REST utilisés par Cordelle.

use reqwest::Method;

use crate::client::{RestClient, decode};
use crate::error::RestError;
use crate::models::{ApiMessage, ApiUser, FingerprintResponse, MessageReference, SendMessageBody};

impl RestClient {
    /// Profil du compte connecté (`GET /users/@me`).
    pub async fn me(&self) -> Result<ApiUser, RestError> {
        self.get_json("/users/@me").await
    }

    /// Page d'historique, du plus récent au plus ancien (`GET /channels/{id}/messages`).
    pub async fn messages(
        &self,
        channel_id: &str,
        before: Option<&str>,
        limit: u8,
    ) -> Result<Vec<ApiMessage>, RestError> {
        let limit = limit.clamp(1, 100).to_string();
        let mut query = vec![("limit", limit.as_str())];
        if let Some(before) = before {
            query.push(("before", before));
        }
        let path = format!("/channels/{channel_id}/messages");
        let bytes = self.request(Method::GET, &path, &query, None).await?;
        decode(&bytes)
    }

    /// Envoi d'un message (`POST /channels/{id}/messages`), `nonce` sert à l'affichage optimiste.
    pub async fn send_message(
        &self,
        channel_id: &str,
        content: &str,
        nonce: &str,
        reply_to: Option<&str>,
    ) -> Result<ApiMessage, RestError> {
        let body = SendMessageBody {
            content,
            nonce,
            tts: false,
            flags: 0,
            message_reference: reply_to.map(|message_id| MessageReference { message_id }),
        };
        self.post_json(&format!("/channels/{channel_id}/messages"), &body)
            .await
    }

    /// Empreinte du client web (`GET /experiments`, champ `fingerprint`).
    pub async fn fingerprint(&self) -> Result<String, RestError> {
        let response: FingerprintResponse = self.get_json("/experiments").await?;
        Ok(response.fingerprint)
    }
}
