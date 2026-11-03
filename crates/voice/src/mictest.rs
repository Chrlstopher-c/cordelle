//! Test du micro hors appel : capture traitée renvoyée dans la sortie (s'écouter) et niveau relayé.

use std::sync::Mutex;

use crate::audio::{AudioHandle, AudioPlan, new_buffer};
use crate::call::level_sink;
use crate::{Emit, VoiceError};

static TEST: Mutex<Option<AudioHandle>> = Mutex::new(None);

/// Démarre (ou redémarre) le test ; `monitor` = s'entendre.
pub fn start(emit: &Emit, monitor: bool) -> Result<(), VoiceError> {
    let mut guard = TEST.lock().map_err(|_| VoiceError::State)?;
    *guard = None;
    let plan = AudioPlan {
        mic: new_buffer(),
        speaker: new_buffer(),
        monitor,
        level: Some(level_sink(emit)),
    };
    *guard = Some(AudioHandle::start(plan)?);
    Ok(())
}

pub fn stop() {
    match TEST.lock() {
        Ok(mut guard) => *guard = None,
        Err(_) => tracing::error!("test micro verrouillé, arrêt impossible"),
    }
}

pub fn running() -> bool {
    TEST.lock().map(|g| g.is_some()).unwrap_or(false)
}
