//! Partage d'écran (Go Live) : qualité demandée et état de partage de sa propre personne.

use crate::AccountId;

/// Définition du partage : largeur × hauteur en pixels et images par seconde.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct StreamQuality {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

/// Partage en cours pour un compte. `quality` est absente quand rien n'est partagé.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct StreamState {
    pub account_id: AccountId,
    pub streaming: bool,
    pub quality: Option<StreamQuality>,
}
