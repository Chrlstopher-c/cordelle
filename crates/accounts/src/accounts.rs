use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use contract::AccountId;
use contract::user::User;

use crate::error::AccountsError;
use crate::index::{self, Index};
use crate::secret::SecretStore;

pub struct Accounts {
    dir: PathBuf,
    store: Arc<dyn SecretStore>,
    index: Mutex<Index>,
}

impl Accounts {
    pub fn open(dir: impl AsRef<Path>, store: Arc<dyn SecretStore>) -> Result<Self, AccountsError> {
        let dir = dir.as_ref().to_path_buf();
        fs::create_dir_all(&dir).inspect_err(|error| {
            tracing::error!(path = %dir.display(), error = %error, "création du dossier des comptes");
        })?;
        let index = index::load(&dir)?;
        Ok(Self {
            dir,
            store,
            index: Mutex::new(index),
        })
    }

    pub fn add(&self, user: User, token: &str) -> Result<(), AccountsError> {
        self.update(|next| {
            self.store.set(&user.id, token)?;
            let id = user.id.clone();
            match next.accounts.iter_mut().find(|known| known.id == id) {
                Some(known) => *known = user,
                None => next.accounts.push(user),
            }
            if next.active.is_none() {
                next.active = Some(id);
            }
            Ok(())
        })
    }

    pub fn remove(&self, id: &str) -> Result<(), AccountsError> {
        self.update(|next| {
            ensure_known(next, id)?;
            next.accounts.retain(|user| user.id != id);
            if next.active.as_deref() == Some(id) {
                next.active = next.accounts.first().map(|user| user.id.clone());
            }
            Ok(())
        })?;
        self.store.delete(id)
    }

    pub fn list(&self) -> Vec<(User, bool)> {
        let index = self.lock();
        index
            .accounts
            .iter()
            .map(|user| {
                (
                    user.clone(),
                    index.active.as_deref() == Some(user.id.as_str()),
                )
            })
            .collect()
    }

    pub fn set_active(&self, id: &str) -> Result<(), AccountsError> {
        self.update(|next| {
            ensure_known(next, id)?;
            next.active = Some(id.to_owned());
            Ok(())
        })
    }

    pub fn active(&self) -> Option<AccountId> {
        self.lock().active.clone()
    }

    pub fn token(&self, id: &str) -> Result<String, AccountsError> {
        ensure_known(&self.lock(), id)?;
        self.store
            .get(id)?
            .ok_or_else(|| AccountsError::NotFound(id.to_owned()))
    }

    fn lock(&self) -> MutexGuard<'_, Index> {
        self.index.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn update(
        &self,
        change: impl FnOnce(&mut Index) -> Result<(), AccountsError>,
    ) -> Result<(), AccountsError> {
        let mut current = self.lock();
        let mut next = current.clone();
        change(&mut next)?;
        index::save(&self.dir, &next)?;
        *current = next;
        Ok(())
    }
}

fn ensure_known(index: &Index, id: &str) -> Result<(), AccountsError> {
    if index.accounts.iter().any(|user| user.id == id) {
        Ok(())
    } else {
        Err(AccountsError::NotFound(id.to_owned()))
    }
}
