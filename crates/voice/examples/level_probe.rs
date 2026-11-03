//! Sonde : ouvre le micro par défaut via PipeWire 2 s et affiche le niveau traité (sans s'écouter).

use std::sync::Arc;

use contract::events::EngineEvent;

fn main() {
    let emit: voice::Emit = Arc::new(|ev| {
        if let EngineEvent::VoiceLevel {
            level_db,
            threshold_db,
            gate_open,
        } = ev
        {
            println!("niveau {level_db:6.1} dB  seuil {threshold_db:6.1} dB  voix {gate_open}");
        }
    });
    match voice::mic_test_start(&emit, false) {
        Ok(()) => std::thread::sleep(std::time::Duration::from_secs(2)),
        Err(e) => println!("échec : {e}"),
    }
    voice::mic_test_stop();
    println!(
        "périphériques : {:?}",
        voice::list_devices().map(|d| (d.inputs.len(), d.outputs.len()))
    );
}
