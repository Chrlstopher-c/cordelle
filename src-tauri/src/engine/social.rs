//! Amis (relations) et mentions récentes : `/users/@me/relationships`, `/users/@me/mentions`.

use contract::{
    AccountId, EngineError, Snowflake,
    social::{Mention, Relationship, RelationshipAction, RelationshipKind},
};
use serde_json::{Value, json};

use super::{Engine, internal};

fn kind(code: u64) -> Option<RelationshipKind> {
    match code {
        1 => Some(RelationshipKind::Friend),
        2 => Some(RelationshipKind::Blocked),
        3 => Some(RelationshipKind::Incoming),
        4 => Some(RelationshipKind::Outgoing),
        _ => None,
    }
}

impl Engine {
    pub async fn relationships(
        &self,
        account_id: &AccountId,
    ) -> Result<Vec<Relationship>, EngineError> {
        let session = self.session(account_id)?;
        let raw: Vec<Value> = session.rest.get_json("/users/@me/relationships").await?;
        Ok(raw
            .iter()
            .filter_map(|r| {
                Some(Relationship {
                    user: store::convert::user(r.get("user")?)?,
                    kind: kind(r.get("type")?.as_u64()?)?,
                    nickname: r.get("nickname").and_then(Value::as_str).map(str::to_owned),
                })
            })
            .collect())
    }

    pub async fn relationship_set(
        &self,
        account_id: &AccountId,
        user_id: &Snowflake,
        action: RelationshipAction,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let path = format!("/users/@me/relationships/{user_id}");
        match action {
            RelationshipAction::Accept => session.rest.put(&path, &json!({})).await?,
            RelationshipAction::Block => session.rest.put(&path, &json!({ "type": 2 })).await?,
            RelationshipAction::Remove => session.rest.delete(&path).await?,
        }
        Ok(())
    }

    /// Demande d'ami par nom d'utilisateur (sans discriminant).
    pub async fn friend_request(
        &self,
        account_id: &AccountId,
        username: &str,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let body = json!({ "username": username.trim(), "discriminator": Value::Null });
        let _: Value = session
            .rest
            .post_json("/users/@me/relationships", &body)
            .await
            .or_else(|e| match e {
                rest::RestError::Decode(_) => Ok(Value::Null),
                other => Err(other),
            })?;
        Ok(())
    }

    pub async fn mentions(&self, account_id: &AccountId) -> Result<Vec<Mention>, EngineError> {
        let session = self.session(account_id)?;
        let raw: Vec<Value> = session
            .rest
            .get_json("/users/@me/mentions?limit=50&roles=true&everyone=true")
            .await?;
        raw.iter()
            .map(|m| {
                Ok(Mention {
                    message: store::convert::message(m)
                        .ok_or_else(|| internal("mention illisible"))?,
                    guild_id: m.get("guild_id").and_then(Value::as_str).map(str::to_owned),
                })
            })
            .collect()
    }
}

impl Engine {
    /// Marque un salon comme lu jusqu'au message donné.
    pub async fn ack_channel(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        message_id: &Snowflake,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let path = format!("/channels/{channel_id}/messages/{message_id}/ack");
        let _: Value = session
            .rest
            .post_json(&path, &json!({ "token": Value::Null }))
            .await?;
        Ok(())
    }

    pub async fn ack_guild(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        session
            .rest
            .post(&format!("/guilds/{guild_id}/ack"), &json!({}))
            .await?;
        Ok(())
    }

    pub async fn pin(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        message_id: &Snowflake,
        pinned: bool,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        let path = format!("/channels/{channel_id}/pins/{message_id}");
        if pinned {
            session.rest.put(&path, &json!({})).await?;
        } else {
            session.rest.delete(&path).await?;
        }
        Ok(())
    }

    pub async fn leave_guild(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        session
            .rest
            .delete(&format!("/users/@me/guilds/{guild_id}"))
            .await?;
        Ok(())
    }

    /// Ferme un MP (ou quitte un groupe).
    pub async fn close_dm(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        session
            .rest
            .delete(&format!("/channels/{channel_id}"))
            .await?;
        Ok(())
    }
}
