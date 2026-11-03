//! Client HTTP interne au domaine : en-têtes de `identity`, erreurs réseau journalisées, réponses JSON tolérantes.

use std::time::Duration;

use identity::ClientIdentity;
use reqwest::{Client, RequestBuilder, StatusCode};
use serde::Serialize;
use serde_json::Value;

use crate::AuthError;

const TIMEOUT: Duration = Duration::from_secs(20);

pub(crate) type Headers = Vec<(&'static str, String)>;

pub(crate) struct Reply {
    pub(crate) status: StatusCode,
    pub(crate) body: Value,
}

pub(crate) struct Api {
    client: Client,
    base: String,
    headers: Headers,
}

impl Api {
    pub(crate) fn new(identity: &ClientIdentity, base: &str) -> Result<Self, AuthError> {
        let client = Client::builder()
            .timeout(TIMEOUT)
            .build()
            .map_err(|err| network_error(&err))?;
        Ok(Self {
            client,
            base: base.trim_end_matches('/').to_owned(),
            headers: identity.http_headers(),
        })
    }

    pub(crate) async fn get(&self, route: &str, extra: &Headers) -> Result<Reply, AuthError> {
        self.exchange(self.client.get(self.url(route)), extra).await
    }

    pub(crate) async fn post<B: Serialize + ?Sized>(
        &self,
        route: &str,
        body: &B,
        extra: &Headers,
    ) -> Result<Reply, AuthError> {
        self.exchange(self.client.post(self.url(route)).json(body), extra)
            .await
    }

    fn url(&self, route: &str) -> String {
        format!("{}{route}", self.base)
    }

    async fn exchange(&self, request: RequestBuilder, extra: &Headers) -> Result<Reply, AuthError> {
        let request = self
            .headers
            .iter()
            .chain(extra)
            .fold(request, |req, (name, value)| {
                req.header(*name, value.as_str())
            });
        let response = request.send().await.map_err(|err| network_error(&err))?;
        let status = response.status();
        let text = response.text().await.map_err(|err| network_error(&err))?;
        let body = serde_json::from_str(&text).unwrap_or_else(|err| {
            tracing::warn!(error = %err, status = %status, "réponse Discord non JSON");
            Value::Null
        });
        Ok(Reply { status, body })
    }
}

pub(crate) fn network_error(err: &reqwest::Error) -> AuthError {
    tracing::error!(error = %err, "requête Discord échouée");
    AuthError::Network(err.to_string())
}

/// Traduit une réponse d'erreur de Discord. Le corps n'est pas journalisé (il peut contenir des tickets).
pub(crate) fn api_error(reply: &Reply) -> AuthError {
    let body = &reply.body;
    if reply.status == StatusCode::TOO_MANY_REQUESTS {
        let seconds = body["retry_after"].as_f64().unwrap_or(1.0);
        return AuthError::RateLimited {
            retry_after_ms: (seconds * 1000.0) as u32,
        };
    }
    let code = body["code"]
        .as_i64()
        .and_then(|c| i32::try_from(c).ok())
        .unwrap_or(0);
    let message = body["message"]
        .as_str()
        .map_or_else(|| reply.status.to_string(), str::to_owned);
    tracing::error!(status = %reply.status, code, "erreur API Discord");
    AuthError::Discord { code, message }
}
