//! Coquille Tauri : branche le moteur (crates/*) sur l'interface via les commandes du contrat.

mod commands;
mod engine;
mod gpu;
mod logging;

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
            commands::dm_open,
            commands::note_set,
            commands::message_edit,
            commands::message_delete,
            commands::reaction_set,
            commands::relationships_list,
            commands::relationship_set,
            commands::friend_request,
            commands::mentions_recent,
            commands::members_subscribe,
            commands::status_set,
            commands::profile_update,
            commands::presences_get,
            commands::channel_ack,
            commands::guild_ack,
            commands::message_pin,
            commands::guild_leave,
            commands::dm_close,
            commands::settings::sessions_list,
            commands::settings::sessions_logout,
            commands::settings::connections_list,
            commands::settings::connection_remove,
            commands::settings::subscriptions_list,
            commands::home::invite_resolve,
            commands::home::invite_accept,
            commands::home::guild_create,
            commands::home::scheduled_events,
            commands::home::discoverable_guilds,
            commands::message_send_files,
            commands::guild_emojis,
            commands::server::guild_info,
            commands::server::guild_update,
            commands::server::roles_list,
            commands::server::role_create,
            commands::server::role_update,
            commands::server::role_delete,
            commands::server::role_reorder,
            commands::server::guild_members_search,
            commands::server::member_kick,
            commands::server::member_ban,
            commands::server::bans_list,
            commands::server::ban_remove,
            commands::server::invites_list,
            commands::server::invite_create,
            commands::server::invite_delete,
            commands::server::guild_emojis_manage,
            commands::server::audit_log,
            commands::server::automod_rules,
            commands::server::integrations_list,
            commands::server::channel_info,
            commands::server::channel_update,
            commands::server::channel_create,
            commands::search::messages_search,
            commands::search::pins_list,
            commands::search::threads_list,
            commands::search::thread_create,
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
    logging::init();

    let builder = specta_builder();
    #[cfg(debug_assertions)]
    if let Err(e) = export_bindings() {
        tracing::error!("export des types TS impossible : {e}");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
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
        .build(tauri::generate_context!())
        .expect("échec du démarrage de Tauri")
        .run(|_, event| logging::run_event(&event));
}
