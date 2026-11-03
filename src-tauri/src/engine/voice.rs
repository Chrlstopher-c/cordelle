//! Vocal côté moteur : poignée de main gateway (opcode 4) puis appels à la crate `voice`.

use std::sync::Arc;
use std::time::Duration;

use contract::{AccountId, EngineError, Snowflake, voice::AudioDevices};
use serde_json::json;
use voice::{JoinPlan, JoinRequest, VoiceError, VoiceOp};

use super::session::Session;
use super::{Engine, internal};

const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);

fn voice_error(error: VoiceError) -> EngineError {
    match error {
        VoiceError::NotInCall => EngineError::NotFound {
            what: "salon vocal".into(),
        },
        other => internal(&other.to_string()),
    }
}

/// Opcode 4 (Voice State Update) : rejoindre, quitter, changer de sourdine.
async fn send_voice_state(session: &Session, op: &VoiceOp) -> Result<(), EngineError> {
    let d = json!({
        "guild_id": op.guild_id,
        "channel_id": op.channel_id,
        "self_mute": op.self_mute,
        "self_deaf": op.self_deaf,
        "self_video": false,
    });
    session.send_op(4, d).await
}

impl Engine {
    /// Rejoint un salon vocal (`guild_id` absent = appel MP). Renvoie quand la connexion audio est établie.
    pub async fn voice_join(
        &self,
        account_id: &AccountId,
        guild_id: Option<Snowflake>,
        channel_id: Snowflake,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let (self_mute, self_deaf) = voice::flags(&session.voice);
        let plan = JoinPlan {
            account_id: account_id.clone(),
            guild_id: guild_id.clone(),
            channel_id: channel_id.clone(),
            self_mute,
            self_deaf,
        };
        let generation = voice::begin(&session.voice, &self.emit, &plan).map_err(voice_error)?;
        let op = VoiceOp {
            guild_id,
            channel_id: Some(channel_id.clone()),
            self_mute,
            self_deaf,
        };
        let handshake = match send_voice_state(&session, &op).await {
            Ok(()) => voice::await_handshake(&session.voice, &channel_id, HANDSHAKE_TIMEOUT).await,
            Err(error) => {
                tracing::error!("opcode 4 impossible : {error:?}");
                Err(VoiceError::Connect(
                    "envoi de l'état vocal impossible".into(),
                ))
            }
        };
        let handshake = match handshake {
            Ok(handshake) => handshake,
            Err(error) => {
                voice::fail(&session.voice, &self.emit, generation, &error);
                return Err(voice_error(error));
            }
        };
        let request = JoinRequest { plan, handshake };
        voice::connect(&session.voice, &self.emit, request, generation)
            .await
            .map_err(voice_error)
    }

    /// Quitte le salon vocal courant (opcode 4 avec `channel_id` nul).
    pub async fn voice_leave(&self, account_id: &AccountId) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        match voice::leave(&session.voice, &self.emit) {
            Some(op) => send_voice_state(&session, &op).await,
            None => Ok(()),
        }
    }

    pub async fn voice_set_mute(
        &self,
        account_id: &AccountId,
        mute: bool,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let op = voice::set_mute(&session.voice, &self.emit, mute).map_err(voice_error)?;
        send_voice_state(&session, &op).await
    }

    pub async fn voice_set_deaf(
        &self,
        account_id: &AccountId,
        deaf: bool,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let op = voice::set_deaf(&session.voice, &self.emit, deaf).map_err(voice_error)?;
        send_voice_state(&session, &op).await
    }

    pub fn voice_devices(&self) -> Result<AudioDevices, EngineError> {
        voice::list_devices().map_err(voice_error)
    }

    /// Choix global des périphériques ; rouvre l'audio des appels en cours.
    pub fn voice_set_devices(
        &self,
        input: Option<Snowflake>,
        output: Option<Snowflake>,
    ) -> Result<(), EngineError> {
        voice::select_devices(input, output);
        let sessions: Vec<Arc<Session>> = self.lock_sessions()?.values().cloned().collect();
        for session in sessions {
            voice::apply_devices(&session.voice).map_err(voice_error)?;
        }
        Ok(())
    }
}
