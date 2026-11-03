//! Moteur de l'app : comptes, connexion, sessions. Tenu dans l'état Tauri, appelé par `commands.rs`.

mod login;

use std::sync::Arc;

use accounts::{Accounts, KeyringStore};
use contract::{EngineError, account::AccountSummary, account::ConnectionState};
use identity::ClientIdentity;
use tokio::sync::{Mutex, OnceCell};

pub use login::QrSlot;

pub struct Engine {
    accounts: Accounts,
    identity: OnceCell<ClientIdentity>,
    qr: QrSlot,
    locale: String,
}

impl Engine {
    pub fn open() -> Result<Self, EngineError> {
        let dir = dirs::data_dir()
            .ok_or_else(|| internal("répertoire de données introuvable"))?
            .join("cordelle");
        let accounts = Accounts::open(&dir, Arc::new(KeyringStore))?;
        Ok(Self {
            accounts,
            identity: OnceCell::new(),
            qr: Mutex::new(None),
            locale: "fr".into(),
        })
    }

    /// Identité du client, avec le numéro de build du client web récupéré une seule fois.
    pub async fn identity(&self) -> Result<&ClientIdentity, EngineError> {
        self.identity
            .get_or_try_init(|| async {
                let http = reqwest_client()?;
                let build = rest::fetch_build_number(&http).await.map_err(|e| {
                    tracing::error!("numéro de build introuvable : {e}");
                    EngineError::from(e)
                })?;
                tracing::info!(build, "numéro de build du client web");
                Ok(ClientIdentity::new(build, &self.locale))
            })
            .await
    }

    pub fn accounts(&self) -> &Accounts {
        &self.accounts
    }

    pub fn qr(&self) -> &QrSlot {
        &self.qr
    }

    pub fn account_summaries(&self) -> Vec<AccountSummary> {
        self.accounts
            .list()
            .into_iter()
            .map(|(user, active)| AccountSummary {
                id: user.id.clone(),
                user,
                active,
                connection: ConnectionState::Disconnected,
            })
            .collect()
    }
}

fn reqwest_client() -> Result<reqwest::Client, EngineError> {
    reqwest::Client::builder().build().map_err(|e| {
        tracing::error!("client HTTP impossible : {e}");
        internal("client HTTP impossible")
    })
}

pub fn internal(message: &str) -> EngineError {
    EngineError::Internal {
        message: message.into(),
    }
}
