//! Choix de qualité du partage : préréglages 720p30 et 1080p60, mode « Source » ramené dans la limite 1080p.

use contract::stream::StreamQuality;

pub const PRESET_720P30: StreamQuality = StreamQuality {
    width: 1280,
    height: 720,
    fps: 30,
};
pub const PRESET_1080P60: StreamQuality = StreamQuality {
    width: 1920,
    height: 1080,
    fps: 60,
};

const MIN_SIDE: u32 = 160;
const MAX_WIDTH: u32 = 1920;
const MAX_HEIGHT: u32 = 1080;
const MIN_FPS: u32 = 5;
const MAX_FPS: u32 = 60;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum QualityError {
    #[error("dimensions hors limites : {0}×{1}")]
    Size(u32, u32),
    #[error("dimensions impaires : {0}×{1}")]
    Odd(u32, u32),
    #[error("images par seconde hors limites : {0}")]
    Fps(u32),
}

/// Vérifie qu'une qualité est envoyable : dimensions paires dans 1920×1080 au plus, 5 à 60 images par seconde.
pub fn validate(quality: StreamQuality) -> Result<StreamQuality, QualityError> {
    let StreamQuality { width, height, fps } = quality;
    let out_of_range =
        !(MIN_SIDE..=MAX_WIDTH).contains(&width) || !(MIN_SIDE..=MAX_HEIGHT).contains(&height);
    if out_of_range {
        return Err(QualityError::Size(width, height));
    }
    if width % 2 != 0 || height % 2 != 0 {
        return Err(QualityError::Odd(width, height));
    }
    if !(MIN_FPS..=MAX_FPS).contains(&fps) {
        return Err(QualityError::Fps(fps));
    }
    Ok(quality)
}

/// Mode « Source » : dimensions de la fenêtre ou de l'écran, réduites pour tenir dans 1080p, proportions conservées.
pub fn fit_source(width: u32, height: u32, fps: u32) -> Result<StreamQuality, QualityError> {
    if width == 0 || height == 0 {
        return Err(QualityError::Size(width, height));
    }
    let scale = (f64::from(MAX_WIDTH) / f64::from(width))
        .min(f64::from(MAX_HEIGHT) / f64::from(height))
        .min(1.0);
    let fitted_w = (f64::from(width) * scale) as u32 & !1;
    let fitted_h = (f64::from(height) * scale) as u32 & !1;
    validate(StreamQuality {
        width: fitted_w,
        height: fitted_h,
        fps,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_are_valid() {
        assert_eq!(validate(PRESET_720P30), Ok(PRESET_720P30));
        assert_eq!(validate(PRESET_1080P60), Ok(PRESET_1080P60));
    }

    #[test]
    fn rejects_odd_size_and_bad_fps() {
        let odd = StreamQuality {
            width: 1281,
            height: 720,
            fps: 30,
        };
        assert_eq!(validate(odd), Err(QualityError::Odd(1281, 720)));
        let slow = StreamQuality {
            width: 1280,
            height: 720,
            fps: 0,
        };
        assert_eq!(validate(slow), Err(QualityError::Fps(0)));
        let fast = StreamQuality {
            width: 1280,
            height: 720,
            fps: 61,
        };
        assert_eq!(validate(fast), Err(QualityError::Fps(61)));
    }

    #[test]
    fn rejects_oversized_frame() {
        let big = StreamQuality {
            width: 2560,
            height: 1440,
            fps: 30,
        };
        assert_eq!(validate(big), Err(QualityError::Size(2560, 1440)));
    }

    #[test]
    fn source_is_scaled_into_1080p_keeping_ratio() {
        assert_eq!(
            fit_source(3840, 2160, 30).map(|q| (q.width, q.height)),
            Ok((1920, 1080))
        );
        assert_eq!(
            fit_source(2560, 1440, 60).map(|q| (q.width, q.height)),
            Ok((1920, 1080))
        );
        assert_eq!(
            fit_source(1001, 601, 30).map(|q| (q.width, q.height)),
            Ok((1000, 600))
        );
    }

    #[test]
    fn source_small_enough_is_not_upscaled() {
        assert_eq!(
            fit_source(1000, 500, 30).map(|q| (q.width, q.height)),
            Ok((1000, 500))
        );
        assert_eq!(fit_source(0, 500, 30), Err(QualityError::Size(0, 500)));
    }
}
