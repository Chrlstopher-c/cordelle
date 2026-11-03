//! Numéro de build du client web Discord, lu dans ses scripts publics.

use std::sync::LazyLock;

use regex::Regex;

use crate::error::{RestError, network_error};

const APP_URL: &str = "https://discord.com/app";
const ORIGIN: &str = "https://discord.com";

static SCRIPT_RE: LazyLock<Regex> = LazyLock::new(|| compile(r"/assets/[A-Za-z0-9._/-]+\.js"));
static BUILD_RES: LazyLock<[Regex; 2]> = LazyLock::new(|| {
    [
        compile(r#"buildNumber:"(\d+)""#),
        compile(r#"build_number:"(\d+)""#),
    ]
});

fn compile(pattern: &str) -> Regex {
    Regex::new(pattern).expect("expression régulière statique invalide")
}

/// Chemins `/assets/*.js` référencés par la page, sans doublon, dans l'ordre d'apparition.
pub fn script_paths(html: &str) -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();
    for found in SCRIPT_RE.find_iter(html) {
        if !paths.iter().any(|known| known == found.as_str()) {
            paths.push(found.as_str().to_owned());
        }
    }
    paths
}

/// Premier numéro de build trouvé dans un texte (`buildNumber:"…"` puis `build_number:"…"`).
pub fn extract_build_number(text: &str) -> Option<u32> {
    BUILD_RES
        .iter()
        .find_map(|re| re.captures(text))
        .and_then(|caps| caps[1].parse::<u32>().ok())
}

/// Lit la page d'application, puis cherche le build dans ses scripts, du dernier au premier.
pub async fn fetch_build_number(http: &reqwest::Client) -> Result<u32, RestError> {
    let html = fetch_text(http, APP_URL).await?;
    let paths = script_paths(&html);
    for path in paths.iter().rev() {
        let script = fetch_text(http, &format!("{ORIGIN}{path}")).await?;
        if let Some(build) = extract_build_number(&script) {
            return Ok(build);
        }
    }
    Err(RestError::Decode(
        "numéro de build introuvable dans les scripts Discord".to_owned(),
    ))
}

async fn fetch_text(http: &reqwest::Client, url: &str) -> Result<String, RestError> {
    let response = http.get(url).send().await.map_err(network_error)?;
    let status = response.status();
    if !status.is_success() {
        return Err(RestError::Http {
            status: status.as_u16(),
            code: 0,
            message: format!("GET {url}"),
        });
    }
    response.text().await.map_err(network_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCRIPT_WITH_BUILD: &str = r#"var e={buildNumber:"345678",releaseChannel:"stable"};"#;
    const SCRIPT_SNAKE: &str = r#"window.GLOBAL_ENV={build_number:"123456",api:"x"};"#;

    #[test]
    fn extrait_build_number_camel_case() {
        assert_eq!(extract_build_number(SCRIPT_WITH_BUILD), Some(345_678));
    }

    #[test]
    fn extrait_build_number_snake_case() {
        assert_eq!(extract_build_number(SCRIPT_SNAKE), Some(123_456));
    }

    #[test]
    fn aucun_build_number_donne_none() {
        assert_eq!(extract_build_number("function(){return 42}"), None);
    }

    #[test]
    fn liste_les_scripts_sans_doublon() {
        let html = r#"<script src="/assets/abc123.js" defer></script>
            <script src="/assets/def-456.js"></script><script src="/assets/abc123.js"></script>"#;
        assert_eq!(
            script_paths(html),
            vec!["/assets/abc123.js", "/assets/def-456.js"]
        );
    }
}
