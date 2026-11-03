//! État de session conservé entre les connexions successives : identifiants de reprise, séquence, canaux.

use identity::ClientIdentity;
use serde_json::Value;
use tokio::sync::{mpsc, watch};

use crate::handle::GatewayEvent;
use crate::protocol::{ReadyInfo, identify_payload, resume_payload};

const GATEWAY_QUERY: &str = "v=9&encoding=json&compress=zlib-stream";

pub(crate) struct Session {
    pub token: String,
    pub identity: ClientIdentity,
    pub base_url: String,
    pub session_id: Option<String>,
    pub resume_url: Option<String>,
    pub seq: Option<u64>,
    pub reached_ready: bool,
    pub events: mpsc::Sender<GatewayEvent>,
    pub outbound: mpsc::Receiver<String>,
    pub shutdown: watch::Receiver<bool>,
}

impl Session {
    pub fn new(
        token: String,
        identity: ClientIdentity,
        base_url: String,
        events: mpsc::Sender<GatewayEvent>,
        outbound: mpsc::Receiver<String>,
        shutdown: watch::Receiver<bool>,
    ) -> Self {
        Self {
            token,
            identity,
            base_url,
            session_id: None,
            resume_url: None,
            seq: None,
            reached_ready: false,
            events,
            outbound,
            shutdown,
        }
    }

    pub fn can_resume(&self) -> bool {
        self.session_id.is_some()
    }

    /// URL de la prochaine connexion : `resume_gateway_url` pour une reprise, sinon l'URL initiale.
    pub fn connect_url(&self) -> String {
        match (&self.session_id, &self.resume_url) {
            (Some(_), Some(resume)) => with_gateway_query(resume),
            _ => self.base_url.clone(),
        }
    }

    /// Premier message d'une connexion : `resume` si la session est reprenable, sinon `identify`.
    pub fn handshake(&self) -> Value {
        match &self.session_id {
            Some(session_id) => {
                resume_payload(&self.token, session_id, self.seq.unwrap_or_default())
            }
            None => identify_payload(&self.token, &self.identity),
        }
    }

    pub fn apply_ready(&mut self, info: ReadyInfo) {
        self.session_id = Some(info.session_id);
        self.resume_url = Some(info.resume_gateway_url);
    }

    pub fn record_seq(&mut self, s: Option<u64>) {
        if let Some(s) = s {
            self.seq = Some(s);
        }
    }

    pub fn clear(&mut self) {
        self.session_id = None;
        self.resume_url = None;
        self.seq = None;
    }

    /// Renvoie `false` si le récepteur d'événements a été fermé.
    pub async fn emit(&self, event: GatewayEvent) -> bool {
        self.events.send(event).await.is_ok()
    }
}

/// Attend l'arrêt demandé. Un émetteur abandonné compte aussi comme arrêt.
pub(crate) async fn wait_shutdown(rx: &mut watch::Receiver<bool>) {
    loop {
        if *rx.borrow() {
            return;
        }
        if rx.changed().await.is_err() {
            return;
        }
    }
}

fn with_gateway_query(url: &str) -> String {
    let separator = if url.contains('?') { '&' } else { '?' };
    format!("{url}{separator}{GATEWAY_QUERY}")
}

#[cfg(test)]
mod tests {
    use super::with_gateway_query;

    #[test]
    fn url_de_reprise_ajoute_la_requete_une_seule_fois() {
        assert_eq!(
            with_gateway_query("wss://r.example"),
            "wss://r.example?v=9&encoding=json&compress=zlib-stream"
        );
        assert_eq!(
            with_gateway_query("wss://r.example/?x=1"),
            "wss://r.example/?x=1&v=9&encoding=json&compress=zlib-stream"
        );
    }
}
