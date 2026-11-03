mod common;

use common::*;
use contract::events::EngineEvent;
use contract::guild::ChannelKind;
use store::Store;

fn channel_ids(store: &Store, guild: &str) -> Vec<String> {
    store.channels(guild).into_iter().map(|c| c.id).collect()
}

#[test]
fn ready_split_guilds_keep_ready_order_and_details() {
    let store = ready_store();
    let guilds = store.guilds();
    assert_eq!(guilds.len(), 2);
    assert_eq!(guilds[0].name, "Serveur Alpha");
    assert_eq!(guilds[0].position, 0);
    assert_eq!(guilds[1].name, "Serveur Beta");
    assert_eq!(guilds[1].position, 1);
    assert_eq!(
        guilds[0].icon_url.as_deref(),
        Some(
            "https://cdn.discordapp.com/icons/222222222222222222/9f8e7d6c5b4a39281706f5e4d3c2b1a0.png"
        )
    );
    assert_eq!(guilds[1].icon_url, None);
}

#[test]
fn guild_unread_aggregates_its_channels() {
    let store = ready_store();
    let alpha = &store.guilds()[0];
    assert!(alpha.unread);
    assert_eq!(alpha.mention_count, 2);
    let beta = &store.guilds()[1];
    assert!(!beta.unread);
    assert_eq!(beta.mention_count, 0);
}

#[test]
fn ready_flat_guild_is_supported() {
    let mut store = Store::open(ACCOUNT.to_string(), None).expect("store");
    store.apply("READY", &fixture("ready_flat.json"));
    let guilds = store.guilds();
    assert_eq!(guilds.len(), 1);
    assert_eq!(guilds[0].name, "Serveur Gamma");
    assert_eq!(
        guilds[0].icon_url.as_deref(),
        Some(
            "https://cdn.discordapp.com/icons/222222222222222224/0123456789abcdef0123456789abcdef.png"
        )
    );
    assert_eq!(
        channel_ids(&store, "222222222222222224"),
        vec!["260000000000000020"]
    );
    assert!(!store.channels("222222222222222224")[0].unread);
}

#[test]
fn channels_are_sorted_by_category_then_position_without_threads() {
    let store = ready_store();
    assert_eq!(
        channel_ids(&store, GUILD_ALPHA),
        vec![
            "260000000000000006", // annonces, sans catégorie
            "260000000000000003", // catégorie Accueil
            "260000000000000005", //   Vocal
            "260000000000000001", // catégorie Discussion
            "260000000000000004", //   bienvenue
            "260000000000000002", //   general
        ]
    );
    let kinds: Vec<ChannelKind> = store.channels(GUILD_ALPHA).iter().map(|c| c.kind).collect();
    assert!(!kinds.contains(&ChannelKind::Thread));
}

#[test]
fn forum_and_announcement_kinds_are_mapped() {
    let store = ready_store();
    let beta = store.channels("222222222222222223");
    assert_eq!(beta[0].kind, ChannelKind::Forum);
    assert_eq!(beta[1].kind, ChannelKind::Announcement);
}

#[test]
fn channel_unread_uses_read_state_and_mentions() {
    let store = ready_store();
    let general = store
        .channels(GUILD_ALPHA)
        .into_iter()
        .find(|c| c.id == GENERAL)
        .expect("general");
    assert!(general.unread);
    assert_eq!(general.mention_count, 2);
    let annonces = store
        .channels(GUILD_ALPHA)
        .into_iter()
        .find(|c| c.id == "260000000000000006")
        .expect("annonces");
    assert!(!annonces.unread);
}

#[test]
fn dms_are_sorted_by_last_message_desc_and_named() {
    let store = ready_store();
    let dms = store.dms();
    let ids: Vec<&str> = dms.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(
        ids,
        vec![
            "280000000000000002",
            "280000000000000001",
            "280000000000000003"
        ]
    );
    assert_eq!(dms[1].name, "Alice");
    assert_eq!(dms[1].recipients[0].id, "444444444444444444");
    assert_eq!(dms[0].name, "bob");
    assert_eq!(dms[2].name, "Projet");
    assert_eq!(dms[2].kind, ChannelKind::GroupDm);
    assert!(
        !dms[0].unread,
        "sans entrée de lecture, le dernier message est lu d'emblée"
    );
    assert!(!dms[1].unread);
}

#[test]
fn ready_emits_upserts_for_guilds_and_all_channels() {
    let mut store = Store::open(ACCOUNT.to_string(), None).expect("store");
    let events = store.apply("READY", &fixture("ready_split.json"));
    let guilds = events
        .iter()
        .filter(|e| matches!(e, EngineEvent::GuildUpsert { .. }))
        .count();
    let channels = events
        .iter()
        .filter(|e| matches!(e, EngineEvent::ChannelUpsert { .. }))
        .count();
    assert_eq!(guilds, 2);
    assert_eq!(channels, 7 + 2 + 3, "salons, fil compris, puis MP");
    let general = events.iter().find_map(|e| match e {
        EngineEvent::ChannelUpsert { channel, .. } if channel.id == GENERAL => Some(channel),
        _ => None,
    });
    assert!(
        general.expect("general émis").unread,
        "l'événement reflète l'état après READY"
    );
}

#[test]
fn unknown_event_is_ignored() {
    let mut store = ready_store();
    let events = store.apply("SOMETHING_NEW", &serde_json::json!({"id": "1"}));
    assert!(events.is_empty());
}

#[test]
fn guild_delete_removes_guild_and_channels_but_not_on_outage() {
    let mut store = ready_store();
    let outage = store.apply(
        "GUILD_DELETE",
        &serde_json::json!({"id": GUILD_ALPHA, "unavailable": true}),
    );
    assert!(outage.is_empty());
    assert_eq!(store.guilds().len(), 2);

    let events = store.apply("GUILD_DELETE", &serde_json::json!({"id": GUILD_ALPHA}));
    assert!(
        matches!(events.as_slice(), [EngineEvent::GuildRemove { guild_id, .. }] if guild_id == GUILD_ALPHA)
    );
    assert_eq!(store.guilds().len(), 1);
    assert!(store.channels(GUILD_ALPHA).is_empty());
}

#[test]
fn channel_create_update_delete_roundtrip() {
    let mut store = ready_store();
    let created = serde_json::json!({
        "id": "260000000000000099", "type": 0, "name": "nouveau", "position": 3,
        "parent_id": null, "guild_id": GUILD_ALPHA
    });
    let events = store.apply("CHANNEL_CREATE", &created);
    assert!(matches!(
        events.as_slice(),
        [EngineEvent::ChannelUpsert { .. }]
    ));
    assert!(channel_ids(&store, GUILD_ALPHA).contains(&"260000000000000099".to_string()));

    let mut renamed = created.clone();
    renamed["name"] = "renomme".into();
    store.apply("CHANNEL_UPDATE", &renamed);
    let name = store
        .channels(GUILD_ALPHA)
        .into_iter()
        .find(|c| c.id == "260000000000000099")
        .map(|c| c.name);
    assert_eq!(name.as_deref(), Some("renomme"));

    let events = store.apply("CHANNEL_DELETE", &renamed);
    assert!(matches!(
        events.as_slice(),
        [EngineEvent::ChannelRemove { .. }]
    ));
    assert!(!channel_ids(&store, GUILD_ALPHA).contains(&"260000000000000099".to_string()));
}
