//! Conversions pures du JSON Discord (compte utilisateur) vers les types du contrat. Aucune E/S.

use contract::{
    guild::{ChannelKind, ChannelSummary},
    message::{Attachment, Message, Reaction},
    user::User,
};
use serde_json::{Value, json};

/// Serveur extrait d'un objet de guilde (plat ou éclaté dans `properties`).
pub struct GuildInfo {
    pub id: String,
    pub name: String,
    pub icon_url: Option<String>,
}

/// Salon extrait, avec son dernier message connu (sert au calcul des non-lus).
pub struct ChannelInput {
    pub summary: ChannelSummary,
    pub last_message_id: Option<String>,
}

pub fn str_field<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key)?.as_str()
}

pub fn array<'a>(value: &'a Value, key: &str) -> &'a [Value] {
    value
        .get(key)
        .and_then(Value::as_array)
        .map_or(&[], Vec::as_slice)
}

fn u32_field(value: &Value, key: &str) -> Option<u32> {
    value.get(key)?.as_u64().and_then(|n| u32::try_from(n).ok())
}

pub fn user(value: &Value) -> Option<User> {
    let id = str_field(value, "id")?.to_string();
    Some(User {
        username: str_field(value, "username").unwrap_or_default().to_string(),
        global_name: str_field(value, "global_name").map(str::to_owned),
        avatar_url: str_field(value, "avatar")
            .map(|hash| format!("https://cdn.discordapp.com/avatars/{id}/{hash}.png")),
        bot: value.get("bot").and_then(Value::as_bool).unwrap_or(false),
        id,
    })
}

pub fn guild(value: &Value) -> Option<GuildInfo> {
    let id = str_field(value, "id")?.to_string();
    let props = value.get("properties").unwrap_or(value);
    let name = str_field(props, "name")?.to_string();
    let icon_url = str_field(props, "icon")
        .map(|hash| format!("https://cdn.discordapp.com/icons/{id}/{hash}.png"));
    Some(GuildInfo { id, name, icon_url })
}

/// Type Discord → type du contrat. `None` pour les types non affichés (boutique, annuaire…).
pub fn channel_kind(code: u64) -> Option<ChannelKind> {
    match code {
        0 => Some(ChannelKind::Text),
        2 => Some(ChannelKind::Voice),
        4 => Some(ChannelKind::Category),
        5 => Some(ChannelKind::Announcement),
        10..=12 => Some(ChannelKind::Thread),
        13 => Some(ChannelKind::Stage),
        15 => Some(ChannelKind::Forum),
        16 => Some(ChannelKind::Media),
        1 => Some(ChannelKind::Dm),
        3 => Some(ChannelKind::GroupDm),
        _ => None,
    }
}

/// `guild_id` explicite (salons d'une guilde) ou à défaut celui de l'objet (CHANNEL_CREATE).
pub fn channel(value: &Value, guild_id: Option<&str>) -> Option<ChannelInput> {
    let kind = channel_kind(value.get("type")?.as_u64()?)?;
    let id = str_field(value, "id")?.to_string();
    let recipients: Vec<User> = array(value, "recipients").iter().filter_map(user).collect();
    let name = match str_field(value, "name") {
        Some(name) => name.to_string(),
        None => recipient_names(&recipients),
    };
    let summary = ChannelSummary {
        id,
        guild_id: guild_id
            .or_else(|| str_field(value, "guild_id"))
            .map(str::to_owned),
        parent_id: str_field(value, "parent_id").map(str::to_owned),
        kind,
        name,
        topic: str_field(value, "topic").map(str::to_owned),
        position: value
            .get("position")
            .and_then(Value::as_i64)
            .and_then(|p| i32::try_from(p).ok())
            .unwrap_or(0),
        nsfw: value.get("nsfw").and_then(Value::as_bool).unwrap_or(false),
        unread: false,
        mention_count: 0,
        last_message_id: None,
        recipients,
    };
    let last_message_id = str_field(value, "last_message_id").map(str::to_owned);
    Some(ChannelInput {
        summary,
        last_message_id,
    })
}

fn recipient_names(recipients: &[User]) -> String {
    recipients
        .iter()
        .map(|user| user.global_name.as_deref().unwrap_or(&user.username))
        .collect::<Vec<&str>>()
        .join(", ")
}

pub fn message(value: &Value) -> Option<Message> {
    Some(Message {
        id: str_field(value, "id")?.to_string(),
        channel_id: str_field(value, "channel_id")?.to_string(),
        author: user(value.get("author")?)?,
        content: str_field(value, "content").unwrap_or_default().to_string(),
        timestamp: str_field(value, "timestamp")
            .unwrap_or_default()
            .to_string(),
        edited_timestamp: str_field(value, "edited_timestamp").map(str::to_owned),
        reply_to: value
            .pointer("/message_reference/message_id")
            .and_then(Value::as_str)
            .map(str::to_owned),
        attachments: array(value, "attachments")
            .iter()
            .filter_map(attachment)
            .collect(),
        reactions: array(value, "reactions")
            .iter()
            .filter_map(reaction)
            .collect(),
        embeds_json: embeds_json(value),
        pinned: value
            .get("pinned")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

fn attachment(value: &Value) -> Option<Attachment> {
    Some(Attachment {
        id: str_field(value, "id")?.to_string(),
        filename: str_field(value, "filename").unwrap_or_default().to_string(),
        url: str_field(value, "url")?.to_string(),
        content_type: str_field(value, "content_type").map(str::to_owned),
        size: u32_field(value, "size").unwrap_or(0),
        width: u32_field(value, "width"),
        height: u32_field(value, "height"),
    })
}

fn reaction(value: &Value) -> Option<Reaction> {
    Some(Reaction {
        emoji: emoji_key(value.get("emoji")?),
        count: u32_field(value, "count").unwrap_or(0),
        me: value.get("me").and_then(Value::as_bool).unwrap_or(false),
    })
}

/// `nom` pour un emoji unicode, `nom:id` pour un emoji personnalisé.
pub fn emoji_key(emoji: &Value) -> String {
    let name = str_field(emoji, "name").unwrap_or_default();
    match str_field(emoji, "id") {
        Some(id) => format!("{name}:{id}"),
        None => name.to_string(),
    }
}

fn embeds_json(value: &Value) -> Option<String> {
    let embeds = array(value, "embeds");
    if embeds.is_empty() {
        return None;
    }
    serde_json::to_string(embeds).ok()
}

/// Fusion superficielle : chaque champ présent dans `patch` remplace celui de `base`.
pub fn merge_patch(base: &mut Value, patch: &Value) {
    if let (Some(target), Some(fields)) = (base.as_object_mut(), patch.as_object()) {
        for (key, value) in fields {
            target.insert(key.clone(), value.clone());
        }
    }
}

/// Ajuste le compteur d'une réaction du message brut (`delta` = +1 ajout, -1 retrait).
pub fn bump_reaction(message: &mut Value, emoji: &Value, by_me: bool, delta: i64) {
    let key = emoji_key(emoji);
    let Some(reactions) = message
        .as_object_mut()
        .map(|fields| {
            fields
                .entry("reactions")
                .or_insert_with(|| Value::Array(Vec::new()))
        })
        .and_then(Value::as_array_mut)
    else {
        return;
    };
    let index = reactions
        .iter()
        .position(|reaction| reaction.get("emoji").map(emoji_key).as_deref() == Some(key.as_str()));
    match index {
        Some(index) => update_reaction(reactions, index, by_me, delta),
        None if delta > 0 => reactions.push(json!({"emoji": emoji, "count": 1, "me": by_me})),
        None => {}
    }
}

fn update_reaction(reactions: &mut Vec<Value>, index: usize, by_me: bool, delta: i64) {
    let count = reactions[index]
        .get("count")
        .and_then(Value::as_i64)
        .unwrap_or(0)
        + delta;
    if count <= 0 {
        reactions.remove(index);
        return;
    }
    reactions[index]["count"] = json!(count);
    if by_me {
        reactions[index]["me"] = json!(delta > 0);
    }
}
