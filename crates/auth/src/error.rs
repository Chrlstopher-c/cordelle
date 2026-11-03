use contract::EngineError;

/// Erreurs du domaine auth. Les messages ne contiennent jamais de jeton ni de mot de passe.
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("réseau : {0}")]
    Network(String),
    #[error("protocole : {0}")]
    Protocol(String),
    #[error("chiffrement : {0}")]
    Crypto(String),
    #[error("Discord ({code}) : {message}")]
    Discord { code: i32, message: String },
    #[error("trop de requêtes, réessayer dans {retry_after_ms} ms")]
    RateLimited { retry_after_ms: u32 },
    #[error("connexion annulée")]
    Cancelled,
    #[error("QR code expiré")]
    Expired,
}

impl From<AuthError> for EngineError {
    fn from(err: AuthError) -> Self {
        match err {
            AuthError::Network(message) => Self::Network { message },
            AuthError::Discord { code, message } => Self::Discord { code, message },
            AuthError::RateLimited { retry_after_ms } => Self::RateLimited { retry_after_ms },
            other => Self::Internal {
                message: other.to_string(),
            },
        }
    }
}
