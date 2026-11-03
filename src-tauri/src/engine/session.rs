//! Session d'un compte connecté : gateway → store → événements vers l'interface, et client REST.

use std::{
    collections::HashSet,
    path::Path,
    sync::{Arc, Mutex},
};

use contract::{AccountId, EngineError, account::ConnectionState, events::EngineEvent};
use gateway::{Gateway, GatewayEvent, GatewayHandle};
use identity::ClientIdentity;
use rest::RestClient;
use store::Store;
use tokio::sync::mpsc;
use voice::SharedVoice;

use super::member_list::MemberLists;

pub type Emitter = Arc<dyn Fn(EngineEvent) + Send + Sync>;

pub struct Session {
    pub rest: RestClient,
    pub store: Arc<Mutex<Store>>,
    pub state: Arc<Mutex<ConnectionState>>,
    /// Salons dont l'historique récent a déjà été chargé par l'API pendant cette session.
    pub fetched: Mutex<HashSet<String>>,
    /// Dernier statut connu par utilisateur (amis au démarrage, puis PRESENCE_UPDATE).
    pub presences: Arc<Mutex<std::collections::HashMap<String, contract::user::PresenceStatus>>>,
    /// État vocal partagé avec la crate `voice` (roster gateway, appel en cours).
    pub voice: SharedVoice,
    gateway: GatewayHandle,
}

impl Session {
    pub fn start(
        account_id: &AccountId,
        token: String,
        identity: &ClientIdentity,
        cache_dir: &Path,
        emit: Emitter,
    ) -> Result<Self, EngineError> {
        let cache = cache_dir.join(format!("{account_id}.sqlite"));
        let store = Arc::new(Mutex::new(Store::open(account_id.clone(), Some(&cache))?));
        let rest =
            RestClient::new(identity.clone(), identity::API_BASE.into())?.with_token(token.clone());
        let (gateway, events) =
            Gateway::spawn(token, identity.clone(), identity::GATEWAY_URL.into());
        let state = Arc::new(Mutex::new(ConnectionState::Connecting));
        let presences = Arc::new(Mutex::new(std::collections::HashMap::new()));
        let voice = voice::new_shared(account_id.clone());
        let pump = Pump {
            account_id: account_id.clone(),
            store: store.clone(),
            state: state.clone(),
            emit,
            members: Mutex::new(MemberLists::default()),
            presences: presences.clone(),
            voice: voice.clone(),
        };
        tauri::async_runtime::spawn(pump.run(events));
        Ok(Self {
            rest,
            store,
            state,
            fetched: Mutex::new(HashSet::new()),
            presences,
            voice,
            gateway,
        })
    }

    pub fn connection(&self) -> ConnectionState {
        self.state
            .lock()
            .map(|s| *s)
            .unwrap_or(ConnectionState::Failed)
    }

    pub fn stop(&self) {
        self.gateway.shutdown();
    }

    /// Change son statut (op 3), visible par les autres.
    pub async fn set_status(&self, status: &str) -> Result<(), EngineError> {
        let d = serde_json::json!({ "status": status, "since": 0, "activities": [], "afk": false });
        self.gateway
            .send(3, d)
            .await
            .map_err(|e| super::internal(&format!("changement de statut impossible : {e}")))
    }

    /// Envoie un opcode brut au gateway (états vocaux, opcode 4).
    pub async fn send_op(&self, op: u8, d: serde_json::Value) -> Result<(), EngineError> {
        self.gateway
            .send(op, d)
            .await
            .map_err(|e| super::internal(&format!("envoi au gateway impossible : {e}")))
    }

    /// Abonne la session à la liste des membres d'un salon (100 premières lignes) : op 37.
    pub async fn subscribe_members(
        &self,
        guild_id: &str,
        channel_id: &str,
    ) -> Result<(), EngineError> {
        let mut channels = serde_json::Map::new();
        channels.insert(channel_id.to_owned(), serde_json::json!([[0, 99]]));
        let mut subs = serde_json::Map::new();
        subs.insert(
            guild_id.to_owned(),
            serde_json::json!({ "typing": true, "activities": true, "threads": true, "channels": channels }),
        );
        self.gateway
            .send(37, serde_json::json!({ "subscriptions": subs }))
            .await
            .map_err(|e| super::internal(&format!("abonnement aux membres impossible : {e}")))
    }
}

struct Pump {
    account_id: AccountId,
    store: Arc<Mutex<Store>>,
    state: Arc<Mutex<ConnectionState>>,
    emit: Emitter,
    members: Mutex<MemberLists>,
    presences: Arc<Mutex<std::collections::HashMap<String, contract::user::PresenceStatus>>>,
    voice: SharedVoice,
}

impl Pump {
    async fn run(self, mut events: mpsc::Receiver<GatewayEvent>) {
        while let Some(event) = events.recv().await {
            match event {
                GatewayEvent::State(state) => self.on_state(state),
                GatewayEvent::Dispatch { name, data, .. } => self.on_dispatch(&name, &data),
            }
        }
        tracing::info!(account = %self.account_id, "flux gateway terminé");
    }

    fn on_state(&self, state: ConnectionState) {
        if let Ok(mut current) = self.state.lock() {
            *current = state;
        }
        (self.emit)(EngineEvent::Connection {
            account_id: self.account_id.clone(),
            state,
        });
    }

    fn on_dispatch(&self, name: &str, data: &serde_json::Value) {
        self.track_members(name, data);
        self.track_voice(name, data);
        let produced = match self.store.lock() {
            Ok(mut store) => store.apply(name, data),
            Err(_) => {
                tracing::error!("store empoisonné, événement {name} ignoré");
                return;
            }
        };
        for event in produced {
            self.remember(&event);
            (self.emit)(event);
        }
    }
}

impl Pump {
    /// États vocaux : READY, GUILD_CREATE, VOICE_STATE_UPDATE, VOICE_SERVER_UPDATE.
    fn track_voice(&self, name: &str, data: &serde_json::Value) {
        if !matches!(
            name,
            "READY" | "GUILD_CREATE" | "VOICE_STATE_UPDATE" | "VOICE_SERVER_UPDATE"
        ) {
            return;
        }
        for event in voice::ingest(&self.voice, name, data) {
            (self.emit)(event);
        }
    }

    /// Statuts initiaux des amis (READY_SUPPLEMENTAL.merged_presences.friends).
    fn friend_presences(&self, data: &serde_json::Value) {
        use serde_json::Value;
        let friends = data
            .pointer("/merged_presences/friends")
            .and_then(Value::as_array);
        for p in friends.into_iter().flatten() {
            let (Some(user_id), Some(status)) = (
                p.get("user_id").and_then(Value::as_str),
                p.get("status").and_then(Value::as_str),
            ) else {
                continue;
            };
            let status = match status {
                "online" => contract::user::PresenceStatus::Online,
                "idle" => contract::user::PresenceStatus::Idle,
                "dnd" => contract::user::PresenceStatus::Dnd,
                _ => contract::user::PresenceStatus::Offline,
            };
            let event = EngineEvent::Presence {
                account_id: self.account_id.clone(),
                user_id: user_id.to_owned(),
                status,
            };
            self.remember(&event);
            (self.emit)(event);
        }
    }

    fn remember(&self, event: &EngineEvent) {
        if let EngineEvent::Presence {
            user_id, status, ..
        } = event
            && let Ok(mut map) = self.presences.lock()
        {
            map.insert(user_id.clone(), *status);
        }
    }

    fn track_members(&self, name: &str, data: &serde_json::Value) {
        let Ok(mut lists) = self.members.lock() else {
            return;
        };
        match name {
            "READY" => {
                for g in data
                    .get("guilds")
                    .and_then(serde_json::Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    lists.ingest_guild(g);
                }
            }
            "GUILD_CREATE" => lists.ingest_guild(data),
            "READY_SUPPLEMENTAL" => self.friend_presences(data),
            "GUILD_MEMBER_LIST_UPDATE" => {
                if let Some((guild_id, groups)) = lists.apply(data) {
                    (self.emit)(EngineEvent::MemberList {
                        account_id: self.account_id.clone(),
                        guild_id,
                        groups,
                    });
                }
            }
            _ => {}
        }
    }
}
