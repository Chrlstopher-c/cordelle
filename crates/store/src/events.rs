//! Dispatches de structure : READY, serveurs, salons et fils, MP, frappe et présence.

use contract::{events::EngineEvent, guild::ChannelSummary, user::PresenceStatus};
use serde_json::Value;

use crate::Store;
use crate::convert::{self, str_field};

impl Store {
    pub(crate) fn on_ready(&mut self, data: &Value) -> Vec<EngineEvent> {
        if let Some(user) = data.get("user").and_then(convert::user) {
            self.state.me = Some(user.id);
        }
        for guild in convert::array(data, "guilds") {
            self.ingest_guild(guild);
        }
        for channel in convert::array(data, "private_channels") {
            self.ingest_channel(channel, None);
        }
        for entry in read_state_entries(data) {
            let Some(channel_id) = str_field(entry, "id") else {
                continue;
            };
            let mentions = entry
                .get("mention_count")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let mentions = u32::try_from(mentions).unwrap_or(u32::MAX);
            self.state
                .apply_read_state(channel_id, str_field(entry, "last_message_id"), mentions);
        }
        self.snapshot()
    }

    pub(crate) fn on_guild_upsert(&mut self, data: &Value) -> Vec<EngineEvent> {
        match self.ingest_guild(data) {
            Some(guild_id) => self.guild_events(&guild_id),
            None => Vec::new(),
        }
    }

    pub(crate) fn on_guild_delete(&mut self, data: &Value) -> Vec<EngineEvent> {
        let Some(guild_id) = str_field(data, "id") else {
            return Vec::new();
        };
        if data
            .get("unavailable")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            tracing::info!(guild_id, "serveur indisponible (panne) : conservé");
            return Vec::new();
        }
        self.state.remove_guild(guild_id);
        vec![EngineEvent::GuildRemove {
            account_id: self.account_id.clone(),
            guild_id: guild_id.to_string(),
        }]
    }

    pub(crate) fn on_channel_upsert(&mut self, data: &Value) -> Vec<EngineEvent> {
        let Some(channel_id) = self.ingest_channel(data, None) else {
            return Vec::new();
        };
        self.state
            .channel_view(&channel_id)
            .map(|c| self.channel_upsert(c))
            .into_iter()
            .collect()
    }

    pub(crate) fn on_channel_delete(&mut self, data: &Value) -> Vec<EngineEvent> {
        let Some(channel_id) = str_field(data, "id") else {
            return Vec::new();
        };
        self.state.remove_channel(channel_id);
        vec![EngineEvent::ChannelRemove {
            account_id: self.account_id.clone(),
            channel_id: channel_id.to_string(),
        }]
    }

    pub(crate) fn on_typing(&self, data: &Value) -> Vec<EngineEvent> {
        match (str_field(data, "channel_id"), str_field(data, "user_id")) {
            (Some(channel_id), Some(user_id)) => vec![EngineEvent::Typing {
                account_id: self.account_id.clone(),
                channel_id: channel_id.to_string(),
                user_id: user_id.to_string(),
            }],
            _ => Vec::new(),
        }
    }

    pub(crate) fn on_presence(&self, data: &Value) -> Vec<EngineEvent> {
        let user_id = data.pointer("/user/id").and_then(Value::as_str);
        let status = data
            .get("status")
            .and_then(Value::as_str)
            .and_then(presence_status);
        match (user_id, status) {
            (Some(user_id), Some(status)) => vec![EngineEvent::Presence {
                account_id: self.account_id.clone(),
                user_id: user_id.to_string(),
                status,
            }],
            _ => Vec::new(),
        }
    }

    /// Ingère une guilde (plate ou éclatée) et ses salons et fils. Renvoie son identifiant.
    fn ingest_guild(&mut self, data: &Value) -> Option<String> {
        let Some(info) = convert::guild(data) else {
            tracing::warn!("guilde sans nom ignorée");
            return None;
        };
        let guild_id = info.id.clone();
        self.state.upsert_guild(info);
        let channels = convert::array(data, "channels")
            .iter()
            .chain(convert::array(data, "threads"));
        for channel in channels {
            self.ingest_channel(channel, Some(&guild_id));
        }
        Some(guild_id)
    }

    /// Ingère un salon, un fil ou un MP. Renvoie son identifiant si le type est pris en charge.
    fn ingest_channel(&mut self, data: &Value, guild_id: Option<&str>) -> Option<String> {
        let Some(input) = convert::channel(data, guild_id) else {
            tracing::trace!("salon d'un type non pris en charge ignoré");
            return None;
        };
        let id = input.summary.id.clone();
        self.state.upsert_channel(input);
        Some(id)
    }

    /// Événements d'une guilde : sa fiche puis tous ses salons, fils compris.
    pub(crate) fn guild_events(&self, guild_id: &str) -> Vec<EngineEvent> {
        let mut events: Vec<EngineEvent> = self.guild_upsert(guild_id).into_iter().collect();
        let channels = self.state.all_views().into_iter();
        events.extend(
            channels
                .filter(|c| c.guild_id.as_deref() == Some(guild_id))
                .map(|c| self.channel_upsert(c)),
        );
        events
    }

    /// Photographie complète après READY : toutes les guildes, puis les MP.
    fn snapshot(&self) -> Vec<EngineEvent> {
        let mut events: Vec<EngineEvent> = self
            .state
            .guild_ids()
            .iter()
            .flat_map(|id| self.guild_events(id))
            .collect();
        let dms = self
            .state
            .all_views()
            .into_iter()
            .filter(|c| c.guild_id.is_none());
        events.extend(dms.map(|c| self.channel_upsert(c)));
        events
    }

    fn guild_upsert(&self, guild_id: &str) -> Option<EngineEvent> {
        self.state
            .guild_summaries()
            .into_iter()
            .find(|guild| guild.id == guild_id)
            .map(|guild| EngineEvent::GuildUpsert {
                account_id: self.account_id.clone(),
                guild,
            })
    }

    pub(crate) fn channel_upsert(&self, channel: ChannelSummary) -> EngineEvent {
        EngineEvent::ChannelUpsert {
            account_id: self.account_id.clone(),
            channel,
        }
    }
}

/// `read_state` : objet `{entries: [...]}` ou tableau direct.
fn read_state_entries(data: &Value) -> &[Value] {
    match data.get("read_state") {
        Some(Value::Array(list)) => list.as_slice(),
        Some(state) => convert::array(state, "entries"),
        None => &[],
    }
}

fn presence_status(text: &str) -> Option<PresenceStatus> {
    match text {
        "online" => Some(PresenceStatus::Online),
        "idle" => Some(PresenceStatus::Idle),
        "dnd" => Some(PresenceStatus::Dnd),
        "invisible" => Some(PresenceStatus::Invisible),
        "offline" => Some(PresenceStatus::Offline),
        _ => None,
    }
}
