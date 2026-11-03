//! Accélération GPU de WebKitGTK : composition et rendu 2D matériels forcés.

use tauri::Manager;

/// À appeler avant la création de la première webview.
pub fn configure_env() {
    // Pilote NVIDIA propriétaire : le rendu DMA-BUF de WebKitGTK donne une fenêtre blanche ;
    // le repli reste accéléré (composition GL), seul le partage de tampons change.
    if std::path::Path::new("/proc/driver/nvidia/version").exists()
        && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
    {
        // SAFETY : appelé au démarrage, avant tout thread qui lirait l'environnement.
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
}

pub fn enable_acceleration(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        tracing::warn!("fenêtre principale absente, accélération GPU non configurée");
        return;
    };
    #[cfg(target_os = "linux")]
    if let Err(e) = window.with_webview(|webview| {
        use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};
        if let Some(settings) = webview.inner().settings() {
            settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Always);
            settings.set_enable_webgl(true);
        }
    }) {
        tracing::error!("réglage de l'accélération GPU impossible : {e}");
    }
}
