//! Profil complet d'un utilisateur : `GET /users/{id}/profile` (+ communs) et note personnelle.

use contract::{
    AccountId, EngineError, Snowflake,
    profile::{Badge, ConnectedAccount, MutualGuild, UserProfile},
};
use serde_json::Value;

use super::{Engine, internal};

const DISCORD_EPOCH_MS: f64 = 1_420_070_400_000.0;
const CDN: &str = "https://cdn.discordapp.com";

impl Engine {
    pub async fn profile(
        &self,
        account_id: &AccountId,
        user_id: &Snowflake,
        guild_id: Option<Snowflake>,
    ) -> Result<UserProfile, EngineError> {
        let session = self.session(account_id)?;
        let mut path = format!(
            "/users/{user_id}/profile?type=popout&with_mutual_guilds=true&with_mutual_friends=true"
        );
        if let Some(g) = &guild_id {
            path.push_str(&format!("&guild_id={g}"));
        }
        let raw: Value = session.rest.get_json(&path).await?;
        let note = match session
            .rest
            .get_json::<Value>(&format!("/users/@me/notes/{user_id}"))
            .await
        {
            Ok(v) => str_of(&v, "note"),
            Err(_) => None,
        };
        let names = self.guilds(account_id).unwrap_or_default();
        let mut profile = parse(&raw).ok_or_else(|| internal("profil illisible"))?;
        for g in &mut profile.mutual_guilds {
            if let Some(known) = names.iter().find(|k| k.id == g.id) {
                g.name = known.name.clone();
                g.icon_url = known.icon_url.clone();
            }
        }
        profile.note = note;
        Ok(profile)
    }
}

fn parse(raw: &Value) -> Option<UserProfile> {
    let user_v = raw.get("user")?;
    let user = store::convert::user(user_v)?;
    let up = raw.get("user_profile").unwrap_or(&Value::Null);
    let member = raw.get("guild_member").unwrap_or(&Value::Null);
    let banner = str_of(user_v, "banner")
        .map(|h| format!("{CDN}/banners/{}/{h}.{}?size=600", user.id, ext(&h)));
    let created = user
        .id
        .parse::<u64>()
        .map(|id| (id >> 22) as f64 + DISCORD_EPOCH_MS)
        .unwrap_or(0.0);
    Some(UserProfile {
        banner_url: banner,
        accent_color: user_v
            .get("accent_color")
            .and_then(Value::as_u64)
            .map(|c| c as u32),
        theme_colors: up.get("theme_colors").and_then(Value::as_array).map(|a| {
            a.iter()
                .filter_map(Value::as_u64)
                .map(|c| c as u32)
                .collect()
        }),
        avatar_decoration_url: user_v
            .pointer("/avatar_decoration_data/asset")
            .and_then(Value::as_str)
            .map(|a| format!("{CDN}/avatar-decoration-presets/{a}.png?size=240&passthrough=true")),
        bio: str_of(up, "bio").or_else(|| str_of(user_v, "bio")),
        pronouns: str_of(up, "pronouns"),
        badges: badges(raw),
        connected_accounts: connections(raw),
        created_at_ms: created,
        joined_guild_at: str_of(member, "joined_at"),
        guild_nick: str_of(member, "nick"),
        mutual_guilds: mutual_guilds(raw),
        mutual_friends: raw
            .get("mutual_friends")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(store::convert::user).collect())
            .unwrap_or_default(),
        note: None,
        user,
    })
}

fn badges(raw: &Value) -> Vec<Badge> {
    list(raw, "badges")
        .filter_map(|b| {
            Some(Badge {
                id: str_of(b, "id")?,
                description: str_of(b, "description").unwrap_or_default(),
                icon_url: format!("{CDN}/badge-icons/{}.png", str_of(b, "icon")?),
                link: str_of(b, "link"),
            })
        })
        .collect()
}

fn connections(raw: &Value) -> Vec<ConnectedAccount> {
    list(raw, "connected_accounts")
        .filter_map(|c| {
            let kind = str_of(c, "type")?;
            let name = str_of(c, "name")?;
            let url = connection_url(&kind, &name, c);
            Some(ConnectedAccount {
                verified: c.get("verified").and_then(Value::as_bool).unwrap_or(false),
                kind,
                name,
                url,
            })
        })
        .collect()
}

fn connection_url(kind: &str, name: &str, c: &Value) -> Option<String> {
    let id = str_of(c, "id").unwrap_or_default();
    match kind {
        "github" => Some(format!("https://github.com/{name}")),
        "twitch" => Some(format!("https://twitch.tv/{name}")),
        "twitter" => Some(format!("https://x.com/{name}")),
        "reddit" => Some(format!("https://reddit.com/u/{name}")),
        "steam" => Some(format!("https://steamcommunity.com/profiles/{id}")),
        "youtube" => Some(format!("https://youtube.com/channel/{id}")),
        "spotify" => Some(format!("https://open.spotify.com/user/{id}")),
        _ => None,
    }
}

fn mutual_guilds(raw: &Value) -> Vec<MutualGuild> {
    list(raw, "mutual_guilds")
        .filter_map(|g| {
            Some(MutualGuild {
                id: str_of(g, "id")?,
                name: String::new(),
                icon_url: None,
                nick: str_of(g, "nick"),
            })
        })
        .collect()
}

fn list<'a>(raw: &'a Value, key: &str) -> impl Iterator<Item = &'a Value> {
    raw.get(key).and_then(Value::as_array).into_iter().flatten()
}

fn str_of(v: &Value, key: &str) -> Option<String> {
    v.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

fn ext(hash: &str) -> &'static str {
    if hash.starts_with("a_") { "gif" } else { "png" }
}

impl Engine {
    /// Ouvre (ou retrouve) le MP avec un utilisateur.
    pub async fn open_dm(
        &self,
        account_id: &AccountId,
        user_id: &Snowflake,
    ) -> Result<contract::guild::ChannelSummary, EngineError> {
        let session = self.session(account_id)?;
        let raw: Value = session
            .rest
            .post_json(
                "/users/@me/channels",
                &serde_json::json!({ "recipients": [user_id] }),
            )
            .await?;
        let input = store::convert::channel(&raw, None).ok_or_else(|| internal("MP illisible"))?;
        Ok(input.summary)
    }

    pub async fn set_note(
        &self,
        account_id: &AccountId,
        user_id: &Snowflake,
        note: &str,
    ) -> Result<(), EngineError> {
        let session = self.session(account_id)?;
        session
            .rest
            .put(
                &format!("/users/@me/notes/{user_id}"),
                &serde_json::json!({ "note": note }),
            )
            .await?;
        Ok(())
    }
}
