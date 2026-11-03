//! Flux QR complet contre un faux serveur remote-auth (WebSocket) et un faux HTTP (wiremock).

use std::sync::Arc;

use auth::AuthError;
use auth::qr::{self, QrHandle};
use base64::{
    Engine as _,
    engine::general_purpose::{STANDARD as B64, URL_SAFE_NO_PAD},
};
use contract::auth::QrAuthEvent;
use contract::user::User;
use futures_util::{SinkExt, StreamExt};
use identity::ClientIdentity;
use rsa::pkcs8::DecodePublicKey;
use rsa::rand_core::OsRng;
use rsa::{Oaep, RsaPublicKey};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::{WebSocketStream, accept_hdr_async};
use wiremock::matchers::{body_json, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

const NONCE: &[u8] = b"fixed-nonce-bytes";
const ORIGIN: &str = "https://discord.com";

type Server = WebSocketStream<TcpStream>;

struct Fake {
    ws: Server,
    key: Option<RsaPublicKey>,
    heartbeats: usize,
}

impl Fake {
    async fn send(&mut self, value: Value) {
        self.ws
            .send(Message::Text(value.to_string().into()))
            .await
            .expect("envoi");
    }

    async fn next_value(&mut self) -> Option<Value> {
        loop {
            let frame = self.ws.next().await?.expect("trame");
            if let Message::Text(text) = frame {
                return Some(serde_json::from_str(&text).expect("json"));
            }
        }
    }

    /// Attend la prochaine opération `op` ; répond aux heartbeats au passage.
    async fn expect_op(&mut self, op: &str) -> Value {
        loop {
            let value = self.next_value().await.expect("flux ouvert");
            match value["op"].as_str() {
                Some("heartbeat") => self.ack_heartbeat().await,
                Some(found) if found == op => return value,
                other => panic!("opération inattendue {other:?}, attendu {op}"),
            }
        }
    }

    async fn ack_heartbeat(&mut self) {
        self.heartbeats += 1;
        self.send(json!({"op": "heartbeat_ack"})).await;
    }

    async fn read_until_heartbeat(&mut self) {
        while self.heartbeats == 0 {
            let value = self.next_value().await.expect("flux ouvert");
            assert_eq!(
                value["op"], "heartbeat",
                "seul un heartbeat est attendu ici"
            );
            self.ack_heartbeat().await;
        }
    }

    fn key(&self) -> &RsaPublicKey {
        self.key.as_ref().expect("clé publique reçue")
    }

    async fn drain(&mut self) {
        while self.ws.next().await.is_some() {}
    }
}

fn enc(key: &RsaPublicKey, data: &[u8]) -> String {
    B64.encode(
        key.encrypt(&mut OsRng, Oaep::new::<Sha256>(), data)
            .expect("chiffrement"),
    )
}

fn hello() -> Value {
    json!({"op": "hello", "heartbeat_interval": 50, "timeout_ms": 60000})
}

#[allow(clippy::result_large_err)] // signature imposée par le callback de tungstenite
async fn accept_ws(listener: &TcpListener) -> (Fake, Option<String>) {
    let (stream, _) = listener.accept().await.expect("accept");
    let mut origin = None;
    let ws = accept_hdr_async(stream, |req: &Request, resp: Response| {
        origin = req
            .headers()
            .get("origin")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        Ok(resp)
    })
    .await
    .expect("handshake");
    (
        Fake {
            ws,
            key: None,
            heartbeats: 0,
        },
        origin,
    )
}

async fn handshake_with_key(fake: &mut Fake) {
    fake.send(hello()).await;
    let init = fake.expect_op("init").await;
    let der = B64
        .decode(init["encoded_public_key"].as_str().expect("clé"))
        .expect("base64");
    fake.key = Some(RsaPublicKey::from_public_key_der(&der).expect("SPKI"));
}

struct Client {
    handle: QrHandle,
    events: tokio::sync::mpsc::Receiver<QrAuthEvent>,
    done: tokio::sync::oneshot::Receiver<Result<(User, String), AuthError>>,
}

fn start_client(ws_url: &str, mock: &MockServer) -> Client {
    let api_base = format!("{}/api/v9", mock.uri());
    let (handle, events, done) = qr::start(&ClientIdentity::new(400_000, "fr"), ws_url, &api_base);
    Client {
        handle,
        events,
        done,
    }
}

fn ws_url_of(listener: &TcpListener) -> String {
    format!("ws://{}/?v=2", listener.local_addr().expect("adresse"))
}

async fn collect_events(events: &mut tokio::sync::mpsc::Receiver<QrAuthEvent>) -> Vec<QrAuthEvent> {
    let mut out = Vec::new();
    while let Some(event) = events.recv().await {
        out.push(event);
    }
    out
}

async fn next_event(events: &mut tokio::sync::mpsc::Receiver<QrAuthEvent>) -> QrAuthEvent {
    events.recv().await.expect("évènement attendu")
}

async fn complete_script(
    listener: TcpListener,
    server_mock: Arc<MockServer>,
) -> (Option<String>, usize) {
    let (mut fake, origin) = accept_ws(&listener).await;
    handshake_with_key(&mut fake).await;
    fake.read_until_heartbeat().await;
    let key = fake.key().clone();
    fake.send(json!({"op": "nonce_proof", "encrypted_nonce": enc(&key, NONCE)}))
        .await;
    let proof = fake.expect_op("nonce_proof").await;
    assert_eq!(
        proof["proof"],
        URL_SAFE_NO_PAD.encode(Sha256::digest(NONCE))
    );
    fake.send(json!({"op": "pending_remote_init", "fingerprint": "FP"}))
        .await;
    fake.send(
        json!({"op": "pending_ticket", "encrypted_user_payload": enc(&key, b"42:0:abc:alice")}),
    )
    .await;
    let token_reply = json!({"encrypted_token": enc(&key, b"TOKEN-XYZ")});
    server_mock
        .register(
            Mock::given(method("POST"))
                .and(path("/api/v9/users/@me/remote-auth/login"))
                .and(body_json(json!({"ticket": "TICKET"})))
                .respond_with(ResponseTemplate::new(200).set_body_json(token_reply)),
        )
        .await;
    fake.send(json!({"op": "pending_login", "ticket": "TICKET"}))
        .await;
    fake.drain().await;
    (origin, fake.heartbeats)
}

#[tokio::test]
async fn flux_complet_obtient_le_jeton_et_l_utilisateur() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let mock = Arc::new(MockServer::start().await);
    let mut client = start_client(&ws_url_of(&listener), &mock);
    let server_mock = Arc::clone(&mock);
    let server = tokio::spawn(complete_script(listener, server_mock));

    let events = collect_events(&mut client.events).await;
    let (origin, heartbeats) = server.await.expect("serveur faux");
    assert_eq!(origin.as_deref(), Some(ORIGIN));
    assert!(heartbeats >= 1);
    assert_eq!(events.len(), 2);
    assert!(matches!(&events[0], QrAuthEvent::Ready { url } if url == "https://discord.com/ra/FP"));
    let QrAuthEvent::Scanned { user } = &events[1] else {
        panic!("Scanned attendu")
    };
    assert_eq!(user.id, "42");
    assert_eq!(user.username, "alice");
    assert_eq!(
        user.avatar_url.as_deref(),
        Some("https://cdn.discordapp.com/avatars/42/abc.png")
    );
    let (user, token) = client.done.await.expect("résultat").expect("succès");
    assert_eq!(user.id, "42");
    assert_eq!(token, "TOKEN-XYZ");
}

#[tokio::test]
async fn annulation_locale_emet_cancelled() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let mock = MockServer::start().await;
    let mut client = start_client(&ws_url_of(&listener), &mock);
    let server = tokio::spawn(async move {
        let (mut fake, _) = accept_ws(&listener).await;
        handshake_with_key(&mut fake).await;
        fake.send(json!({"op": "pending_remote_init", "fingerprint": "FP"}))
            .await;
        fake.drain().await;
    });
    assert!(matches!(
        next_event(&mut client.events).await,
        QrAuthEvent::Ready { .. }
    ));
    client.handle.cancel();
    assert!(matches!(
        next_event(&mut client.events).await,
        QrAuthEvent::Cancelled
    ));
    let result = client.done.await.expect("résultat");
    assert!(matches!(result, Err(AuthError::Cancelled)));
    server.await.expect("serveur faux");
}

#[tokio::test]
async fn cancel_du_serveur_emet_cancelled() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let mock = MockServer::start().await;
    let mut client = start_client(&ws_url_of(&listener), &mock);
    let server = tokio::spawn(async move {
        let (mut fake, _) = accept_ws(&listener).await;
        handshake_with_key(&mut fake).await;
        fake.send(json!({"op": "cancel"})).await;
        fake.drain().await;
    });
    let events = collect_events(&mut client.events).await;
    server.await.expect("serveur faux");
    assert!(matches!(events.as_slice(), [QrAuthEvent::Cancelled]));
    assert!(matches!(
        client.done.await.expect("résultat"),
        Err(AuthError::Cancelled)
    ));
}

#[tokio::test]
async fn fermeture_sans_jeton_emet_expired() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let mock = MockServer::start().await;
    let mut client = start_client(&ws_url_of(&listener), &mock);
    let server = tokio::spawn(async move {
        let (mut fake, _) = accept_ws(&listener).await;
        handshake_with_key(&mut fake).await;
        fake.ws.close(None).await.expect("fermeture");
    });
    let events = collect_events(&mut client.events).await;
    server.await.expect("serveur faux");
    assert!(matches!(events.as_slice(), [QrAuthEvent::Expired]));
    assert!(matches!(
        client.done.await.expect("résultat"),
        Err(AuthError::Expired)
    ));
}
