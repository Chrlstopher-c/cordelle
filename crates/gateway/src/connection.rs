//! Une connexion WebSocket : Hello, identify ou resume, lecture, battements, envoi sortant, fermeture.

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tokio::net::TcpStream;
use tokio::time::{Instant, Interval, interval_at};
use tokio_tungstenite::tungstenite::{Error as WsError, Message};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

use crate::dispatch::handle_dispatch;
use crate::error::GatewayError;
use crate::heartbeat::Heartbeat;
use crate::inflate::Inflater;
use crate::protocol::{self, Payload};
use crate::protocol::{
    OP_DISPATCH, OP_HEARTBEAT, OP_HEARTBEAT_ACK, OP_HELLO, OP_INVALID_SESSION, OP_RECONNECT,
};
use crate::session::{Session, wait_shutdown};

/// Issue d'une connexion : ce que la boucle de vie doit faire ensuite.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Exit {
    /// Arrêt demandé ou émetteur abandonné.
    Shutdown,
    /// Fermeture définitive (auth ou configuration invalide) : pas de reconnexion.
    Fatal(u16),
    /// Coupure ou zombie : reprise de la session avec backoff.
    KeepSession,
    /// Session invalide : identify neuf après une pause.
    ResetSession,
}

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

enum Step {
    Incoming(Option<Result<Message, WsError>>),
    Beat,
    Outgoing(Option<String>),
    Shutdown,
}

struct Connection {
    ws: WsStream,
    inflater: Inflater,
    heartbeat: Option<Heartbeat>,
    ticker: Option<Interval>,
}

pub(crate) async fn run_once(session: &mut Session) -> Exit {
    let url = session.connect_url();
    let ws = match connect_async(url.as_str()).await {
        Ok((ws, _)) => ws,
        Err(err) => {
            tracing::error!(error = %err, "connexion à la gateway impossible");
            return Exit::KeepSession;
        }
    };
    let connection = Connection {
        ws,
        inflater: Inflater::new(),
        heartbeat: None,
        ticker: None,
    };
    connection.run(session).await
}

/// Code de fermeture → issue. 4004 et 4010-4014 sont fatales ; 4007 et 4009 invalident la session.
pub(crate) fn exit_for_close(code: Option<u16>) -> Exit {
    match code {
        Some(code @ (4004 | 4010..=4014)) => Exit::Fatal(code),
        Some(4007 | 4009) => Exit::ResetSession,
        _ => Exit::KeepSession,
    }
}

fn exit_for_invalid_session(d: &Value) -> Exit {
    if protocol::invalid_session_resumable(d) {
        Exit::KeepSession
    } else {
        Exit::ResetSession
    }
}

async fn next_beat(ticker: &mut Option<Interval>) {
    match ticker {
        Some(interval) => {
            interval.tick().await;
        }
        None => std::future::pending::<()>().await,
    }
}

impl Connection {
    async fn run(mut self, session: &mut Session) -> Exit {
        loop {
            let step = self.next_step(session).await;
            if let Some(exit) = self.apply(session, step).await {
                return exit;
            }
        }
    }

    async fn next_step(&mut self, session: &mut Session) -> Step {
        tokio::select! {
            item = self.ws.next() => Step::Incoming(item),
            _ = next_beat(&mut self.ticker) => Step::Beat,
            text = session.outbound.recv() => Step::Outgoing(text),
            _ = wait_shutdown(&mut session.shutdown) => Step::Shutdown,
        }
    }

    async fn apply(&mut self, session: &mut Session, step: Step) -> Option<Exit> {
        match step {
            Step::Incoming(item) => self.on_incoming(session, item).await,
            Step::Beat => self.on_beat(session.seq).await,
            Step::Outgoing(Some(text)) => self.send_text(text).await,
            Step::Outgoing(None) | Step::Shutdown => {
                self.close().await;
                Some(Exit::Shutdown)
            }
        }
    }

    async fn on_incoming(
        &mut self,
        session: &mut Session,
        item: Option<Result<Message, WsError>>,
    ) -> Option<Exit> {
        match item {
            Some(Ok(Message::Close(frame))) => {
                Some(exit_for_close(frame.map(|f| u16::from(f.code))))
            }
            Some(Ok(message)) => self.on_message(session, message).await,
            Some(Err(err)) => {
                tracing::error!(error = %err, "erreur réseau gateway");
                Some(Exit::KeepSession)
            }
            None => Some(Exit::KeepSession),
        }
    }

    async fn on_message(&mut self, session: &mut Session, message: Message) -> Option<Exit> {
        let text = match message {
            Message::Text(text) => text.as_str().to_owned(),
            Message::Binary(bytes) => match self.decode_binary(&bytes) {
                Ok(Some(text)) => text,
                Ok(None) => return None,
                Err(err) => {
                    tracing::error!(error = %err, "décompression gateway échouée");
                    return Some(Exit::KeepSession);
                }
            },
            _ => return None,
        };
        match protocol::parse_payload(&text) {
            Ok(payload) => self.dispatch(session, payload).await,
            Err(err) => {
                tracing::error!(error = %err, "payload gateway invalide");
                None
            }
        }
    }

    fn decode_binary(&mut self, bytes: &[u8]) -> Result<Option<String>, GatewayError> {
        match self.inflater.push(bytes)? {
            Some(full) => Ok(Some(String::from_utf8(full)?)),
            None => Ok(None),
        }
    }

    async fn dispatch(&mut self, session: &mut Session, payload: Payload) -> Option<Exit> {
        match payload.op {
            OP_HELLO => self.on_hello(session, &payload.d).await,
            OP_DISPATCH => handle_dispatch(session, payload).await,
            OP_HEARTBEAT => {
                self.send_json(&protocol::heartbeat_payload(session.seq))
                    .await
            }
            OP_HEARTBEAT_ACK => {
                if let Some(heartbeat) = self.heartbeat.as_mut() {
                    heartbeat.mark_ack();
                }
                None
            }
            OP_RECONNECT => Some(Exit::KeepSession),
            OP_INVALID_SESSION => Some(exit_for_invalid_session(&payload.d)),
            _ => None,
        }
    }

    async fn on_hello(&mut self, session: &Session, d: &Value) -> Option<Exit> {
        let interval_ms = match protocol::hello_interval_ms(d) {
            Ok(ms) => ms,
            Err(err) => {
                tracing::error!(error = %err, "Hello invalide");
                return Some(Exit::KeepSession);
            }
        };
        let heartbeat = Heartbeat::new(interval_ms);
        let first = Instant::now() + heartbeat.first_delay(rand::random::<f64>());
        self.ticker = Some(interval_at(first, heartbeat.interval()));
        self.heartbeat = Some(heartbeat);
        self.send_json(&session.handshake()).await
    }

    async fn on_beat(&mut self, seq: Option<u64>) -> Option<Exit> {
        let heartbeat = self.heartbeat.as_mut()?;
        if heartbeat.is_zombie() {
            tracing::warn!("battement sans ACK : connexion zombie, reprise");
            return Some(Exit::KeepSession);
        }
        heartbeat.mark_sent();
        self.send_json(&protocol::heartbeat_payload(seq)).await
    }

    async fn send_json(&mut self, value: &Value) -> Option<Exit> {
        self.send_text(value.to_string()).await
    }

    async fn send_text(&mut self, text: String) -> Option<Exit> {
        match self.ws.send(Message::Text(text.into())).await {
            Ok(()) => None,
            Err(err) => {
                tracing::error!(error = %err, "envoi gateway échoué");
                Some(Exit::KeepSession)
            }
        }
    }

    async fn close(&mut self) {
        if let Err(err) = self.ws.close(None).await {
            tracing::warn!(error = %err, "fermeture gateway incomplète");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Exit, exit_for_close, exit_for_invalid_session};
    use serde_json::json;

    #[test]
    fn fermetures_fatales_et_invalidantes() {
        assert_eq!(exit_for_close(Some(4004)), Exit::Fatal(4004));
        assert_eq!(exit_for_close(Some(4010)), Exit::Fatal(4010));
        assert_eq!(exit_for_close(Some(4014)), Exit::Fatal(4014));
        assert_eq!(exit_for_close(Some(4009)), Exit::ResetSession);
        assert_eq!(exit_for_close(Some(1006)), Exit::KeepSession);
        assert_eq!(exit_for_close(None), Exit::KeepSession);
    }

    #[test]
    fn invalid_session_choisit_reprise_ou_identify() {
        assert_eq!(exit_for_invalid_session(&json!(true)), Exit::KeepSession);
        assert_eq!(exit_for_invalid_session(&json!(false)), Exit::ResetSession);
    }
}
