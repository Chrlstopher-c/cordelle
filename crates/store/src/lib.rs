//! Domaine store : état en mémoire d'un compte et cache SQLite des messages.
//! Seul producteur des `EngineEvent` : chaque dispatch de la gateway passe par `Store::apply`.

mod cache;
pub mod convert;
mod error;
mod events;
mod message_events;
mod state;
mod unread;

use std::path::Path;

pub use contract::message::MessagePage;
use contract::{
    AccountId,
    events::EngineEvent,
    guild::{ChannelSummary, GuildSummary},
};
pub use error::StoreError;
use serde_json::Value;

use cache::MessageCache;
use state::State;

pub struct Store {
    account_id: AccountId,
    state: State,
    cache: MessageCache,
}

impl Store {
    /// Ouvre un store pour un compte. `None` = cache SQLite en mémoire (tests).
    pub fn open(account_id: AccountId, cache_path: Option<&Path>) -> Result<Store, StoreError> {
        Ok(Store {
            account_id,
            state: State::default(),
            cache: MessageCache::open(cache_path)?,
        })
    }

    /// Applique un dispatch de la gateway et renvoie les événements à pousser à l'interface.
    pub fn apply(&mut self, name: &str, data: &Value) -> Vec<EngineEvent> {
        match name {
            "READY" => self.on_ready(data),
            "GUILD_CREATE" | "GUILD_UPDATE" => self.on_guild_upsert(data),
            "GUILD_DELETE" => self.on_guild_delete(data),
            "CHANNEL_CREATE" | "CHANNEL_UPDATE" | "THREAD_CREATE" | "THREAD_UPDATE" => {
                self.on_channel_upsert(data)
            }
            "CHANNEL_DELETE" | "THREAD_DELETE" => self.on_channel_delete(data),
            "MESSAGE_CREATE" => self.on_message_create(data),
            "MESSAGE_UPDATE" => self.on_message_update(data),
            "MESSAGE_DELETE" => self.on_message_delete(data),
            "MESSAGE_DELETE_BULK" => self.on_message_delete_bulk(data),
            "MESSAGE_REACTION_ADD" => self.on_reaction(data, 1),
            "MESSAGE_REACTION_REMOVE" => self.on_reaction(data, -1),
            "MESSAGE_ACK" => self.on_ack(data),
            "TYPING_START" => self.on_typing(data),
            "PRESENCE_UPDATE" => self.on_presence(data),
            _ => {
                tracing::trace!(event = name, "événement ignoré");
                Vec::new()
            }
        }
    }

    /// Serveurs dans l'ordre de READY.
    pub fn guilds(&self) -> Vec<GuildSummary> {
        self.state.guild_summaries()
    }

    /// Salons d'un serveur : sans catégorie d'abord, puis chaque catégorie suivie de ses salons.
    /// Les fils sont exclus (ils ne figurent pas dans la barre latérale).
    pub fn channels(&self, guild_id: &str) -> Vec<ChannelSummary> {
        self.state.guild_channels(guild_id)
    }

    /// MP et groupes, du plus récent au plus ancien.
    pub fn dms(&self) -> Vec<ChannelSummary> {
        self.state.dm_views()
    }

    /// Page d'historique depuis le cache, du plus récent au plus ancien.
    pub fn messages(&self, channel_id: &str, before: Option<&str>, limit: usize) -> MessagePage {
        let (raw, has_more) = or_log(self.cache.page(channel_id, before, limit), "page");
        let messages = raw
            .iter()
            .filter_map(|value| {
                let message = convert::message(value);
                if message.is_none() {
                    tracing::warn!("message du cache illisible ignoré");
                }
                message
            })
            .collect();
        MessagePage { messages, has_more }
    }

    /// Stocke une page de messages venue de l'API REST (JSON Discord brut).
    pub fn cache_messages(&mut self, channel_id: &str, messages: &[Value]) {
        or_log(self.cache.put_many(channel_id, messages), "put_many");
    }
}

/// Journalise une erreur de cache et renvoie la valeur par défaut : la lecture reste utilisable.
fn or_log<T: Default>(result: Result<T, StoreError>, operation: &'static str) -> T {
    result.unwrap_or_else(|err| {
        tracing::error!(error = %err, operation, "erreur du cache messages");
        T::default()
    })
}
