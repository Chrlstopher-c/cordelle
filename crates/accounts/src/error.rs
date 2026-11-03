use contract::{AccountId, EngineError};

#[derive(Debug, thiserror::Error)]
pub enum AccountsError {
    #[error("compte introuvable : {0}")]
    NotFound(AccountId),
    #[error("index des comptes invalide : {0}")]
    Index(#[from] serde_json::Error),
    #[error("disque : {0}")]
    Io(#[from] std::io::Error),
    #[error("trousseau système : {0}")]
    Keyring(String),
}

impl From<AccountsError> for EngineError {
    fn from(error: AccountsError) -> Self {
        match error {
            AccountsError::NotFound(id) => Self::NotFound {
                what: format!("compte {id}"),
            },
            other => Self::Internal {
                message: other.to_string(),
            },
        }
    }
}
