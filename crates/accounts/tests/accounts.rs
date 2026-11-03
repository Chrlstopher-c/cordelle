use std::fs;
use std::sync::Arc;

use accounts::{Accounts, AccountsError, MemoryStore};
use contract::EngineError;
use contract::user::User;
use tempfile::TempDir;

const TOKEN: &str = "tok-SECRET-123";

fn user(id: &str) -> User {
    User {
        id: id.to_owned(),
        username: format!("user{id}"),
        global_name: None,
        avatar_url: None,
        bot: false,
    }
}

fn open(dir: &TempDir, store: &Arc<MemoryStore>) -> Accounts {
    Accounts::open(dir.path(), store.clone()).expect("ouverture du trousseau de comptes")
}

#[test]
fn first_added_account_becomes_active() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    let accounts = open(&dir, &store);

    accounts.add(user("1"), TOKEN).unwrap();
    accounts.add(user("2"), "autre").unwrap();

    assert_eq!(accounts.active().as_deref(), Some("1"));
    assert_eq!(accounts.list().len(), 2);
}

#[test]
fn set_active_switches_account() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    let accounts = open(&dir, &store);
    accounts.add(user("1"), TOKEN).unwrap();
    accounts.add(user("2"), "autre").unwrap();

    accounts.set_active("2").unwrap();

    assert_eq!(accounts.active().as_deref(), Some("2"));
    let flags: Vec<bool> = accounts
        .list()
        .into_iter()
        .map(|(_, active)| active)
        .collect();
    assert_eq!(flags, vec![false, true]);
    assert!(matches!(
        accounts.set_active("9"),
        Err(AccountsError::NotFound(_))
    ));
}

#[test]
fn remove_active_falls_back_to_remaining_account() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    let accounts = open(&dir, &store);
    accounts.add(user("1"), TOKEN).unwrap();
    accounts.add(user("2"), "autre").unwrap();

    accounts.remove("1").unwrap();

    assert_eq!(accounts.active().as_deref(), Some("2"));
    assert!(matches!(
        accounts.token("1"),
        Err(AccountsError::NotFound(_))
    ));
    accounts.remove("2").unwrap();
    assert_eq!(accounts.active(), None);
    assert!(accounts.list().is_empty());
    assert!(matches!(
        accounts.remove("2"),
        Err(AccountsError::NotFound(_))
    ));
}

#[test]
fn add_existing_id_updates_profile_and_token() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    let accounts = open(&dir, &store);
    accounts.add(user("1"), TOKEN).unwrap();

    let mut renamed = user("1");
    renamed.username = "renomme".to_owned();
    accounts.add(renamed, "nouveau").unwrap();

    let listed = accounts.list();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].0.username, "renomme");
    assert_eq!(accounts.token("1").unwrap(), "nouveau");
}

#[test]
fn token_is_returned_per_account_and_unknown_is_not_found() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    let accounts = open(&dir, &store);
    accounts.add(user("1"), TOKEN).unwrap();

    assert_eq!(accounts.token("1").unwrap(), TOKEN);
    assert!(matches!(
        accounts.token("9"),
        Err(AccountsError::NotFound(_))
    ));
}

#[test]
fn state_survives_reopening() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    {
        let accounts = open(&dir, &store);
        accounts.add(user("1"), TOKEN).unwrap();
        accounts.add(user("2"), "autre").unwrap();
        accounts.set_active("2").unwrap();
    }

    let reopened = open(&dir, &store);

    assert_eq!(reopened.active().as_deref(), Some("2"));
    assert_eq!(reopened.list().len(), 2);
    assert_eq!(reopened.token("1").unwrap(), TOKEN);
}

#[test]
fn token_never_written_to_index_file() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    let accounts = open(&dir, &store);

    accounts.add(user("1"), TOKEN).unwrap();

    let raw = fs::read_to_string(dir.path().join("accounts.json")).unwrap();
    assert!(!raw.contains(TOKEN));
}

#[test]
fn token_absent_from_store_debug_output() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(MemoryStore::default());
    let accounts = open(&dir, &store);
    accounts.add(user("1"), TOKEN).unwrap();

    assert!(!format!("{store:?}").contains(TOKEN));
}

#[test]
fn accounts_error_maps_to_engine_error() {
    let error: EngineError = AccountsError::NotFound("9".to_owned()).into();

    assert!(matches!(error, EngineError::NotFound { .. }));
}
