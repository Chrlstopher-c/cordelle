//! Lecture des réponses de connexion et de 2FA : jeton, second facteur, captcha, identifiants refusés.

use contract::auth::{CaptchaChallenge, MfaMethod};
use serde_json::Value;

use super::Step;
use crate::AuthError;
use crate::http::{Reply, api_error};

/// Code Discord « code 2FA invalide ».
const INVALID_MFA_CODE: i64 = 60008;

pub(crate) fn parse_login(reply: &Reply) -> Result<Step, AuthError> {
    let body = &reply.body;
    if body.get("mfa").and_then(Value::as_bool) == Some(true) {
        return mfa_step(body);
    }
    if body.get("captcha_sitekey").is_some() {
        return Ok(Step::Captcha(captcha_challenge(body)));
    }
    if reply.status.is_success() {
        return token_step(body);
    }
    if has_field_error(body) {
        return Ok(Step::Invalid);
    }
    Err(api_error(reply))
}

pub(crate) fn parse_mfa(reply: &Reply) -> Result<Step, AuthError> {
    if reply.status.is_success() {
        return token_step(&reply.body);
    }
    if reply.body.get("code").and_then(Value::as_i64) == Some(INVALID_MFA_CODE) {
        return Ok(Step::Invalid);
    }
    Err(api_error(reply))
}

fn mfa_step(body: &Value) -> Result<Step, AuthError> {
    let ticket =
        text_of(body, "ticket").ok_or_else(|| AuthError::Protocol("ticket MFA absent".into()))?;
    let methods = [
        ("totp", MfaMethod::Totp),
        ("sms", MfaMethod::Sms),
        ("backup", MfaMethod::Backup),
        ("webauthn", MfaMethod::Webauthn),
    ]
    .into_iter()
    .filter(|(key, _)| body.get(*key).and_then(Value::as_bool) == Some(true))
    .map(|(_, method)| method)
    .collect();
    Ok(Step::Mfa { ticket, methods })
}

fn captcha_challenge(body: &Value) -> CaptchaChallenge {
    CaptchaChallenge {
        service: text_of(body, "captcha_service").unwrap_or_default(),
        sitekey: text_of(body, "captcha_sitekey").unwrap_or_default(),
        rqdata: text_of(body, "captcha_rqdata"),
        rqtoken: text_of(body, "captcha_rqtoken"),
    }
}

fn token_step(body: &Value) -> Result<Step, AuthError> {
    text_of(body, "token")
        .map(Step::Token)
        .ok_or_else(|| AuthError::Protocol("jeton absent de la réponse".into()))
}

fn has_field_error(body: &Value) -> bool {
    body.get("errors")
        .is_some_and(|errors| errors.get("login").is_some() || errors.get("password").is_some())
}

fn text_of(body: &Value, key: &str) -> Option<String> {
    body.get(key).and_then(Value::as_str).map(str::to_owned)
}
