use crate::{AccountId, Snowflake};

/// État vocal d'une personne dans un salon (VOICE_STATE_UPDATE).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct VoiceMember {
    pub user_id: Snowflake,
    pub channel_id: Snowflake,
    pub mute: bool,
    pub deaf: bool,
    /// Partage d'écran (Go Live) en cours.
    pub streaming: bool,
    pub video: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum VoiceConnection {
    Disconnected,
    Connecting,
    Connected,
    Failed,
}

/// Sa propre session vocale.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct VoiceSession {
    pub account_id: AccountId,
    pub guild_id: Option<Snowflake>,
    pub channel_id: Option<Snowflake>,
    pub connection: VoiceConnection,
    pub self_mute: bool,
    pub self_deaf: bool,
    pub ping_ms: Option<u32>,
    /// Utilisateurs qui parlent en ce moment (indicateur vert).
    pub speaking: Vec<Snowflake>,
    /// Message lisible en cas d'échec.
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct AudioDevices {
    pub inputs: Vec<AudioDevice>,
    pub outputs: Vec<AudioDevice>,
}
