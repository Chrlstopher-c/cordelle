//! Traitement des Dispatch (op 0) : suivi de la séquence, READY/RESUMED, relais des événements bruts.

use contract::account::ConnectionState;

use crate::connection::Exit;
use crate::handle::GatewayEvent;
use crate::protocol::{self, Payload};
use crate::session::Session;

pub(crate) async fn handle_dispatch(session: &mut Session, payload: Payload) -> Option<Exit> {
    session.record_seq(payload.s);
    let name = payload.t?;
    if name == "READY" {
        match protocol::parse_ready(&payload.d) {
            Ok(info) => session.apply_ready(info),
            Err(err) => {
                tracing::error!(error = %err, "READY invalide, reconnexion");
                return Some(Exit::KeepSession);
            }
        }
    }
    if name == "READY" || name == "RESUMED" {
        session.reached_ready = true;
        if !session
            .emit(GatewayEvent::State(ConnectionState::Ready))
            .await
        {
            return Some(Exit::Shutdown);
        }
    }
    let seq = payload.s.unwrap_or_default();
    let event = GatewayEvent::Dispatch {
        name,
        seq,
        data: payload.d,
    };
    if session.emit(event).await {
        None
    } else {
        Some(Exit::Shutdown)
    }
}
