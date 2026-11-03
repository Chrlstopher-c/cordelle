//! Identité du client : Cordelle se présente exactement comme le client web Discord (Chrome sous Linux).
//! Partagée par `rest`, `gateway` et `auth` pour que toutes les requêtes portent la même empreinte.

use base64::Engine as _;
use serde::Serialize;

pub const API_BASE: &str = "https://discord.com/api/v9";
pub const GATEWAY_URL: &str = "wss://gateway.discord.gg/?v=9&encoding=json&compress=zlib-stream";
pub const REMOTE_AUTH_URL: &str = "wss://remote-auth-gateway.discord.gg/?v=2";
pub const ORIGIN: &str = "https://discord.com";

const CHROME_VERSION: &str = "142.0.0.0";

/// Champs `X-Super-Properties` / `identify.properties` du client web.
#[derive(Debug, Clone, Serialize)]
pub struct SuperProperties {
    pub os: String,
    pub browser: String,
    pub device: String,
    pub system_locale: String,
    pub browser_user_agent: String,
    pub browser_version: String,
    pub os_version: String,
    pub referrer: String,
    pub referring_domain: String,
    pub release_channel: String,
    pub client_build_number: u32,
    pub client_event_source: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ClientIdentity {
    pub properties: SuperProperties,
    pub locale: String,
}

impl ClientIdentity {
    /// `build_number` doit venir du client web courant (voir `rest::fetch_build_number`).
    pub fn new(build_number: u32, locale: &str) -> Self {
        let ua = format!(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{CHROME_VERSION} Safari/537.36"
        );
        Self {
            properties: SuperProperties {
                os: "Linux".into(),
                browser: "Chrome".into(),
                device: String::new(),
                system_locale: locale.into(),
                browser_user_agent: ua,
                browser_version: CHROME_VERSION.into(),
                os_version: String::new(),
                referrer: String::new(),
                referring_domain: String::new(),
                release_channel: "stable".into(),
                client_build_number: build_number,
                client_event_source: None,
            },
            locale: locale.into(),
        }
    }

    pub fn user_agent(&self) -> &str {
        &self.properties.browser_user_agent
    }

    /// Valeur de l'en-tête `X-Super-Properties` (JSON en base64 standard).
    pub fn super_properties_header(&self) -> String {
        let json = serde_json::to_vec(&self.properties).unwrap_or_default();
        base64::engine::general_purpose::STANDARD.encode(json)
    }

    /// En-têtes HTTP communs à toutes les requêtes REST (hors `Authorization`).
    pub fn http_headers(&self) -> Vec<(&'static str, String)> {
        vec![
            ("User-Agent", self.user_agent().to_owned()),
            ("X-Super-Properties", self.super_properties_header()),
            ("X-Discord-Locale", self.locale.clone()),
            ("X-Discord-Timezone", "Europe/Paris".into()),
            ("Origin", ORIGIN.into()),
            ("Referer", format!("{ORIGIN}/channels/@me")),
            ("Accept-Language", self.locale.clone()),
        ]
    }

    /// Objet `properties` du payload `identify` de la gateway.
    pub fn identify_properties(&self) -> serde_json::Value {
        serde_json::to_value(&self.properties).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn super_properties_round_trip() {
        let id = ClientIdentity::new(400_000, "fr");
        let raw = base64::engine::general_purpose::STANDARD
            .decode(id.super_properties_header())
            .unwrap();
        let v: serde_json::Value = serde_json::from_slice(&raw).unwrap();
        assert_eq!(v["os"], "Linux");
        assert_eq!(v["client_build_number"], 400_000);
    }
}
