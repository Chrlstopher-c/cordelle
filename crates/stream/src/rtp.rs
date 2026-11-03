//! Paquetisation RTP du H264 (RFC 6184) : une unité NAL par paquet si elle tient, sinon fragments FU-A.
//! Une unité d'accès (une image) se termine par un paquet dont le bit marqueur est levé.

/// Type de charge utile H264 annoncé à Discord (SELECT_PROTOCOL / VIDEO).
pub const H264_PAYLOAD_TYPE: u8 = 103;
/// Horloge RTP vidéo : 90 kHz.
pub const VIDEO_CLOCK_RATE: u32 = 90_000;
/// Charge utile maximale par paquet, en-tête RTP exclu (marge sous le MTU pour le chiffrement).
pub const DEFAULT_MAX_PAYLOAD: usize = 1100;

const RTP_HEADER_LEN: usize = 12;
const FU_A_TYPE: u8 = 28;
const FU_START: u8 = 0x80;
const FU_END: u8 = 0x40;
const MARKER: u8 = 0x80;
const NAL_TYPE_MASK: u8 = 0x1F;
const NRI_MASK: u8 = 0xE0;

/// État d'un flux RTP vidéo : SSRC, numéro de séquence et taille maximale de charge utile.
#[derive(Debug, Clone)]
pub struct H264Packetizer {
    ssrc: u32,
    payload_type: u8,
    sequence: u16,
    max_payload: usize,
}

impl H264Packetizer {
    pub fn new(ssrc: u32, payload_type: u8, max_payload: usize) -> Self {
        Self {
            ssrc,
            payload_type,
            sequence: 0,
            max_payload: max_payload.max(3),
        }
    }

    /// Paquets RTP (en-tête compris) d'une unité d'accès : ses unités NAL, dans l'ordre, horodatées `timestamp`.
    pub fn packetize(&mut self, nal_units: &[&[u8]], timestamp: u32) -> Vec<Vec<u8>> {
        let mut packets: Vec<Vec<u8>> = nal_units
            .iter()
            .filter(|nal| !nal.is_empty())
            .flat_map(|nal| self.packetize_nal(nal, timestamp))
            .collect();
        if let Some(last) = packets.last_mut() {
            last[1] |= MARKER;
        }
        packets
    }

    fn packetize_nal(&mut self, nal: &[u8], timestamp: u32) -> Vec<Vec<u8>> {
        if nal.len() <= self.max_payload {
            return vec![self.packet(timestamp, &[nal])];
        }
        self.fragment(nal, timestamp)
    }

    /// Fragments FU-A : indicateur (NRI + type 28), en-tête FU (début, fin, type d'origine), puis morceau.
    fn fragment(&mut self, nal: &[u8], timestamp: u32) -> Vec<Vec<u8>> {
        let header = nal[0];
        let indicator = (header & NRI_MASK) | FU_A_TYPE;
        let original_type = header & NAL_TYPE_MASK;
        let chunk_len = self.max_payload - 2;
        let body = &nal[1..];
        let chunks: Vec<&[u8]> = body.chunks(chunk_len).collect();
        let last = chunks.len().saturating_sub(1);
        chunks
            .iter()
            .enumerate()
            .map(|(index, chunk)| {
                let mut fu_header = original_type;
                if index == 0 {
                    fu_header |= FU_START;
                }
                if index == last {
                    fu_header |= FU_END;
                }
                let fu_head = [indicator, fu_header];
                self.packet(timestamp, &[&fu_head[..], *chunk])
            })
            .collect()
    }

    /// Un paquet RTP : en-tête de 12 octets (version 2, sans marqueur), puis les morceaux de charge utile.
    fn packet(&mut self, timestamp: u32, parts: &[&[u8]]) -> Vec<u8> {
        let payload_len: usize = parts.iter().map(|p| p.len()).sum();
        let mut packet = Vec::with_capacity(RTP_HEADER_LEN + payload_len);
        packet.push(0x80);
        packet.push(self.payload_type & !MARKER);
        packet.extend_from_slice(&self.sequence.to_be_bytes());
        packet.extend_from_slice(&timestamp.to_be_bytes());
        packet.extend_from_slice(&self.ssrc.to_be_bytes());
        for part in parts {
            packet.extend_from_slice(part);
        }
        self.sequence = self.sequence.wrapping_add(1);
        packet
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SSRC: u32 = 0xA1B2_C3D4;

    fn payload(packet: &[u8]) -> &[u8] {
        &packet[RTP_HEADER_LEN..]
    }

    fn sequence(packet: &[u8]) -> u16 {
        u16::from_be_bytes([packet[2], packet[3]])
    }

    fn marker(packet: &[u8]) -> bool {
        packet[1] & MARKER != 0
    }

    /// Reconstitue une unité NAL à partir de ses fragments FU-A (en-tête NAL rebâti depuis l'indicateur).
    fn rebuild_fua(packets: &[Vec<u8>]) -> Vec<u8> {
        let indicator = payload(&packets[0])[0];
        let mut nal = vec![(indicator & NRI_MASK) | (payload(&packets[0])[1] & NAL_TYPE_MASK)];
        for packet in packets {
            nal.extend_from_slice(&payload(packet)[2..]);
        }
        nal
    }

    #[test]
    fn small_nal_is_one_packet_with_marker_and_header() {
        let mut packetizer = H264Packetizer::new(SSRC, H264_PAYLOAD_TYPE, DEFAULT_MAX_PAYLOAD);
        let nal = [0x67, 1, 2, 3];
        let packets = packetizer.packetize(&[&nal], 4500);
        assert_eq!(packets.len(), 1);
        let packet = &packets[0];
        assert_eq!(packet[0], 0x80);
        assert_eq!(packet[1] & !MARKER, H264_PAYLOAD_TYPE);
        assert!(marker(packet));
        assert_eq!(
            u32::from_be_bytes([packet[4], packet[5], packet[6], packet[7]]),
            4500
        );
        assert_eq!(
            u32::from_be_bytes([packet[8], packet[9], packet[10], packet[11]]),
            SSRC
        );
        assert_eq!(payload(packet), &nal);
    }

    #[test]
    fn large_nal_is_fua_fragments_that_rebuild_exactly() {
        let mut packetizer = H264Packetizer::new(SSRC, H264_PAYLOAD_TYPE, 100);
        let mut nal = vec![0x65];
        nal.extend((0..250).map(|i| (i % 251) as u8));
        let packets = packetizer.packetize(&[&nal], 0);
        assert_eq!(packets.len(), 3);
        assert!(
            packets
                .iter()
                .all(|p| payload(p)[0] & NAL_TYPE_MASK == FU_A_TYPE)
        );
        assert_eq!(payload(&packets[0])[1] & FU_START, FU_START);
        assert_eq!(payload(&packets[2])[1] & FU_END, FU_END);
        assert_eq!(rebuild_fua(&packets), nal);
    }

    #[test]
    fn marker_only_on_last_packet_of_access_unit_and_sequence_is_consecutive() {
        let mut packetizer = H264Packetizer::new(SSRC, H264_PAYLOAD_TYPE, 100);
        let sps = [0x67, 9, 9];
        let idr = vec![0x65; 300];
        let packets = packetizer.packetize(&[&sps[..], &idr[..]], 9000);
        let marked: Vec<bool> = packets.iter().map(|p| marker(p)).collect();
        assert_eq!(marked.iter().filter(|m| **m).count(), 1);
        assert!(marked[marked.len() - 1]);
        let seqs: Vec<u16> = packets.iter().map(|p| sequence(p)).collect();
        assert!(seqs.windows(2).all(|w| w[1] == w[0].wrapping_add(1)));
    }

    #[test]
    fn sequence_wraps_around() {
        let mut packetizer = H264Packetizer::new(SSRC, H264_PAYLOAD_TYPE, DEFAULT_MAX_PAYLOAD);
        packetizer.sequence = u16::MAX;
        let packets = packetizer.packetize(&[&[0x41, 1], &[0x41, 2]], 0);
        assert_eq!(sequence(&packets[0]), u16::MAX);
        assert_eq!(sequence(&packets[1]), 0);
    }

    #[test]
    fn empty_access_unit_produces_no_packet() {
        let mut packetizer = H264Packetizer::new(SSRC, H264_PAYLOAD_TYPE, DEFAULT_MAX_PAYLOAD);
        assert!(packetizer.packetize(&[&[]], 0).is_empty());
    }
}
