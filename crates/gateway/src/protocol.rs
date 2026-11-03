//! Opcodes et payloads JSON de la gateway Discord.

use identity::ClientIdentity;
use serde_json::{Value, json};

use crate::error::GatewayError;

pub const OP_DISPATCH: u8 = 0;
pub const OP_HEARTBEAT: u8 = 1;
pub const OP_IDENTIFY: u8 = 2;
pub const OP_RESUME: u8 = 6;
pub const OP_RECONNECT: u8 = 7;
pub const OP_INVALID_SESSION: u8 = 9;
pub const OP_HELLO: u8 = 10;
pub const OP_HEARTBEAT_ACK: u8 = 11;

const CAPABILITIES: u32 = 30717;

#[derive(Debug, Clone, PartialEq)]
pub struct Payload {
    pub op: u8,
    pub d: Value,
    pub s: Option<u64>,
    pub t: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadyInfo {
    pub session_id: String,
    pub resume_gateway_url: String,
}

pub fn parse_payload(text: &str) -> Result<Payload, GatewayError> {
    let raw: Value = serde_json::from_str(text)?;
    let op = raw
        .get("op")
        .and_then(Value::as_u64)
        .and_then(|v| u8::try_from(v).ok())
        .ok_or(GatewayError::Field("op"))?;
    Ok(Payload {
        op,
        d: raw.get("d").cloned().unwrap_or(Value::Null),
        s: raw.get("s").and_then(Value::as_u64),
        t: raw.get("t").and_then(Value::as_str).map(str::to_owned),
    })
}

pub fn hello_interval_ms(d: &Value) -> Result<u64, GatewayError> {
    d.get("heartbeat_interval")
        .and_then(Value::as_u64)
        .ok_or(GatewayError::Field("heartbeat_interval"))
}

pub fn invalid_session_resumable(d: &Value) -> bool {
    d.as_bool().unwrap_or(false)
}

pub fn parse_ready(d: &Value) -> Result<ReadyInfo, GatewayError> {
    Ok(ReadyInfo {
        session_id: str_field(d, "session_id")?,
        resume_gateway_url: str_field(d, "resume_gateway_url")?,
    })
}

fn str_field(d: &Value, key: &'static str) -> Result<String, GatewayError> {
    d.get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or(GatewayError::Field(key))
}

pub fn identify_payload(token: &str, identity: &ClientIdentity) -> Value {
    json!({"op": OP_IDENTIFY, "d": {
        "token": token,
        "capabilities": CAPABILITIES,
        "properties": identity.identify_properties(),
        "presence": {"status": "unknown", "since": 0, "activities": [], "afk": false},
        "compress": false,
        "client_state": {"guild_versions": {}}
    }})
}

pub fn resume_payload(token: &str, session_id: &str, seq: u64) -> Value {
    json!({"op": OP_RESUME, "d": {"token": token, "session_id": session_id, "seq": seq}})
}

pub fn heartbeat_payload(seq: Option<u64>) -> Value {
    json!({"op": OP_HEARTBEAT, "d": seq})
}

#[cfg(test)]
mod tests {
    use identity::ClientIdentity;
    use serde_json::json;

    use super::*;

    #[test]
    fn parse_hello_extrait_l_intervalle() {
        let p = parse_payload(r#"{"op":10,"d":{"heartbeat_interval":41250}}"#).expect("hello");
        assert_eq!(p.op, OP_HELLO);
        assert_eq!(p.s, None);
        assert_eq!(hello_interval_ms(&p.d).expect("intervalle"), 41250);
    }

    #[test]
    fn parse_dispatch_extrait_seq_et_nom() {
        let p = parse_payload(r#"{"op":0,"s":7,"t":"MESSAGE_CREATE","d":{"id":"1"}}"#)
            .expect("dispatch");
        assert_eq!(p.op, OP_DISPATCH);
        assert_eq!(p.s, Some(7));
        assert_eq!(p.t.as_deref(), Some("MESSAGE_CREATE"));
        assert_eq!(p.d["id"], "1");
    }

    #[test]
    fn parse_ack_sans_d_ni_s() {
        let p = parse_payload(r#"{"op":11}"#).expect("ack");
        assert_eq!(p.op, OP_HEARTBEAT_ACK);
        assert!(p.d.is_null());
    }

    #[test]
    fn parse_rejette_opcode_absent_ou_invalide() {
        assert!(parse_payload(r#"{"d":1}"#).is_err());
        assert!(parse_payload(r#"{"op":"x"}"#).is_err());
        assert!(parse_payload(r#"{"op":300}"#).is_err());
        assert!(parse_payload("pas du json").is_err());
    }

    #[test]
    fn invalid_session_lit_le_booleen() {
        assert!(invalid_session_resumable(&json!(true)));
        assert!(!invalid_session_resumable(&json!(false)));
        assert!(!invalid_session_resumable(&Value::Null));
    }

    #[test]
    fn ready_exige_session_et_url_de_reprise() {
        let d = json!({"session_id": "s1", "resume_gateway_url": "wss://r.example"});
        let info = parse_ready(&d).expect("ready");
        assert_eq!(info.session_id, "s1");
        assert_eq!(info.resume_gateway_url, "wss://r.example");
        assert!(parse_ready(&json!({"session_id": "s1"})).is_err());
    }

    #[test]
    fn identify_contient_le_jeton_et_les_champs_fixes() {
        let id = ClientIdentity::new(400_000, "fr");
        let p = identify_payload("tok", &id);
        assert_eq!(p["op"], OP_IDENTIFY);
        assert_eq!(p["d"]["token"], "tok");
        assert_eq!(p["d"]["capabilities"], CAPABILITIES);
        assert_eq!(p["d"]["compress"], false);
        assert_eq!(p["d"]["presence"]["status"], "unknown");
        assert_eq!(p["d"]["properties"]["os"], "Linux");
    }

    #[test]
    fn resume_et_heartbeat_ont_la_forme_attendue() {
        let r = resume_payload("tok", "s1", 42);
        assert_eq!(
            r,
            json!({"op": 6, "d": {"token": "tok", "session_id": "s1", "seq": 42}})
        );
        assert_eq!(heartbeat_payload(Some(3)), json!({"op": 1, "d": 3}));
        assert_eq!(heartbeat_payload(None), json!({"op": 1, "d": null}));
    }
}
