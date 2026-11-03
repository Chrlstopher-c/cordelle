//! Tests du client REST contre un faux serveur local (jamais le vrai Discord).

use std::time::{Duration, Instant};

use contract::EngineError;
use identity::ClientIdentity;
use rest::{RestClient, RestError};
use serde_json::json;
use wiremock::matchers::{body_json, header, header_exists, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

const MESSAGE_JSON: &str = concat!(
    r#"{"id":"9","channel_id":"42","content":"salut","#,
    r#""timestamp":"2026-11-03T10:00:00+00:00","author":{"id":"1","username":"chris"}}"#
);

fn identity() -> ClientIdentity {
    ClientIdentity::new(400_000, "fr")
}

async fn client_for(server: &MockServer) -> RestClient {
    RestClient::new(identity(), server.uri()).expect("client HTTP")
}

#[tokio::test]
async fn envoie_identite_et_jeton() {
    let server = MockServer::start().await;
    let id = identity();
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .and(header(
            "x-super-properties",
            id.super_properties_header().as_str(),
        ))
        .and(header("x-discord-locale", "fr"))
        .and(header("authorization", "jeton-test"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"id": "1", "username": "chris"})),
        )
        .expect(1)
        .mount(&server)
        .await;

    let user = client_for(&server)
        .await
        .with_token("jeton-test")
        .me()
        .await
        .expect("me");
    assert_eq!(user.username, "chris");
    let requests = server.received_requests().await.unwrap_or_default();
    assert_eq!(
        requests[0]
            .headers
            .get("user-agent")
            .and_then(|v| v.to_str().ok()),
        Some(id.user_agent())
    );
}

#[tokio::test]
async fn sans_jeton_pas_d_autorisation() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/experiments"))
        .and(header_exists("x-super-properties"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"fingerprint": "fp-1"})))
        .mount(&server)
        .await;

    let fingerprint = client_for(&server)
        .await
        .fingerprint()
        .await
        .expect("fingerprint");
    assert_eq!(fingerprint, "fp-1");
    let requests = server.received_requests().await.unwrap_or_default();
    assert!(requests[0].headers.get("authorization").is_none());
}

#[tokio::test]
async fn relance_une_fois_apres_429() {
    let server = MockServer::start().await;
    let limited =
        json!({"message": "You are being rate limited.", "retry_after": 0.05, "global": false});
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .respond_with(ResponseTemplate::new(429).set_body_json(limited))
        .up_to_n_times(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"id": "1", "username": "chris"})),
        )
        .mount(&server)
        .await;

    let user = client_for(&server)
        .await
        .with_token("t")
        .me()
        .await
        .expect("succès après 429");
    assert_eq!(user.id, "1");
    assert_eq!(
        server.received_requests().await.unwrap_or_default().len(),
        2
    );
}

#[tokio::test]
async fn pause_globale_sur_429_global() {
    let server = MockServer::start().await;
    let limited = json!({"message": "global", "retry_after": 0.2, "global": true});
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .respond_with(ResponseTemplate::new(429).set_body_json(limited))
        .up_to_n_times(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"id": "1", "username": "chris"})),
        )
        .mount(&server)
        .await;

    let start = Instant::now();
    client_for(&server)
        .await
        .with_token("t")
        .me()
        .await
        .expect("succès après pause globale");
    assert!(start.elapsed() >= Duration::from_millis(180));
}

#[tokio::test]
async fn bucket_epuise_attend_la_reprise() {
    let server = MockServer::start().await;
    let exhausted = ResponseTemplate::new(200)
        .insert_header("x-ratelimit-bucket", "b1")
        .insert_header("x-ratelimit-remaining", "0")
        .insert_header("x-ratelimit-reset-after", "0.3")
        .set_body_json(json!({"fingerprint": "fp"}));
    Mock::given(method("GET"))
        .and(path("/experiments"))
        .respond_with(exhausted)
        .up_to_n_times(1)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/experiments"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"fingerprint": "fp"})))
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    client.fingerprint().await.expect("première requête");
    let start = Instant::now();
    client.fingerprint().await.expect("seconde requête");
    assert!(start.elapsed() >= Duration::from_millis(250));
}

#[tokio::test]
async fn unauthorized_sur_401() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .respond_with(
            ResponseTemplate::new(401)
                .set_body_json(json!({"message": "401: Unauthorized", "code": 0})),
        )
        .mount(&server)
        .await;

    let err = client_for(&server)
        .await
        .with_token("mauvais")
        .me()
        .await
        .expect_err("401 attendu");
    assert!(matches!(err, RestError::Unauthorized));
    assert!(matches!(EngineError::from(err), EngineError::Unauthorized));
}

#[tokio::test]
async fn erreur_discord_decodee() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .respond_with(
            ResponseTemplate::new(403)
                .set_body_json(json!({"code": 50001, "message": "Missing Access"})),
        )
        .mount(&server)
        .await;

    let err = client_for(&server)
        .await
        .me()
        .await
        .expect_err("403 attendu");
    match err {
        RestError::Http {
            status,
            code,
            message,
        } => {
            assert_eq!(status, 403);
            assert_eq!(code, 50001);
            assert_eq!(message, "Missing Access");
        }
        other => panic!("mauvaise erreur : {other:?}"),
    }
}

#[tokio::test]
async fn corps_invalide_donne_decode() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/users/@me"))
        .respond_with(ResponseTemplate::new(200).set_body_string("pas du json"))
        .mount(&server)
        .await;

    let err = client_for(&server)
        .await
        .me()
        .await
        .expect_err("décodage attendu");
    assert!(matches!(err, RestError::Decode(_)));
}

#[tokio::test]
async fn envoi_message_avec_reponse() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/channels/42/messages"))
        .and(body_json(json!({
            "content": "salut",
            "nonce": "n-1",
            "tts": false,
            "flags": 0,
            "message_reference": {"message_id": "7"}
        })))
        .respond_with(ResponseTemplate::new(200).set_body_raw(MESSAGE_JSON, "application/json"))
        .expect(1)
        .mount(&server)
        .await;

    let sent = client_for(&server)
        .await
        .with_token("t")
        .send_message("42", "salut", "n-1", Some("7"))
        .await;
    assert_eq!(sent.expect("envoi").id, "9");
}

#[tokio::test]
async fn envoi_message_sans_reponse_omet_la_reference() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/channels/42/messages"))
        .and(body_json(
            json!({"content": "salut", "nonce": "n-2", "tts": false, "flags": 0}),
        ))
        .respond_with(ResponseTemplate::new(200).set_body_raw(MESSAGE_JSON, "application/json"))
        .expect(1)
        .mount(&server)
        .await;

    let sent = client_for(&server)
        .await
        .with_token("t")
        .send_message("42", "salut", "n-2", None)
        .await;
    assert!(sent.is_ok());
}

#[tokio::test]
async fn historique_avec_pagination() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/channels/42/messages"))
        .and(query_param("limit", "50"))
        .and(query_param("before", "99"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_raw(format!("[{MESSAGE_JSON}]"), "application/json"),
        )
        .expect(1)
        .mount(&server)
        .await;

    let page = client_for(&server)
        .await
        .messages("42", Some("99"), 50)
        .await
        .expect("historique");
    assert_eq!(page.len(), 1);
    assert_eq!(page[0].author.username, "chris");
}
