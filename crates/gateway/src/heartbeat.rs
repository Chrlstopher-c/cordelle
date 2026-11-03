//! Battements de cœur : premier envoi décalé par le jitter, puis régulier ; détection des connexions zombies.

use std::time::Duration;

#[derive(Debug)]
pub struct Heartbeat {
    interval: Duration,
    awaiting_ack: bool,
}

impl Heartbeat {
    pub fn new(interval_ms: u64) -> Self {
        Self {
            interval: Duration::from_millis(interval_ms),
            awaiting_ack: false,
        }
    }

    pub fn interval(&self) -> Duration {
        self.interval
    }

    /// Délai avant le premier battement : `interval × jitter`, avec `jitter` dans [0, 1).
    pub fn first_delay(&self, jitter: f64) -> Duration {
        self.interval.mul_f64(jitter.clamp(0.0, 1.0))
    }

    /// Vrai si le battement précédent n'a pas été acquitté : la connexion est morte.
    pub fn is_zombie(&self) -> bool {
        self.awaiting_ack
    }

    pub fn mark_sent(&mut self) {
        self.awaiting_ack = true;
    }

    pub fn mark_ack(&mut self) {
        self.awaiting_ack = false;
    }
}

#[cfg(test)]
mod tests {
    use super::Heartbeat;
    use std::time::Duration;

    #[test]
    fn premier_battement_decale_par_le_jitter() {
        let hb = Heartbeat::new(1000);
        assert_eq!(hb.first_delay(0.0), Duration::ZERO);
        assert_eq!(hb.first_delay(0.5), Duration::from_millis(500));
        assert!(hb.first_delay(0.999) < hb.interval());
    }

    #[test]
    fn sans_ack_la_connexion_est_zombie() {
        let mut hb = Heartbeat::new(1000);
        assert!(!hb.is_zombie());
        hb.mark_sent();
        assert!(hb.is_zombie());
        hb.mark_ack();
        assert!(!hb.is_zombie());
    }
}
