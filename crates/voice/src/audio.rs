//! Micro et haut-parleur (cpal) sur un thread dédié : les flux cpal ne quittent jamais ce thread.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, mpsc};
use std::thread::JoinHandle;

use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{BufferSize, InputCallbackInfo, OutputCallbackInfo, Stream, StreamConfig};

use crate::VoiceError;
use crate::devices::{find_input, find_output};
use crate::mixer::{pull, push_capped};

pub const RATE: u32 = 48_000;
pub const CHANNELS: u16 = 2;
/// Capture gardée au plus 0,5 s : au-delà, les plus anciens échantillons sont jetés.
const MIC_CAP: usize = (RATE as usize) * (CHANNELS as usize) / 2;
/// Lecture gardée au plus 0,2 s pour une latence bornée.
pub const SPEAKER_CAP: usize = (RATE as usize) * (CHANNELS as usize) / 5;

/// Tampon partagé d'échantillons f32 entrelacés.
pub type Buffer = Arc<Mutex<VecDeque<f32>>>;

pub fn new_buffer() -> Buffer {
    Arc::new(Mutex::new(VecDeque::new()))
}

/// Flux audio actifs ; les dropper les arrête.
pub struct AudioHandle {
    stop: Option<mpsc::Sender<()>>,
    _thread: JoinHandle<()>,
}

impl AudioHandle {
    /// Ouvre micro (capture → `mic`) et haut-parleur (`speaker` → sortie) ; erreur lisible si le format est refusé.
    pub fn start(
        mic: Buffer,
        speaker: Buffer,
        input_id: Option<&str>,
        output_id: Option<&str>,
    ) -> Result<Self, VoiceError> {
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), VoiceError>>();
        let input_id = input_id.map(str::to_owned);
        let output_id = output_id.map(str::to_owned);
        let thread = std::thread::Builder::new()
            .name("cordelle-audio".into())
            .spawn(move || {
                match build_streams(mic, speaker, input_id.as_deref(), output_id.as_deref()) {
                    Ok(streams) => {
                        let _ = ready_tx.send(Ok(()));
                        let _ = stop_rx.recv();
                        drop(streams);
                    }
                    Err(error) => {
                        let _ = ready_tx.send(Err(error));
                    }
                }
            })
            .map_err(|e| VoiceError::Audio(format!("thread audio impossible : {e}")))?;
        match ready_rx.recv() {
            Ok(Ok(())) => Ok(Self {
                stop: Some(stop_tx),
                _thread: thread,
            }),
            Ok(Err(error)) => Err(error),
            Err(_) => Err(VoiceError::Audio("thread audio arrêté au démarrage".into())),
        }
    }
}

impl Drop for AudioHandle {
    fn drop(&mut self) {
        if let Some(stop) = self.stop.take() {
            let _ = stop.send(());
        }
    }
}

fn build_streams(
    mic: Buffer,
    speaker: Buffer,
    input_id: Option<&str>,
    output_id: Option<&str>,
) -> Result<Vec<Stream>, VoiceError> {
    let config = StreamConfig {
        channels: CHANNELS,
        sample_rate: RATE,
        buffer_size: BufferSize::Default,
    };
    let input = find_input(input_id)?;
    let output = find_output(output_id)?;
    let capture = input
        .build_input_stream::<f32, _, _>(
            config,
            move |data: &[f32], _: &InputCallbackInfo| {
                if let Ok(mut buffer) = mic.lock() {
                    push_capped(&mut buffer, data, MIC_CAP);
                }
            },
            |e| tracing::error!("flux micro : {e}"),
            None,
        )
        .map_err(|e| VoiceError::Audio(format!("micro refusé (48 kHz stéréo f32 requis) : {e}")))?;
    let playback = output
        .build_output_stream::<f32, _, _>(
            config,
            move |data: &mut [f32], _: &OutputCallbackInfo| match speaker.lock() {
                Ok(mut buffer) => pull(&mut buffer, data),
                Err(_) => data.fill(0.0),
            },
            |e| tracing::error!("flux sortie : {e}"),
            None,
        )
        .map_err(|e| {
            VoiceError::Audio(format!("sortie refusée (48 kHz stéréo f32 requis) : {e}"))
        })?;
    capture
        .play()
        .map_err(|e| VoiceError::Audio(e.to_string()))?;
    playback
        .play()
        .map_err(|e| VoiceError::Audio(e.to_string()))?;
    Ok(vec![capture, playback])
}
