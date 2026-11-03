mod common;

use common::*;
use contract::events::EngineEvent;
use serde_json::{Value, json};
use store::Store;

fn create(store: &mut Store, message: &Value) -> Vec<EngineEvent> {
    let mut data = message.clone();
    data["nonce"] = json!("local-42");
    store.apply("MESSAGE_CREATE", &data)
}

fn cached_message(store: &Store, id: &str) -> contract::message::Message {
    store
        .messages(GENERAL, None, 50)
        .messages
        .into_iter()
        .find(|m| m.id == id)
        .expect("message en cache")
}

#[test]
fn message_create_emits_event_caches_and_marks_unread() {
    let mut store = ready_store();
    let events = create(&mut store, &fixture("message.json"));
    match &events[0] {
        EngineEvent::MessageCreate {
            account_id,
            message,
            nonce,
        } => {
            assert_eq!(account_id, ACCOUNT);
            assert_eq!(
                message.content,
                "Salut <@111111111111111111>, regarde **ça** :)"
            );
            assert_eq!(nonce.as_deref(), Some("local-42"));
        }
        other => panic!("événement inattendu : {other:?}"),
    }
    assert!(
        matches!(
            events[1],
            EngineEvent::Unread {
                unread: true,
                mention_count: 3,
                ..
            }
        ),
        "un message mentionnant Chris ajoute une mention"
    );
    assert_eq!(store.messages(GENERAL, None, 50).messages.len(), 1);
}

#[test]
fn own_message_does_not_count_as_unread() {
    let mut store = ready_store();
    let mut mine = message_with_id("300000000000001001", GENERAL);
    mine["author"]["id"] = json!(ME);
    let events = create(&mut store, &mine);
    assert!(matches!(
        events[1],
        EngineEvent::Unread {
            unread: false,
            mention_count: 0,
            ..
        }
    ));
}

#[test]
fn message_update_partial_keeps_missing_fields() {
    let mut store = ready_store();
    create(&mut store, &fixture("message.json"));
    let patch = json!({
        "id": "300000000000001000",
        "channel_id": GENERAL,
        "content": "Version éditée",
        "edited_timestamp": "2026-11-03T11:00:00.000000+00:00"
    });
    let events = store.apply("MESSAGE_UPDATE", &patch);
    assert!(matches!(
        events.as_slice(),
        [EngineEvent::MessageUpdate { .. }]
    ));
    let message = cached_message(&store, "300000000000001000");
    assert_eq!(message.content, "Version éditée");
    assert!(message.edited_timestamp.is_some());
    assert_eq!(message.author.username, "alice");
    assert_eq!(message.attachments.len(), 1);
    assert_eq!(message.reactions.len(), 1);
    assert_eq!(message.reply_to.as_deref(), Some("300000000000000990"));
}

#[test]
fn message_update_without_cache_is_dropped() {
    let mut store = ready_store();
    let events = store.apply(
        "MESSAGE_UPDATE",
        &json!({"id": "1", "channel_id": GENERAL, "content": "x"}),
    );
    assert!(events.is_empty());
    assert!(store.messages(GENERAL, None, 50).messages.is_empty());
}

#[test]
fn message_delete_removes_from_cache() {
    let mut store = ready_store();
    create(&mut store, &fixture("message.json"));
    let events = store.apply(
        "MESSAGE_DELETE",
        &json!({"id": "300000000000001000", "channel_id": GENERAL}),
    );
    let [EngineEvent::MessageDelete { message_id, .. }] = events.as_slice() else {
        panic!("événement inattendu : {events:?}");
    };
    assert_eq!(message_id, "300000000000001000");
    assert!(store.messages(GENERAL, None, 50).messages.is_empty());
}

#[test]
fn bulk_delete_emits_one_event_per_id() {
    let mut store = ready_store();
    store.cache_messages(
        GENERAL,
        &[
            message_with_id("9", GENERAL),
            message_with_id("10", GENERAL),
        ],
    );
    let events = store.apply(
        "MESSAGE_DELETE_BULK",
        &json!({"ids": ["9", "10"], "channel_id": GENERAL}),
    );
    assert_eq!(events.len(), 2);
    assert!(store.messages(GENERAL, None, 50).messages.is_empty());
}

#[test]
fn reactions_add_and_remove_track_own_state() {
    let mut store = ready_store();
    create(&mut store, &fixture("message.json"));
    let base = json!({"channel_id": GENERAL, "message_id": "300000000000001000"});

    let mut add_own = base.clone();
    add_own["user_id"] = json!(ME);
    add_own["emoji"] = json!({"name": "🔥", "id": null});
    store.apply("MESSAGE_REACTION_ADD", &add_own);
    let fire = &cached_message(&store, "300000000000001000").reactions[0];
    assert_eq!((fire.count, fire.me), (3, true));

    let mut add_custom = base.clone();
    add_custom["user_id"] = json!("444444444444444444");
    add_custom["emoji"] = json!({"name": "pepe", "id": "123"});
    let events = store.apply("MESSAGE_REACTION_ADD", &add_custom);
    assert!(matches!(
        events.as_slice(),
        [EngineEvent::MessageUpdate { .. }]
    ));
    let reactions = cached_message(&store, "300000000000001000").reactions;
    assert_eq!(reactions.len(), 2);
    assert_eq!(reactions[1].emoji, "pepe:123");
    assert_eq!((reactions[1].count, reactions[1].me), (1, false));

    let mut remove_own = add_own.clone();
    store.apply("MESSAGE_REACTION_REMOVE", &remove_own);
    let fire = &cached_message(&store, "300000000000001000").reactions[0];
    assert_eq!((fire.count, fire.me), (2, false));

    remove_own["emoji"] = json!({"name": "pepe", "id": "123"});
    remove_own["user_id"] = json!("444444444444444444");
    store.apply("MESSAGE_REACTION_REMOVE", &remove_own);
    assert_eq!(
        cached_message(&store, "300000000000001000").reactions.len(),
        1
    );
}

#[test]
fn reaction_on_uncached_message_emits_nothing() {
    let mut store = ready_store();
    let events = store.apply(
        "MESSAGE_REACTION_ADD",
        &json!({"channel_id": GENERAL, "message_id": "42", "user_id": ME, "emoji": {"name": "x", "id": null}}),
    );
    assert!(events.is_empty());
}

#[test]
fn pagination_is_numeric_and_newest_first() {
    let mut store = ready_store();
    let page: Vec<Value> = ["9", "10", "11", "12", "13"]
        .iter()
        .map(|id| message_with_id(id, GENERAL))
        .collect();
    store.cache_messages(GENERAL, &page);
    let ids = |p: &store::MessagePage| p.messages.iter().map(|m| m.id.clone()).collect::<Vec<_>>();

    let first = store.messages(GENERAL, None, 2);
    assert_eq!(ids(&first), vec!["13", "12"]);
    assert!(first.has_more);

    let second = store.messages(GENERAL, Some("12"), 2);
    assert_eq!(ids(&second), vec!["11", "10"]);
    assert!(second.has_more);

    let last = store.messages(GENERAL, Some("10"), 5);
    assert_eq!(ids(&last), vec!["9"]);
    assert!(!last.has_more);
}

#[test]
fn cache_survives_reopen_on_disk() {
    let path = std::path::PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("store-reopen.db");
    let _ = std::fs::remove_file(&path);
    {
        let mut store = Store::open(ACCOUNT.to_string(), Some(&path)).expect("ouverture fichier");
        store.cache_messages(GENERAL, &[message_with_id("300000000000002000", GENERAL)]);
    }
    let reopened = Store::open(ACCOUNT.to_string(), Some(&path)).expect("réouverture");
    assert_eq!(reopened.messages(GENERAL, None, 10).messages.len(), 1);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn ack_marks_channel_read_and_resets_mentions() {
    let mut store = ready_store();
    create(&mut store, &fixture("message.json"));
    let events = store.apply(
        "MESSAGE_ACK",
        &json!({"channel_id": GENERAL, "message_id": "300000000000001000"}),
    );
    assert!(matches!(
        events.as_slice(),
        [EngineEvent::Unread {
            unread: false,
            mention_count: 0,
            ..
        }]
    ));
    let general = store
        .channels(GUILD_ALPHA)
        .into_iter()
        .find(|c| c.id == GENERAL)
        .expect("general");
    assert!(!general.unread);
    assert_eq!(general.mention_count, 0);
}

#[test]
fn typing_and_presence_are_forwarded() {
    let mut store = ready_store();
    let typing = store.apply(
        "TYPING_START",
        &json!({"channel_id": DM_ALICE, "user_id": "444444444444444444", "timestamp": 1}),
    );
    assert!(matches!(typing.as_slice(), [EngineEvent::Typing { .. }]));
    let presence = store.apply(
        "PRESENCE_UPDATE",
        &json!({"user": {"id": "444444444444444444"}, "status": "dnd"}),
    );
    assert!(matches!(
        presence.as_slice(),
        [EngineEvent::Presence {
            status: contract::user::PresenceStatus::Dnd,
            ..
        }]
    ));
}
