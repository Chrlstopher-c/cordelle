//! Journaux : terminal + fichier `~/.local/share/cordelle/logs/cordelle.log` remis à zéro à chaque lancement,
//! paniques comprises, pour diagnostiquer après coup (fermetures inattendues).

use std::{fs::File, sync::Mutex};

use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

pub fn init() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let file = dirs::data_dir()
        .map(|d| d.join("cordelle").join("logs"))
        .and_then(|dir| {
            std::fs::create_dir_all(&dir)
                .ok()
                .map(|()| dir.join("cordelle.log"))
        })
        .and_then(|path| File::create(path).ok());
    let file_layer = file.map(|f| fmt::layer().with_ansi(false).with_writer(Mutex::new(f)));
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer())
        .with(file_layer)
        .init();
    std::panic::set_hook(Box::new(|info| {
        tracing::error!("panique : {info}");
    }));
}

/// Trace les événements de fenêtre et de sortie qui expliquent une fermeture.
pub fn run_event(event: &tauri::RunEvent) {
    match event {
        tauri::RunEvent::ExitRequested { code, .. } => tracing::warn!(?code, "sortie demandée"),
        tauri::RunEvent::Exit => tracing::warn!("sortie de l'application"),
        tauri::RunEvent::WindowEvent { label, event, .. } => match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                tracing::warn!(label, "fermeture de fenêtre demandée")
            }
            tauri::WindowEvent::Destroyed => tracing::warn!(label, "fenêtre détruite"),
            _ => {}
        },
        _ => {}
    }
}
