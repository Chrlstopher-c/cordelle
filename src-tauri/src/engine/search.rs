//! Recherche, messages épinglés et fils (API Discord v9) : appels REST du compte connecté.

use std::time::Duration;

use contract::{
    AccountId, EngineError, Snowflake,
    message::Message,
    search::{SearchHas, SearchPage, SearchQuery, ThreadSummary},
};
use serde_json::{Value, json};

use super::{Engine, internal};

/// Tentatives quand Discord répond 202 : son index de recherche se construit encore.
const INDEX_ATTEMPTS: u8 = 3;
/// Attente maximale entre deux tentatives, même si Discord annonce plus.
const INDEX_WAIT_MAX_SECS: f64 = 10.0;
const THREAD_PAGE_SIZE: u8 = 25;
/// Type de fil public (salon texte, sans message de départ).
const PUBLIC_THREAD: u8 = 11;

impl Engine {
    /// Recherche dans un serveur (`guild_id`) ou dans un salon / MP (`channel_id`).
    pub async fn messages_search(
        &self,
        account_id: &AccountId,
        guild_id: Option<&Snowflake>,
        channel_id: Option<&Snowflake>,
        query: &SearchQuery,
    ) -> Result<SearchPage, EngineError> {
        let scope = search_scope(guild_id, channel_id)?;
        let session = self.session(account_id)?;
        let path = format!("{scope}/messages/search?{}", search_params(query));
        for _ in 0..INDEX_ATTEMPTS {
            let value: Value = session.rest.get_json(&path).await?;
            if value.get("messages").is_some() {
                return Ok(search_page(&value));
            }
            let wait = value
                .get("retry_after")
                .and_then(Value::as_f64)
                .unwrap_or(1.0);
            tracing::info!(
                wait_secs = wait,
                "index de recherche en cours de construction"
            );
            tokio::time::sleep(Duration::from_secs_f64(
                wait.clamp(0.0, INDEX_WAIT_MAX_SECS),
            ))
            .await;
        }
        Err(internal(
            "index de recherche indisponible, réessaie plus tard",
        ))
    }

    pub async fn pins_list(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
    ) -> Result<Vec<Message>, EngineError> {
        let session = self.session(account_id)?;
        let items: Vec<Value> = session
            .rest
            .get_json(&format!("/channels/{channel_id}/pins"))
            .await?;
        Ok(items.iter().filter_map(store::convert::message).collect())
    }

    pub async fn threads_list(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        archived: bool,
    ) -> Result<Vec<ThreadSummary>, EngineError> {
        let session = self.session(account_id)?;
        let path = format!(
            "/channels/{channel_id}/threads/search?archived={archived}&sort_by=last_message_time&sort_order=desc&limit={THREAD_PAGE_SIZE}"
        );
        let page: Value = session.rest.get_json(&path).await?;
        Ok(page
            .get("threads")
            .and_then(Value::as_array)
            .map(|threads| threads.iter().filter_map(thread_summary).collect())
            .unwrap_or_default())
    }

    /// Crée un fil. Avec `content` : publication d'un forum (le premier message est obligatoire).
    /// Sans : fil public d'un salon texte.
    pub async fn thread_create(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        name: &str,
        content: Option<&str>,
    ) -> Result<ThreadSummary, EngineError> {
        let session = self.session(account_id)?;
        let body = match content {
            Some(text) => json!({ "name": name, "message": { "content": text } }),
            None => json!({ "name": name, "type": PUBLIC_THREAD }),
        };
        let created: Value = session
            .rest
            .post_json(&format!("/channels/{channel_id}/threads"), &body)
            .await?;
        thread_summary(&created).ok_or_else(|| internal("réponse de création de fil illisible"))
    }
}

fn search_scope(
    guild_id: Option<&Snowflake>,
    channel_id: Option<&Snowflake>,
) -> Result<String, EngineError> {
    match (guild_id, channel_id) {
        (Some(guild), _) => Ok(format!("/guilds/{guild}")),
        (None, Some(channel)) => Ok(format!("/channels/{channel}")),
        (None, None) => Err(internal("recherche sans serveur ni salon")),
    }
}

fn search_params(query: &SearchQuery) -> String {
    let mut parts = vec![
        format!("content={}", percent_encode(&query.content)),
        format!("offset={}", query.offset),
    ];
    if let Some(author) = &query.author_id {
        parts.push(format!("author_id={author}"));
    }
    parts.extend(
        query
            .has
            .iter()
            .map(|has| format!("has={}", has_name(*has))),
    );
    parts.join("&")
}

fn has_name(has: SearchHas) -> &'static str {
    match has {
        SearchHas::Link => "link",
        SearchHas::Embed => "embed",
        SearchHas::File => "file",
        SearchHas::Video => "video",
        SearchHas::Image => "image",
        SearchHas::Sound => "sound",
        SearchHas::Sticker => "sticker",
    }
}

/// Encode une valeur de paramètre d'URL (tout sauf les caractères non réservés).
fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Réponse 200 : chaque résultat est un groupe de messages dont on garde le premier.
fn search_page(value: &Value) -> SearchPage {
    let messages = value
        .get("messages")
        .and_then(Value::as_array)
        .map(|groups| {
            groups
                .iter()
                .filter_map(|group| group.as_array()?.first())
                .filter_map(store::convert::message)
                .collect()
        })
        .unwrap_or_default();
    SearchPage {
        total: count(value, "total_results"),
        messages,
    }
}

fn thread_summary(value: &Value) -> Option<ThreadSummary> {
    Some(ThreadSummary {
        id: text(value, "id")?,
        name: text(value, "name").unwrap_or_default(),
        message_count: count(value, "message_count"),
        member_count: count(value, "member_count"),
        last_message_id: text(value, "last_message_id"),
        archived: value
            .pointer("/thread_metadata/archived")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        owner_id: text(value, "owner_id"),
    })
}

fn text(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::to_owned)
}

fn count(value: &Value, key: &str) -> u32 {
    value
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|n| u32::try_from(n).ok())
        .unwrap_or(0)
}
