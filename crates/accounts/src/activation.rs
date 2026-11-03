//! Démarre le Secret Service s'il n'est pas déjà sur le bus de session.
//! KWallet 6 (`ksecretd`) n'est activable que sous `org.kde.secretservicecompat`, pas sous le nom standard.

const STANDARD: &str = "org.freedesktop.secrets";
const FALLBACKS: [&str; 2] = [STANDARD, "org.kde.secretservicecompat"];

/// À appeler avant le premier accès au trousseau. Sans effet si le service tourne déjà.
pub fn ensure_secret_service() {
    let connection = match zbus::blocking::Connection::session() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("bus de session inaccessible : {e}");
            return;
        }
    };
    let Ok(proxy) = zbus::blocking::fdo::DBusProxy::new(&connection) else {
        tracing::error!("proxy D-Bus impossible");
        return;
    };
    let standard = zbus::names::BusName::try_from(STANDARD).expect("nom D-Bus valide");
    if proxy.name_has_owner(standard).unwrap_or(false) {
        return;
    }
    for name in FALLBACKS {
        let Ok(well_known) = zbus::names::WellKnownName::try_from(name) else {
            continue;
        };
        match proxy.start_service_by_name(well_known, 0) {
            Ok(_) => {
                tracing::info!(service = name, "Secret Service démarré");
                return;
            }
            Err(e) => tracing::warn!(service = name, "activation impossible : {e}"),
        }
    }
    tracing::error!(
        "aucun Secret Service disponible : les jetons ne pourront pas être enregistrés"
    );
}
