/// Erreurs du domaine store.
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("SQLite : {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("JSON invalide : {0}")]
    Json(#[from] serde_json::Error),
    #[error("identifiant Discord invalide : {0}")]
    InvalidId(String),
}

impl From<StoreError> for contract::EngineError {
    fn from(err: StoreError) -> Self {
        contract::EngineError::Internal {
            message: err.to_string(),
        }
    }
}
