//! Dispatches de messages : création, édition, suppression, réactions et accusés de lecture.

use contract::events::EngineEvent;
use serde_json::Value;

use crate::convert::{self, str_field};
use crate::{Store, or_log};

impl Store {
    pub(crate) fn on_message_create(&mut self, data: &Value) -> Vec<EngineEvent> {
        let Some(message) = convert::message(data) else {
            tracing::warn!("MESSAGE_CREATE invalide ignoré");
            return Vec::new();
        };
        let channel_id = message.channel_id.clone();
        self.cache_raw(&channel_id, std::slice::from_ref(data));
        let by_me = self.is_me(&message.author.id);
        let mentions_me = self.mentions_me(data);
        self.state
            .note_message(&channel_id, &message.id, by_me, mentions_me);
        let nonce = data.get("nonce").and_then(nonce_text);
        let mut events = vec![EngineEvent::MessageCreate {
            account_id: self.account_id.clone(),
            message,
            nonce,
        }];
        events.extend(self.unread_event(&channel_id));
        events
    }

    /// Édition partielle : seuls les champs présents remplacent ceux du message en cache.
    pub(crate) fn on_message_update(&mut self, patch: &Value) -> Vec<EngineEvent> {
        let (Some(channel_id), Some(id)) = (str_field(patch, "channel_id"), str_field(patch, "id"))
        else {
            return Vec::new();
        };
        let Some(mut merged) = or_log(self.cache.get(channel_id, id), "get") else {
            tracing::trace!("édition d'un message absent du cache ignorée");
            return Vec::new();
        };
        convert::merge_patch(&mut merged, patch);
        self.cache_raw(channel_id, std::slice::from_ref(&merged));
        self.message_update(&merged)
    }

    pub(crate) fn on_message_delete(&mut self, data: &Value) -> Vec<EngineEvent> {
        match (str_field(data, "channel_id"), str_field(data, "id")) {
            (Some(channel_id), Some(id)) => vec![self.remove_message(channel_id, id)],
            _ => Vec::new(),
        }
    }

    pub(crate) fn on_message_delete_bulk(&mut self, data: &Value) -> Vec<EngineEvent> {
        let Some(channel_id) = str_field(data, "channel_id") else {
            return Vec::new();
        };
        let ids: Vec<&str> = convert::array(data, "ids")
            .iter()
            .filter_map(Value::as_str)
            .collect();
        ids.into_iter()
            .map(|id| self.remove_message(channel_id, id))
            .collect()
    }

    /// Ajout (`delta` = 1) ou retrait (`delta` = -1) d'une réaction sur un message du cache.
    pub(crate) fn on_reaction(&mut self, data: &Value, delta: i64) -> Vec<EngineEvent> {
        let (Some(channel_id), Some(message_id), Some(emoji)) = (
            str_field(data, "channel_id"),
            str_field(data, "message_id"),
            data.get("emoji"),
        ) else {
            return Vec::new();
        };
        let by_me = str_field(data, "user_id").is_some_and(|user| self.is_me(user));
        let Some(mut message) = or_log(self.cache.get(channel_id, message_id), "get") else {
            return Vec::new();
        };
        convert::bump_reaction(&mut message, emoji, by_me, delta);
        self.cache_raw(channel_id, std::slice::from_ref(&message));
        self.message_update(&message)
    }

    pub(crate) fn on_ack(&mut self, data: &Value) -> Vec<EngineEvent> {
        let (Some(channel_id), Some(message_id)) =
            (str_field(data, "channel_id"), str_field(data, "message_id"))
        else {
            return Vec::new();
        };
        self.state.mark_read(channel_id, message_id);
        self.unread_event(channel_id).into_iter().collect()
    }

    fn remove_message(&self, channel_id: &str, id: &str) -> EngineEvent {
        or_log(self.cache.delete(channel_id, id), "delete");
        EngineEvent::MessageDelete {
            account_id: self.account_id.clone(),
            channel_id: channel_id.to_string(),
            message_id: id.to_string(),
        }
    }

    fn message_update(&self, raw: &Value) -> Vec<EngineEvent> {
        convert::message(raw)
            .map(|message| EngineEvent::MessageUpdate {
                account_id: self.account_id.clone(),
                message,
            })
            .into_iter()
            .collect()
    }

    fn unread_event(&self, channel_id: &str) -> Option<EngineEvent> {
        self.state
            .channel_view(channel_id)
            .map(|channel| EngineEvent::Unread {
                account_id: self.account_id.clone(),
                channel_id: channel.id,
                unread: channel.unread,
                mention_count: channel.mention_count,
            })
    }

    fn cache_raw(&mut self, channel_id: &str, raw: &[Value]) {
        or_log(self.cache.put_many(channel_id, raw), "put_many");
    }

    fn is_me(&self, user_id: &str) -> bool {
        self.state.me.as_deref() == Some(user_id)
    }

    fn mentions_me(&self, data: &Value) -> bool {
        self.state.me.as_deref().is_some_and(|me| {
            convert::array(data, "mentions")
                .iter()
                .any(|user| str_field(user, "id") == Some(me))
        })
    }
}

/// Nonce envoyé par le client : chaîne ou nombre selon l'API.
fn nonce_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}
