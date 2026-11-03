//! API publique : lancement de la connexion d'un compte, envoi d'opcodes, arrêt.

use contract::account::ConnectionState;
use identity::ClientIdentity;
use serde_json::{Value, json};
use tokio::sync::{mpsc, watch};

use crate::error::GatewayError;
use crate::session::Session;
use crate::supervisor;

const OUTBOUND_CAPACITY: usize = 64;
const EVENT_CAPACITY: usize = 256;

#[derive(Debug, Clone, PartialEq)]
pub enum GatewayEvent {
    State(ConnectionState),
    Dispatch { name: String, seq: u64, data: Value },
}

pub struct GatewayHandle {
    outbound: mpsc::Sender<String>,
    shutdown: watch::Sender<bool>,
}

impl GatewayHandle {
    /// Envoie un opcode brut `{"op": op, "d": d}` sur la connexion courante (mise en file si reconnexion).
    pub async fn send(&self, op: u8, d: Value) -> Result<(), GatewayError> {
        self.outbound
            .send(json!({"op": op, "d": d}).to_string())
            .await
            .map_err(|_| GatewayError::Closed)
    }

    pub fn shutdown(&self) {
        self.shutdown.send_replace(true);
    }
}

pub struct Gateway;

impl Gateway {
    /// Lance la boucle de connexion d'un compte. Doit être appelé dans un runtime tokio.
    pub fn spawn(
        token: String,
        identity: ClientIdentity,
        url: String,
    ) -> (GatewayHandle, mpsc::Receiver<GatewayEvent>) {
        let (outbound, outbound_rx) = mpsc::channel(OUTBOUND_CAPACITY);
        let (events, events_rx) = mpsc::channel(EVENT_CAPACITY);
        let (shutdown, shutdown_rx) = watch::channel(false);
        let session = Session::new(token, identity, url, events, outbound_rx, shutdown_rx);
        tokio::spawn(supervisor::run(session));
        (GatewayHandle { outbound, shutdown }, events_rx)
    }
}
