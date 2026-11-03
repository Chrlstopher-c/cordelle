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

use super::member_list::MemberLists;

pub type Emitter = Arc<dyn Fn(EngineEvent) + Send + Sync>;

pub struct Session {
    pub rest: RestClient,
    pub store: Arc<Mutex<Store>>,
    pub state: Arc<Mutex<ConnectionState>>,
    /// Salons dont l'historique récent a déjà été chargé par l'API pendant cette session.
    pub fetched: Mutex<HashSet<String>>,
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
        let pump = Pump {
            account_id: account_id.clone(),
            store: store.clone(),
            state: state.clone(),
            emit,
            members: Mutex::new(MemberLists::default()),
        };
        tauri::async_runtime::spawn(pump.run(events));
        Ok(Self {
            rest,
            store,
            state,
            fetched: Mutex::new(HashSet::new()),
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
        let produced = match self.store.lock() {
            Ok(mut store) => store.apply(name, data),
            Err(_) => {
                tracing::error!("store empoisonné, événement {name} ignoré");
                return;
            }
        };
        for event in produced {
            (self.emit)(event);
        }
    }
}

impl Pump {
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
