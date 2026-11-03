//! Numéro de build du client web, mis en cache sur disque : démarrage instantané, rafraîchi en tâche de fond.

use std::{
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use contract::EngineError;
use serde::{Deserialize, Serialize};

const MAX_AGE: Duration = Duration::from_secs(24 * 3600);

#[derive(Serialize, Deserialize)]
struct Cached {
    build: u32,
    fetched_at: u64,
}

pub struct BuildCache {
    path: PathBuf,
}

impl BuildCache {
    pub fn new(dir: &Path) -> Self {
        Self {
            path: dir.join("build.json"),
        }
    }

    /// Valeur en cache (même périmée) et vrai si elle doit être rafraîchie.
    pub fn read(&self) -> Option<(u32, bool)> {
        let raw = std::fs::read(&self.path).ok()?;
        let cached: Cached = serde_json::from_slice(&raw).ok()?;
        let age = now().saturating_sub(cached.fetched_at);
        Some((cached.build, age > MAX_AGE.as_secs()))
    }

    pub fn write(&self, build: u32) {
        let cached = Cached {
            build,
            fetched_at: now(),
        };
        let written = serde_json::to_vec(&cached)
            .map_err(|e| e.to_string())
            .and_then(|json| std::fs::write(&self.path, json).map_err(|e| e.to_string()));
        if let Err(e) = written {
            tracing::error!("écriture du cache de build impossible : {e}");
        }
    }

    pub async fn fetch(&self) -> Result<u32, EngineError> {
        let http = reqwest::Client::builder().build().map_err(|e| {
            tracing::error!("client HTTP impossible : {e}");
            super::internal("client HTTP impossible")
        })?;
        let build = rest::fetch_build_number(&http).await.map_err(|e| {
            tracing::error!("numéro de build introuvable : {e}");
            EngineError::from(e)
        })?;
        tracing::info!(build, "numéro de build du client web");
        self.write(build);
        Ok(build)
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
