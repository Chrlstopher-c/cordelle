//! Limites de débit Discord : instant de reprise par bucket. Tant que le bucket d'une route est
//! inconnu, la route elle-même sert de clé.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use reqwest::header::HeaderMap;
use tokio::sync::Mutex;

const MAX_WAIT: Duration = Duration::from_secs(3600);

#[derive(Default)]
pub struct RateLimits {
    state: Mutex<LimitState>,
}

#[derive(Default)]
struct LimitState {
    route_buckets: HashMap<String, String>,
    bucket_resume: HashMap<String, Instant>,
    global_resume: Option<Instant>,
}

impl LimitState {
    fn key_of<'a>(&'a self, route: &'a str) -> &'a str {
        self.route_buckets.get(route).map_or(route, String::as_str)
    }
}

/// Convertit une durée en secondes reçue de Discord, bornée à une heure. `None` si invalide.
pub fn bounded_wait(secs: f64) -> Option<Duration> {
    Duration::try_from_secs_f64(secs)
        .ok()
        .map(|wait| wait.min(MAX_WAIT))
}

impl RateLimits {
    /// Attend la fin de la pause globale ou du bucket de la route, si l'une est active.
    pub async fn wait_before(&self, route: &str) {
        let until = {
            let state = self.state.lock().await;
            let bucket_until = state.bucket_resume.get(state.key_of(route)).copied();
            [state.global_resume, bucket_until]
                .into_iter()
                .flatten()
                .max()
        };
        if let Some(until) = until {
            tokio::time::sleep(until.saturating_duration_since(Instant::now())).await;
        }
    }

    /// Mémorise le bucket de la route et, si le bucket est épuisé, son instant de reprise.
    pub async fn observe(&self, route: &str, headers: &HeaderMap) {
        let Some(bucket) = header_text(headers, "x-ratelimit-bucket") else {
            return;
        };
        let exhausted = header_text(headers, "x-ratelimit-remaining") == Some("0");
        let reset =
            header_text(headers, "x-ratelimit-reset-after").and_then(|v| v.parse::<f64>().ok());
        let mut state = self.state.lock().await;
        state
            .route_buckets
            .insert(route.to_owned(), bucket.to_owned());
        if let (true, Some(wait)) = (exhausted, reset.and_then(bounded_wait)) {
            state
                .bucket_resume
                .insert(bucket.to_owned(), Instant::now() + wait);
        }
    }

    /// Pause après un 429 : globale si `global`, sinon sur le bucket de la route.
    pub async fn pause(&self, route: &str, wait: Duration, global: bool) {
        let mut state = self.state.lock().await;
        let until = Instant::now() + wait;
        if global {
            state.global_resume = Some(until);
        } else {
            let key = state.key_of(route).to_owned();
            state.bucket_resume.insert(key, until);
        }
    }
}

fn header_text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name)?.to_str().ok()
}
