//! Domaine accounts : comptes enregistrés, jetons dans le trousseau système, compte actif.

mod accounts;
mod activation;
mod error;
mod fallback;
mod index;
mod secret;

pub use accounts::Accounts;
pub use activation::ensure_secret_service;
pub use error::AccountsError;
pub use fallback::{FallbackStore, FileStore};
pub use secret::{KeyringStore, MemoryStore, SecretStore};
