//! Lectures et envois : serveurs, salons, MP, messages (cache d'abord, API ensuite).

use contract::{
    AccountId, EngineError, Snowflake,
    guild::{ChannelSummary, GuildSummary},
    message::{Message, MessagePage, OutgoingMessage},
};
use serde_json::{Value, json};

use super::{Engine, internal};

impl Engine {
    pub fn guilds(&self, account_id: &AccountId) -> Result<Vec<GuildSummary>, EngineError> {
        self.with_store(account_id, |s| s.guilds())
    }

    pub fn channels(
        &self,
        account_id: &AccountId,
        guild_id: &str,
    ) -> Result<Vec<ChannelSummary>, EngineError> {
        self.with_store(account_id, |s| s.channels(guild_id))
    }

    pub fn dms(&self, account_id: &AccountId) -> Result<Vec<ChannelSummary>, EngineError> {
        self.with_store(account_id, |s| s.dms())
    }

    /// Le cache répond d'abord ; l'API complète au premier passage dans un salon ou quand le cache est court.
    pub async fn messages(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        before: Option<Snowflake>,
        limit: u8,
    ) -> Result<MessagePage, EngineError> {
        let session = self.session(account_id)?;
        let limit = limit.clamp(1, 100);
        let cached = self.with_store(account_id, |s| {
            s.messages(channel_id, before.as_deref(), limit.into())
        })?;
        let first_visit =
            before.is_none() && !session.fetched.lock().is_ok_and(|f| f.contains(channel_id));
        if !first_visit && cached.messages.len() >= usize::from(limit) {
            return Ok(cached);
        }
        let mut path = format!("/channels/{channel_id}/messages?limit={limit}");
        if let Some(before) = &before {
            path.push_str(&format!("&before={before}"));
        }
        let page: Vec<Value> = session.rest.get_json(&path).await?;
        if let Ok(mut fetched) = session.fetched.lock() {
            fetched.insert(channel_id.clone());
        }
        self.with_store(account_id, |s| {
            s.cache_messages(channel_id, &page);
            let mut out = s.messages(channel_id, before.as_deref(), limit.into());
            out.has_more = page.len() >= usize::from(limit);
            out
        })
    }

    pub async fn send(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        message: &OutgoingMessage,
    ) -> Result<Message, EngineError> {
        let session = self.session(account_id)?;
        let mut body =
            json!({"content": message.content, "nonce": message.nonce, "tts": false, "flags": 0});
        if let Some(reply) = &message.reply_to {
            body["message_reference"] = json!({"channel_id": channel_id, "message_id": reply});
        }
        let sent: Value = session
            .rest
            .post_json(&format!("/channels/{channel_id}/messages"), &body)
            .await?;
        store::convert::message(&sent).ok_or_else(|| internal("réponse d'envoi illisible"))
    }

    fn with_store<T>(
        &self,
        account_id: &AccountId,
        read: impl FnOnce(&mut store::Store) -> T,
    ) -> Result<T, EngineError> {
        let session = self.session(account_id)?;
        let mut store = session
            .store
            .lock()
            .map_err(|_| internal("store verrouillé"))?;
        Ok(read(&mut store))
    }
}

/// Emoji pour l'URL des réactions : unicode encodé, ou `nom:id` pour un emoji personnalisé.
fn emoji_path(emoji: &str) -> String {
    emoji
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b':' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

impl Engine {
    pub async fn edit(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        message_id: &Snowflake,
        content: &str,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let _: Value = session
            .rest
            .patch_json(
                &format!("/channels/{channel_id}/messages/{message_id}"),
                &json!({ "content": content }),
            )
            .await?;
        Ok(())
    }

    pub async fn delete(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        message_id: &Snowflake,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        session
            .rest
            .delete(&format!("/channels/{channel_id}/messages/{message_id}"))
            .await?;
        Ok(())
    }

    pub async fn react(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        message_id: &Snowflake,
        emoji: &str,
        add: bool,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let path = format!(
            "/channels/{channel_id}/messages/{message_id}/reactions/{}/@me?location=Message&type=0",
            emoji_path(emoji)
        );
        if add {
            session.rest.put(&path, &json!({})).await?;
        } else {
            session.rest.delete(&path).await?;
        }
        Ok(())
    }
}
