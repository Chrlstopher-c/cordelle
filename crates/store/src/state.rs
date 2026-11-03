//! État en mémoire d'un compte : serveurs, salons (fils et MP compris), lectures, identité.
//! `unread` et `mention_count` ne sont pas stockés : ils se calculent à la lecture.

use std::cmp::Reverse;
use std::collections::HashMap;

use contract::{
    Snowflake,
    guild::{ChannelKind, ChannelSummary, GuildSummary},
};

use crate::convert::{ChannelInput, GuildInfo};
use crate::unread;

#[derive(Default)]
pub(crate) struct State {
    pub(crate) me: Option<Snowflake>,
    guilds: Vec<GuildEntry>,
    channels: HashMap<Snowflake, ChannelEntry>,
}

struct GuildEntry {
    id: Snowflake,
    name: String,
    icon_url: Option<String>,
}

struct ChannelEntry {
    summary: ChannelSummary,
    last_message_id: Option<Snowflake>,
    last_read_id: Option<Snowflake>,
    mention_count: u32,
}

impl ChannelEntry {
    fn is_unread(&self) -> bool {
        unread::is_unread(
            self.last_message_id.as_deref(),
            self.last_read_id.as_deref(),
        )
    }

    fn view(&self) -> ChannelSummary {
        let mut summary = self.summary.clone();
        summary.unread = self.is_unread();
        summary.mention_count = self.mention_count;
        summary.last_message_id = self.last_message_id.clone();
        summary.last_read_id = self.last_read_id.clone();
        summary
    }
}

fn is_category(entry: &ChannelEntry) -> bool {
    entry.summary.kind == ChannelKind::Category
}

fn sort_key(entry: &ChannelEntry) -> (i32, u64) {
    (
        entry.summary.position,
        unread::snowflake_value(&entry.summary.id),
    )
}

fn parent_is(entry: &ChannelEntry, parent_id: &str) -> bool {
    entry.summary.parent_id.as_deref() == Some(parent_id)
}

fn in_any_category(entry: &ChannelEntry, category_ids: &[&str]) -> bool {
    entry
        .summary
        .parent_id
        .as_deref()
        .is_some_and(|parent| category_ids.contains(&parent))
}

fn sorted_views(mut entries: Vec<&ChannelEntry>) -> Vec<ChannelSummary> {
    entries.sort_by_key(|c| sort_key(c));
    entries.into_iter().map(ChannelEntry::view).collect()
}

impl State {
    pub(crate) fn upsert_guild(&mut self, info: GuildInfo) {
        let GuildInfo { id, name, icon_url } = info;
        match self.guilds.iter_mut().find(|guild| guild.id == id) {
            Some(guild) => {
                guild.name = name;
                guild.icon_url = icon_url;
            }
            None => self.guilds.push(GuildEntry { id, name, icon_url }),
        }
    }

    pub(crate) fn remove_guild(&mut self, guild_id: &str) {
        self.guilds.retain(|guild| guild.id != guild_id);
        self.channels
            .retain(|_, channel| channel.summary.guild_id.as_deref() != Some(guild_id));
    }

    pub(crate) fn guild_ids(&self) -> Vec<Snowflake> {
        self.guilds.iter().map(|guild| guild.id.clone()).collect()
    }

    pub(crate) fn guild_summaries(&self) -> Vec<GuildSummary> {
        self.guilds
            .iter()
            .enumerate()
            .map(|(position, guild)| self.summarize(position, guild))
            .collect()
    }

    fn summarize(&self, position: usize, guild: &GuildEntry) -> GuildSummary {
        let channels: Vec<&ChannelEntry> = self
            .channels
            .values()
            .filter(|channel| channel.summary.guild_id.as_deref() == Some(guild.id.as_str()))
            .collect();
        GuildSummary {
            id: guild.id.clone(),
            name: guild.name.clone(),
            icon_url: guild.icon_url.clone(),
            position: u32::try_from(position).unwrap_or(u32::MAX),
            folder_id: None,
            unread: channels.iter().any(|channel| channel.is_unread()),
            mention_count: channels.iter().map(|channel| channel.mention_count).sum(),
        }
    }

    /// Insère ou met à jour un salon. Un nouveau salon démarre lu jusqu'à son dernier message connu.
    pub(crate) fn upsert_channel(&mut self, input: ChannelInput) {
        let ChannelInput {
            summary,
            last_message_id,
        } = input;
        match self.channels.get_mut(&summary.id) {
            Some(entry) => {
                entry.last_message_id = last_message_id.or_else(|| entry.last_message_id.clone());
                entry.summary = summary;
            }
            None => {
                let id = summary.id.clone();
                let entry = ChannelEntry {
                    summary,
                    last_read_id: last_message_id.clone(),
                    last_message_id,
                    mention_count: 0,
                };
                self.channels.insert(id, entry);
            }
        }
    }

    pub(crate) fn remove_channel(&mut self, channel_id: &str) {
        self.channels.remove(channel_id);
    }

    pub(crate) fn channel_view(&self, channel_id: &str) -> Option<ChannelSummary> {
        self.channels.get(channel_id).map(ChannelEntry::view)
    }

    pub(crate) fn all_views(&self) -> Vec<ChannelSummary> {
        self.channels.values().map(ChannelEntry::view).collect()
    }

    /// Salons de la barre latérale : sans catégorie, puis chaque catégorie suivie de ses salons.
    pub(crate) fn guild_channels(&self, guild_id: &str) -> Vec<ChannelSummary> {
        let rows: Vec<&ChannelEntry> = self
            .channels
            .values()
            .filter(|channel| channel.summary.guild_id.as_deref() == Some(guild_id))
            .filter(|channel| channel.summary.kind != ChannelKind::Thread)
            .collect();
        let mut categories: Vec<&ChannelEntry> =
            rows.iter().copied().filter(|c| is_category(c)).collect();
        categories.sort_by_key(|c| sort_key(c));
        let category_ids: Vec<&str> = categories.iter().map(|c| c.summary.id.as_str()).collect();
        let loose = rows
            .iter()
            .copied()
            .filter(|c| !is_category(c) && !in_any_category(c, &category_ids))
            .collect();
        let mut out = sorted_views(loose);
        for category in categories {
            out.push(category.view());
            let children = rows
                .iter()
                .copied()
                .filter(|c| !is_category(c) && parent_is(c, &category.summary.id))
                .collect();
            out.extend(sorted_views(children));
        }
        out
    }

    /// MP et groupes (sans serveur), du plus récent au plus ancien.
    pub(crate) fn dm_views(&self) -> Vec<ChannelSummary> {
        let mut dms: Vec<&ChannelEntry> = self
            .channels
            .values()
            .filter(|c| c.summary.guild_id.is_none())
            .collect();
        dms.sort_by_key(|c| {
            let last = c
                .last_message_id
                .as_deref()
                .map_or(0, unread::snowflake_value);
            (Reverse(last), unread::snowflake_value(&c.summary.id))
        });
        dms.into_iter().map(ChannelEntry::view).collect()
    }

    /// Un message arrive : avance le dernier message, puis compte pour soi-même ou pour les mentions.
    pub(crate) fn note_message(
        &mut self,
        channel_id: &str,
        message_id: &str,
        by_me: bool,
        mentions_me: bool,
    ) {
        let Some(entry) = self.channels.get_mut(channel_id) else {
            return;
        };
        if entry
            .last_message_id
            .as_deref()
            .is_none_or(|last| unread::is_newer(message_id, last))
        {
            entry.last_message_id = Some(message_id.to_string());
        }
        if by_me {
            entry.last_read_id = entry.last_message_id.clone();
            entry.mention_count = 0;
        } else if mentions_me {
            entry.mention_count += 1;
        }
    }

    /// Accusé de lecture : avance la lecture et remet les mentions à zéro si le salon est lu.
    pub(crate) fn mark_read(&mut self, channel_id: &str, message_id: &str) {
        let Some(entry) = self.channels.get_mut(channel_id) else {
            return;
        };
        if entry
            .last_read_id
            .as_deref()
            .is_none_or(|read| unread::is_newer(message_id, read))
        {
            entry.last_read_id = Some(message_id.to_string());
        }
        if !entry.is_unread() {
            entry.mention_count = 0;
        }
    }

    /// Entrée de read_state (READY) : dernier message lu et mentions en attente.
    pub(crate) fn apply_read_state(
        &mut self,
        channel_id: &str,
        last_read: Option<&str>,
        mentions: u32,
    ) {
        let Some(entry) = self.channels.get_mut(channel_id) else {
            return;
        };
        if let Some(read) = last_read {
            entry.last_read_id = Some(read.to_string());
        }
        entry.mention_count = mentions;
    }
}
