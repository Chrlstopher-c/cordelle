//! Cycle de vie d'un appel : démarrage, connexion songbird, départ, sourdine, périphériques.

use std::num::NonZeroU64;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use contract::{Snowflake, voice::VoiceConnection, voice::VoiceSession};
use songbird::Config;
use songbird::driver::{Channels, DecodeConfig, DecodeMode, Driver, SampleRate};
use songbird::id::{ChannelId, GuildId, UserId};
use songbird::input::RawAdapter;
use songbird::{ConnectionInfo, CoreEvent, Event};

use contract::events::EngineEvent;

use crate::audio::{AudioHandle, AudioPlan, Buffer, CHANNELS, LevelSink, RATE, new_buffer};
use crate::receive::{ReceiveHook, Receiver, SpeakingSink};
use crate::roster::Handshake;
use crate::shared::{ActiveCall, SharedVoice, blank_session, publish, update};
use crate::source::MicSource;
use crate::{Emit, VoiceError};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const HANDSHAKE_POLL: Duration = Duration::from_millis(50);

/// Salon visé et sourdines à l'ouverture d'une connexion (avant la poignée de main).
#[derive(Debug, Clone)]
pub struct JoinPlan {
    pub account_id: Snowflake,
    pub guild_id: Option<Snowflake>,
    pub channel_id: Snowflake,
    pub self_mute: bool,
    pub self_deaf: bool,
}

/// Ce qu'il faut pour ouvrir le driver : le plan et la poignée de main gateway.
#[derive(Debug, Clone)]
pub struct JoinRequest {
    pub plan: JoinPlan,
    pub handshake: Handshake,
}

/// Opcode 4 à renvoyer au gateway (`channel_id` absent = départ).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoiceOp {
    pub guild_id: Option<Snowflake>,
    pub channel_id: Option<Snowflake>,
    pub self_mute: bool,
    pub self_deaf: bool,
}

/// Lock de l'état partagé, erreur lisible si empoisonné.
fn lock(
    shared: &SharedVoice,
) -> Result<std::sync::MutexGuard<'_, crate::shared::VoiceShared>, VoiceError> {
    shared.lock().map_err(|_| VoiceError::State)
}

/// Démarre une connexion : coupe l'appel précédent, publie « connexion » et renvoie la génération.
/// Source micro pour songbird : PCM f32 brut tiré du tampon de capture.
pub fn mic_input(mic: crate::audio::Buffer) -> songbird::input::Input {
    RawAdapter::new(MicSource::new(mic), RATE, u32::from(CHANNELS)).into()
}

pub fn begin(shared: &SharedVoice, emit: &Emit, plan: &JoinPlan) -> Result<u64, VoiceError> {
    let (generation, previous) = {
        let mut state = lock(shared)?;
        state.roster.begin_handshake();
        state.generation += 1;
        (state.generation, state.call.take())
    };
    if let Some(mut call) = previous {
        call.driver.leave();
    }
    let mut session = blank_session(plan.account_id.clone(), VoiceConnection::Connecting);
    session.guild_id = plan.guild_id.clone();
    session.channel_id = Some(plan.channel_id.clone());
    session.self_mute = plan.self_mute;
    session.self_deaf = plan.self_deaf;
    publish(shared, emit, session);
    Ok(generation)
}

/// Sourdines courantes (conservées d'un appel à l'autre).
pub fn flags(shared: &SharedVoice) -> (bool, bool) {
    match shared.lock() {
        Ok(state) => state
            .session
            .as_ref()
            .map_or((false, false), |s| (s.self_mute, s.self_deaf)),
        Err(_) => (false, false),
    }
}

/// Attend la poignée de main gateway (mon état vocal + serveur vocal) pour ce salon.
pub async fn await_handshake(
    shared: &SharedVoice,
    channel_id: &str,
    timeout: Duration,
) -> Result<Handshake, VoiceError> {
    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        if let Some(handshake) = lock(shared)?.roster.handshake(channel_id) {
            return Ok(handshake);
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(VoiceError::Timeout);
        }
        tokio::time::sleep(HANDSHAKE_POLL).await;
    }
}

/// Ouvre audio et driver, connecte au salon. Publie `connected` ou `failed` (message lisible).
pub async fn connect(
    shared: &SharedVoice,
    emit: &Emit,
    req: JoinRequest,
    generation: u64,
) -> Result<(), VoiceError> {
    match start_call(shared, emit, &req, generation).await {
        Ok(()) => {
            update(shared, emit, |s| {
                s.connection = VoiceConnection::Connected;
                s.error = None;
            });
            Ok(())
        }
        Err(error) => {
            fail(shared, emit, generation, &error);
            Err(error)
        }
    }
}

async fn start_call(
    shared: &SharedVoice,
    emit: &Emit,
    req: &JoinRequest,
    generation: u64,
) -> Result<(), VoiceError> {
    let info = connection_info(req)?;
    let mic = new_buffer();
    let speaker = new_buffer();
    let deaf = Arc::new(AtomicBool::new(req.plan.self_deaf));
    let audio = AudioHandle::start(call_plan(&mic, &speaker, emit))?;
    let mut driver = Driver::new(driver_config());
    attach_receiver(&mut driver, shared, emit, &speaker, &deaf);
    driver.play_only_input(mic_input(mic.clone()));
    driver.mute(req.plan.self_mute);
    let pending = driver.connect(info);
    store_call(
        shared,
        generation,
        ActiveCall {
            driver,
            audio: Some(audio),
            mic,
            speaker,
            deaf,
        },
    )?;
    match tokio::time::timeout(CONNECT_TIMEOUT, pending).await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(error)) => Err(VoiceError::Connect(error.to_string())),
        Err(_) => Err(VoiceError::Timeout),
    }
}

fn store_call(shared: &SharedVoice, generation: u64, call: ActiveCall) -> Result<(), VoiceError> {
    let mut state = lock(shared)?;
    if state.generation != generation {
        return Err(VoiceError::Superseded);
    }
    state.call = Some(call);
    Ok(())
}

fn attach_receiver(
    driver: &mut Driver,
    shared: &SharedVoice,
    emit: &Emit,
    speaker: &crate::audio::Buffer,
    deaf: &Arc<AtomicBool>,
) {
    let receiver = Arc::new(Receiver::new(
        speaker.clone(),
        deaf.clone(),
        speaking_sink(shared, emit),
    ));
    driver.add_global_event(
        Event::Core(CoreEvent::VoiceTick),
        ReceiveHook(receiver.clone()),
    );
    driver.add_global_event(
        Event::Core(CoreEvent::SpeakingStateUpdate),
        ReceiveHook(receiver.clone()),
    );
    driver.add_global_event(
        Event::Core(CoreEvent::ClientDisconnect),
        ReceiveHook(receiver),
    );
}

fn speaking_sink(shared: &SharedVoice, emit: &Emit) -> SpeakingSink {
    let (shared, emit) = (shared.clone(), emit.clone());
    Arc::new(move |speaking: Vec<Snowflake>| update(&shared, &emit, |s| s.speaking = speaking))
}

fn driver_config() -> Config {
    Config::default().decode_mode(DecodeMode::Decode(DecodeConfig::new(
        Channels::Stereo,
        SampleRate::Hz48000,
    )))
}

fn connection_info(req: &JoinRequest) -> Result<ConnectionInfo, VoiceError> {
    let channel = parse_id(&req.plan.channel_id)?;
    let guild = match &req.plan.guild_id {
        Some(guild) => parse_id(guild)?,
        None => channel,
    };
    Ok(ConnectionInfo {
        channel_id: ChannelId::from(channel),
        endpoint: req.handshake.endpoint.clone(),
        guild_id: GuildId::from(guild),
        session_id: req.handshake.session_id.clone(),
        token: req.handshake.token.clone(),
        user_id: UserId::from(parse_id(&req.handshake.user_id)?),
    })
}

fn parse_id(raw: &str) -> Result<NonZeroU64, VoiceError> {
    raw.parse::<u64>()
        .ok()
        .and_then(NonZeroU64::new)
        .ok_or_else(|| VoiceError::InvalidId(raw.to_owned()))
}

/// Publie l'échec sauf si une autre demande a pris le relais entre-temps.
pub fn fail(shared: &SharedVoice, emit: &Emit, generation: u64, error: &VoiceError) {
    tracing::error!("connexion vocale : {error}");
    let dropped = {
        let Ok(mut state) = shared.lock() else {
            return;
        };
        if state.generation != generation {
            return;
        }
        let dropped = state.call.take();
        if let Some(session) = state.session.as_mut() {
            session.connection = VoiceConnection::Failed;
            session.speaking.clear();
            session.error = Some(error.to_string());
        }
        dropped
    };
    if let Some(mut call) = dropped {
        call.driver.leave();
    }
    update(shared, emit, |_| {});
}

/// Quitte le salon : libère driver et audio, publie `disconnected`.
/// Renvoie l'opcode 4 à envoyer, si un salon était pris.
pub fn leave(shared: &SharedVoice, emit: &Emit) -> Option<VoiceOp> {
    let (op, dropped, snapshot) = {
        let mut state = shared.lock().ok()?;
        state.generation += 1;
        let dropped = state.call.take();
        let session = state.session.as_mut()?;
        let op = VoiceOp {
            guild_id: session.guild_id.clone(),
            channel_id: session.channel_id.clone(),
            self_mute: session.self_mute,
            self_deaf: session.self_deaf,
        };
        session.connection = VoiceConnection::Disconnected;
        session.guild_id = None;
        session.channel_id = None;
        session.speaking.clear();
        session.error = None;
        (op, dropped, session.clone())
    };
    if let Some(mut call) = dropped {
        call.driver.leave();
    }
    publish(shared, emit, snapshot);
    op.channel_id.is_some().then_some(op)
}

/// Micro coupé : le driver n'envoie plus d'audio. Renvoie l'opcode 4 à envoyer.
pub fn set_mute(shared: &SharedVoice, emit: &Emit, mute: bool) -> Result<VoiceOp, VoiceError> {
    let (op, snapshot) = {
        let mut state = lock(shared)?;
        let call = state.call.as_mut().ok_or(VoiceError::NotInCall)?;
        call.driver.mute(mute);
        let session = state.session.as_mut().ok_or(VoiceError::NotInCall)?;
        session.self_mute = mute;
        (op_of(session), session.clone())
    };
    publish(shared, emit, snapshot);
    Ok(op)
}

/// Sourdine : plus d'audio reçu joué. Renvoie l'opcode 4 à envoyer.
pub fn set_deaf(shared: &SharedVoice, emit: &Emit, deaf: bool) -> Result<VoiceOp, VoiceError> {
    let (op, snapshot) = {
        let mut state = lock(shared)?;
        let call = state.call.as_ref().ok_or(VoiceError::NotInCall)?;
        call.deaf.store(deaf, Ordering::Relaxed);
        let session = state.session.as_mut().ok_or(VoiceError::NotInCall)?;
        session.self_deaf = deaf;
        (op_of(session), session.clone())
    };
    publish(shared, emit, snapshot);
    Ok(op)
}

fn op_of(session: &VoiceSession) -> VoiceOp {
    VoiceOp {
        guild_id: session.guild_id.clone(),
        channel_id: session.channel_id.clone(),
        self_mute: session.self_mute,
        self_deaf: session.self_deaf,
    }
}

/// Niveau du micro relayé à l'interface.
pub fn level_sink(emit: &Emit) -> LevelSink {
    let emit = emit.clone();
    Arc::new(move |level_db, threshold_db, gate_open| {
        emit(EngineEvent::VoiceLevel {
            level_db,
            threshold_db,
            gate_open,
        });
    })
}

fn call_plan(mic: &Buffer, speaker: &Buffer, emit: &Emit) -> AudioPlan {
    AudioPlan {
        mic: mic.clone(),
        speaker: speaker.clone(),
        monitor: false,
        level: Some(level_sink(emit)),
    }
}

/// Rouvre les flux de l'appel en cours avec les réglages courants ; sans effet hors appel.
pub fn reopen_audio(shared: &SharedVoice, emit: &Emit) -> Result<(), VoiceError> {
    let mut state = lock(shared)?;
    let Some(call) = state.call.as_mut() else {
        return Ok(());
    };
    call.audio = None;
    call.audio = Some(AudioHandle::start(call_plan(
        &call.mic,
        &call.speaker,
        emit,
    ))?);
    Ok(())
}
