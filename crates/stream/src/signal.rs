//! Signalisation Go Live sur le gateway principal : opcodes 18/19/22, clés de flux et dispatchs STREAM_*.

use serde_json::{Value, json};

pub const OP_STREAM_CREATE: u8 = 18;
pub const OP_STREAM_DELETE: u8 = 19;
pub const OP_STREAM_SET_PAUSED: u8 = 22;

/// Lieu du partage : un salon de serveur, ou un appel privé (MP).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamScope {
    Guild {
        guild_id: String,
        channel_id: String,
    },
    Call {
        channel_id: String,
    },
}

/// Clé d'un flux telle que Discord la renvoie.
/// Formes : `guild:<serveur>:<salon>:<utilisateur>` et `call:<salon>:<utilisateur>`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamKey {
    Guild {
        guild_id: String,
        channel_id: String,
        user_id: String,
    },
    Call {
        channel_id: String,
        user_id: String,
    },
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum StreamKeyError {
    #[error("clé de flux inconnue")]
    Unknown,
}

/// Lit une clé de flux ; une clé mal formée est refusée (pas de valeur devinée).
pub fn parse_stream_key(key: &str) -> Result<StreamKey, StreamKeyError> {
    let parts: Vec<&str> = key.split(':').collect();
    match parts.as_slice() {
        ["guild", guild_id, channel_id, user_id] if non_empty(&[guild_id, channel_id, user_id]) => {
            Ok(StreamKey::Guild {
                guild_id: (*guild_id).to_owned(),
                channel_id: (*channel_id).to_owned(),
                user_id: (*user_id).to_owned(),
            })
        }
        ["call", channel_id, user_id] if non_empty(&[channel_id, user_id]) => Ok(StreamKey::Call {
            channel_id: (*channel_id).to_owned(),
            user_id: (*user_id).to_owned(),
        }),
        _ => Err(StreamKeyError::Unknown),
    }
}

fn non_empty(parts: &[&&str]) -> bool {
    parts.iter().all(|p| !p.is_empty())
}

/// Opcode 18 « stream create » : demande un Go Live dans le salon donné.
pub fn create_payload(scope: &StreamScope) -> Value {
    match scope {
        StreamScope::Guild {
            guild_id,
            channel_id,
        } => json!({
            "type": "guild", "guild_id": guild_id, "channel_id": channel_id, "preferred_region": null,
        }),
        StreamScope::Call { channel_id } => json!({
            "type": "call", "guild_id": null, "channel_id": channel_id, "preferred_region": null,
        }),
    }
}

/// Opcode 19 « stream delete » : arrête le flux désigné par sa clé.
pub fn delete_payload(stream_key: &str) -> Value {
    json!({ "stream_key": stream_key, "reason": null })
}

/// Opcode 22 « stream set paused » : met le flux en pause (image figée) ou le reprend.
pub fn set_paused_payload(stream_key: &str, paused: bool) -> Value {
    json!({ "stream_key": stream_key, "paused": paused })
}

/// Dispatch STREAM_CREATE : identifiant du serveur RTC et clé du flux attribués à ce Go Live.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreamCreated {
    pub rtc_server_id: String,
    pub stream_key: String,
}

/// Dispatch STREAM_SERVER_UPDATE : serveur de média (endpoint) et jeton pour le flux.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreamServer {
    pub stream_key: String,
    pub endpoint: String,
    pub token: String,
}

/// Lit STREAM_CREATE ; `None` si un champ manque (le dispatch est alors ignoré et journalisé par l'appelant).
pub fn parse_stream_created(data: &Value) -> Option<StreamCreated> {
    Some(StreamCreated {
        rtc_server_id: data.get("rtc_server_id")?.as_str()?.to_owned(),
        stream_key: data.get("stream_key")?.as_str()?.to_owned(),
    })
}

/// Lit STREAM_SERVER_UPDATE ; `endpoint` absent signifie que le serveur de média n'est pas encore attribué.
pub fn parse_stream_server(data: &Value) -> Option<StreamServer> {
    Some(StreamServer {
        stream_key: data.get("stream_key")?.as_str()?.to_owned(),
        endpoint: data.get("endpoint")?.as_str()?.to_owned(),
        token: data.get("token")?.as_str()?.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_guild_and_call_keys() {
        assert_eq!(
            parse_stream_key("guild:1:2:3"),
            Ok(StreamKey::Guild {
                guild_id: "1".into(),
                channel_id: "2".into(),
                user_id: "3".into()
            })
        );
        assert_eq!(
            parse_stream_key("call:2:3"),
            Ok(StreamKey::Call {
                channel_id: "2".into(),
                user_id: "3".into()
            })
        );
    }

    #[test]
    fn rejects_malformed_keys() {
        assert_eq!(parse_stream_key("guild:1:2"), Err(StreamKeyError::Unknown));
        assert_eq!(parse_stream_key("call::3"), Err(StreamKeyError::Unknown));
        assert_eq!(parse_stream_key("bogus:1:2"), Err(StreamKeyError::Unknown));
    }

    #[test]
    fn builds_create_payload_for_guild_and_call() {
        let guild = create_payload(&StreamScope::Guild {
            guild_id: "g".into(),
            channel_id: "c".into(),
        });
        assert_eq!(
            guild,
            json!({ "type": "guild", "guild_id": "g", "channel_id": "c", "preferred_region": null })
        );
        let call = create_payload(&StreamScope::Call {
            channel_id: "c".into(),
        });
        assert_eq!(call["type"], "call");
        assert!(call["guild_id"].is_null());
    }

    #[test]
    fn builds_delete_and_pause_payloads() {
        assert_eq!(
            delete_payload("call:c:u"),
            json!({ "stream_key": "call:c:u", "reason": null })
        );
        assert_eq!(
            set_paused_payload("call:c:u", true),
            json!({ "stream_key": "call:c:u", "paused": true })
        );
    }

    #[test]
    fn parses_stream_dispatches_and_ignores_incomplete_ones() {
        let created = json!({ "rtc_server_id": "9", "stream_key": "call:c:u", "paused": false });
        assert_eq!(
            parse_stream_created(&created),
            Some(StreamCreated {
                rtc_server_id: "9".into(),
                stream_key: "call:c:u".into()
            })
        );
        let server =
            json!({ "stream_key": "call:c:u", "endpoint": "rtc.example:443", "token": "t" });
        assert_eq!(
            parse_stream_server(&server).map(|s| s.endpoint),
            Some("rtc.example:443".into())
        );
        assert_eq!(
            parse_stream_server(&json!({ "stream_key": "call:c:u", "endpoint": null })),
            None
        );
    }
}
