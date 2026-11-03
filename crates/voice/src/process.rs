//! Traitement du micro par trame de 20 ms : gain, réduction de bruit (RNNoise), niveau, seuil de voix avec
//! maintien (la voix ne coupe pas entre deux mots), seuil automatique qui suit le bruit de fond.

use contract::voice::AudioSettings;
use nnnoiseless::DenoiseState;

/// Trame traitée : 20 ms à 48 kHz.
pub const FRAME: usize = 960;
/// Maintien après la dernière détection : 300 ms.
const HANGOVER_FRAMES: u32 = 15;
const FLOOR_DB: f32 = -100.0;

pub struct Frame {
    /// Stéréo entrelacé, silence si la voix ne passe pas.
    pub samples: Vec<f32>,
    pub level_db: f32,
    pub threshold_db: f32,
    pub gate_open: bool,
}

pub struct Processor {
    denoise: Box<DenoiseState<'static>>,
    noise_floor_db: f32,
    hangover: u32,
}

impl Default for Processor {
    fn default() -> Self {
        Self {
            denoise: DenoiseState::new(),
            noise_floor_db: -60.0,
            hangover: 0,
        }
    }
}

impl Processor {
    /// `stereo` : `FRAME` paires gauche/droite.
    pub fn process(&mut self, stereo: &[f32], settings: &AudioSettings) -> Frame {
        let mut mono: Vec<f32> = stereo
            .as_chunks::<2>()
            .0
            .iter()
            .map(|lr| (lr[0] + lr[1]) * 0.5 * settings.input_volume)
            .collect();
        if settings.noise_suppression {
            self.denoise_in_place(&mut mono);
        }
        let level_db = level_of(&mono);
        let threshold_db = self.threshold(level_db, settings);
        let gate_open = self.gate(level_db >= threshold_db);
        let samples = if gate_open {
            mono.iter().flat_map(|&s| [s.clamp(-1.0, 1.0); 2]).collect()
        } else {
            vec![0.0; mono.len() * 2]
        };
        Frame {
            samples,
            level_db,
            threshold_db,
            gate_open,
        }
    }

    fn denoise_in_place(&mut self, mono: &mut [f32]) {
        let mut out = [0.0f32; DenoiseState::FRAME_SIZE];
        for chunk in mono.chunks_mut(DenoiseState::FRAME_SIZE) {
            if chunk.len() < DenoiseState::FRAME_SIZE {
                continue;
            }
            let scaled: Vec<f32> = chunk.iter().map(|s| s * 32_767.0).collect();
            self.denoise.process_frame(&mut out, &scaled);
            for (dst, src) in chunk.iter_mut().zip(out.iter()) {
                *dst = src / 32_767.0;
            }
        }
    }

    /// Seuil manuel, ou bruit de fond + 18 dB (borné) en automatique.
    fn threshold(&mut self, level_db: f32, settings: &AudioSettings) -> f32 {
        if level_db < self.noise_floor_db {
            self.noise_floor_db = level_db.max(FLOOR_DB);
        } else {
            self.noise_floor_db += 0.02;
        }
        if settings.vad_auto {
            (self.noise_floor_db + 18.0).clamp(-55.0, -25.0)
        } else {
            settings.vad_threshold_db
        }
    }

    fn gate(&mut self, above: bool) -> bool {
        if above {
            self.hangover = HANGOVER_FRAMES;
            return true;
        }
        if self.hangover > 0 {
            self.hangover -= 1;
            return true;
        }
        false
    }
}

/// Niveau RMS en dBFS (plancher -100 dB).
pub fn level_of(mono: &[f32]) -> f32 {
    if mono.is_empty() {
        return FLOOR_DB;
    }
    let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
    if rms <= 1e-5 {
        FLOOR_DB
    } else {
        (20.0 * rms.log10()).max(FLOOR_DB)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(auto: bool, threshold: f32, ns: bool) -> AudioSettings {
        AudioSettings {
            vad_auto: auto,
            vad_threshold_db: threshold,
            noise_suppression: ns,
            ..AudioSettings::default()
        }
    }

    fn tone(amplitude: f32) -> Vec<f32> {
        (0..FRAME)
            .flat_map(|i| {
                let s = amplitude * (i as f32 * 0.05).sin();
                [s, s]
            })
            .collect()
    }

    #[test]
    fn silence_is_floor() {
        assert_eq!(level_of(&[0.0; 10]), FLOOR_DB);
    }

    #[test]
    fn loud_voice_passes_manual_threshold() {
        let mut p = Processor::default();
        let f = p.process(&tone(0.5), &settings(false, -40.0, false));
        assert!(f.gate_open && f.level_db > -40.0);
        assert!(f.samples.iter().any(|s| *s != 0.0));
    }

    #[test]
    fn quiet_noise_is_gated_after_hangover() {
        let mut p = Processor::default();
        let s = settings(false, -20.0, false);
        let mut last = p.process(&tone(0.001), &s);
        for _ in 0..HANGOVER_FRAMES + 1 {
            last = p.process(&tone(0.001), &s);
        }
        assert!(!last.gate_open);
        assert!(last.samples.iter().all(|s| *s == 0.0));
    }

    #[test]
    fn hangover_keeps_voice_between_words() {
        let mut p = Processor::default();
        let s = settings(false, -40.0, false);
        p.process(&tone(0.5), &s);
        assert!(p.process(&tone(0.0), &s).gate_open);
    }

    #[test]
    fn gain_raises_level() {
        let mut p = Processor::default();
        let quiet = p
            .process(&tone(0.1), &settings(false, -90.0, false))
            .level_db;
        let s = AudioSettings {
            input_volume: 2.0,
            ..settings(false, -90.0, false)
        };
        let loud = Processor::default().process(&tone(0.1), &s).level_db;
        assert!(loud > quiet + 5.0);
    }

    #[test]
    fn denoise_runs_on_full_frame() {
        let mut p = Processor::default();
        let f = p.process(&tone(0.3), &settings(true, -90.0, true));
        assert_eq!(f.samples.len(), FRAME * 2);
    }
}
