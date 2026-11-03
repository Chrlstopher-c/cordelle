//! Accueil des serveurs : invitations, création, événements programmés, découverte publique.

use contract::{
    AccountId, EngineError, Snowflake,
    home::{DiscoverableGuild, InvitePreview, ScheduledEvent},
};
use serde_json::{Value, json};

use super::{Engine, internal};

/// Taille d'une page de la découverte.
pub const DISCOVERY_PAGE: u32 = 24;

impl Engine {
    /// Aperçu d'une invitation (nom, icône, effectifs, salon). `code` sans préfixe.
    pub async fn invite_resolve(
        &self,
        account_id: &AccountId,
        code: &str,
    ) -> Result<InvitePreview, EngineError> {
        valid_code(code)?;
        let session = self.session(account_id)?;
        let raw: Value = session
            .rest
            .get_json(&format!("/invites/{code}?with_counts=true"))
            .await?;
        invite_preview(&raw, code).ok_or_else(|| internal("invitation illisible"))
    }

    /// Accepte une invitation ; renvoie l'id du serveur rejoint.
    pub async fn invite_accept(
        &self,
        account_id: &AccountId,
        code: &str,
    ) -> Result<Snowflake, EngineError> {
        valid_code(code)?;
        let session = self.session(account_id)?;
        let raw: Value = session
            .rest
            .post_json(&format!("/invites/{code}"), &json!({}))
            .await?;
        str_field(raw.get("guild").unwrap_or(&Value::Null), "id")
            .ok_or_else(|| internal("adhésion illisible"))
    }

    /// Crée un serveur vide ; renvoie son id.
    pub async fn guild_create(
        &self,
        account_id: &AccountId,
        name: &str,
    ) -> Result<Snowflake, EngineError> {
        let session = self.session(account_id)?;
        let raw: Value = session
            .rest
            .post_json("/guilds", &json!({ "name": name.trim() }))
            .await?;
        str_field(&raw, "id").ok_or_else(|| internal("création illisible"))
    }

    /// Événements à venir ou en cours d'un serveur, par date de début.
    pub async fn scheduled_events(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<ScheduledEvent>, EngineError> {
        let session = self.session(account_id)?;
        let raw: Vec<Value> = session
            .rest
            .get_json(&format!(
                "/guilds/{guild_id}/scheduled-events?with_user_count=true"
            ))
            .await?;
        let mut events: Vec<ScheduledEvent> = raw.iter().filter_map(scheduled_event).collect();
        events.sort_by(|a, b| a.start.cmp(&b.start));
        Ok(events)
    }

    /// Serveurs publics, filtrés par `query` (vide = tous). Un échec de l'endpoint donne une liste vide.
    pub async fn discoverable_guilds(
        &self,
        account_id: &AccountId,
        query: &str,
        offset: u32,
    ) -> Result<Vec<DiscoverableGuild>, EngineError> {
        let session = self.session(account_id)?;
        let path = format!(
            "/discovery/search?query={}&limit={DISCOVERY_PAGE}&offset={offset}",
            percent_encode(query.trim())
        );
        match session.rest.get_json::<Value>(&path).await {
            Ok(raw) => Ok(discoverable_list(&raw)),
            Err(e) => {
                tracing::warn!("découverte des serveurs indisponible : {e}");
                Ok(Vec::new())
            }
        }
    }
}

/// Un code d'invitation ne contient que des lettres, chiffres, `-` et `_` : il part dans un chemin d'URL.
fn valid_code(code: &str) -> Result<(), EngineError> {
    let ok = !code.is_empty()
        && code
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(())
    } else {
        Err(internal("code d'invitation invalide"))
    }
}

fn str_field(v: &Value, key: &str) -> Option<String> {
    v.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

fn count(v: &Value, key: &str) -> u32 {
    v.get(key)
        .and_then(Value::as_u64)
        .and_then(|n| u32::try_from(n).ok())
        .unwrap_or(0)
}

/// Icône de serveur (CDN Discord) à partir de son hachage.
fn guild_icon(guild_id: &str, hash: Option<&str>) -> Option<String> {
    hash.map(|h| format!("https://cdn.discordapp.com/icons/{guild_id}/{h}.png"))
}

fn invite_preview(raw: &Value, code: &str) -> Option<InvitePreview> {
    let guild = raw.get("guild")?;
    let guild_id = str_field(guild, "id")?;
    Some(InvitePreview {
        code: code.to_owned(),
        icon_url: guild_icon(&guild_id, guild.get("icon").and_then(Value::as_str)),
        guild_name: str_field(guild, "name")?,
        member_count: count(raw, "approximate_member_count"),
        online_count: count(raw, "approximate_presence_count"),
        channel_name: raw.get("channel").and_then(|c| str_field(c, "name")),
        guild_id,
    })
}

/// Statut 1 = prévu, 2 = en cours, 3 = terminé, 4 = annulé : seuls les deux premiers sont listés.
fn scheduled_event(raw: &Value) -> Option<ScheduledEvent> {
    let status = raw.get("status")?.as_u64()?;
    if status != 1 && status != 2 {
        return None;
    }
    Some(ScheduledEvent {
        id: str_field(raw, "id")?,
        name: str_field(raw, "name")?,
        description: str_field(raw, "description"),
        start: str_field(raw, "scheduled_start_time")?,
        end: str_field(raw, "scheduled_end_time"),
        channel_id: str_field(raw, "channel_id"),
        location: raw
            .get("entity_metadata")
            .and_then(|m| str_field(m, "location")),
        interested: count(raw, "user_count"),
        live: status == 2,
    })
}

fn discoverable_list(raw: &Value) -> Vec<DiscoverableGuild> {
    let items = raw
        .get("guilds")
        .and_then(Value::as_array)
        .or_else(|| raw.as_array());
    items
        .map(|list| list.iter().filter_map(discoverable).collect())
        .unwrap_or_default()
}

fn discoverable(raw: &Value) -> Option<DiscoverableGuild> {
    let id = str_field(raw, "id")?;
    Some(DiscoverableGuild {
        icon_url: guild_icon(&id, raw.get("icon").and_then(Value::as_str)),
        name: str_field(raw, "name")?,
        description: str_field(raw, "description"),
        member_count: count(raw, "approximate_member_count"),
        online_count: count(raw, "approximate_presence_count"),
        id,
    })
}

/// Encodage pour un paramètre de requête (RFC 3986, espaces en `%20`).
fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                char::from(b).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}
