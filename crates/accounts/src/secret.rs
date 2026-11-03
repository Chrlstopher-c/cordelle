use std::collections::HashMap;
use std::fmt;
use std::sync::{Mutex, MutexGuard, PoisonError};

use crate::error::AccountsError;

const KEYRING_SERVICE: &str = "cordelle";

pub trait SecretStore: Send + Sync {
    fn get(&self, key: &str) -> Result<Option<String>, AccountsError>;
    fn set(&self, key: &str, value: &str) -> Result<(), AccountsError>;
    fn delete(&self, key: &str) -> Result<(), AccountsError>;
}

#[derive(Debug, Default)]
pub struct KeyringStore;

impl SecretStore for KeyringStore {
    fn get(&self, key: &str) -> Result<Option<String>, AccountsError> {
        match entry(key)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(keyring_error("lecture", &error)),
        }
    }

    fn set(&self, key: &str, value: &str) -> Result<(), AccountsError> {
        entry(key)?
            .set_password(value)
            .map_err(|error| keyring_error("écriture", &error))
    }

    fn delete(&self, key: &str) -> Result<(), AccountsError> {
        match entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(keyring_error("suppression", &error)),
        }
    }
}

fn entry(key: &str) -> Result<keyring::Entry, AccountsError> {
    keyring::Entry::new(KEYRING_SERVICE, key).map_err(|error| keyring_error("ouverture", &error))
}

fn keyring_error(operation: &str, error: &keyring::Error) -> AccountsError {
    tracing::error!(operation, error = %error, "trousseau système indisponible");
    AccountsError::Keyring(error.to_string())
}

#[derive(Default)]
pub struct MemoryStore {
    entries: Mutex<HashMap<String, String>>,
}

impl MemoryStore {
    fn lock(&self) -> MutexGuard<'_, HashMap<String, String>> {
        self.entries.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

impl fmt::Debug for MemoryStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("MemoryStore").finish_non_exhaustive()
    }
}

impl SecretStore for MemoryStore {
    fn get(&self, key: &str) -> Result<Option<String>, AccountsError> {
        Ok(self.lock().get(key).cloned())
    }

    fn set(&self, key: &str, value: &str) -> Result<(), AccountsError> {
        self.lock().insert(key.to_owned(), value.to_owned());
        Ok(())
    }

    fn delete(&self, key: &str) -> Result<(), AccountsError> {
        self.lock().remove(key);
        Ok(())
    }
}
