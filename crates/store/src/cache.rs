//! Cache SQLite des messages : JSON Discord brut par (salon, message), ordre numérique sur l'identifiant.

use std::path::Path;

use rusqlite::{Connection, OptionalExtension, params};
use serde_json::Value;

use crate::error::StoreError;

const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS messages (
    channel_id INTEGER NOT NULL,
    id INTEGER NOT NULL,
    json TEXT NOT NULL,
    PRIMARY KEY (channel_id, id)
)";

pub(crate) struct MessageCache {
    conn: Connection,
}

impl MessageCache {
    pub(crate) fn open(path: Option<&Path>) -> Result<Self, StoreError> {
        let conn = match path {
            Some(path) => Connection::open(path)?,
            None => Connection::open_in_memory()?,
        };
        conn.execute(SCHEMA, [])?;
        Ok(Self { conn })
    }

    /// Insère ou remplace les messages d'un salon dans une seule transaction.
    pub(crate) fn put_many(
        &mut self,
        channel_id: &str,
        messages: &[Value],
    ) -> Result<(), StoreError> {
        let channel = snowflake_key(channel_id)?;
        let tx = self.conn.transaction()?;
        for message in messages {
            let Some(id) = message.get("id").and_then(Value::as_str) else {
                tracing::warn!("message sans identifiant ignoré dans le cache");
                continue;
            };
            tx.execute(
                "INSERT OR REPLACE INTO messages (channel_id, id, json) VALUES (?1, ?2, ?3)",
                params![channel, snowflake_key(id)?, message.to_string()],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub(crate) fn get(&self, channel_id: &str, id: &str) -> Result<Option<Value>, StoreError> {
        let raw: Option<String> = self
            .conn
            .query_row(
                "SELECT json FROM messages WHERE channel_id = ?1 AND id = ?2",
                params![snowflake_key(channel_id)?, snowflake_key(id)?],
                |row| row.get(0),
            )
            .optional()?;
        raw.map(|text| serde_json::from_str(&text))
            .transpose()
            .map_err(StoreError::from)
    }

    pub(crate) fn delete(&self, channel_id: &str, id: &str) -> Result<(), StoreError> {
        self.conn.execute(
            "DELETE FROM messages WHERE channel_id = ?1 AND id = ?2",
            params![snowflake_key(channel_id)?, snowflake_key(id)?],
        )?;
        Ok(())
    }

    /// Jusqu'à `limit` messages plus anciens que `before`, du plus récent au plus ancien.
    /// Renvoie aussi `true` si des messages plus anciens existent encore.
    pub(crate) fn page(
        &self,
        channel_id: &str,
        before: Option<&str>,
        limit: usize,
    ) -> Result<(Vec<Value>, bool), StoreError> {
        let before = before.map(snowflake_key).transpose()?.unwrap_or(i64::MAX);
        let fetch = i64::try_from(limit.saturating_add(1)).unwrap_or(i64::MAX);
        let mut statement = self.conn.prepare_cached(
            "SELECT json FROM messages WHERE channel_id = ?1 AND id < ?2 ORDER BY id DESC LIMIT ?3",
        )?;
        let rows = statement
            .query_map(params![snowflake_key(channel_id)?, before, fetch], |row| {
                row.get::<_, String>(0)
            })?
            .collect::<Result<Vec<String>, rusqlite::Error>>()?;
        let mut values = rows
            .iter()
            .map(|text| serde_json::from_str::<Value>(text))
            .collect::<Result<Vec<Value>, serde_json::Error>>()?;
        let has_more = values.len() > limit;
        values.truncate(limit);
        Ok((values, has_more))
    }
}

/// Snowflake → entier signé pour SQLite (ordre numérique correct, valeurs < 2^63).
fn snowflake_key(id: &str) -> Result<i64, StoreError> {
    id.parse::<u64>()
        .ok()
        .and_then(|n| i64::try_from(n).ok())
        .ok_or_else(|| StoreError::InvalidId(id.to_string()))
}
