//! Partage d'écran (Go Live) de Cordelle : qualité, paquetisation RTP H264, signalisation gateway.
//! Le transport média vers le serveur de stream n'est pas encore branché : ces modules en sont les briques.

pub mod annexb;
pub mod quality;
pub mod rtp;
pub mod signal;

pub use annexb::split_nal_units;
pub use quality::{PRESET_720P30, PRESET_1080P60, QualityError, fit_source, validate};
pub use rtp::{H264_PAYLOAD_TYPE, H264Packetizer, VIDEO_CLOCK_RATE};
pub use signal::{StreamKey, StreamKeyError, parse_stream_key};
