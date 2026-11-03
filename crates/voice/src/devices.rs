//! Périphériques audio tels que PipeWire les présente (via `pactl`, serveur PulseAudio de PipeWire) :
//! mêmes noms que le panneau son du système, sources « .monitor » exclues.

use std::process::Command;

use contract::voice::{AudioDevice, AudioDevices};
use serde_json::Value;

use crate::VoiceError;

pub fn list() -> Result<AudioDevices, VoiceError> {
    let default_out = pactl(&["get-default-sink"]).unwrap_or_default();
    let default_in = pactl(&["get-default-source"]).unwrap_or_default();
    Ok(AudioDevices {
        inputs: nodes("sources", default_in.trim())?,
        outputs: nodes("sinks", default_out.trim())?,
    })
}

fn nodes(kind: &str, default: &str) -> Result<Vec<AudioDevice>, VoiceError> {
    let raw = pactl(&["-f", "json", "list", kind])?;
    let parsed: Vec<Value> = serde_json::from_str(&raw)
        .map_err(|e| VoiceError::Audio(format!("liste {kind} illisible : {e}")))?;
    Ok(parsed
        .iter()
        .filter_map(|node| {
            let name = node.get("name")?.as_str()?;
            if name.ends_with(".monitor") {
                return None;
            }
            Some(AudioDevice {
                id: name.to_owned(),
                name: label(node, name),
                is_default: name == default,
            })
        })
        .collect())
}

/// Description lisible ; à défaut le surnom du nœud, puis le nom technique.
fn label(node: &Value, name: &str) -> String {
    [
        node.get("description"),
        node.pointer("/properties/node.description"),
        node.pointer("/properties/node.nick"),
    ]
    .into_iter()
    .flatten()
    .filter_map(Value::as_str)
    .find(|s| !s.is_empty() && *s != "(null)")
    .unwrap_or(name)
    .to_owned()
}

fn pactl(args: &[&str]) -> Result<String, VoiceError> {
    let out = Command::new("pactl").args(args).output().map_err(|e| {
        tracing::error!("pactl introuvable : {e}");
        VoiceError::Audio(format!("pactl indisponible : {e}"))
    })?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).into_owned();
        tracing::error!("pactl {args:?} : {err}");
        return Err(VoiceError::Audio(err));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}
