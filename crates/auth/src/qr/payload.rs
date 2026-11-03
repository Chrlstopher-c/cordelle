//! Payload utilisateur du QR code, déchiffré : `id:discriminator:avatar_hash:username`.

use contract::user::User;

use crate::AuthError;

const AVATAR_CDN: &str = "https://cdn.discordapp.com/avatars";

pub(crate) fn parse_user(text: &str) -> Result<User, AuthError> {
    let mut parts = text.splitn(4, ':');
    let (Some(id), Some(_discriminator), Some(avatar), Some(username)) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(AuthError::Protocol("payload utilisateur mal formé".into()));
    };
    if id.is_empty() {
        return Err(AuthError::Protocol("identifiant utilisateur vide".into()));
    }
    let avatar_url = (!avatar.is_empty()).then(|| format!("{AVATAR_CDN}/{id}/{avatar}.png"));
    Ok(User {
        id: id.to_owned(),
        username: username.to_owned(),
        global_name: None,
        avatar_url,
        bot: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_complet_donne_avatar() {
        let user = parse_user("42:0:abc:alice").expect("payload valide");
        assert_eq!(user.id, "42");
        assert_eq!(user.username, "alice");
        assert_eq!(
            user.avatar_url.as_deref(),
            Some("https://cdn.discordapp.com/avatars/42/abc.png")
        );
    }

    #[test]
    fn hash_vide_sans_avatar() {
        let user = parse_user("42:0::alice").expect("payload valide");
        assert!(user.avatar_url.is_none());
    }

    #[test]
    fn username_avec_deux_points_est_conserve() {
        let user = parse_user("7:0::a:b").expect("payload valide");
        assert_eq!(user.username, "a:b");
    }

    #[test]
    fn payload_tronque_est_refuse() {
        assert!(parse_user("42:0").is_err());
        assert!(parse_user(":0::alice").is_err());
    }
}
