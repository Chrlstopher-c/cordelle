//! Découpe d'un flux H264 au format Annex B (codes de début 00 00 01 / 00 00 00 01) en unités NAL.

const START_CODE: [u8; 3] = [0, 0, 1];

/// Unités NAL d'un flux Annex B, sans code de début ni zéros de fin (ceux d'un code de début à 4 octets).
pub fn split_nal_units(stream: &[u8]) -> Vec<&[u8]> {
    let starts = start_positions(stream);
    starts
        .iter()
        .enumerate()
        .filter_map(|(index, &start)| {
            let mut end = starts
                .get(index + 1)
                .map_or(stream.len(), |&next| next - START_CODE.len());
            while end > start && stream[end - 1] == 0 {
                end -= 1;
            }
            (end > start).then(|| &stream[start..end])
        })
        .collect()
}

/// Position du premier octet après chaque code de début à 3 octets.
fn start_positions(stream: &[u8]) -> Vec<usize> {
    let mut positions = Vec::new();
    let mut index = 0;
    while index + START_CODE.len() <= stream.len() {
        if stream[index..index + START_CODE.len()] == START_CODE {
            positions.push(index + START_CODE.len());
            index += START_CODE.len();
        } else {
            index += 1;
        }
    }
    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_mixed_start_codes() {
        let stream = [
            0, 0, 0, 1, 0x67, 1, 2, 0, 0, 1, 0x68, 3, 0, 0, 0, 1, 0x65, 9,
        ];
        let nals = split_nal_units(&stream);
        assert_eq!(
            nals,
            vec![&[0x67, 1, 2][..], &[0x68, 3][..], &[0x65, 9][..]]
        );
    }

    #[test]
    fn drops_empty_units_and_trailing_zeros() {
        let stream = [0, 0, 1, 0, 0, 1, 0x41, 7, 0, 0, 0];
        assert_eq!(split_nal_units(&stream), vec![&[0x41, 7][..]]);
    }

    #[test]
    fn empty_input_yields_nothing() {
        assert!(split_nal_units(&[]).is_empty());
        assert!(split_nal_units(&[1, 2, 3]).is_empty());
    }
}
