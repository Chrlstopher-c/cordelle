//! Périphériques audio (cpal, ALSA ou PipeWire) : listing et sélection courante, partagée par l'application.

use std::str::FromStr;
use std::sync::Mutex;

use contract::voice::{AudioDevice, AudioDevices};
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::{Device, DeviceId};

use crate::VoiceError;

/// Identifiants choisis (`None` = périphérique par défaut du système).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Selection {
    pub input: Option<String>,
    pub output: Option<String>,
}

static SELECTION: Mutex<Selection> = Mutex::new(Selection {
    input: None,
    output: None,
});

pub fn selection() -> Selection {
    match SELECTION.lock() {
        Ok(guard) => guard.clone(),
        Err(_) => {
            tracing::error!("sélection audio verrouillée");
            Selection::default()
        }
    }
}

pub fn set_selection(input: Option<String>, output: Option<String>) {
    match SELECTION.lock() {
        Ok(mut guard) => *guard = Selection { input, output },
        Err(_) => tracing::error!("sélection audio verrouillée, choix ignoré"),
    }
}

/// Entrées et sorties disponibles, avec le périphérique par défaut signalé.
pub fn list() -> Result<AudioDevices, VoiceError> {
    let host = cpal::default_host();
    let default_in = host.default_input_device().and_then(|d| d.id().ok());
    let default_out = host.default_output_device().and_then(|d| d.id().ok());
    let inputs = host
        .input_devices()
        .map_err(|e| VoiceError::Audio(e.to_string()))?;
    let outputs = host
        .output_devices()
        .map_err(|e| VoiceError::Audio(e.to_string()))?;
    Ok(AudioDevices {
        inputs: inputs
            .filter_map(|d| describe(&d, default_in.as_ref()))
            .collect(),
        outputs: outputs
            .filter_map(|d| describe(&d, default_out.as_ref()))
            .collect(),
    })
}

fn describe(device: &Device, default: Option<&DeviceId>) -> Option<AudioDevice> {
    let id = device.id().ok()?;
    let name = device
        .description()
        .map(|d| d.name().to_owned())
        .unwrap_or_else(|_| id.to_string());
    Some(AudioDevice {
        id: id.to_string(),
        name,
        is_default: default == Some(&id),
    })
}

/// Micro choisi, ou par défaut si l'identifiant est absent ou disparu.
pub fn find_input(id: Option<&str>) -> Result<Device, VoiceError> {
    let host = cpal::default_host();
    if let Some(device) = id.and_then(|id| lookup(&host, id)) {
        return Ok(device);
    }
    host.default_input_device()
        .ok_or(VoiceError::NoDevice("entrée"))
}

/// Haut-parleur choisi, ou par défaut si l'identifiant est absent ou disparu.
pub fn find_output(id: Option<&str>) -> Result<Device, VoiceError> {
    let host = cpal::default_host();
    if let Some(device) = id.and_then(|id| lookup(&host, id)) {
        return Ok(device);
    }
    host.default_output_device()
        .ok_or(VoiceError::NoDevice("sortie"))
}

fn lookup(host: &cpal::Host, id: &str) -> Option<Device> {
    let parsed = DeviceId::from_str(id).ok();
    let device = parsed.and_then(|d| host.device_by_id(&d));
    if device.is_none() {
        tracing::warn!("périphérique audio {id} introuvable, défaut système utilisé");
    }
    device
}
