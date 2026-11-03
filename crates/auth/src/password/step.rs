//! Étape de connexion par mot de passe. `Debug` masque jetons et tickets.

use std::fmt;

use contract::auth::{CaptchaChallenge, MfaMethod};

pub enum Step {
    Token(String),
    Mfa {
        ticket: String,
        methods: Vec<MfaMethod>,
    },
    Captcha(CaptchaChallenge),
    /// Identifiants refusés, ou code 2FA refusé.
    Invalid,
}

impl fmt::Debug for Step {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Token(_) => f.write_str("Token(<masqué>)"),
            Self::Mfa { methods, .. } => f
                .debug_struct("Mfa")
                .field("ticket", &"<masqué>")
                .field("methods", methods)
                .finish(),
            Self::Captcha(challenge) => f.debug_tuple("Captcha").field(challenge).finish(),
            Self::Invalid => f.write_str("Invalid"),
        }
    }
}
