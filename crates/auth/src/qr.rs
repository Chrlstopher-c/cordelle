//! Connexion par QR code (remote auth v2). La clé RSA est générée ici, éphémère : Discord ne voit que la clé publique.

mod crypto;
mod payload;

use std::sync::Arc;
use std::time::Duration;

use contract::auth::QrAuthEvent;
use contract::user::User;
use futures_util::{SinkExt, StreamExt};
use identity::ClientIdentity;
use rsa::RsaPrivateKey;
use serde_json::{Value, json};
use tokio::net::TcpStream;
use tokio::sync::{Notify, mpsc, oneshot};
use tokio::time::{Instant, Interval, interval_at};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::{HeaderValue, header::ORIGIN};
use tokio_tungstenite::tungstenite::{self, Message};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

use crate::AuthError;
use crate::http::{Api, api_error};

/// Résultat final : utilisateur scanné et jeton déchiffré.
pub type QrOutcome = Result<(User, String), AuthError>;

const EVENT_BUFFER: usize = 16;
const QR_URL_PREFIX: &str = "https://discord.com/ra/";

type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// Permet d'annuler la connexion QR en cours depuis l'interface.
pub struct QrHandle {
    cancel: Arc<Notify>,
}

impl QrHandle {
    pub fn cancel(&self) {
        self.cancel.notify_one();
    }
}

/// Lance la connexion QR. Doit être appelée dans un runtime tokio.
pub fn start(
    identity: &ClientIdentity,
    ws_url: &str,
    api_base: &str,
) -> (
    QrHandle,
    mpsc::Receiver<QrAuthEvent>,
    oneshot::Receiver<QrOutcome>,
) {
    let (events, event_rx) = mpsc::channel(EVENT_BUFFER);
    let (outcome_tx, outcome_rx) = oneshot::channel();
    let cancel = Arc::new(Notify::new());
    let session = Session {
        identity: identity.clone(),
        ws_url: ws_url.to_owned(),
        api_base: api_base.to_owned(),
        events,
        cancel: Arc::clone(&cancel),
    };
    tokio::spawn(async move {
        let outcome = session.run().await;
        if outcome_tx.send(outcome).is_err() {
            tracing::debug!("résultat QR ignoré : receveur fermé");
        }
    });
    (QrHandle { cancel }, event_rx, outcome_rx)
}

struct Session {
    identity: ClientIdentity,
    ws_url: String,
    api_base: String,
    events: mpsc::Sender<QrAuthEvent>,
    cancel: Arc<Notify>,
}

/// État mutable d'une session : clé, client HTTP, utilisateur scanné, battement de cœur.
struct State {
    key: RsaPrivateKey,
    api: Api,
    user: Option<User>,
    heartbeat: Option<Interval>,
}

/// Opérations reçues du serveur remote auth. Les opérations inconnues tombent dans `Unknown`.
#[derive(serde::Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Incoming {
    Hello {
        heartbeat_interval: u64,
    },
    HeartbeatAck,
    NonceProof {
        encrypted_nonce: String,
    },
    PendingRemoteInit {
        fingerprint: String,
    },
    PendingTicket {
        encrypted_user_payload: String,
    },
    PendingLogin {
        ticket: String,
    },
    Cancel,
    #[serde(other)]
    Unknown,
}

impl Session {
    async fn run(self) -> QrOutcome {
        let outcome = self.connect_and_drive().await;
        match &outcome {
            Ok(_) => {}
            Err(AuthError::Cancelled) => self.emit(QrAuthEvent::Cancelled).await,
            Err(AuthError::Expired) => self.emit(QrAuthEvent::Expired).await,
            Err(err) => {
                tracing::error!(error = %err, "connexion QR échouée");
                self.emit(QrAuthEvent::Failed {
                    message: err.to_string(),
                })
                .await;
            }
        }
        outcome
    }

    async fn connect_and_drive(&self) -> QrOutcome {
        let key = crypto::generate_key().await?;
        let api = Api::new(&self.identity, &self.api_base)?;
        let mut ws = self.connect().await?;
        let mut state = State {
            key,
            api,
            user: None,
            heartbeat: None,
        };
        let outcome = self.drive(&mut ws, &mut state).await;
        if let Err(err) = ws.close(None).await {
            tracing::debug!(error = %err, "fermeture WebSocket remote auth");
        }
        outcome
    }

    async fn connect(&self) -> Result<Ws, AuthError> {
        let mut request = self
            .ws_url
            .as_str()
            .into_client_request()
            .map_err(|err| ws_error(&err))?;
        request
            .headers_mut()
            .insert(ORIGIN, HeaderValue::from_static(identity::ORIGIN));
        let (ws, _) = connect_async(request).await.map_err(|err| ws_error(&err))?;
        Ok(ws)
    }

    async fn drive(&self, ws: &mut Ws, state: &mut State) -> QrOutcome {
        loop {
            tokio::select! {
                frame = ws.next() => {
                    if let Some(outcome) = self.on_frame(ws, state, frame).await? {
                        return Ok(outcome);
                    }
                }
                () = next_beat(&mut state.heartbeat) => send(ws, json!({"op": "heartbeat"})).await?,
                () = self.cancel.notified() => return Err(AuthError::Cancelled),
            }
        }
    }

    async fn on_frame(
        &self,
        ws: &mut Ws,
        state: &mut State,
        frame: Option<Result<Message, tungstenite::Error>>,
    ) -> Result<Option<(User, String)>, AuthError> {
        match frame {
            Some(Ok(Message::Text(text))) => self.on_text(ws, state, &text).await,
            Some(Ok(Message::Close(_))) | None => Err(AuthError::Expired),
            Some(Ok(_)) => Ok(None),
            Some(Err(err)) => Err(ws_error(&err)),
        }
    }

    async fn on_text(
        &self,
        ws: &mut Ws,
        state: &mut State,
        text: &str,
    ) -> Result<Option<(User, String)>, AuthError> {
        let Some(incoming) = decode(text) else {
            return Ok(None);
        };
        match incoming {
            Incoming::Hello { heartbeat_interval } => {
                self.on_hello(ws, state, heartbeat_interval).await?
            }
            Incoming::NonceProof { encrypted_nonce } => {
                self.on_nonce(ws, state, &encrypted_nonce).await?
            }
            Incoming::PendingRemoteInit { fingerprint } => {
                self.emit(QrAuthEvent::Ready {
                    url: format!("{QR_URL_PREFIX}{fingerprint}"),
                })
                .await;
            }
            Incoming::PendingTicket {
                encrypted_user_payload,
            } => {
                self.on_scanned(state, &encrypted_user_payload).await?;
            }
            Incoming::PendingLogin { ticket } => {
                return self.on_login(state, &ticket).await.map(Some);
            }
            Incoming::Cancel => return Err(AuthError::Cancelled),
            Incoming::HeartbeatAck | Incoming::Unknown => {}
        }
        Ok(None)
    }

    async fn on_hello(
        &self,
        ws: &mut Ws,
        state: &mut State,
        heartbeat_ms: u64,
    ) -> Result<(), AuthError> {
        let period = Duration::from_millis(heartbeat_ms.max(1));
        state.heartbeat = Some(interval_at(Instant::now() + period, period));
        let encoded_public_key = crypto::public_key_b64(&state.key)?;
        send(
            ws,
            json!({"op": "init", "encoded_public_key": encoded_public_key}),
        )
        .await
    }

    async fn on_nonce(
        &self,
        ws: &mut Ws,
        state: &State,
        encrypted_nonce: &str,
    ) -> Result<(), AuthError> {
        let proof = crypto::nonce_proof(&state.key, encrypted_nonce)?;
        send(ws, json!({"op": "nonce_proof", "proof": proof})).await
    }

    async fn on_scanned(
        &self,
        state: &mut State,
        encrypted_user_payload: &str,
    ) -> Result<(), AuthError> {
        let text = crypto::decrypt_text(&state.key, encrypted_user_payload)?;
        let user = payload::parse_user(&text)?;
        state.user = Some(user.clone());
        self.emit(QrAuthEvent::Scanned { user }).await;
        Ok(())
    }

    async fn on_login(&self, state: &mut State, ticket: &str) -> Result<(User, String), AuthError> {
        let token = self.fetch_token(state, ticket).await?;
        let user = state
            .user
            .take()
            .ok_or_else(|| AuthError::Protocol("connexion sans utilisateur scanné".into()))?;
        Ok((user, token))
    }

    async fn fetch_token(&self, state: &State, ticket: &str) -> Result<String, AuthError> {
        let reply = state
            .api
            .post(
                "/users/@me/remote-auth/login",
                &json!({"ticket": ticket}),
                &Vec::new(),
            )
            .await?;
        if !reply.status.is_success() {
            return Err(api_error(&reply));
        }
        let encrypted = reply.body["encrypted_token"]
            .as_str()
            .ok_or_else(|| AuthError::Protocol("encrypted_token absent".into()))?;
        crypto::decrypt_text(&state.key, encrypted)
    }

    async fn emit(&self, event: QrAuthEvent) {
        if self.events.send(event).await.is_err() {
            tracing::debug!("évènement QR ignoré : receveur fermé");
        }
    }
}

fn decode(text: &str) -> Option<Incoming> {
    serde_json::from_str(text)
        .inspect_err(|err| tracing::warn!(error = %err, "message remote auth ignoré"))
        .ok()
}

async fn next_beat(beat: &mut Option<Interval>) {
    match beat {
        Some(interval) => {
            interval.tick().await;
        }
        None => std::future::pending::<()>().await,
    }
}

async fn send(ws: &mut Ws, value: Value) -> Result<(), AuthError> {
    ws.send(Message::Text(value.to_string().into()))
        .await
        .map_err(|err| ws_error(&err))
}

fn ws_error(err: &tungstenite::Error) -> AuthError {
    tracing::error!(error = %err, "WebSocket remote auth en erreur");
    AuthError::Network(err.to_string())
}
