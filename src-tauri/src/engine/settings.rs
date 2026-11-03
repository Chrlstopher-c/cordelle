//! Réglages du compte : sessions (`/auth/sessions`), comptes liés (`/users/@me/connections`), abonnements.

use contract::{
    AccountId, EngineError,
    settings::{DeviceSession, LinkedService, Subscription},
};
use serde_json::{Value, json};

use super::{Engine, internal};

/// Un segment d'URL venant de l'interface : lettres, chiffres, `-` et `_` seulement.
fn is_segment(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn str_of(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::to_owned)
}

fn parse_session(raw: &Value) -> Option<DeviceSession> {
    let info = raw.get("client_info").unwrap_or(&Value::Null);
    Some(DeviceSession {
        id_hash: str_of(raw, "session_id_hash")?,
        client: str_of(info, "client").unwrap_or_else(|| "Client inconnu".into()),
        os: str_of(info, "os").unwrap_or_default(),
        location: str_of(info, "location"),
        last_active: str_of(raw, "approx_last_used_time"),
    })
}

fn parse_service(raw: &Value) -> Option<LinkedService> {
    Some(LinkedService {
        kind: str_of(raw, "type")?,
        id: str_of(raw, "id")?,
        name: str_of(raw, "name").unwrap_or_default(),
        verified: raw
            .get("verified")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        // Discord : visibility 1 = affiché sur le profil, 0 = masqué.
        visible: raw.get("visibility").and_then(Value::as_u64) == Some(1),
    })
}

fn parse_subscription(raw: &Value) -> Option<Subscription> {
    Some(Subscription {
        id: str_of(raw, "id")?,
        status: str_of(raw, "status").unwrap_or_else(|| "inconnu".into()),
        period_end: str_of(raw, "current_period_end"),
        canceled: raw.get("canceled_at").is_some_and(|v| v.is_string()),
    })
}

impl Engine {
    pub async fn device_sessions(
        &self,
        account_id: &AccountId,
    ) -> Result<Vec<DeviceSession>, EngineError> {
        let session = self.session(account_id)?;
        let raw: Value = session.rest.get_json("/auth/sessions").await?;
        Ok(raw
            .get("user_sessions")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_session).collect())
            .unwrap_or_default())
    }

    pub async fn device_logout(
        &self,
        account_id: &AccountId,
        id_hashes: &[String],
    ) -> Result<(), EngineError> {
        if id_hashes.is_empty() {
            return Ok(());
        }
        let session = self.session(account_id)?;
        let body = json!({ "session_id_hashes": id_hashes });
        session.rest.post("/auth/sessions/logout", &body).await?;
        Ok(())
    }

    pub async fn linked_services(
        &self,
        account_id: &AccountId,
    ) -> Result<Vec<LinkedService>, EngineError> {
        let session = self.session(account_id)?;
        let raw: Vec<Value> = session.rest.get_json("/users/@me/connections").await?;
        Ok(raw.iter().filter_map(parse_service).collect())
    }

    pub async fn linked_service_remove(
        &self,
        account_id: &AccountId,
        kind: &str,
        id: &str,
    ) -> Result<(), EngineError> {
        if !is_segment(kind) || !is_segment(id) {
            return Err(internal("identifiant de compte lié invalide"));
        }
        let session = self.session(account_id)?;
        session
            .rest
            .delete(&format!("/users/@me/connections/{kind}/{id}"))
            .await?;
        Ok(())
    }

    pub async fn subscriptions(
        &self,
        account_id: &AccountId,
    ) -> Result<Vec<Subscription>, EngineError> {
        let session = self.session(account_id)?;
        let raw: Vec<Value> = session
            .rest
            .get_json("/users/@me/billing/subscriptions")
            .await?;
        Ok(raw.iter().filter_map(parse_subscription).collect())
    }
}
