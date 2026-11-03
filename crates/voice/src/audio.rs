//! Micro et sortie via PipeWire (API PulseAudio, `libpulse-simple`) : périphériques ouverts par leur nom,
//! capture traitée par trames de 20 ms (`process`), lecture par blocs de 10 ms. Un fil par sens.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use libpulse_binding::def::BufferAttr;
use libpulse_binding::sample::{Format, Spec};
use libpulse_binding::stream::Direction;
use libpulse_simple_binding::Simple;

use crate::VoiceError;
use crate::mixer::{pull, push_capped};
use crate::process::{FRAME, Processor};
use crate::settings;

pub const RATE: u32 = 48_000;
pub const CHANNELS: u16 = 2;
/// Capture gardée au plus 0,5 s : au-delà, les plus anciens échantillons sont jetés.
const MIC_CAP: usize = (RATE as usize) * (CHANNELS as usize) / 2;
/// Lecture gardée au plus 0,2 s pour une latence bornée.
pub const SPEAKER_CAP: usize = (RATE as usize) * (CHANNELS as usize) / 5;
/// Bloc de lecture : 10 ms stéréo.
const PLAY_BLOCK: usize = FRAME;

/// Tampon partagé d'échantillons f32 entrelacés.
pub type Buffer = Arc<Mutex<VecDeque<f32>>>;
/// Niveau du micro : (niveau dBFS, seuil dBFS, voix qui passe).
pub type LevelSink = Arc<dyn Fn(f32, f32, bool) + Send + Sync>;

pub fn new_buffer() -> Buffer {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub struct AudioPlan {
    pub mic: Buffer,
    pub speaker: Buffer,
    /// Renvoie la voix traitée dans la sortie (test du micro).
    pub monitor: bool,
    pub level: Option<LevelSink>,
}

/// Flux audio actifs ; les dropper les arrête.
pub struct AudioHandle {
    stop: Arc<AtomicBool>,
    threads: Vec<JoinHandle<()>>,
}

impl AudioHandle {
    pub fn start(plan: AudioPlan) -> Result<Self, VoiceError> {
        let stop = Arc::new(AtomicBool::new(false));
        let s = settings::current();
        let capture = open(Direction::Record, s.input_device.as_deref(), "Micro")?;
        let playback = open(Direction::Playback, s.output_device.as_deref(), "Voix")?;
        let cap = Capture {
            pa: capture,
            plan_mic: plan.mic,
            speaker: plan.speaker.clone(),
            monitor: plan.monitor,
            level: plan.level,
            stop: stop.clone(),
        };
        let threads = vec![
            spawn("cordelle-micro", move || cap.run())?,
            spawn(
                "cordelle-sortie",
                playback_loop(playback, plan.speaker, stop.clone()),
            )?,
        ];
        Ok(Self { stop, threads })
    }
}

impl Drop for AudioHandle {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        for t in self.threads.drain(..) {
            let _ = t.join();
        }
    }
}

fn open(dir: Direction, device: Option<&str>, stream: &str) -> Result<Simple, VoiceError> {
    let spec = Spec {
        format: Format::F32le,
        channels: CHANNELS as u8,
        rate: RATE,
    };
    let bytes_20ms = (FRAME * CHANNELS as usize * 4) as u32;
    let attr = BufferAttr {
        maxlength: u32::MAX,
        tlength: bytes_20ms * 2,
        prebuf: u32::MAX,
        minreq: u32::MAX,
        fragsize: bytes_20ms,
    };
    Simple::new(
        None,
        "Cordelle",
        dir,
        device,
        stream,
        &spec,
        None,
        Some(&attr),
    )
    .map_err(|e| {
        let what = if dir == Direction::Record {
            "micro"
        } else {
            "sortie"
        };
        tracing::error!("ouverture {what} ({device:?}) impossible : {e}");
        VoiceError::Audio(format!("{what} indisponible : {e}"))
    })
}

fn spawn(name: &str, body: impl FnOnce() + Send + 'static) -> Result<JoinHandle<()>, VoiceError> {
    std::thread::Builder::new()
        .name(name.into())
        .spawn(body)
        .map_err(|e| VoiceError::Audio(format!("fil audio impossible : {e}")))
}

struct Capture {
    pa: Simple,
    plan_mic: Buffer,
    speaker: Buffer,
    monitor: bool,
    level: Option<LevelSink>,
    stop: Arc<AtomicBool>,
}

impl Capture {
    fn run(self) {
        let mut processor = Processor::default();
        let mut bytes = vec![0u8; FRAME * CHANNELS as usize * 4];
        let mut tick = 0u32;
        while !self.stop.load(Ordering::Relaxed) {
            if let Err(e) = self.pa.read(&mut bytes) {
                tracing::error!("lecture micro : {e}");
                break;
            }
            let stereo: Vec<f32> = bytes
                .as_chunks::<4>()
                .0
                .iter()
                .map(|b| f32::from_le_bytes(*b))
                .collect();
            let frame = processor.process(&stereo, &settings::current());
            push_into(&self.plan_mic, &frame.samples, MIC_CAP);
            if self.monitor {
                push_into(&self.speaker, &frame.samples, SPEAKER_CAP);
            }
            tick = tick.wrapping_add(1);
            if let Some(sink) = self.level.as_ref().filter(|_| tick.is_multiple_of(3)) {
                sink(frame.level_db, frame.threshold_db, frame.gate_open);
            }
        }
    }
}

fn playback_loop(
    pa: Simple,
    speaker: Buffer,
    stop: Arc<AtomicBool>,
) -> impl FnOnce() + Send + 'static {
    move || {
        let mut block = vec![0.0f32; PLAY_BLOCK];
        while !stop.load(Ordering::Relaxed) {
            match speaker.lock() {
                Ok(mut buffer) => pull(&mut buffer, &mut block),
                Err(_) => block.fill(0.0),
            }
            let gain = settings::current().output_volume;
            let bytes: Vec<u8> = block
                .iter()
                .flat_map(|s| (s * gain).clamp(-1.0, 1.0).to_le_bytes())
                .collect();
            if let Err(e) = pa.write(&bytes) {
                tracing::error!("écriture sortie : {e}");
                break;
            }
        }
        let _ = pa.drain();
    }
}

fn push_into(buffer: &Buffer, samples: &[f32], cap: usize) {
    if let Ok(mut b) = buffer.lock() {
        push_capped(&mut b, samples, cap);
    }
}
