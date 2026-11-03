//! Erreurs REST typées et leur traduction vers le contrat moteur.

use contract::EngineError;
use reqwest::StatusCode;

use crate::models::ApiErrorBody;

const ERROR_TEXT_MAX_CHARS: usize = 200;

#[derive(Debug, thiserror::Error)]
pub enum RestError {
    #[error("HTTP {status} (code {code}) : {message}")]
    Http {
        status: u16,
        code: i32,
        message: String,
    },
    #[error("jeton refusé (401)")]
    Unauthorized,
    #[error("limite de débit atteinte, nouvel essai dans {retry_after_secs} s")]
    RateLimited { retry_after_secs: f64 },
    #[error("erreur réseau : {0}")]
    Network(String),
    #[error("réponse illisible : {0}")]
    Decode(String),
    #[error("requête non sérialisable : {0}")]
    Encode(String),
}

/// Journalise l'erreur réseau (sans jeton : il n'est que dans les en-têtes) et la convertit.
pub(crate) fn network_error(err: reqwest::Error) -> RestError {
    tracing::error!(error = %err, "requête REST échouée (réseau)");
    RestError::Network(err.to_string())
}

pub(crate) fn classify(status: StatusCode, body: &[u8]) -> RestError {
    if status == StatusCode::UNAUTHORIZED {
        return RestError::Unauthorized;
    }
    let (code, message) = match serde_json::from_slice::<ApiErrorBody>(body) {
        Ok(parsed) => (parsed.code, parsed.message),
        Err(_) => (
            0,
            String::from_utf8_lossy(body)
                .chars()
                .take(ERROR_TEXT_MAX_CHARS)
                .collect(),
        ),
    };
    RestError::Http {
        status: status.as_u16(),
        code,
        message,
    }
}

impl From<RestError> for EngineError {
    fn from(err: RestError) -> Self {
        match err {
            RestError::Http {
                status: 404,
                message,
                ..
            } => Self::NotFound { what: message },
            RestError::Http { code, message, .. } => Self::Discord { code, message },
            RestError::Unauthorized => Self::Unauthorized,
            RestError::RateLimited { retry_after_secs } => Self::RateLimited {
                retry_after_ms: retry_after_ms(retry_after_secs),
            },
            RestError::Network(message) => Self::Network { message },
            RestError::Decode(message) | RestError::Encode(message) => Self::Internal { message },
        }
    }
}

fn retry_after_ms(secs: f64) -> u32 {
    (secs * 1000.0).ceil() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_404_devient_not_found() {
        let err = RestError::Http {
            status: 404,
            code: 10003,
            message: "Unknown Channel".into(),
        };
        assert!(
            matches!(EngineError::from(err), EngineError::NotFound { what } if what == "Unknown Channel")
        );
    }

    #[test]
    fn http_autre_devient_discord() {
        let err = RestError::Http {
            status: 403,
            code: 50001,
            message: "Missing Access".into(),
        };
        assert!(matches!(
            EngineError::from(err),
            EngineError::Discord { code: 50001, .. }
        ));
    }

    #[test]
    fn rate_limit_en_millisecondes() {
        let err = RestError::RateLimited {
            retry_after_secs: 1.5,
        };
        assert!(matches!(
            EngineError::from(err),
            EngineError::RateLimited {
                retry_after_ms: 1500
            }
        ));
    }

    #[test]
    fn classify_garde_le_texte_brut_si_pas_du_json() {
        let err = classify(StatusCode::BAD_GATEWAY, b"<html>oops</html>");
        assert!(
            matches!(err, RestError::Http { status: 502, code: 0, ref message } if message.contains("oops"))
        );
    }
}
