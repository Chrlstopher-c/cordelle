use crate::{
    AccountId, Snowflake,
    account::ConnectionState,
    guild::{ChannelSummary, GuildSummary},
    message::Message,
    social::MemberGroup,
    user::PresenceStatus,
};

/// Tout ce que le moteur pousse vers l'interface, sur l'événement Tauri `engine`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineEvent {
    Connection {
        account_id: AccountId,
        state: ConnectionState,
    },
    GuildUpsert {
        account_id: AccountId,
        guild: GuildSummary,
    },
    GuildRemove {
        account_id: AccountId,
        guild_id: Snowflake,
    },
    ChannelUpsert {
        account_id: AccountId,
        channel: ChannelSummary,
    },
    ChannelRemove {
        account_id: AccountId,
        channel_id: Snowflake,
    },
    MessageCreate {
        account_id: AccountId,
        message: Message,
        nonce: Option<String>,
    },
    MessageUpdate {
        account_id: AccountId,
        message: Message,
    },
    MessageDelete {
        account_id: AccountId,
        channel_id: Snowflake,
        message_id: Snowflake,
    },
    Typing {
        account_id: AccountId,
        channel_id: Snowflake,
        user_id: Snowflake,
    },
    Presence {
        account_id: AccountId,
        user_id: Snowflake,
        status: PresenceStatus,
    },
    Unread {
        account_id: AccountId,
        channel_id: Snowflake,
        unread: bool,
        mention_count: u32,
    },
    /// Liste des membres d'un salon (100 premiers), remplacée en entier à chaque mise à jour.
    MemberList {
        account_id: AccountId,
        guild_id: Snowflake,
        groups: Vec<MemberGroup>,
    },
    /// États vocaux d'un serveur (ou d'un appel MP) : remplace la liste entière de ce périmètre.
    VoiceStates {
        account_id: AccountId,
        /// `None` pour un appel en MP.
        guild_id: Option<Snowflake>,
        states: Vec<crate::voice::VoiceMember>,
    },
    /// Sa propre session vocale (connexion, micro, qui parle).
    VoiceSession { session: crate::voice::VoiceSession },
}
