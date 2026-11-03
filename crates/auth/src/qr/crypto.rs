//! Cryptographie remote auth : clé RSA-2048 éphémère, RSA-OAEP SHA-256, preuve de nonce.

use base64::Engine as _;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use rsa::pkcs8::EncodePublicKey;
use rsa::rand_core::OsRng;
use rsa::{Oaep, RsaPrivateKey};
use sha2::{Digest, Sha256};

use crate::AuthError;

const KEY_BITS: usize = 2048;

pub(crate) async fn generate_key() -> Result<RsaPrivateKey, AuthError> {
    match tokio::task::spawn_blocking(|| RsaPrivateKey::new(&mut OsRng, KEY_BITS)).await {
        Ok(Ok(key)) => Ok(key),
        Ok(Err(err)) => Err(crypto_error("génération de clé", &err)),
        Err(err) => Err(crypto_error("tâche de génération de clé", &err)),
    }
}

/// Clé publique au format SPKI DER, encodée en base64 standard.
pub(crate) fn public_key_b64(key: &RsaPrivateKey) -> Result<String, AuthError> {
    let der = key
        .to_public_key()
        .to_public_key_der()
        .map_err(|err| crypto_error("clé publique", &err))?;
    Ok(STANDARD.encode(der.as_bytes()))
}

pub(crate) fn decrypt_b64(key: &RsaPrivateKey, encoded: &str) -> Result<Vec<u8>, AuthError> {
    let cipher = STANDARD
        .decode(encoded)
        .map_err(|err| crypto_error("base64", &err))?;
    key.decrypt(Oaep::new::<Sha256>(), &cipher)
        .map_err(|err| crypto_error("déchiffrement OAEP", &err))
}

pub(crate) fn decrypt_text(key: &RsaPrivateKey, encoded: &str) -> Result<String, AuthError> {
    let bytes = decrypt_b64(key, encoded)?;
    String::from_utf8(bytes).map_err(|err| crypto_error("texte UTF-8", &err))
}

/// Réponse au défi `nonce_proof` : base64url sans padding de SHA-256(nonce).
pub(crate) fn nonce_proof(key: &RsaPrivateKey, encrypted_nonce: &str) -> Result<String, AuthError> {
    Ok(proof_for(&decrypt_b64(key, encrypted_nonce)?))
}

pub(crate) fn proof_for(nonce: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(nonce))
}

fn crypto_error(step: &str, err: &dyn std::fmt::Display) -> AuthError {
    tracing::error!(error = %err, step, "échec cryptographique remote auth");
    AuthError::Crypto(format!("{step} : {err}"))
}

#[cfg(test)]
mod tests {
    use rsa::RsaPublicKey;
    use rsa::pkcs8::DecodePublicKey;

    use super::*;

    #[tokio::test]
    async fn oaep_aller_retour() {
        let key = generate_key().await.expect("clé");
        let cipher = key
            .to_public_key()
            .encrypt(&mut OsRng, Oaep::new::<Sha256>(), b"jeton de test")
            .expect("chiffrement");
        let encoded = STANDARD.encode(cipher);
        assert_eq!(
            decrypt_text(&key, &encoded).expect("déchiffrement"),
            "jeton de test"
        );
    }

    #[tokio::test]
    async fn cle_publique_encodee_se_relit_en_spki() {
        let key = generate_key().await.expect("clé");
        let encoded = public_key_b64(&key).expect("encodage");
        let der = STANDARD.decode(encoded).expect("base64");
        let parsed = RsaPublicKey::from_public_key_der(&der).expect("SPKI");
        assert_eq!(parsed, key.to_public_key());
    }

    #[test]
    fn preuve_de_nonce_sur_vecteur_fixe() {
        assert_eq!(
            proof_for(b"abc"),
            "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
        );
    }

    #[tokio::test]
    async fn texte_chiffre_invalide_est_refuse() {
        let key = generate_key().await.expect("clé");
        assert!(decrypt_text(&key, "pas du base64 !!").is_err());
    }
}
