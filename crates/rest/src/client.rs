//! Client REST : chaque requête porte les en-têtes du client web, le jeton s'il existe,
//! et passe par les limites de débit ; un 429 est relancé une fois.

use std::time::Duration;

use identity::ClientIdentity;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::multipart::{Form, Part};
use reqwest::{Method, StatusCode};
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::error::{RestError, classify, network_error};
use crate::models::RateLimitBody;
use crate::ratelimit::{RateLimits, bounded_wait};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const DEFAULT_RETRY: Duration = Duration::from_secs(1);

/// Corps d'une requête. Le multipart garde ses octets pour pouvoir être reconstruit à la relance.
#[derive(Clone)]
pub(crate) enum RequestBody {
    Json(Vec<u8>),
    Multipart {
        json: Vec<u8>,
        files: Vec<(String, Vec<u8>)>,
    },
}

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
            .request(
                Method::POST,
                path,
                &[],
                Some(RequestBody::Json(encode(body)?)),
            )
            .await?;
        decode(&bytes)
    }

    pub async fn patch_json<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, RestError> {
        let bytes = self
            .request(
                Method::PATCH,
                path,
                &[],
                Some(RequestBody::Json(encode(body)?)),
            )
            .await?;
        decode(&bytes)
    }

    /// POST multipart : `payload` part en `payload_json`, chaque fichier (nom, octets) en `files[i]`.
    pub async fn post_multipart<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        payload: &B,
        files: Vec<(String, Vec<u8>)>,
    ) -> Result<T, RestError> {
        let body = RequestBody::Multipart {
            json: encode(payload)?,
            files,
        };
        let bytes = self.request(Method::POST, path, &[], Some(body)).await?;
        decode(&bytes)
    }

    /// POST sans corps de réponse attendu (204).
    pub async fn post(&self, path: &str, body: &impl Serialize) -> Result<(), RestError> {
        self.request(
            Method::POST,
            path,
            &[],
            Some(RequestBody::Json(encode(body)?)),
        )
        .await
        .map(|_| ())
    }

    /// PUT sans corps de réponse attendu (204 fréquent chez Discord).
    pub async fn put(&self, path: &str, body: &impl Serialize) -> Result<(), RestError> {
        self.request(
            Method::PUT,
            path,
            &[],
            Some(RequestBody::Json(encode(body)?)),
        )
        .await
        .map(|_| ())
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
        body: Option<RequestBody>,
    ) -> Result<Vec<u8>, RestError> {
        match self.attempt(&method, path, query, body.as_ref()).await {
            Err(RestError::RateLimited { .. }) => {
                self.attempt(&method, path, query, body.as_ref()).await
            }
            result => result,
        }
    }

    async fn attempt(
        &self,
        method: &Method,
        path: &str,
        query: &[(&str, &str)],
        body: Option<&RequestBody>,
    ) -> Result<Vec<u8>, RestError> {
        let route = format!("{method} {path}");
        self.limits.wait_before(&route).await;
        let response = self
            .build_request(method, path, query, body)?
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
        body: Option<&RequestBody>,
    ) -> Result<reqwest::RequestBuilder, RestError> {
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
        Ok(match body {
            None => request,
            Some(RequestBody::Json(bytes)) => request
                .header(CONTENT_TYPE, "application/json")
                .body(bytes.clone()),
            Some(RequestBody::Multipart { json, files }) => {
                request.multipart(multipart_form(json, files)?)
            }
        })
    }
}

fn multipart_form(json: &[u8], files: &[(String, Vec<u8>)]) -> Result<Form, RestError> {
    let payload = Part::bytes(json.to_vec())
        .mime_str("application/json")
        .map_err(|err| RestError::Encode(err.to_string()))?;
    let mut form = Form::new().part("payload_json", payload);
    for (index, (filename, bytes)) in files.iter().enumerate() {
        let part = Part::bytes(bytes.clone()).file_name(filename.clone());
        form = form.part(format!("files[{index}]"), part);
    }
    Ok(form)
}

pub(crate) fn decode<T: DeserializeOwned>(bytes: &[u8]) -> Result<T, RestError> {
    serde_json::from_slice(bytes).map_err(|err| RestError::Decode(err.to_string()))
}

fn encode<B: Serialize>(body: &B) -> Result<Vec<u8>, RestError> {
    serde_json::to_vec(body).map_err(|err| RestError::Encode(err.to_string()))
}
