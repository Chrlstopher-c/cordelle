//! Mixage PCM et tampons à débit borné : pur, sans I/O, testé unitairement.

use std::collections::VecDeque;

/// Échantillons (entrelacés) d'une trame de 20 ms en stéréo 48 kHz.
pub const FRAME_SAMPLES: usize = 1920;

/// Additionne des trames PCM 16 bits dans `out` (flottants, bornés à [-1, 1]).
pub fn mix_frames<'a, I>(frames: I, out: &mut [f32])
where
    I: IntoIterator<Item = &'a [i16]>,
{
    out.fill(0.0);
    for frame in frames {
        for (dst, src) in out.iter_mut().zip(frame) {
            *dst += f32::from(*src) / 32768.0;
        }
    }
    for sample in out.iter_mut() {
        *sample = sample.clamp(-1.0, 1.0);
    }
}

/// Ajoute `samples` au tampon ; au-delà de `cap`, les plus anciens sont jetés (latence bornée).
pub fn push_capped(buffer: &mut VecDeque<f32>, samples: &[f32], cap: usize) {
    buffer.extend(samples.iter().copied());
    let excess = buffer.len().saturating_sub(cap);
    buffer.drain(..excess);
}

/// Remplit `out` depuis le tampon ; zéros pour ce qui manque (sous-alimentation).
pub fn pull(buffer: &mut VecDeque<f32>, out: &mut [f32]) {
    let available = out.len().min(buffer.len());
    for (dst, src) in out[..available].iter_mut().zip(buffer.drain(..available)) {
        *dst = src;
    }
    out[available..].fill(0.0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mix_sums_frames_and_clamps() {
        let loud = [i16::MAX; 4];
        let other = [i16::MAX; 4];
        let mut out = [0.0_f32; 4];
        mix_frames([&loud[..], &other[..]], &mut out);
        assert!(out.iter().all(|s| (*s - 1.0).abs() < f32::EPSILON));
    }

    #[test]
    fn mix_without_frames_is_silence() {
        let mut out = [0.5_f32; 3];
        mix_frames(std::iter::empty::<&[i16]>(), &mut out);
        assert_eq!(out, [0.0; 3]);
    }

    #[test]
    fn mix_scales_half_scale_samples() {
        let frame = [16384_i16, -16384];
        let mut out = [0.0_f32; 2];
        mix_frames([&frame[..]], &mut out);
        assert!((out[0] - 0.5).abs() < 1e-4);
        assert!((out[1] + 0.5).abs() < 1e-4);
    }

    #[test]
    fn push_caps_latency_by_dropping_oldest() {
        let mut buffer = VecDeque::new();
        push_capped(&mut buffer, &[1.0, 2.0, 3.0], 2);
        push_capped(&mut buffer, &[4.0], 2);
        assert_eq!(buffer.iter().copied().collect::<Vec<_>>(), vec![3.0, 4.0]);
    }

    #[test]
    fn pull_pads_with_silence_on_underrun() {
        let mut buffer = VecDeque::from(vec![0.25_f32, 0.5]);
        let mut out = [9.0_f32; 4];
        pull(&mut buffer, &mut out);
        assert_eq!(out, [0.25, 0.5, 0.0, 0.0]);
        assert!(buffer.is_empty());
    }

    #[test]
    fn pull_leaves_the_rest_for_next_call() {
        let mut buffer = VecDeque::from(vec![1.0_f32, 2.0, 3.0]);
        let mut out = [0.0_f32; 2];
        pull(&mut buffer, &mut out);
        assert_eq!(out, [1.0, 2.0]);
        assert_eq!(buffer.len(), 1);
    }
}
