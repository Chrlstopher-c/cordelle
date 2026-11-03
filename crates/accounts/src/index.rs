use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

use contract::AccountId;
use contract::user::User;
use serde::{Deserialize, Serialize};

use crate::error::AccountsError;

const INDEX_FILE: &str = "accounts.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct Index {
    #[serde(default)]
    pub(crate) accounts: Vec<User>,
    #[serde(default)]
    pub(crate) active: Option<AccountId>,
}

pub(crate) fn load(dir: &Path) -> Result<Index, AccountsError> {
    let path = index_path(dir);
    match fs::read(&path) {
        Ok(raw) => serde_json::from_slice(&raw).map_err(|error| {
            tracing::error!(path = %path.display(), error = %error, "index des comptes illisible");
            error.into()
        }),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(Index::default()),
        Err(error) => {
            tracing::error!(path = %path.display(), error = %error, "lecture de l'index des comptes");
            Err(error.into())
        }
    }
}

pub(crate) fn save(dir: &Path, index: &Index) -> Result<(), AccountsError> {
    let path = index_path(dir);
    write_atomic(&path, index).inspect_err(|error| {
        tracing::error!(path = %path.display(), error = %error, "écriture de l'index des comptes");
    })
}

fn index_path(dir: &Path) -> PathBuf {
    dir.join(INDEX_FILE)
}

fn write_atomic(path: &Path, index: &Index) -> Result<(), AccountsError> {
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(index)?;
    let mut file = fs::File::create(&tmp)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    fs::rename(&tmp, path)?;
    Ok(())
}
