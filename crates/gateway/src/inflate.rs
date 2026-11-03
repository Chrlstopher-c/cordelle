//! Décompression zlib-stream : un seul décompresseur par connexion, chaque message finit par le suffixe Sync.

use flate2::{Decompress, FlushDecompress};

use crate::error::GatewayError;

const SYNC_SUFFIX: [u8; 4] = [0x00, 0x00, 0xFF, 0xFF];
const MIN_RESERVE: usize = 1024;

pub struct Inflater {
    decompress: Decompress,
    pending: Vec<u8>,
}

impl Default for Inflater {
    fn default() -> Self {
        Self::new()
    }
}

impl Inflater {
    pub fn new() -> Self {
        Self {
            decompress: Decompress::new(true),
            pending: Vec::new(),
        }
    }

    /// Ajoute une trame binaire. Renvoie le message décompressé dès que le suffixe 00 00 FF FF est atteint.
    pub fn push(&mut self, chunk: &[u8]) -> Result<Option<Vec<u8>>, GatewayError> {
        self.pending.extend_from_slice(chunk);
        if !self.pending.ends_with(&SYNC_SUFFIX) {
            return Ok(None);
        }
        let frame = std::mem::take(&mut self.pending);
        self.inflate(&frame).map(Some)
    }

    fn inflate(&mut self, frame: &[u8]) -> Result<Vec<u8>, GatewayError> {
        let mut out = Vec::with_capacity(frame.len().saturating_mul(4));
        let start = self.decompress.total_in();
        loop {
            if out.len() == out.capacity() {
                out.reserve(frame.len().max(MIN_RESERVE));
            }
            let before = (self.decompress.total_in(), self.decompress.total_out());
            let consumed = usize::try_from(before.0 - start).unwrap_or(frame.len());
            self.decompress
                .decompress_vec(&frame[consumed..], &mut out, FlushDecompress::Sync)?;
            let after = (self.decompress.total_in(), self.decompress.total_out());
            let all_read = usize::try_from(after.0 - start).ok() == Some(frame.len());
            if all_read && out.len() < out.capacity() {
                return Ok(out);
            }
            if after == before {
                return Err(GatewayError::Truncated);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use flate2::{Compress, Compression, FlushCompress};

    use super::Inflater;

    /// Compresse un message dans le flux persistant `c`, terminé par un flush Sync (suffixe 00 00 FF FF).
    pub(crate) fn compress_frame(c: &mut Compress, msg: &[u8]) -> Vec<u8> {
        let mut out = Vec::with_capacity(msg.len() + 64);
        let start = c.total_in();
        loop {
            if out.len() == out.capacity() {
                out.reserve(256);
            }
            let consumed = usize::try_from(c.total_in() - start).unwrap_or(msg.len());
            c.compress_vec(&msg[consumed..], &mut out, FlushCompress::Sync)
                .expect("compression de test");
            if usize::try_from(c.total_in() - start).ok() == Some(msg.len())
                && out.len() < out.capacity()
            {
                return out;
            }
        }
    }

    #[test]
    fn decompresse_plusieurs_trames_avec_un_seul_contexte() {
        let mut c = Compress::new(Compression::default(), true);
        let first = compress_frame(&mut c, br#"{"op":10,"d":{"heartbeat_interval":41250}}"#);
        let second = compress_frame(&mut c, br#"{"op":11}"#);
        let mut inflater = Inflater::new();
        let one = inflater.push(&first).expect("trame 1").expect("message 1");
        assert_eq!(one, br#"{"op":10,"d":{"heartbeat_interval":41250}}"#);
        let two = inflater.push(&second).expect("trame 2").expect("message 2");
        assert_eq!(two, br#"{"op":11}"#);
    }

    #[test]
    fn attend_le_suffixe_avant_de_rendre_le_message() {
        let mut c = Compress::new(Compression::default(), true);
        let frame = compress_frame(&mut c, b"hello gateway");
        let (head, tail) = frame.split_at(frame.len() / 2);
        let mut inflater = Inflater::new();
        assert!(inflater.push(head).expect("morceau 1").is_none());
        assert_eq!(
            inflater.push(tail).expect("morceau 2").as_deref(),
            Some(&b"hello gateway"[..])
        );
    }

    #[test]
    fn gros_message_traverse_les_reallocations() {
        let mut c = Compress::new(Compression::default(), true);
        let msg = vec![b'a'; 100_000];
        let frame = compress_frame(&mut c, &msg);
        let mut inflater = Inflater::new();
        assert_eq!(
            inflater.push(&frame).expect("gros message").as_deref(),
            Some(msg.as_slice())
        );
    }
}
