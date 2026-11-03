//! Moteur de l'app : comptes, connexion, sessions. Tenu dans l'état Tauri, appelé par `commands.rs`.

mod data;
mod login;
mod session;

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex as SyncMutex},
};

use accounts::{Accounts, KeyringStore};
use contract::{AccountId, EngineError, account::AccountSummary, account::ConnectionState};
use identity::ClientIdentity;
use tokio::sync::{Mutex, OnceCell};

pub use login::QrSlot;
pub use session::Emitter;
use session::Session;

pub struct Engine {
    accounts: Accounts,
    identity: OnceCell<ClientIdentity>,
    qr: QrSlot,
    locale: String,
    cache_dir: PathBuf,
    sessions: SyncMutex<HashMap<AccountId, Arc<Session>>>,
    emit: Emitter,
}

impl Engine {
    pub fn open(emit: Emitter) -> Result<Self, EngineError> {
        let dir = dirs::data_dir()
            .ok_or_else(|| internal("répertoire de données introuvable"))?
            .join("cordelle");
        let cache_dir = dir.join("cache");
        std::fs::create_dir_all(&cache_dir).map_err(|e| {
            tracing::error!("création du cache impossible : {e}");
            internal("création du cache impossible")
        })?;
        Ok(Self {
            accounts: Accounts::open(&dir, Arc::new(KeyringStore))?,
            identity: OnceCell::new(),
            qr: Mutex::new(None),
            locale: "fr".into(),
            cache_dir,
            sessions: SyncMutex::new(HashMap::new()),
            emit,
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

    /// Connecte tous les comptes enregistrés (chacun reçoit ses notifications en parallèle).
    pub async fn connect_all(&self) {
        for (user, _) in self.accounts.list() {
            if let Err(e) = self.connect(&user.id).await {
                tracing::error!(account = %user.id, "connexion impossible : {e:?}");
            }
        }
    }

    pub async fn connect(&self, account_id: &AccountId) -> Result<(), EngineError> {
        if self.session(account_id).is_ok() {
            return Ok(());
        }
        let token = self.accounts.token(account_id)?;
        let identity = self.identity().await?;
        let session = Session::start(
            account_id,
            token,
            identity,
            &self.cache_dir,
            self.emit.clone(),
        )?;
        self.lock_sessions()?
            .insert(account_id.clone(), Arc::new(session));
        Ok(())
    }

    pub fn disconnect(&self, account_id: &AccountId) {
        if let Ok(mut sessions) = self.lock_sessions()
            && let Some(session) = sessions.remove(account_id)
        {
            session.stop();
        }
    }

    fn session(&self, account_id: &AccountId) -> Result<Arc<Session>, EngineError> {
        self.lock_sessions()?
            .get(account_id)
            .cloned()
            .ok_or_else(|| EngineError::NotFound {
                what: format!("session {account_id}"),
            })
    }

    fn lock_sessions(
        &self,
    ) -> Result<std::sync::MutexGuard<'_, HashMap<AccountId, Arc<Session>>>, EngineError> {
        self.sessions
            .lock()
            .map_err(|_| internal("sessions verrouillées"))
    }

    pub fn account_summaries(&self) -> Vec<AccountSummary> {
        self.accounts
            .list()
            .into_iter()
            .map(|(user, active)| AccountSummary {
                connection: self
                    .session(&user.id)
                    .map(|s| s.connection())
                    .unwrap_or(ConnectionState::Disconnected),
                id: user.id.clone(),
                user,
                active,
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
