//! Repli quand le trousseau système refuse (portefeuille KWallet absent ou verrouillé) : fichier JSON en 0600,
//! comme le client officiel sous Linux. Le trousseau reste prioritaire en lecture comme en écriture.

use std::collections::HashMap;
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::error::AccountsError;
use crate::secret::SecretStore;

pub struct FileStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl FileStore {
    pub fn new(dir: &Path) -> Self {
        Self {
            path: dir.join("secrets.json"),
            lock: Mutex::new(()),
        }
    }

    fn read(&self) -> HashMap<String, String> {
        std::fs::read(&self.path)
            .ok()
            .and_then(|raw| serde_json::from_slice(&raw).ok())
            .unwrap_or_default()
    }

    fn write(&self, map: &HashMap<String, String>) -> Result<(), AccountsError> {
        let tmp = self.path.with_extension("json.tmp");
        let json = serde_json::to_vec(map).map_err(|e| io_error("sérialisation", e.to_string()))?;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&tmp)
            .map_err(|e| io_error("ouverture", e.to_string()))?;
        file.write_all(&json)
            .map_err(|e| io_error("écriture", e.to_string()))?;
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))
            .and_then(|()| std::fs::rename(&tmp, &self.path))
            .map_err(|e| io_error("remplacement", e.to_string()))
    }

    fn update(
        &self,
        change: impl FnOnce(&mut HashMap<String, String>),
    ) -> Result<(), AccountsError> {
        let _guard = self
            .lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut map = self.read();
        change(&mut map);
        self.write(&map)
    }
}

impl SecretStore for FileStore {
    fn get(&self, key: &str) -> Result<Option<String>, AccountsError> {
        Ok(self.read().remove(key))
    }

    fn set(&self, key: &str, value: &str) -> Result<(), AccountsError> {
        self.update(|m| {
            m.insert(key.to_owned(), value.to_owned());
        })
    }

    fn delete(&self, key: &str) -> Result<(), AccountsError> {
        self.update(|m| {
            m.remove(key);
        })
    }
}

/// Trousseau d'abord ; en cas de refus, le fichier.
pub struct FallbackStore<P: SecretStore> {
    primary: P,
    file: FileStore,
}

impl<P: SecretStore> FallbackStore<P> {
    pub fn new(primary: P, dir: &Path) -> Self {
        Self {
            primary,
            file: FileStore::new(dir),
        }
    }
}

impl<P: SecretStore> SecretStore for FallbackStore<P> {
    fn get(&self, key: &str) -> Result<Option<String>, AccountsError> {
        match self.primary.get(key) {
            Ok(Some(secret)) => Ok(Some(secret)),
            _ => self.file.get(key),
        }
    }

    fn set(&self, key: &str, value: &str) -> Result<(), AccountsError> {
        if self.primary.set(key, value).is_ok() {
            return Ok(());
        }
        tracing::warn!("trousseau indisponible, jeton rangé dans le fichier protégé (0600)");
        self.file.set(key, value)
    }

    fn delete(&self, key: &str) -> Result<(), AccountsError> {
        let _ = self.primary.delete(key);
        self.file.delete(key)
    }
}

fn io_error(operation: &str, message: String) -> AccountsError {
    tracing::error!(operation, "fichier de secrets : {message}");
    AccountsError::Keyring(format!("fichier de secrets ({operation}) : {message}"))
}
