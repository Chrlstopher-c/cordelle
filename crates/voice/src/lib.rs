//! Moteur vocal de Cordelle : états vocaux du gateway, audio local (PipeWire) et pont songbird (DAVE inclus).
//! Indépendant de Tauri : l'orchestration gateway (opcodes 4) reste dans `src-tauri/src/engine/voice.rs`.

mod audio;
mod call;
mod devices;
mod mictest;
mod mixer;
mod process;
mod receive;
mod roster;
mod settings;
mod shared;
mod source;

use std::sync::Arc;

use contract::events::EngineEvent;

pub use audio::new_buffer;
pub use call::{
    JoinPlan, JoinRequest, VoiceOp, await_handshake, begin, connect, fail, flags, leave, mic_input,
    reopen_audio, set_deaf, set_mute,
};
pub use devices::list as list_devices;
pub use mictest::{running as mic_test_running, start as mic_test_start, stop as mic_test_stop};
pub use roster::Handshake;
pub use settings::{current as audio_settings, replace as replace_audio_settings};
pub use shared::{SharedVoice, blank_session, ingest, new_shared, publish, update};

/// Canal de sortie vers l'interface (identique à l'émetteur du moteur).
pub type Emit = Arc<dyn Fn(EngineEvent) + Send + Sync>;

#[derive(Debug, thiserror::Error)]
pub enum VoiceError {
    #[error("pas de salon vocal en cours")]
    NotInCall,
    #[error("connexion remplacée par une demande plus récente")]
    Superseded,
    #[error("périphérique audio introuvable : {0}")]
    NoDevice(&'static str),
    #[error("audio : {0}")]
    Audio(String),
    #[error("identifiant vocal invalide : {0}")]
    InvalidId(String),
    #[error("driver vocal : {0}")]
    Connect(String),
    #[error("délai dépassé en attendant Discord")]
    Timeout,
    #[error("état vocal verrouillé")]
    State,
}
