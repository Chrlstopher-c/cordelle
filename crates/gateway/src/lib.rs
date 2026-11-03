//! Domaine gateway : connexion WebSocket temps réel d'un compte (identify, heartbeat, resume, décompression).

mod connection;
mod dispatch;
mod error;
mod handle;
mod heartbeat;
mod inflate;
mod protocol;
mod session;
mod supervisor;

pub use error::GatewayError;
pub use handle::{Gateway, GatewayEvent, GatewayHandle};
