//! Flux micro vu par songbird : échantillons f32 LE tirés du tampon de capture, silence si vide.

use std::io::{self, Read, Seek, SeekFrom};

use symphonia_core::io::MediaSource;

use crate::audio::Buffer;

/// Source non seekable et infinie : ne se termine jamais, ne bloque jamais le mixeur.
pub struct MicSource {
    samples: Buffer,
}

impl MicSource {
    pub fn new(samples: Buffer) -> Self {
        Self { samples }
    }
}

impl Read for MicSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let Ok(mut samples) = self.samples.lock() else {
            buf.fill(0);
            return Ok(buf.len());
        };
        let written = buf.len() - buf.len() % 4;
        for chunk in buf[..written].as_chunks_mut::<4>().0 {
            let sample = samples.pop_front().unwrap_or(0.0);
            chunk.copy_from_slice(&sample.to_le_bytes());
        }
        Ok(written)
    }
}

impl Seek for MicSource {
    fn seek(&mut self, _pos: SeekFrom) -> io::Result<u64> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "flux micro non seekable",
        ))
    }
}

impl MediaSource for MicSource {
    fn is_seekable(&self) -> bool {
        false
    }

    fn byte_len(&self) -> Option<u64> {
        None
    }
}
