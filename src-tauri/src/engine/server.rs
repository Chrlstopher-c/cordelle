//! Administration d'un serveur : détail, rôles, membres, bannissements, invitations, emoji, AutoMod, journal,
//! intégrations, salons. Les écritures ne vérifient pas les permissions : Discord répond 403 (code 50013).

use contract::{
    AccountId, EngineError, Snowflake,
    server::{
        AuditChange, AuditEntry, AutomodRule, Ban, ChannelDetail, ChannelEdit, GuildDetail,
        GuildEdit, GuildEmoji, Integration, Invite, MemberSummary, NewChannelKind, Role, RoleEdit,
    },
    user::User,
};
use serde_json::{Value, json};

use super::{Engine, internal};

const ADMINISTRATOR: u64 = 1 << 3;
const CDN: &str = "https://cdn.discordapp.com";

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key)?.as_str().map(str::to_owned)
}

fn flag(v: &Value, key: &str) -> bool {
    v.get(key).and_then(Value::as_bool).unwrap_or(false)
}

fn u32_of(v: &Value, key: &str) -> u32 {
    opt_u32(v, key).unwrap_or(0)
}

fn opt_u32(v: &Value, key: &str) -> Option<u32> {
    v.get(key)
        .and_then(Value::as_u64)
        .and_then(|n| u32::try_from(n).ok())
}

fn items(v: Option<&Value>) -> &[Value] {
    match v.and_then(Value::as_array) {
        Some(a) => a,
        None => &[],
    }
}

fn strs(v: Option<&Value>) -> Vec<String> {
    items(v)
        .iter()
        .filter_map(|s| s.as_str().map(str::to_owned))
        .collect()
}

fn asset(kind: &str, id: &str, hash: Option<String>) -> Option<String> {
    hash.map(|h| format!("{CDN}/{kind}/{id}/{h}.png"))
}

fn snowflake_ms(id: &str) -> f64 {
    id.parse::<u64>()
        .map_or(0.0, |n| ((n >> 22) + 1_420_070_400_000) as f64)
}

fn encode(raw: &str) -> String {
    raw.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn member_of(v: &Value) -> Option<MemberSummary> {
    Some(MemberSummary {
        user: store::convert::user(v.get("user")?)?,
        nick: text(v, "nick"),
        roles: strs(v.get("roles")),
        joined_at: text(v, "joined_at"),
        timed_out_until: text(v, "communication_disabled_until"),
    })
}

fn role_of(v: &Value) -> Option<Role> {
    Some(Role {
        id: text(v, "id")?,
        name: text(v, "name")?,
        color: u32_of(v, "color"),
        hoist: flag(v, "hoist"),
        mentionable: flag(v, "mentionable"),
        position: i32::try_from(v.get("position")?.as_i64()?).unwrap_or(0),
        permissions: text(v, "permissions").unwrap_or_else(|| "0".into()),
        managed: flag(v, "managed"),
    })
}

fn ban_of(v: &Value) -> Option<Ban> {
    Some(Ban {
        user: store::convert::user(v.get("user")?)?,
        reason: text(v, "reason"),
    })
}

fn invite_of(v: &Value) -> Option<Invite> {
    let channel = v.get("channel");
    Some(Invite {
        code: text(v, "code")?,
        inviter: v.get("inviter").and_then(store::convert::user),
        channel_id: channel.and_then(|c| text(c, "id")).unwrap_or_default(),
        channel_name: channel.and_then(|c| text(c, "name")),
        uses: u32_of(v, "uses"),
        max_uses: u32_of(v, "max_uses"),
        created_at: text(v, "created_at"),
        expires_at: text(v, "expires_at"),
    })
}

fn emoji_of(v: &Value) -> Option<GuildEmoji> {
    let id = text(v, "id")?;
    let animated = flag(v, "animated");
    let ext = if animated { "gif" } else { "png" };
    Some(GuildEmoji {
        name: text(v, "name")?,
        animated,
        creator: v
            .pointer("/user/username")
            .and_then(Value::as_str)
            .map(str::to_owned),
        image_url: format!("{CDN}/emojis/{id}.{ext}"),
        id,
    })
}

fn automod_of(v: &Value) -> Option<AutomodRule> {
    Some(AutomodRule {
        id: text(v, "id")?,
        name: text(v, "name")?,
        enabled: flag(v, "enabled"),
        trigger_type: u32_of(v, "trigger_type"),
        keywords: strs(v.pointer("/trigger_metadata/keyword_filter")),
        actions: items(v.get("actions"))
            .iter()
            .map(|a| u32_of(a, "type"))
            .collect(),
        exempt_roles: strs(v.get("exempt_roles")),
        exempt_channels: strs(v.get("exempt_channels")),
    })
}

fn integration_of(v: &Value) -> Option<Integration> {
    Some(Integration {
        id: text(v, "id")?,
        name: text(v, "name")?,
        kind: text(v, "type").unwrap_or_default(),
        enabled: flag(v, "enabled"),
        account_name: v
            .pointer("/account/name")
            .and_then(Value::as_str)
            .map(str::to_owned),
    })
}

fn show(v: &Value) -> String {
    v.as_str().map_or_else(|| v.to_string(), str::to_owned)
}

fn change_of(c: &Value) -> Option<AuditChange> {
    Some(AuditChange {
        key: text(c, "key")?,
        old: c.get("old_value").filter(|x| !x.is_null()).map(show),
        new: c.get("new_value").filter(|x| !x.is_null()).map(show),
    })
}

fn audit_of(v: &Value, users: &[User]) -> Option<AuditEntry> {
    let id = text(v, "id")?;
    let actor = text(v, "user_id").and_then(|a| users.iter().find(|u| u.id == a).cloned());
    Some(AuditEntry {
        action_type: u32_of(v, "action_type"),
        actor,
        target_id: text(v, "target_id"),
        reason: text(v, "reason"),
        changes: items(v.get("changes"))
            .iter()
            .filter_map(change_of)
            .collect(),
        created_ms: snowflake_ms(&id),
        id,
    })
}

fn channel_of(v: &Value) -> Option<ChannelDetail> {
    Some(ChannelDetail {
        id: text(v, "id")?,
        guild_id: text(v, "guild_id"),
        name: text(v, "name")?,
        topic: text(v, "topic"),
        nsfw: flag(v, "nsfw"),
        rate_limit_per_user: u32_of(v, "rate_limit_per_user"),
    })
}

impl Engine {
    /// Bits de permission de l'utilisateur sur le serveur. Propriétaire ou administrateur = tout.
    async fn permission_bits(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        owner_id: &str,
    ) -> Result<u64, EngineError> {
        if owner_id == account_id.as_str() {
            return Ok(u64::MAX);
        }
        let session = self.session(account_id)?;
        let roles: Vec<Value> = session
            .rest
            .get_json(&format!("/guilds/{guild_id}/roles"))
            .await?;
        let me: Value = session
            .rest
            .get_json(&format!("/guilds/{guild_id}/members/@me"))
            .await?;
        let mine = strs(me.get("roles"));
        let bits = roles
            .iter()
            .filter(|r| text(r, "id").is_some_and(|id| id == *guild_id || mine.contains(&id)))
            .filter_map(|r| text(r, "permissions")?.parse::<u64>().ok())
            .fold(0, |acc, bits| acc | bits);
        Ok(if bits & ADMINISTRATOR != 0 {
            u64::MAX
        } else {
            bits
        })
    }

    pub async fn guild_info(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<GuildDetail, EngineError> {
        let session = self.session(account_id)?;
        let g: Value = session
            .rest
            .get_json(&format!("/guilds/{guild_id}?with_counts=true"))
            .await?;
        let owner_id = text(&g, "owner_id").unwrap_or_default();
        let permissions = self
            .permission_bits(account_id, guild_id, &owner_id)
            .await?;
        Ok(GuildDetail {
            id: guild_id.clone(),
            name: text(&g, "name").unwrap_or_default(),
            description: text(&g, "description"),
            icon_url: asset("icons", guild_id, text(&g, "icon")),
            banner_url: asset("banners", guild_id, text(&g, "banner")),
            owner_id,
            member_count: opt_u32(&g, "approximate_member_count"),
            online_count: opt_u32(&g, "approximate_presence_count"),
            permissions: permissions.to_string(),
        })
    }

    pub async fn guild_update(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        edit: &GuildEdit,
    ) -> Result<(), EngineError> {
        let _: Value = self
            .session(account_id)?
            .rest
            .patch_json(&format!("/guilds/{guild_id}"), edit)
            .await?;
        Ok(())
    }

    pub async fn roles_list(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<Role>, EngineError> {
        let raw: Vec<Value> = self
            .session(account_id)?
            .rest
            .get_json(&format!("/guilds/{guild_id}/roles"))
            .await?;
        let mut roles: Vec<Role> = raw.iter().filter_map(role_of).collect();
        roles.sort_by_key(|r| std::cmp::Reverse(r.position));
        Ok(roles)
    }

    pub async fn role_create(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        name: &str,
    ) -> Result<Role, EngineError> {
        let raw: Value = self
            .session(account_id)?
            .rest
            .post_json(
                &format!("/guilds/{guild_id}/roles"),
                &json!({ "name": name }),
            )
            .await?;
        role_of(&raw).ok_or_else(|| internal("rôle créé illisible"))
    }

    pub async fn role_update(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        role_id: &Snowflake,
        edit: &RoleEdit,
    ) -> Result<(), EngineError> {
        let path = format!("/guilds/{guild_id}/roles/{role_id}");
        let _: Value = self
            .session(account_id)?
            .rest
            .patch_json(&path, edit)
            .await?;
        Ok(())
    }

    pub async fn role_delete(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        role_id: &Snowflake,
    ) -> Result<(), EngineError> {
        self.session(account_id)?
            .rest
            .delete(&format!("/guilds/{guild_id}/roles/{role_id}"))
            .await?;
        Ok(())
    }

    /// `order` : identifiants du plus haut au plus bas ; chaque rôle reçoit sa position (le plus haut = le plus grand).
    pub async fn role_reorder(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        order: &[Snowflake],
    ) -> Result<(), EngineError> {
        let n = order.len();
        let body: Vec<Value> = order
            .iter()
            .enumerate()
            .map(|(i, id)| json!({ "id": id, "position": n - i }))
            .collect();
        let _: Vec<Value> = self
            .session(account_id)?
            .rest
            .patch_json(&format!("/guilds/{guild_id}/roles"), &body)
            .await?;
        Ok(())
    }

    pub async fn members_search(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        query: &str,
        limit: u16,
    ) -> Result<Vec<MemberSummary>, EngineError> {
        let path = format!(
            "/guilds/{guild_id}/members/search?query={}&limit={limit}",
            encode(query.trim())
        );
        let raw: Vec<Value> = self.session(account_id)?.rest.get_json(&path).await?;
        Ok(raw.iter().filter_map(member_of).collect())
    }

    pub async fn member_kick(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        user_id: &Snowflake,
    ) -> Result<(), EngineError> {
        self.session(account_id)?
            .rest
            .delete(&format!("/guilds/{guild_id}/members/{user_id}"))
            .await?;
        Ok(())
    }

    /// `delete_days` : jours d'historique de messages à supprimer (0 à 7).
    pub async fn member_ban(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        user_id: &Snowflake,
        delete_days: u8,
    ) -> Result<(), EngineError> {
        let body = json!({ "delete_message_days": delete_days.min(7) });
        self.session(account_id)?
            .rest
            .put(&format!("/guilds/{guild_id}/bans/{user_id}"), &body)
            .await?;
        Ok(())
    }

    pub async fn bans_list(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<Ban>, EngineError> {
        let raw: Vec<Value> = self
            .session(account_id)?
            .rest
            .get_json(&format!("/guilds/{guild_id}/bans"))
            .await?;
        Ok(raw.iter().filter_map(ban_of).collect())
    }

    pub async fn ban_remove(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        user_id: &Snowflake,
    ) -> Result<(), EngineError> {
        self.session(account_id)?
            .rest
            .delete(&format!("/guilds/{guild_id}/bans/{user_id}"))
            .await?;
        Ok(())
    }

    pub async fn invites_list(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<Invite>, EngineError> {
        let raw: Vec<Value> = self
            .session(account_id)?
            .rest
            .get_json(&format!("/guilds/{guild_id}/invites"))
            .await?;
        Ok(raw.iter().filter_map(invite_of).collect())
    }

    /// `max_age` en secondes (0 = jamais), `max_uses` (0 = illimité).
    pub async fn invite_create(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        max_age: u32,
        max_uses: u32,
    ) -> Result<Invite, EngineError> {
        let body = json!({ "max_age": max_age, "max_uses": max_uses });
        let raw: Value = self
            .session(account_id)?
            .rest
            .post_json(&format!("/channels/{channel_id}/invites"), &body)
            .await?;
        invite_of(&raw).ok_or_else(|| internal("invitation créée illisible"))
    }

    pub async fn invite_delete(
        &self,
        account_id: &AccountId,
        code: &str,
    ) -> Result<(), EngineError> {
        self.session(account_id)?
            .rest
            .delete(&format!("/invites/{code}"))
            .await?;
        Ok(())
    }

    /// Supprime l'emoji `remove` si fourni, puis renvoie la liste à jour.
    pub async fn emojis_manage(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        remove: Option<&Snowflake>,
    ) -> Result<Vec<GuildEmoji>, EngineError> {
        let session = self.session(account_id)?;
        if let Some(id) = remove {
            session
                .rest
                .delete(&format!("/guilds/{guild_id}/emojis/{id}"))
                .await?;
        }
        let raw: Vec<Value> = session
            .rest
            .get_json(&format!("/guilds/{guild_id}/emojis"))
            .await?;
        Ok(raw.iter().filter_map(emoji_of).collect())
    }

    pub async fn audit_log(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<AuditEntry>, EngineError> {
        let raw: Value = self
            .session(account_id)?
            .rest
            .get_json(&format!("/guilds/{guild_id}/audit-logs?limit=50"))
            .await?;
        let users: Vec<User> = items(raw.get("users"))
            .iter()
            .filter_map(store::convert::user)
            .collect();
        Ok(items(raw.get("audit_log_entries"))
            .iter()
            .filter_map(|e| audit_of(e, &users))
            .collect())
    }

    pub async fn automod_rules(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<AutomodRule>, EngineError> {
        let path = format!("/guilds/{guild_id}/auto-moderation/rules");
        let raw: Vec<Value> = self.session(account_id)?.rest.get_json(&path).await?;
        Ok(raw.iter().filter_map(automod_of).collect())
    }

    pub async fn integrations_list(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<Integration>, EngineError> {
        let path = format!("/guilds/{guild_id}/integrations");
        let raw: Vec<Value> = self.session(account_id)?.rest.get_json(&path).await?;
        Ok(raw.iter().filter_map(integration_of).collect())
    }

    pub async fn channel_info(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
    ) -> Result<ChannelDetail, EngineError> {
        let raw: Value = self
            .session(account_id)?
            .rest
            .get_json(&format!("/channels/{channel_id}"))
            .await?;
        channel_of(&raw).ok_or_else(|| internal("salon illisible"))
    }

    pub async fn channel_update(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        edit: &ChannelEdit,
    ) -> Result<(), EngineError> {
        let _: Value = self
            .session(account_id)?
            .rest
            .patch_json(&format!("/channels/{channel_id}"), edit)
            .await?;
        Ok(())
    }

    pub async fn channel_create(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
        name: &str,
        kind: NewChannelKind,
    ) -> Result<(), EngineError> {
        let kind_code = match kind {
            NewChannelKind::Text => 0,
            NewChannelKind::Voice => 2,
        };
        let body = json!({ "name": name, "type": kind_code });
        let _: Value = self
            .session(account_id)?
            .rest
            .post_json(&format!("/guilds/{guild_id}/channels"), &body)
            .await?;
        Ok(())
    }
}
