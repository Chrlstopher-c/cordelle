//! Coquille Tauri : branche le moteur (crates/*) sur l'interface via les commandes du contrat.

mod commands;
mod engine;
mod gpu;

use tauri_specta::{Builder, collect_commands, collect_events};

pub const BINDINGS_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/contract/bindings.ts");

pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            commands::accounts_list,
            commands::account_switch,
            commands::account_remove,
            commands::auth_qr_start,
            commands::auth_qr_cancel,
            commands::auth_password,
            commands::auth_mfa,
            commands::guilds_list,
            commands::channels_list,
            commands::dms_list,
            commands::messages_get,
            commands::message_send,
            commands::user_profile,
        ])
        .events(collect_events![commands::Engine, commands::AuthQr])
}

pub fn export_bindings() -> Result<(), String> {
    specta_builder()
        .export(specta_typescript::Typescript::default(), BINDINGS_PATH)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    gpu::configure_env();
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let builder = specta_builder();
    #[cfg(debug_assertions)]
    if let Err(e) = export_bindings() {
        tracing::error!("export des types TS impossible : {e}");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            let handle = app.handle().clone();
            let emit: engine::Emitter = std::sync::Arc::new(move |event| {
                if let Err(e) = tauri_specta::Event::emit(&commands::Engine(event), &handle) {
                    tracing::error!("émission engine impossible : {e}");
                }
            });
            let engine: &'static engine::Engine = Box::leak(Box::new(
                engine::Engine::open(emit).map_err(|e| format!("moteur : {e:?}"))?,
            ));
            tauri::Manager::manage(app, engine);
            tauri::async_runtime::spawn(async move {
                let _ = engine.identity().await;
                engine.connect_all().await;
            });
            gpu::enable_acceleration(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("échec du démarrage de Tauri");
}
