//! Helpers partagés par les tests d'intégration (chaque binaire n'en utilise pas tous).
#![allow(dead_code)]

use serde_json::Value;
use store::Store;

pub const ME: &str = "111111111111111111";
pub const ACCOUNT: &str = "acc-1";
pub const GUILD_ALPHA: &str = "222222222222222222";
pub const GENERAL: &str = "260000000000000002";
pub const DM_ALICE: &str = "280000000000000001";

pub fn fixture(name: &str) -> Value {
    let path = format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("fixture {path}: {e}"));
    serde_json::from_str(&raw).unwrap_or_else(|e| panic!("JSON {path}: {e}"))
}

pub fn ready_store() -> Store {
    let mut store = Store::open(ACCOUNT.to_string(), None).expect("store en mémoire");
    store.apply("READY", &fixture("ready_split.json"));
    store
}

/// Copie le message de référence avec un autre identifiant.
pub fn message_with_id(id: &str, channel_id: &str) -> Value {
    let mut message = fixture("message.json");
    message["id"] = Value::from(id);
    message["channel_id"] = Value::from(channel_id);
    message
}
