//! État vocal tenu depuis le gateway : qui est dans quel salon (par serveur, ou appel MP) et ma propre session.

use std::collections::{BTreeMap, HashMap};

use contract::{AccountId, Snowflake, events::EngineEvent, voice::VoiceMember};
use serde_json::Value;

/// Périmètre d'une liste d'états : un serveur, ou `None` pour un appel en MP.
pub type Scope = Option<Snowflake>;

/// Ma connexion vocale telle que le gateway la décrit (VOICE_STATE_UPDATE de mon utilisateur).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OwnVoice {
    pub session_id: String,
    pub guild_id: Scope,
    pub channel_id: Snowflake,
}

/// Serveur vocal attribué (VOICE_SERVER_UPDATE).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoiceServer {
    pub token: String,
    pub endpoint: String,
    pub guild_id: Scope,
}

/// Tout ce qu'il faut pour ouvrir le driver vocal une fois la poignée de main gateway faite.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Handshake {
    pub user_id: Snowflake,
    pub session_id: String,
    pub token: String,
    pub endpoint: String,
}

/// États vocaux par périmètre, alimentés par READY, GUILD_CREATE, VOICE_STATE_UPDATE et VOICE_SERVER_UPDATE.
#[derive(Debug)]
pub struct VoiceRoster {
    account_id: AccountId,
    own_user: Option<Snowflake>,
    scopes: HashMap<Scope, BTreeMap<Snowflake, VoiceMember>>,
    own: Option<OwnVoice>,
    server: Option<VoiceServer>,
}

impl VoiceRoster {
    pub fn new(account_id: AccountId) -> Self {
        Self {
            account_id,
            own_user: None,
            scopes: HashMap::new(),
            own: None,
            server: None,
        }
    }

    /// Applique un événement gateway ; renvoie les listes de périmètres qui ont changé.
    pub fn ingest(&mut self, name: &str, data: &Value) -> Vec<EngineEvent> {
        match name {
            "READY" => self.on_ready(data),
            // Comptes utilisateurs : les états vocaux de chaque serveur arrivent ici, pas dans READY.
            "READY_SUPPLEMENTAL" => self.on_supplemental(data),
            "GUILD_CREATE" => match str_field(data, "id") {
                Some(guild_id) => self.replace_scope(Some(guild_id), data),
                None => Vec::new(),
            },
            "VOICE_STATE_UPDATE" => self.apply_state(data),
            "VOICE_SERVER_UPDATE" => {
                self.on_server(data);
                Vec::new()
            }
            _ => Vec::new(),
        }
    }

    fn on_ready(&mut self, data: &Value) -> Vec<EngineEvent> {
        self.own_user = data
            .pointer("/user/id")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let guilds = data.get("guilds").and_then(Value::as_array);
        let mut events = Vec::new();
        for guild in guilds.into_iter().flatten() {
            if let Some(guild_id) = str_field(guild, "id") {
                events.extend(self.replace_scope(Some(guild_id), guild));
            }
        }
        events
    }

    /// Remplace la liste d'un serveur par son `voice_states` ; ne renvoie un événement qu'en cas de changement.
    fn on_supplemental(&mut self, data: &Value) -> Vec<EngineEvent> {
        let guilds = data.get("guilds").and_then(Value::as_array);
        let mut events = Vec::new();
        for guild in guilds.into_iter().flatten() {
            if let (Some(guild_id), Some(_)) = (str_field(guild, "id"), guild.get("voice_states")) {
                events.extend(self.replace_scope(Some(guild_id), guild));
            }
        }
        events
    }

    fn replace_scope(&mut self, scope: Scope, guild: &Value) -> Vec<EngineEvent> {
        let mut next = BTreeMap::new();
        for state in guild
            .get("voice_states")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some((user_id, member)) = parse_member(state) {
                next.insert(user_id, member);
            }
        }
        let previous = self.scopes.get(&scope);
        let unchanged = previous.map_or(next.is_empty(), |p| {
            p.len() == next.len() && same_members(p, &next)
        });
        if unchanged {
            return Vec::new();
        }
        if next.is_empty() {
            self.scopes.remove(&scope);
        } else {
            self.scopes.insert(scope.clone(), next);
        }
        vec![self.scope_event(&scope)]
    }

    fn apply_state(&mut self, data: &Value) -> Vec<EngineEvent> {
        let Some(user_id) = str_field(data, "user_id") else {
            return Vec::new();
        };
        let scope = str_field(data, "guild_id");
        let channel_id = str_field(data, "channel_id");
        if self.own_user.as_deref() == Some(user_id.as_str()) {
            self.own = channel_id.clone().map(|channel_id| OwnVoice {
                session_id: str_field(data, "session_id").unwrap_or_default(),
                guild_id: scope.clone(),
                channel_id,
            });
        }
        let mut touched: Vec<Scope> = Vec::new();
        for (other, members) in &mut self.scopes {
            if *other != scope && members.remove(&user_id).is_some() {
                touched.push(other.clone());
            }
        }
        match (&channel_id, parse_member(data)) {
            (Some(_), Some((_, member))) => {
                self.scopes
                    .entry(scope.clone())
                    .or_default()
                    .insert(user_id, member);
                touched.push(scope.clone());
            }
            (None, _) => {
                if let Some(members) = self.scopes.get_mut(&scope) {
                    members.remove(&user_id);
                    touched.push(scope.clone());
                }
            }
            (Some(_), None) => {}
        }
        self.prune_empty();
        touched.iter().map(|s| self.scope_event(s)).collect()
    }

    fn on_server(&mut self, data: &Value) {
        if let (Some(token), Some(endpoint)) =
            (str_field(data, "token"), str_field(data, "endpoint"))
        {
            self.server = Some(VoiceServer {
                token,
                endpoint,
                guild_id: str_field(data, "guild_id"),
            });
        }
    }

    fn prune_empty(&mut self) {
        self.scopes.retain(|_, members| !members.is_empty());
    }

    fn scope_event(&self, scope: &Scope) -> EngineEvent {
        let states = self
            .scopes
            .get(scope)
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default();
        EngineEvent::VoiceStates {
            account_id: self.account_id.clone(),
            guild_id: scope.clone(),
            states,
        }
    }

    /// Liste courante d'un périmètre (vide si personne).
    pub fn states(&self, scope: &Scope) -> Vec<VoiceMember> {
        self.scopes
            .get(scope)
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default()
    }

    /// Efface la poignée de main en cours avant d'envoyer l'opcode 4 : seules les réponses suivantes comptent.
    pub fn begin_handshake(&mut self) {
        self.own = None;
        self.server = None;
    }

    /// Poignée de main complète pour ce salon (mon état et le serveur vocal reçus), sinon `None`.
    pub fn handshake(&self, channel_id: &str) -> Option<Handshake> {
        let own = self.own.as_ref().filter(|o| o.channel_id == channel_id)?;
        let server = self.server.as_ref()?;
        Some(Handshake {
            user_id: self.own_user.clone()?,
            session_id: own.session_id.clone(),
            token: server.token.clone(),
            endpoint: server.endpoint.clone(),
        })
    }

    /// Mon utilisateur, connu après READY.
    pub fn own_user(&self) -> Option<&Snowflake> {
        self.own_user.as_ref()
    }
}

fn str_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_owned)
}

fn flag(value: &Value, key: &str) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(false)
}

/// Lit un état vocal ; `None` si l'utilisateur n'est dans aucun salon.
fn parse_member(state: &Value) -> Option<(Snowflake, VoiceMember)> {
    let user_id = str_field(state, "user_id")?;
    let channel_id = str_field(state, "channel_id")?;
    let member = VoiceMember {
        user_id: user_id.clone(),
        channel_id,
        mute: flag(state, "mute") || flag(state, "self_mute"),
        deaf: flag(state, "deaf") || flag(state, "self_deaf"),
        streaming: flag(state, "self_stream"),
        video: flag(state, "self_video"),
    };
    Some((user_id, member))
}

fn same_members(
    a: &BTreeMap<Snowflake, VoiceMember>,
    b: &BTreeMap<Snowflake, VoiceMember>,
) -> bool {
    a.iter()
        .all(|(id, m)| b.get(id).is_some_and(|n| same_member(m, n)))
}

fn same_member(a: &VoiceMember, b: &VoiceMember) -> bool {
    a.channel_id == b.channel_id
        && a.mute == b.mute
        && a.deaf == b.deaf
        && a.streaming == b.streaming
        && a.video == b.video
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    const ME: &str = "111";
    const GUILD: &str = "900";
    const OTHER_GUILD: &str = "901";

    fn roster() -> VoiceRoster {
        VoiceRoster::new("111".into())
    }

    fn ready() -> Value {
        json!({
            "user": { "id": ME },
            "guilds": [
                { "id": GUILD, "voice_states": [
                    { "user_id": "222", "channel_id": "500", "self_mute": true, "self_stream": true },
                    { "user_id": "333", "channel_id": "501", "deaf": false }
                ]},
                { "id": OTHER_GUILD, "voice_states": [] }
            ]
        })
    }

    fn states_of(event: &EngineEvent) -> (Scope, Vec<(String, String)>) {
        match event {
            EngineEvent::VoiceStates {
                guild_id, states, ..
            } => (
                guild_id.clone(),
                states
                    .iter()
                    .map(|m| (m.user_id.clone(), m.channel_id.clone()))
                    .collect(),
            ),
            other => panic!("événement inattendu : {other:?}"),
        }
    }

    #[test]
    fn ready_fills_each_guild_and_flags_mute_and_stream() {
        let mut roster = roster();
        let events = roster.ingest("READY", &ready());
        assert_eq!(events.len(), 1, "un seul serveur non vide");
        let (guild, members) = states_of(&events[0]);
        assert_eq!(guild.as_deref(), Some(GUILD));
        assert_eq!(
            members,
            vec![("222".into(), "500".into()), ("333".into(), "501".into())]
        );
        let first = &roster.states(&Some(GUILD.into()))[0];
        assert!(first.mute && first.streaming && !first.deaf);
        assert_eq!(roster.own_user().map(String::as_str), Some(ME));
    }

    #[test]
    fn ready_supplemental_brings_user_account_voice_states() {
        let mut roster = roster();
        roster.ingest(
            "READY",
            &json!({ "user": { "id": ME }, "guilds": [{ "id": GUILD }] }),
        );
        let supplemental = json!({ "guilds": [
            { "id": GUILD, "voice_states": [{ "user_id": "222", "channel_id": "500" }] },
            { "id": OTHER_GUILD }
        ]});
        let events = roster.ingest("READY_SUPPLEMENTAL", &supplemental);
        assert_eq!(events.len(), 1);
        assert_eq!(states_of(&events[0]).1, vec![("222".into(), "500".into())]);
    }

    #[test]
    fn voice_state_update_joins_moves_and_leaves() {
        let mut roster = roster();
        roster.ingest("READY", &ready());
        let join = json!({
            "guild_id": GUILD, "channel_id": "502", "user_id": "444", "session_id": "s", "self_deaf": true
        });
        let (guild, members) = states_of(&roster.ingest("VOICE_STATE_UPDATE", &join)[0]);
        assert_eq!(guild.as_deref(), Some(GUILD));
        assert!(members.contains(&("444".into(), "502".into())));
        assert!(
            roster
                .states(&Some(GUILD.into()))
                .iter()
                .any(|m| m.user_id == "444" && m.deaf)
        );

        let move_to_other = json!({
            "guild_id": OTHER_GUILD, "channel_id": "600", "user_id": "222", "session_id": "s"
        });
        let events = roster.ingest("VOICE_STATE_UPDATE", &move_to_other);
        assert_eq!(events.len(), 2, "ancien serveur puis nouveau serveur");
        assert!(
            !roster
                .states(&Some(GUILD.into()))
                .iter()
                .any(|m| m.user_id == "222")
        );

        let leave =
            json!({ "guild_id": GUILD, "channel_id": null, "user_id": "444", "session_id": "s" });
        let (_, members) = states_of(&roster.ingest("VOICE_STATE_UPDATE", &leave)[0]);
        assert!(!members.iter().any(|(user, _)| user == "444"));
    }

    #[test]
    fn dm_call_uses_no_guild_scope() {
        let mut roster = roster();
        let call =
            json!({ "guild_id": null, "channel_id": "700", "user_id": "555", "session_id": "d" });
        let (guild, members) = states_of(&roster.ingest("VOICE_STATE_UPDATE", &call)[0]);
        assert_eq!(guild, None);
        assert_eq!(members, vec![("555".into(), "700".into())]);
    }

    #[test]
    fn unchanged_guild_emits_nothing() {
        let mut roster = roster();
        roster.ingest("READY", &ready());
        assert!(roster.ingest("GUILD_CREATE", &json!({ "id": GUILD, "voice_states": [
            { "user_id": "222", "channel_id": "500", "self_mute": true, "self_stream": true },
            { "user_id": "333", "channel_id": "501" }
        ]})).is_empty());
    }

    #[test]
    fn handshake_needs_own_state_and_server_for_same_channel() {
        let mut roster = roster();
        roster.ingest("READY", &ready());
        roster.begin_handshake();
        roster.ingest(
            "VOICE_STATE_UPDATE",
            &json!({ "guild_id": GUILD, "channel_id": "500", "user_id": ME, "session_id": "sess" }),
        );
        assert!(
            roster.handshake("500").is_none(),
            "pas encore de serveur vocal"
        );
        roster.ingest(
            "VOICE_SERVER_UPDATE",
            &json!({ "token": "tok", "endpoint": "ep.example:443", "guild_id": GUILD }),
        );
        let hs = roster.handshake("500").expect("poignée complète");
        assert_eq!(
            (
                hs.user_id.as_str(),
                hs.session_id.as_str(),
                hs.token.as_str()
            ),
            (ME, "sess", "tok")
        );
        assert!(roster.handshake("999").is_none(), "autre salon : rien");
    }

    #[test]
    fn leaving_clears_own_handshake_state() {
        let mut roster = roster();
        roster.ingest("READY", &ready());
        roster.ingest(
            "VOICE_STATE_UPDATE",
            &json!({ "guild_id": GUILD, "channel_id": "500", "user_id": ME, "session_id": "s" }),
        );
        roster.ingest(
            "VOICE_SERVER_UPDATE",
            &json!({ "token": "t", "endpoint": "e", "guild_id": GUILD }),
        );
        roster.ingest(
            "VOICE_STATE_UPDATE",
            &json!({ "guild_id": GUILD, "channel_id": null, "user_id": ME, "session_id": "s" }),
        );
        assert!(roster.handshake("500").is_none());
    }
}
