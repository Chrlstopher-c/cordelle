//! État vocal partagé d'une session : roster gateway, snapshot publié et appel en cours.

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use contract::{
    AccountId, Snowflake, events::EngineEvent, voice::VoiceConnection, voice::VoiceSession,
};
use songbird::driver::Driver;

use crate::Emit;
use crate::audio::{AudioHandle, Buffer};
use crate::roster::VoiceRoster;

/// Partagé entre la session (qui y pousse le gateway) et les commandes vocales.
pub type SharedVoice = Arc<Mutex<VoiceShared>>;

pub struct VoiceShared {
    pub roster: VoiceRoster,
    pub session: Option<VoiceSession>,
    pub call: Option<ActiveCall>,
    /// Incrémenté à chaque nouvelle demande de connexion ou de départ : invalide les connexions en cours.
    pub generation: u64,
}

/// Driver songbird et flux audio d'une connexion.
pub struct ActiveCall {
    pub driver: Driver,
    pub audio: Option<AudioHandle>,
    pub mic: Buffer,
    pub speaker: Buffer,
    pub deaf: Arc<AtomicBool>,
}

pub fn new_shared(account_id: AccountId) -> SharedVoice {
    Arc::new(Mutex::new(VoiceShared {
        roster: VoiceRoster::new(account_id),
        session: None,
        call: None,
        generation: 0,
    }))
}

/// Applique un événement gateway vocal ; renvoie les listes de périmètres modifiées (à émettre par l'appelant).
pub fn ingest(shared: &SharedVoice, name: &str, data: &serde_json::Value) -> Vec<EngineEvent> {
    match shared.lock() {
        Ok(mut state) => state.roster.ingest(name, data),
        Err(_) => {
            tracing::error!("état vocal verrouillé, événement {name} ignoré");
            Vec::new()
        }
    }
}

/// Remplace le snapshot publié et l'émet.
pub fn publish(shared: &SharedVoice, emit: &Emit, session: VoiceSession) {
    if let Ok(mut state) = shared.lock() {
        state.session = Some(session.clone());
    }
    emit(EngineEvent::VoiceSession { session });
}

/// Modifie le snapshot courant (s'il existe), puis l'émet.
pub fn update(shared: &SharedVoice, emit: &Emit, edit: impl FnOnce(&mut VoiceSession)) {
    let snapshot = match shared.lock() {
        Ok(mut state) => state.session.as_mut().map(|session| {
            edit(session);
            session.clone()
        }),
        Err(_) => None,
    };
    if let Some(session) = snapshot {
        emit(EngineEvent::VoiceSession { session });
    }
}

pub fn blank_session(account_id: AccountId, connection: VoiceConnection) -> VoiceSession {
    VoiceSession {
        account_id,
        guild_id: None,
        channel_id: None,
        connection,
        self_mute: false,
        self_deaf: false,
        ping_ms: None,
        speaking: Vec::<Snowflake>::new(),
        error: None,
    }
}
