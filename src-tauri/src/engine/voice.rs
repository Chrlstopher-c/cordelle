//! Vocal côté moteur : poignée de main gateway (opcode 4) puis appels à la crate `voice`.

use std::sync::Arc;
use std::time::Duration;

use contract::{
    AccountId, EngineError, Snowflake,
    voice::{AudioDevices, AudioSettings},
};
use serde_json::json;
use voice::{Handshake, JoinPlan, JoinRequest, VoiceError, VoiceOp};

use super::session::Session;
use super::{Engine, internal};

const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(8);
const REJOIN_PAUSE: Duration = Duration::from_millis(600);

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

fn op_of(plan: &JoinPlan) -> VoiceOp {
    VoiceOp {
        guild_id: plan.guild_id.clone(),
        channel_id: Some(plan.channel_id.clone()),
        self_mute: plan.self_mute,
        self_deaf: plan.self_deaf,
    }
}

/// Envoie l'opcode 4 de connexion et attend VOICE_STATE_UPDATE + VOICE_SERVER_UPDATE.
async fn handshake_once(session: &Session, plan: &JoinPlan) -> Result<Handshake, VoiceError> {
    match send_voice_state(session, &op_of(plan)).await {
        Ok(()) => voice::await_handshake(&session.voice, &plan.channel_id, HANDSHAKE_TIMEOUT).await,
        Err(error) => {
            tracing::error!("opcode 4 impossible : {error:?}");
            Err(VoiceError::Connect(
                "envoi de l'état vocal impossible".into(),
            ))
        }
    }
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
        match self.join_attempt(&session, &plan).await {
            Err(VoiceError::Timeout) => {
                // Discord nous croit encore dans le salon (départ perdu, plantage) : départ propre puis nouvel essai.
                tracing::warn!("connexion vocale sans réponse, départ propre puis nouvel essai");
                let leave = VoiceOp {
                    channel_id: None,
                    ..op_of(&plan)
                };
                if let Err(error) = send_voice_state(&session, &leave).await {
                    tracing::error!("opcode 4 de départ impossible : {error:?}");
                }
                tokio::time::sleep(REJOIN_PAUSE).await;
                self.join_attempt(&session, &plan)
                    .await
                    .map_err(voice_error)
            }
            other => other.map_err(voice_error),
        }
    }

    /// Un essai complet : opcode 4, poignée de main gateway, puis connexion du driver.
    async fn join_attempt(&self, session: &Session, plan: &JoinPlan) -> Result<(), VoiceError> {
        let generation = voice::begin(&session.voice, &self.emit, plan)?;
        let handshake = match handshake_once(session, plan).await {
            Ok(handshake) => handshake,
            Err(error) => {
                tracing::warn!("poignée de main vocale échouée : {error}");
                voice::fail(&session.voice, &self.emit, generation, &error);
                return Err(error);
            }
        };
        tracing::info!(endpoint = %handshake.endpoint, "poignée de main vocale reçue, connexion du driver");
        let request = JoinRequest {
            plan: plan.clone(),
            handshake,
        };
        let result = voice::connect(&session.voice, &self.emit, request, generation).await;
        if result.is_ok() {
            tracing::info!("connexion vocale établie");
        }
        result
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

    /// Choix des périphériques (raccourci du menu d'appel) ; garde les autres réglages.
    pub fn voice_set_devices(
        &self,
        input: Option<Snowflake>,
        output: Option<Snowflake>,
    ) -> Result<(), EngineError> {
        let next = AudioSettings {
            input_device: input,
            output_device: output,
            ..voice::audio_settings()
        };
        self.voice_set_audio_settings(next)
    }

    pub fn voice_audio_settings(&self) -> AudioSettings {
        voice::audio_settings()
    }

    /// Réglages audio en direct ; rouvre les flux (appels, test) si un périphérique change.
    pub fn voice_set_audio_settings(&self, next: AudioSettings) -> Result<(), EngineError> {
        if !voice::replace_audio_settings(next) {
            return Ok(());
        }
        let sessions: Vec<Arc<Session>> = self.lock_sessions()?.values().cloned().collect();
        for session in sessions {
            voice::reopen_audio(&session.voice, &self.emit).map_err(voice_error)?;
        }
        if voice::mic_test_running() {
            voice::mic_test_start(&self.emit, true).map_err(voice_error)?;
        }
        Ok(())
    }

    pub fn voice_mic_test(&self, on: bool) -> Result<(), EngineError> {
        if on {
            voice::mic_test_start(&self.emit, true).map_err(voice_error)
        } else {
            voice::mic_test_stop();
            Ok(())
        }
    }
}
