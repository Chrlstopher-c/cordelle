//! Domaine rest : client HTTP de l'API Discord v9 (en-têtes du client web, limites de débit, erreurs typées).

mod build_number;
mod client;
mod endpoints;
mod error;
mod models;
mod ratelimit;

pub use build_number::{extract_build_number, fetch_build_number, script_paths};
pub use client::RestClient;
pub use error::RestError;
pub use models::{ApiMessage, ApiUser, FingerprintResponse, MessageReference, SendMessageBody};
