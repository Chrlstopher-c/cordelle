//! Partage d'écran (Go Live) côté moteur. Le transport média vers le serveur de stream n'est pas encore branché :
//! `stream_start` valide la demande puis refuse, sans rien envoyer au gateway (pas de flux fantôme pour les autres).

use contract::{
    AccountId, EngineError, stream::StreamQuality, stream::StreamState, voice::VoiceConnection,
};
use serde_json::Value;

use super::session::Session;
use super::{Engine, internal};

const START_COMMAND: &str = "stream_start";

/// Vrai si ma session est connectée à un salon vocal (appel ou serveur).
fn in_call(session: &Session) -> bool {
    match session.voice.lock() {
        Ok(state) => state
            .session
            .as_ref()
            .is_some_and(|v| v.connection == VoiceConnection::Connected),
        Err(_) => {
            tracing::error!("état vocal verrouillé, partage refusé");
            false
        }
    }
}

impl Engine {
    /// Démarre un Go Live dans l'appel courant. Refusé tant que le transport vidéo n'est pas branché.
    pub fn stream_start(
        &self,
        account_id: &AccountId,
        quality: StreamQuality,
    ) -> Result<StreamState, EngineError> {
        let session = self.session(account_id)?;
        if !in_call(&session) {
            return Err(EngineError::NotFound {
                what: "salon vocal".into(),
            });
        }
        let checked = ::stream::validate(quality).map_err(|error| internal(&error.to_string()))?;
        tracing::info!(
            width = checked.width,
            height = checked.height,
            fps = checked.fps,
            "partage demandé, transport vidéo non branché"
        );
        Err(EngineError::NotImplemented {
            command: START_COMMAND.into(),
        })
    }

    /// Arrête le partage. Sans flux en cours, c'est un état déjà atteint.
    pub fn stream_stop(&self, account_id: &AccountId) -> Result<StreamState, EngineError> {
        self.session(account_id)?;
        Ok(StreamState {
            account_id: account_id.clone(),
            streaming: false,
            quality: None,
        })
    }
}

/// Aiguillage des dispatchs de partage (STREAM_CREATE, STREAM_SERVER_UPDATE, STREAM_DELETE) : journalise seulement,
/// tant qu'aucun flux n'est tenu. Jetons et clés de flux ne sont jamais journalisés.
pub(super) fn track(name: &str, data: &Value) {
    match name {
        "STREAM_CREATE" => match ::stream::signal::parse_stream_created(data) {
            Some(created) => {
                tracing::debug!(rtc_server = %created.rtc_server_id, "STREAM_CREATE reçu")
            }
            None => tracing::warn!("STREAM_CREATE incomplet, ignoré"),
        },
        "STREAM_SERVER_UPDATE" => match ::stream::signal::parse_stream_server(data) {
            Some(server) => {
                tracing::debug!(endpoint = %server.endpoint, "STREAM_SERVER_UPDATE reçu")
            }
            None => tracing::debug!("STREAM_SERVER_UPDATE sans serveur, ignoré"),
        },
        "STREAM_DELETE" => tracing::debug!("STREAM_DELETE reçu"),
        _ => {}
    }
}
