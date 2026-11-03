//! Connexion par email et mot de passe, avec captcha et second facteur. Ne stocke rien : c'est `accounts`.

mod reply;
mod step;

use contract::auth::{MfaMethod, PasswordLogin};
use identity::ClientIdentity;
use serde::Serialize;

use crate::AuthError;
use crate::http::{Api, Headers, api_error};
pub use step::Step;

#[derive(Serialize)]
struct LoginBody<'a> {
    login: &'a str,
    password: &'a str,
    undelete: bool,
    login_source: Option<String>,
    gift_code_sku_id: Option<String>,
}

#[derive(Serialize)]
struct MfaBody<'a> {
    code: &'a str,
    ticket: &'a str,
    login_source: Option<String>,
    gift_code_sku_id: Option<String>,
}

/// Tentative de connexion par mot de passe. `api_base` est `identity::API_BASE` en production.
pub async fn login(
    identity: &ClientIdentity,
    api_base: &str,
    request: &PasswordLogin,
) -> Result<Step, AuthError> {
    let api = Api::new(identity, api_base)?;
    let fingerprint = fetch_fingerprint(&api).await?;
    let body = LoginBody {
        login: &request.login,
        password: &request.password,
        undelete: false,
        login_source: None,
        gift_code_sku_id: None,
    };
    let reply = api
        .post("/auth/login", &body, &login_headers(&fingerprint, request))
        .await?;
    reply::parse_login(&reply)
}

/// Second facteur après `Step::Mfa`.
pub async fn mfa(
    identity: &ClientIdentity,
    api_base: &str,
    ticket: &str,
    method: MfaMethod,
    code: &str,
) -> Result<Step, AuthError> {
    let segment = mfa_segment(method)?;
    let api = Api::new(identity, api_base)?;
    let body = MfaBody {
        code,
        ticket,
        login_source: None,
        gift_code_sku_id: None,
    };
    let reply = api
        .post(&format!("/auth/mfa/{segment}"), &body, &Vec::new())
        .await?;
    reply::parse_mfa(&reply)
}

async fn fetch_fingerprint(api: &Api) -> Result<String, AuthError> {
    let reply = api.get("/experiments", &Vec::new()).await?;
    if !reply.status.is_success() {
        return Err(api_error(&reply));
    }
    reply.body["fingerprint"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| AuthError::Protocol("fingerprint absent".into()))
}

fn login_headers(fingerprint: &str, request: &PasswordLogin) -> Headers {
    let mut headers: Headers = vec![("X-Fingerprint", fingerprint.to_owned())];
    if let Some(key) = &request.captcha_key {
        headers.push(("X-Captcha-Key", key.clone()));
        headers.push((
            "X-Captcha-Rqtoken",
            request.captcha_rqtoken.clone().unwrap_or_default(),
        ));
    }
    headers
}

fn mfa_segment(method: MfaMethod) -> Result<&'static str, AuthError> {
    match method {
        MfaMethod::Totp => Ok("totp"),
        MfaMethod::Sms => Ok("sms"),
        MfaMethod::Backup => Ok("backup"),
        MfaMethod::Webauthn => Err(AuthError::Protocol("WebAuthn non géré".into())),
    }
}
