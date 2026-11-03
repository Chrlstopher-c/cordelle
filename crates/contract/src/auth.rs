use crate::{AccountId, user::User};

/// Étapes de la connexion par QR code (remote auth), poussées par l'événement `auth_qr`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(tag = "step", rename_all = "snake_case")]
pub enum QrAuthEvent {
    /// `url` est à encoder en QR et à scanner avec l'app mobile Discord.
    Ready {
        url: String,
    },
    Scanned {
        user: User,
    },
    Completed {
        account_id: AccountId,
    },
    Cancelled,
    Expired,
    Failed {
        message: String,
    },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct CaptchaChallenge {
    pub service: String,
    pub sitekey: String,
    pub rqdata: Option<String>,
    pub rqtoken: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum MfaMethod {
    Totp,
    Sms,
    Backup,
    Webauthn,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum LoginOutcome {
    Success {
        account_id: AccountId,
    },
    MfaRequired {
        ticket: String,
        methods: Vec<MfaMethod>,
    },
    CaptchaRequired {
        challenge: CaptchaChallenge,
    },
    InvalidCredentials,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct PasswordLogin {
    pub login: String,
    pub password: String,
    /// Réponse au captcha quand la tentative précédente a renvoyé `CaptchaRequired`.
    pub captcha_key: Option<String>,
    pub captcha_rqtoken: Option<String>,
}
