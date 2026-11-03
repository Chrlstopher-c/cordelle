//! Réglages audio courants, partagés par l'appel en cours et le test du micro ; lus à chaque trame.

use std::sync::RwLock;

use contract::voice::AudioSettings;

static SETTINGS: RwLock<Option<AudioSettings>> = RwLock::new(None);

pub fn current() -> AudioSettings {
    match SETTINGS.read() {
        Ok(guard) => guard.clone().unwrap_or_default(),
        Err(_) => {
            tracing::error!("réglages audio verrouillés, valeurs par défaut");
            AudioSettings::default()
        }
    }
}

/// Remplace les réglages ; renvoie vrai si un périphérique a changé (flux à rouvrir).
pub fn replace(next: AudioSettings) -> bool {
    let Ok(mut guard) = SETTINGS.write() else {
        tracing::error!("réglages audio verrouillés, changement ignoré");
        return false;
    };
    let prev = guard.clone().unwrap_or_default();
    let devices_changed =
        prev.input_device != next.input_device || prev.output_device != next.output_device;
    *guard = Some(next);
    devices_changed
}
