//! Compositeur : envoi de fichiers joints (multipart) et emojis personnalisés du serveur.

use contract::{
    AccountId, EngineError, Snowflake,
    compose::{GuildEmoji, OutgoingFile},
    message::Message,
};
use serde_json::{Value, json};

use super::{Engine, internal};

/// Limite par fichier pour un compte sans Nitro.
const MAX_FILE_BYTES: usize = 10 * 1024 * 1024;

impl Engine {
    pub async fn send_files(
        &self,
        account_id: &AccountId,
        channel_id: &Snowflake,
        content: &str,
        reply_to: Option<&Snowflake>,
        files: &[OutgoingFile],
    ) -> Result<Message, EngineError> {
        let session = self.session(account_id)?;
        let mut payload = json!({
            "content": content,
            "nonce": nonce(),
            "tts": false,
            "attachments": attachment_refs(files),
        });
        if let Some(reply) = reply_to {
            payload["message_reference"] = json!({"channel_id": channel_id, "message_id": reply});
        }
        let uploads = decode_files(files)?;
        let sent: Value = session
            .rest
            .post_multipart(
                &format!("/channels/{channel_id}/messages"),
                &payload,
                uploads,
            )
            .await?;
        store::convert::message(&sent).ok_or_else(|| internal("réponse d'envoi illisible"))
    }

    pub async fn guild_emojis(
        &self,
        account_id: &AccountId,
        guild_id: &Snowflake,
    ) -> Result<Vec<GuildEmoji>, EngineError> {
        let session = self.session(account_id)?;
        let raw: Vec<Value> = session
            .rest
            .get_json(&format!("/guilds/{guild_id}/emojis"))
            .await?;
        Ok(raw.iter().filter_map(guild_emoji).collect())
    }
}

fn guild_emoji(value: &Value) -> Option<GuildEmoji> {
    Some(GuildEmoji {
        id: value.get("id")?.as_str()?.to_owned(),
        name: value.get("name")?.as_str()?.to_owned(),
        animated: value
            .get("animated")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

/// Références `attachments` du payload : index du fichier (`files[i]`) et nom.
fn attachment_refs(files: &[OutgoingFile]) -> Value {
    Value::Array(
        files
            .iter()
            .enumerate()
            .map(|(id, file)| json!({"id": id, "filename": file.filename}))
            .collect(),
    )
}

fn decode_files(files: &[OutgoingFile]) -> Result<Vec<(String, Vec<u8>)>, EngineError> {
    files
        .iter()
        .map(|file| {
            let bytes = base64_decode(&file.bytes_b64)
                .ok_or_else(|| internal("fichier joint illisible"))?;
            if bytes.len() > MAX_FILE_BYTES {
                return Err(internal("fichier trop lourd (10 Mo maximum)"));
            }
            Ok((file.filename.clone(), bytes))
        })
        .collect()
}

/// Décodage base64 standard ; le remplissage `=` est ignoré. `None` si un caractère est invalide.
fn base64_decode(input: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(input.len() / 4 * 3);
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;
    for byte in input.bytes().filter(|b| *b != b'=') {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        };
        buffer = (buffer << 6) | u32::from(value);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
        }
    }
    Some(out)
}

/// Nonce : horodatage en millisecondes, réconcilie l'envoi côté Discord.
fn nonce() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis())
        .to_string()
}
