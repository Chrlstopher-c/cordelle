//! Connexion par mot de passe, captcha et 2FA contre un faux HTTP (wiremock).

use auth::password::{self, Step};
use contract::auth::{MfaMethod, PasswordLogin};
use identity::ClientIdentity;
use serde_json::json;
use wiremock::matchers::{body_json, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

const LOGIN_BODY: &str = "login";

fn identity() -> ClientIdentity {
    ClientIdentity::new(400_000, "fr")
}

fn login_request() -> PasswordLogin {
    PasswordLogin {
        login: LOGIN_BODY.into(),
        password: "hunter2".into(),
        captcha_key: None,
        captcha_rqtoken: None,
    }
}

async fn mount_fingerprint(server: &MockServer) {
    Mock::given(method("GET"))
        .and(path("/api/v9/experiments"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"fingerprint": "FP-1"})))
        .mount(server)
        .await;
}

fn expected_login_body() -> serde_json::Value {
    json!({
        "login": LOGIN_BODY,
        "password": "hunter2",
        "undelete": false,
        "login_source": null,
        "gift_code_sku_id": null
    })
}

fn api(server: &MockServer) -> String {
    format!("{}/api/v9", server.uri())
}

#[tokio::test]
async fn connexion_reussie_renvoie_le_jeton() {
    let server = MockServer::start().await;
    mount_fingerprint(&server).await;
    Mock::given(method("POST"))
        .and(path("/api/v9/auth/login"))
        .and(header("X-Fingerprint", "FP-1"))
        .and(body_json(expected_login_body()))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"token": "TOK"})))
        .mount(&server)
        .await;
    let step = password::login(&identity(), &api(&server), &login_request())
        .await
        .expect("réponse");
    assert!(matches!(step, Step::Token(ref token) if token == "TOK"));
}

#[tokio::test]
async fn mfa_demande_le_second_facteur_puis_renvoie_le_jeton() {
    let server = MockServer::start().await;
    mount_fingerprint(&server).await;
    Mock::given(method("POST"))
        .and(path("/api/v9/auth/login"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "mfa": true, "ticket": "TK", "totp": true, "sms": false, "backup": true, "webauthn": false
        })))
        .mount(&server)
        .await;
    mount_mfa_totp(&server).await;
    let step = password::login(&identity(), &api(&server), &login_request())
        .await
        .expect("réponse");
    let Step::Mfa { ticket, methods } = step else {
        panic!("MFA attendu")
    };
    assert_eq!(ticket, "TK");
    assert_eq!(methods, vec![MfaMethod::Totp, MfaMethod::Backup]);
    let second = password::mfa(
        &identity(),
        &api(&server),
        &ticket,
        MfaMethod::Totp,
        "123456",
    )
    .await
    .expect("réponse 2FA");
    assert!(matches!(second, Step::Token(ref token) if token == "TOK2"));
}

async fn mount_mfa_totp(server: &MockServer) {
    Mock::given(method("POST"))
        .and(path("/api/v9/auth/mfa/totp"))
        .and(body_json(json!({
            "code": "123456", "ticket": "TK", "login_source": null, "gift_code_sku_id": null
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"token": "TOK2"})))
        .mount(server)
        .await;
}

fn captcha_reply() -> ResponseTemplate {
    ResponseTemplate::new(400).set_body_json(json!({
        "captcha_key": ["captcha-required"],
        "captcha_sitekey": "SK",
        "captcha_service": "hcaptcha",
        "captcha_rqdata": "RQD",
        "captcha_rqtoken": "RQT"
    }))
}

async fn mount_captcha_accepted(server: &MockServer) {
    Mock::given(method("POST"))
        .and(path("/api/v9/auth/login"))
        .and(header("X-Captcha-Key", "CK"))
        .and(header("X-Captcha-Rqtoken", "RQT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"token": "TOK3"})))
        .mount(server)
        .await;
}

#[tokio::test]
async fn captcha_est_renvoye_puis_accepte_avec_ses_en_tetes() {
    let server = MockServer::start().await;
    mount_fingerprint(&server).await;
    mount_captcha_accepted(&server).await;
    Mock::given(method("POST"))
        .and(path("/api/v9/auth/login"))
        .respond_with(captcha_reply())
        .mount(&server)
        .await;

    let step = password::login(&identity(), &api(&server), &login_request())
        .await
        .expect("réponse");
    let Step::Captcha(challenge) = step else {
        panic!("captcha attendu")
    };
    assert_eq!(challenge.service, "hcaptcha");
    assert_eq!(challenge.sitekey, "SK");
    assert_eq!(challenge.rqdata.as_deref(), Some("RQD"));
    assert_eq!(challenge.rqtoken.as_deref(), Some("RQT"));

    let retry = PasswordLogin {
        captcha_key: Some("CK".into()),
        captcha_rqtoken: Some("RQT".into()),
        ..login_request()
    };
    let step = password::login(&identity(), &api(&server), &retry)
        .await
        .expect("réponse 2");
    assert!(matches!(step, Step::Token(ref token) if token == "TOK3"));
}

#[tokio::test]
async fn identifiants_invalides_renvoient_invalid() {
    let server = MockServer::start().await;
    mount_fingerprint(&server).await;
    Mock::given(method("POST"))
        .and(path("/api/v9/auth/login"))
        .respond_with(ResponseTemplate::new(400).set_body_json(json!({
            "code": 50035,
            "errors": {"login": {"_errors": [{"code": "INVALID_LOGIN", "message": "incorrect"}]}},
            "message": "Invalid Form Body"
        })))
        .mount(&server)
        .await;
    let step = password::login(&identity(), &api(&server), &login_request())
        .await
        .expect("réponse");
    assert!(matches!(step, Step::Invalid));
}

#[test]
fn debug_ne_montre_ni_jeton_ni_ticket() {
    let token = format!("{:?}", Step::Token("SECRET-TOKEN".into()));
    let mfa = format!(
        "{:?}",
        Step::Mfa {
            ticket: "SECRET-TICKET".into(),
            methods: vec![MfaMethod::Sms]
        }
    );
    assert!(!token.contains("SECRET-TOKEN"));
    assert!(!mfa.contains("SECRET-TICKET"));
}
