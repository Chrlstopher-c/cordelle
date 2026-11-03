//! Domaine auth : obtenir un jeton Discord, par QR code (remote auth) ou par mot de passe (+ 2FA, captcha).
//! Ne stocke rien : le jeton part vers `accounts`. Aucun jeton, mot de passe ou code n'est journalisé.

mod error;
mod http;
pub mod password;
pub mod qr;

pub use error::AuthError;
