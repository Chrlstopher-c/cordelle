//! Réception : SSRC → utilisateur, mixage des voix reçues vers la sortie, liste des locuteurs actifs.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use async_trait::async_trait;
use contract::Snowflake;
use songbird::model::payload::{ClientDisconnect, Speaking};
use songbird::{Event, EventContext, EventHandler};

use crate::audio::{Buffer, SPEAKER_CAP};
use crate::mixer::{FRAME_SAMPLES, mix_frames, push_capped};

/// Un utilisateur est « qui parle » pendant 200 ms après sa dernière trame audible.
const SPEAKING_WINDOW: Duration = Duration::from_millis(200);
/// Au plus 5 changements de liste par seconde.
const EMIT_INTERVAL: Duration = Duration::from_millis(200);

/// Reçoit la liste des locuteurs actifs quand elle change (throttlée).
pub type SpeakingSink = Arc<dyn Fn(Vec<Snowflake>) + Send + Sync>;

#[derive(Default)]
struct Tracking {
    ssrc_users: HashMap<u32, Snowflake>,
    last_heard: HashMap<Snowflake, Instant>,
    emitted: Vec<Snowflake>,
    last_emit: Option<Instant>,
}

pub struct Receiver {
    speaker: Buffer,
    deaf: Arc<AtomicBool>,
    tracking: Mutex<Tracking>,
    on_speaking: SpeakingSink,
}

impl Receiver {
    pub fn new(speaker: Buffer, deaf: Arc<AtomicBool>, on_speaking: SpeakingSink) -> Self {
        Self {
            speaker,
            deaf,
            tracking: Mutex::new(Tracking::default()),
            on_speaking,
        }
    }

    fn on_speaking_state(&self, ssrc: u32, user: Option<String>) {
        let (Some(user), Ok(mut tracking)) = (user, self.tracking.lock()) else {
            return;
        };
        tracking.ssrc_users.insert(ssrc, user);
    }

    fn on_client_disconnect(&self, user: &str) {
        let Ok(mut tracking) = self.tracking.lock() else {
            return;
        };
        tracking.ssrc_users.retain(|_, u| u != user);
        tracking.last_heard.remove(user);
    }

    /// Une trame de 20 ms : mixe les voix reçues dans la sortie, puis met à jour les locuteurs.
    fn on_tick(&self, ticks: &HashMap<u32, songbird::events::context_data::VoiceData>) {
        let now = Instant::now();
        let Ok(mut tracking) = self.tracking.lock() else {
            return;
        };
        let mut frames: Vec<&[i16]> = Vec::new();
        for (ssrc, data) in ticks {
            let Some(pcm) = data.decoded_voice.as_deref().filter(|p| !p.is_empty()) else {
                continue;
            };
            frames.push(pcm);
            if let Some(user) = tracking.ssrc_users.get(ssrc).cloned() {
                tracking.last_heard.insert(user, now);
            }
        }
        if !self.deaf.load(Ordering::Relaxed) {
            self.push_frame(&frames);
        }
        let active = active_speakers(&mut tracking, now);
        if active != tracking.emitted && tracking.last_emit.is_none_or(|t| now - t >= EMIT_INTERVAL)
        {
            tracking.emitted = active.clone();
            tracking.last_emit = Some(now);
            drop(tracking);
            (self.on_speaking)(active);
        }
    }

    fn push_frame(&self, frames: &[&[i16]]) {
        let mut mixed = [0.0_f32; FRAME_SAMPLES];
        mix_frames(frames.iter().copied(), &mut mixed);
        if let Ok(mut speaker) = self.speaker.lock() {
            push_capped(&mut speaker, &mixed, SPEAKER_CAP);
        }
    }
}

/// Utilisateurs audibles dans la fenêtre récente ; purge les entrées périmées.
fn active_speakers(tracking: &mut Tracking, now: Instant) -> Vec<Snowflake> {
    tracking
        .last_heard
        .retain(|_, heard| now - *heard < SPEAKING_WINDOW * 5);
    let mut active: Vec<Snowflake> = tracking
        .last_heard
        .iter()
        .filter(|(_, heard)| now - **heard < SPEAKING_WINDOW)
        .map(|(user, _)| user.clone())
        .collect();
    active.sort();
    active
}

/// Enregistre le récepteur auprès du driver (un hook par type d'événement).
pub struct ReceiveHook(pub Arc<Receiver>);

#[async_trait]
impl EventHandler for ReceiveHook {
    async fn act(&self, ctx: &EventContext<'_>) -> Option<Event> {
        match ctx {
            EventContext::SpeakingStateUpdate(Speaking { ssrc, user_id, .. }) => {
                self.0
                    .on_speaking_state(*ssrc, user_id.map(|id| id.0.to_string()));
            }
            EventContext::VoiceTick(tick) => self.0.on_tick(&tick.speaking),
            EventContext::ClientDisconnect(ClientDisconnect { user_id }) => {
                self.0.on_client_disconnect(&user_id.0.to_string());
            }
            _ => {}
        }
        None
    }
}
