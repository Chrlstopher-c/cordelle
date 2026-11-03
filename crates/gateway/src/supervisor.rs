//! Boucle de vie d'un compte : états publiés, reprise avec backoff exponentiel, arrêt propre.

use std::time::Duration;

use contract::account::ConnectionState;
use tokio::sync::watch;

use crate::connection::{Exit, run_once};
use crate::handle::GatewayEvent;
use crate::session::{Session, wait_shutdown};

const BACKOFF_CAP_SECS: u64 = 60;
const BACKOFF_MAX_SHIFT: u32 = 6;
const IDENTIFY_DELAY_MIN_MS: u64 = 1_000;
const IDENTIFY_DELAY_MAX_MS: u64 = 5_000;

pub(crate) async fn run(mut session: Session) {
    let mut attempt: u32 = 0;
    loop {
        let state = if session.can_resume() {
            ConnectionState::Resuming
        } else {
            ConnectionState::Connecting
        };
        session.emit(GatewayEvent::State(state)).await;
        session.reached_ready = false;
        let exit = run_once(&mut session).await;
        if session.reached_ready {
            attempt = 0;
        }
        let delay = match exit {
            Exit::Shutdown => break,
            Exit::Fatal(code) => {
                tracing::error!(code, "gateway refusée : reconnexion arrêtée");
                session
                    .emit(GatewayEvent::State(ConnectionState::Failed))
                    .await;
                return;
            }
            Exit::KeepSession => {
                let delay = backoff_delay(attempt);
                attempt = attempt.saturating_add(1);
                delay
            }
            Exit::ResetSession => {
                session.clear();
                identify_delay()
            }
        };
        if !wait_or_shutdown(delay, &mut session.shutdown).await {
            break;
        }
    }
    session
        .emit(GatewayEvent::State(ConnectionState::Disconnected))
        .await;
}

/// 1 s, 2 s, 4 s … plafonné à 60 s.
pub(crate) fn backoff_delay(attempt: u32) -> Duration {
    Duration::from_secs(1_u64 << attempt.min(BACKOFF_MAX_SHIFT))
        .min(Duration::from_secs(BACKOFF_CAP_SECS))
}

fn identify_delay() -> Duration {
    Duration::from_millis(rand::random_range(
        IDENTIFY_DELAY_MIN_MS..=IDENTIFY_DELAY_MAX_MS,
    ))
}

/// Renvoie `false` si l'arrêt a été demandé pendant l'attente.
async fn wait_or_shutdown(delay: Duration, shutdown: &mut watch::Receiver<bool>) -> bool {
    tokio::select! {
        _ = tokio::time::sleep(delay) => true,
        _ = wait_shutdown(shutdown) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::backoff_delay;
    use std::time::Duration;

    #[test]
    fn backoff_double_et_plafonne_a_60_secondes() {
        assert_eq!(backoff_delay(0), Duration::from_secs(1));
        assert_eq!(backoff_delay(1), Duration::from_secs(2));
        assert_eq!(backoff_delay(5), Duration::from_secs(32));
        assert_eq!(backoff_delay(6), Duration::from_secs(60));
        assert_eq!(backoff_delay(100), Duration::from_secs(60));
    }
}
