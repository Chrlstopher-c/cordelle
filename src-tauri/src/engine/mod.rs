//! Moteur de l'app : comptes, connexion, sessions. Tenu dans l'état Tauri, appelé par `commands.rs`.

mod build_cache;
mod data;
mod login;
mod member_list;
mod profile;
mod session;
mod social;

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex as SyncMutex},
};

use accounts::{Accounts, FallbackStore, KeyringStore};
use contract::{AccountId, EngineError, account::AccountSummary, account::ConnectionState};
use identity::ClientIdentity;
use tokio::sync::{Mutex, OnceCell};

use build_cache::BuildCache;
pub use login::QrSlot;
pub use session::Emitter;
use session::Session;

pub struct Engine {
    accounts: Accounts,
    identity: OnceCell<ClientIdentity>,
    qr: QrSlot,
    locale: String,
    cache_dir: PathBuf,
    build_cache: BuildCache,
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
            accounts: { Accounts::open(&dir, Arc::new(FallbackStore::new(KeyringStore, &dir)))? },
            identity: OnceCell::new(),
            qr: Mutex::new(None),
            locale: "fr".into(),
            build_cache: BuildCache::new(&dir),
            cache_dir,
            sessions: SyncMutex::new(HashMap::new()),
            emit,
        })
    }

    /// Identité du client. Numéro de build pris dans le cache disque s'il existe (rafraîchi en fond si
    /// périmé, effet au prochain lancement), sinon récupéré sur le client web.
    pub async fn identity(&'static self) -> Result<&'static ClientIdentity, EngineError> {
        self.identity
            .get_or_try_init(|| async {
                let build = match self.build_cache.read() {
                    Some((build, stale)) => {
                        if stale {
                            tauri::async_runtime::spawn(async move {
                                let _ = self.build_cache.fetch().await;
                            });
                        }
                        build
                    }
                    None => self.build_cache.fetch().await?,
                };
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
    pub async fn connect_all(&'static self) {
        for (user, _) in self.accounts.list() {
            if let Err(e) = self.connect(&user.id).await {
                tracing::error!(account = %user.id, "connexion impossible : {e:?}");
            }
        }
    }

    pub async fn connect(&'static self, account_id: &AccountId) -> Result<(), EngineError> {
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

    pub async fn subscribe_members(
        &self,
        account_id: &AccountId,
        guild_id: &str,
        channel_id: &str,
    ) -> Result<(), EngineError> {
        self.session(account_id)?
            .subscribe_members(guild_id, channel_id)
            .await
    }

    pub async fn set_status(
        &self,
        account_id: &AccountId,
        status: contract::user::PresenceStatus,
    ) -> Result<(), EngineError> {
        use contract::user::PresenceStatus as P;
        let code = match status {
            P::Online => "online",
            P::Idle => "idle",
            P::Dnd => "dnd",
            P::Invisible | P::Offline => "invisible",
        };
        self.session(account_id)?.set_status(code).await
    }

    pub fn presences(
        &self,
        account_id: &AccountId,
    ) -> Result<std::collections::HashMap<String, contract::user::PresenceStatus>, EngineError>
    {
        let session = self.session(account_id)?;
        let map = session
            .presences
            .lock()
            .map_err(|_| internal("présences verrouillées"))?;
        Ok(map.clone())
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

pub fn internal(message: &str) -> EngineError {
    EngineError::Internal {
        message: message.into(),
    }
}
