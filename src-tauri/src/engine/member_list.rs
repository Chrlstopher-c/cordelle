//! Panneau Membres : suit `GUILD_MEMBER_LIST_UPDATE` (SYNC/INSERT/UPDATE/DELETE/INVALIDATE) pour les 100 premières
//! lignes d'un salon, et les rôles des serveurs (nom, couleur, position) pour nommer les groupes et colorer les noms.

use std::collections::HashMap;

use contract::{
    social::{MemberEntry, MemberGroup},
    user::PresenceStatus,
};
use serde_json::Value;

#[derive(Clone)]
struct Role {
    name: String,
    color: u32,
    position: i64,
}

#[derive(Default)]
pub struct MemberLists {
    roles: HashMap<String, HashMap<String, Role>>,
    items: HashMap<String, Vec<Value>>,
    counts: HashMap<String, HashMap<String, u32>>,
}

impl MemberLists {
    /// READY ou GUILD_CREATE : mémorise les rôles de chaque serveur.
    pub fn ingest_guild(&mut self, guild: &Value) {
        let Some(id) = guild.get("id").and_then(Value::as_str) else {
            return;
        };
        let roles = guild
            .get("roles")
            .and_then(Value::as_array)
            .into_iter()
            .flatten();
        let map = roles
            .filter_map(|r| {
                Some((
                    r.get("id")?.as_str()?.to_owned(),
                    Role {
                        name: r.get("name")?.as_str()?.to_owned(),
                        color: r.get("color").and_then(Value::as_u64).unwrap_or(0) as u32,
                        position: r.get("position").and_then(Value::as_i64).unwrap_or(0),
                    },
                ))
            })
            .collect();
        self.roles.insert(id.to_owned(), map);
    }

    /// Applique une mise à jour et renvoie la liste complète du serveur.
    pub fn apply(&mut self, data: &Value) -> Option<(String, Vec<MemberGroup>)> {
        let guild = data.get("guild_id")?.as_str()?.to_owned();
        let counts = self.counts.entry(guild.clone()).or_default();
        for g in data
            .get("groups")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let (Some(id), Some(n)) = (
                g.get("id").and_then(Value::as_str),
                g.get("count").and_then(Value::as_u64),
            ) {
                counts.insert(id.to_owned(), n as u32);
            }
        }
        let items = self.items.entry(guild.clone()).or_default();
        for op in data
            .get("ops")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            apply_op(items, op);
        }
        Some((guild.clone(), self.groups(&guild)))
    }

    fn groups(&self, guild: &str) -> Vec<MemberGroup> {
        let empty = HashMap::new();
        let roles = self.roles.get(guild).unwrap_or(&empty);
        let counts = self.counts.get(guild);
        let mut out: Vec<MemberGroup> = Vec::new();
        for item in self.items.get(guild).into_iter().flatten() {
            if let Some(g) = item.get("group") {
                let id = g.get("id").and_then(Value::as_str).unwrap_or("").to_owned();
                out.push(MemberGroup {
                    name: group_name(&id, roles),
                    count: counts.and_then(|c| c.get(&id)).copied().unwrap_or(0),
                    members: Vec::new(),
                    id,
                });
            } else if let (Some(m), Some(last)) = (item.get("member"), out.last_mut())
                && let Some(entry) = member(m, roles)
            {
                last.members.push(entry);
            }
        }
        out
    }
}

fn apply_op(items: &mut Vec<Value>, op: &Value) {
    let index = |key: &str| op.get(key).and_then(Value::as_u64).map(|i| i as usize);
    let range = op
        .get("range")
        .and_then(Value::as_array)
        .and_then(|r| Some((r.first()?.as_u64()? as usize, r.get(1)?.as_u64()? as usize)));
    match op.get("op").and_then(Value::as_str) {
        Some("SYNC") => {
            let Some((start, _)) = range else { return };
            let new = op
                .get("items")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            if items.len() < start + new.len() {
                items.resize(start + new.len(), Value::Null);
            }
            for (i, it) in new.into_iter().enumerate() {
                items[start + i] = it;
            }
        }
        Some("INSERT") => {
            if let (Some(i), Some(item)) = (index("index"), op.get("item")) {
                items.insert(i.min(items.len()), item.clone());
            }
        }
        Some("UPDATE") => {
            if let (Some(i), Some(item)) = (index("index"), op.get("item"))
                && i < items.len()
            {
                items[i] = item.clone();
            }
        }
        Some("DELETE") => {
            if let Some(i) = index("index").filter(|i| *i < items.len()) {
                items.remove(i);
            }
        }
        Some("INVALIDATE") => {
            if let Some((start, end)) = range {
                for item in items.iter_mut().take(end + 1).skip(start) {
                    *item = Value::Null;
                }
            }
        }
        _ => {}
    }
}

fn group_name(id: &str, roles: &HashMap<String, Role>) -> String {
    match id {
        "online" => "En ligne".into(),
        "offline" => "Hors ligne".into(),
        other => roles
            .get(other)
            .map(|r| r.name.clone())
            .unwrap_or_else(|| "Membres".into()),
    }
}

fn member(m: &Value, roles: &HashMap<String, Role>) -> Option<MemberEntry> {
    let user = store::convert::user(m.get("user")?)?;
    let color = m
        .get("roles")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|r| roles.get(r.as_str()?))
        .filter(|r| r.color != 0)
        .max_by_key(|r| r.position)
        .map(|r| r.color);
    let presence = m.get("presence").unwrap_or(&Value::Null);
    Some(MemberEntry {
        user,
        nick: m.get("nick").and_then(Value::as_str).map(str::to_owned),
        color,
        status: status(
            presence
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("offline"),
        ),
        activity: activity(presence),
    })
}

fn status(s: &str) -> PresenceStatus {
    match s {
        "online" => PresenceStatus::Online,
        "idle" => PresenceStatus::Idle,
        "dnd" => PresenceStatus::Dnd,
        _ => PresenceStatus::Offline,
    }
}

fn activity(presence: &Value) -> Option<String> {
    let acts = presence.get("activities")?.as_array()?;
    let custom = acts
        .iter()
        .find(|a| a.get("type").and_then(Value::as_u64) == Some(4));
    let main = acts
        .iter()
        .find(|a| a.get("type").and_then(Value::as_u64) != Some(4));
    if let Some(a) = main {
        let name = a.get("name")?.as_str()?;
        let verb = match a.get("type").and_then(Value::as_u64) {
            Some(1) => "Streame",
            Some(2) => "Écoute",
            Some(3) => "Regarde",
            Some(5) => "Participe à",
            _ => "Joue à",
        };
        return Some(format!("{verb} {name}"));
    }
    custom.and_then(|a| a.get("state")?.as_str().map(str::to_owned))
}
