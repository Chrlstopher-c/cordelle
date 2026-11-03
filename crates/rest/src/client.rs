//! Client REST : chaque requête porte les en-têtes du client web, le jeton s'il existe,
//! et passe par les limites de débit ; un 429 est relancé une fois.

use std::time::Duration;

use identity::ClientIdentity;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::{Method, StatusCode};
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::error::{RestError, classify, network_error};
use crate::models::RateLimitBody;
use crate::ratelimit::{RateLimits, bounded_wait};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const DEFAULT_RETRY: Duration = Duration::from_secs(1);

pub struct RestClient {
    http: reqwest::Client,
    base_url: String,
    identity: ClientIdentity,
    token: Option<String>,
    limits: RateLimits,
}

impl RestClient {
    /// `base_url` = `identity::API_BASE` en production, un serveur local en test.
    pub fn new(identity: ClientIdentity, base_url: String) -> Result<Self, RestError> {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|err| RestError::Network(format!("initialisation HTTP : {err}")))?;
        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_owned(),
            identity,
            token: None,
            limits: RateLimits::default(),
        })
    }

    /// Même client HTTP et identité, avec son jeton et ses propres limites de débit (un jeton = un compte).
    pub fn with_token(&self, token: impl Into<String>) -> Self {
        Self {
            http: self.http.clone(),
            base_url: self.base_url.clone(),
            identity: self.identity.clone(),
            token: Some(token.into()),
            limits: RateLimits::default(),
        }
    }

    pub async fn get_json<T: DeserializeOwned>(&self, path: &str) -> Result<T, RestError> {
        let bytes = self.request(Method::GET, path, &[], None).await?;
        decode(&bytes)
    }

    pub async fn post_json<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, RestError> {
        let bytes = self
            .request(Method::POST, path, &[], Some(encode(body)?))
            .await?;
        decode(&bytes)
    }

    pub async fn patch_json<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, RestError> {
        let bytes = self
            .request(Method::PATCH, path, &[], Some(encode(body)?))
            .await?;
        decode(&bytes)
    }

    pub async fn delete(&self, path: &str) -> Result<(), RestError> {
        self.request(Method::DELETE, path, &[], None)
            .await
            .map(|_| ())
    }

    /// Une requête, relancée une seule fois si Discord répond 429.
    pub(crate) async fn request(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, &str)],
        body: Option<Vec<u8>>,
    ) -> Result<Vec<u8>, RestError> {
        match self.attempt(&method, path, query, body.as_deref()).await {
            Err(RestError::RateLimited { .. }) => {
                self.attempt(&method, path, query, body.as_deref()).await
            }
            result => result,
        }
    }

    async fn attempt(
        &self,
        method: &Method,
        path: &str,
        query: &[(&str, &str)],
        body: Option<&[u8]>,
    ) -> Result<Vec<u8>, RestError> {
        let route = format!("{method} {path}");
        self.limits.wait_before(&route).await;
        let response = self
            .build_request(method, path, query, body)
            .send()
            .await
            .map_err(network_error)?;
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response.bytes().await.map_err(network_error)?.to_vec();
        self.limits.observe(&route, &headers).await;
        if status == StatusCode::TOO_MANY_REQUESTS {
            return Err(self.on_rate_limited(&route, &bytes).await);
        }
        if status.is_success() {
            Ok(bytes)
        } else {
            Err(classify(status, &bytes))
        }
    }

    async fn on_rate_limited(&self, route: &str, body: &[u8]) -> RestError {
        let info: RateLimitBody = serde_json::from_slice(body).unwrap_or(RateLimitBody {
            retry_after: DEFAULT_RETRY.as_secs_f64(),
            global: false,
        });
        let wait = bounded_wait(info.retry_after).unwrap_or(DEFAULT_RETRY);
        tracing::warn!(
            route,
            wait_secs = wait.as_secs_f64(),
            global = info.global,
            "limite de débit"
        );
        self.limits.pause(route, wait, info.global).await;
        RestError::RateLimited {
            retry_after_secs: info.retry_after,
        }
    }

    fn build_request(
        &self,
        method: &Method,
        path: &str,
        query: &[(&str, &str)],
        body: Option<&[u8]>,
    ) -> reqwest::RequestBuilder {
        let mut request = self
            .http
            .request(method.clone(), format!("{}{path}", self.base_url))
            .query(query);
        for (name, value) in self.identity.http_headers() {
            request = request.header(name, value);
        }
        if let Some(token) = &self.token {
            request = request.header(AUTHORIZATION, token.as_str());
        }
        if let Some(bytes) = body {
            request = request
                .header(CONTENT_TYPE, "application/json")
                .body(bytes.to_vec());
        }
        request
    }
}

pub(crate) fn decode<T: DeserializeOwned>(bytes: &[u8]) -> Result<T, RestError> {
    serde_json::from_slice(bytes).map_err(|err| RestError::Decode(err.to_string()))
}

fn encode<B: Serialize>(body: &B) -> Result<Vec<u8>, RestError> {
    serde_json::to_vec(body).map_err(|err| RestError::Encode(err.to_string()))
}
