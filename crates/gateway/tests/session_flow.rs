//! Test d'intégration : serveur WebSocket local qui rejoue la gateway Discord (Hello, identify, READY,
//! heartbeat, coupure, resume) sans le vrai Discord.

use std::time::Duration;

use contract::account::ConnectionState;
use flate2::{Compress, Compression, FlushCompress};
use futures_util::{SinkExt, StreamExt};
use gateway::{Gateway, GatewayEvent};
use identity::ClientIdentity;
use serde_json::{Value, json};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::{WebSocketStream, accept_async};

const STEP_TIMEOUT: Duration = Duration::from_secs(5);

/// Serveur côté test : une connexion, un compresseur zlib-stream persistant.
struct Peer {
    ws: WebSocketStream<TcpStream>,
    compressor: Compress,
}

impl Peer {
    async fn accept(listener: &TcpListener) -> Self {
        let (stream, _) = timeout(STEP_TIMEOUT, listener.accept())
            .await
            .expect("accept")
            .expect("tcp");
        let ws = accept_async(stream).await.expect("handshake ws");
        Self {
            ws,
            compressor: Compress::new(Compression::default(), true),
        }
    }

    /// Envoie un JSON compressé en trame binaire, comme la gateway réelle.
    async fn send_compressed(&mut self, value: Value) {
        let frame = compress(&mut self.compressor, value.to_string().as_bytes());
        self.ws
            .send(Message::Binary(frame.into()))
            .await
            .expect("envoi serveur");
    }

    async fn recv_json(&mut self) -> Value {
        let message = timeout(STEP_TIMEOUT, self.ws.next())
            .await
            .expect("message client")
            .expect("flux")
            .expect("ws");
        match message {
            Message::Text(text) => serde_json::from_str(text.as_str()).expect("json client"),
            other => panic!("trame texte attendue du client, reçu {other:?}"),
        }
    }
}

fn compress(c: &mut Compress, msg: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(msg.len() + 64);
    let start = c.total_in();
    loop {
        if out.len() == out.capacity() {
            out.reserve(256);
        }
        let consumed = usize::try_from(c.total_in() - start).unwrap_or(msg.len());
        c.compress_vec(&msg[consumed..], &mut out, FlushCompress::Sync)
            .expect("compression");
        if usize::try_from(c.total_in() - start).ok() == Some(msg.len())
            && out.len() < out.capacity()
        {
            return out;
        }
    }
}

async fn next_event(rx: &mut mpsc::Receiver<GatewayEvent>) -> GatewayEvent {
    timeout(STEP_TIMEOUT, rx.recv())
        .await
        .expect("événement attendu")
        .expect("canal fermé")
}

fn local_url(listener: &TcpListener) -> String {
    format!(
        "ws://{}/?v=9&encoding=json&compress=zlib-stream",
        listener.local_addr().expect("adresse")
    )
}

#[tokio::test]
async fn identify_heartbeat_puis_resume_apres_coupure() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let url = local_url(&listener);
    let (handle, mut events) = Gateway::spawn(
        "tok-test".into(),
        ClientIdentity::new(400_000, "fr"),
        url.clone(),
    );

    let mut peer = Peer::accept(&listener).await;
    peer.send_compressed(json!({"op": 10, "d": {"heartbeat_interval": 200}}))
        .await;
    let identify = peer.recv_json().await;
    assert_eq!(identify["op"], 2);
    assert_eq!(identify["d"]["token"], "tok-test");
    assert_eq!(identify["d"]["capabilities"], 30717);
    assert_eq!(identify["d"]["properties"]["os"], "Linux");

    peer.send_compressed(json!({"op": 0, "s": 1, "t": "READY",
        "d": {"session_id": "sess-1", "resume_gateway_url": url}}))
        .await;
    peer.send_compressed(
        json!({"op": 0, "s": 2, "t": "MESSAGE_CREATE", "d": {"content": "salut"}}),
    )
    .await;

    let beat = peer.recv_json().await;
    assert_eq!(beat["op"], 1, "premier battement attendu");
    assert_eq!(
        beat["d"], 2,
        "le battement porte le dernier numéro de séquence"
    );
    peer.ws
        .send(Message::Text(json!({"op": 11}).to_string().into()))
        .await
        .expect("ack");

    assert!(matches!(
        next_event(&mut events).await,
        GatewayEvent::State(ConnectionState::Connecting)
    ));
    assert!(matches!(
        next_event(&mut events).await,
        GatewayEvent::State(ConnectionState::Ready)
    ));
    match next_event(&mut events).await {
        GatewayEvent::Dispatch { name, seq, .. } => assert_eq!((name.as_str(), seq), ("READY", 1)),
        other => panic!("READY attendu, reçu {other:?}"),
    }
    match next_event(&mut events).await {
        GatewayEvent::Dispatch { name, seq, data } => {
            assert_eq!((name.as_str(), seq), ("MESSAGE_CREATE", 2));
            assert_eq!(data["content"], "salut");
        }
        other => panic!("MESSAGE_CREATE attendu, reçu {other:?}"),
    }

    drop(peer);
    assert!(matches!(
        next_event(&mut events).await,
        GatewayEvent::State(ConnectionState::Resuming)
    ));

    let mut peer = Peer::accept(&listener).await;
    peer.send_compressed(json!({"op": 10, "d": {"heartbeat_interval": 200}}))
        .await;
    let resume = peer.recv_json().await;
    assert_eq!(resume["op"], 6, "resume attendu après coupure");
    assert_eq!(resume["d"]["token"], "tok-test");
    assert_eq!(resume["d"]["session_id"], "sess-1");
    assert_eq!(resume["d"]["seq"], 2);

    peer.send_compressed(json!({"op": 0, "s": 3, "t": "RESUMED", "d": {}}))
        .await;
    assert!(matches!(
        next_event(&mut events).await,
        GatewayEvent::State(ConnectionState::Ready)
    ));
    match next_event(&mut events).await {
        GatewayEvent::Dispatch { name, seq, .. } => {
            assert_eq!((name.as_str(), seq), ("RESUMED", 3))
        }
        other => panic!("RESUMED attendu, reçu {other:?}"),
    }

    handle.shutdown();
    assert!(matches!(
        next_event(&mut events).await,
        GatewayEvent::State(ConnectionState::Disconnected)
    ));
}

#[tokio::test]
async fn code_4004_arrete_la_connexion_sans_reconnexion() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let url = local_url(&listener);
    let (_handle, mut events) =
        Gateway::spawn("tok-bad".into(), ClientIdentity::new(400_000, "fr"), url);

    let mut peer = Peer::accept(&listener).await;
    peer.send_compressed(json!({"op": 10, "d": {"heartbeat_interval": 200}}))
        .await;
    assert_eq!(peer.recv_json().await["op"], 2);
    let frame = CloseFrame {
        code: 4004.into(),
        reason: "".into(),
    };
    peer.ws.close(Some(frame)).await.expect("fermeture serveur");

    assert!(matches!(
        next_event(&mut events).await,
        GatewayEvent::State(ConnectionState::Connecting)
    ));
    assert!(matches!(
        next_event(&mut events).await,
        GatewayEvent::State(ConnectionState::Failed)
    ));
    assert!(
        timeout(Duration::from_millis(1500), listener.accept())
            .await
            .is_err(),
        "aucune reconnexion attendue"
    );
}
