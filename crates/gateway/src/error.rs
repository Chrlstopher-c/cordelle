//! Erreurs du domaine gateway.

#[derive(Debug, thiserror::Error)]
pub enum GatewayError {
    #[error("gateway fermée")]
    Closed,
    #[error("décompression zlib-stream échouée: {0}")]
    Decompress(#[from] flate2::DecompressError),
    #[error("trame zlib-stream incomplète")]
    Truncated,
    #[error("payload gateway invalide: {0}")]
    Json(#[from] serde_json::Error),
    #[error("texte gateway non UTF-8: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error("champ gateway absent ou invalide: {0}")]
    Field(&'static str),
}
