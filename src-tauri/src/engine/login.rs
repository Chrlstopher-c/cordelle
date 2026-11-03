//! Connexion : QR, mot de passe, 2FA. Le jeton obtenu est vérifié (`/users/@me`) puis rangé dans le trousseau.

use auth::{password, password::Step, qr};
use contract::{
    AccountId, EngineError,
    auth::{LoginOutcome, MfaMethod, PasswordLogin, QrAuthEvent},
    user::User,
};
use tokio::sync::{Mutex, mpsc};

use super::Engine;

pub type QrSlot = Mutex<Option<qr::QrHandle>>;

impl Engine {
    /// Démarre une connexion QR ; chaque étape est transmise à `notify`.
    pub async fn start_qr<F>(&'static self, notify: F) -> Result<(), EngineError>
    where
        F: Fn(QrAuthEvent) + Send + Sync + 'static,
    {
        let identity = self.identity().await?.clone();
        let (handle, events, outcome) =
            qr::start(&identity, identity::REMOTE_AUTH_URL, identity::API_BASE);
        if let Some(previous) = self.qr().lock().await.replace(handle) {
            previous.cancel();
        }
        tauri::async_runtime::spawn(async move {
            forward_qr(events, &notify).await;
            let event = match outcome.await {
                Ok(Ok((user, token))) => match self.save_account(user, &token) {
                    Ok(account_id) => QrAuthEvent::Completed { account_id },
                    Err(e) => failed(&e),
                },
                Ok(Err(e)) => failed(&EngineError::from(e)),
                Err(_) => QrAuthEvent::Cancelled,
            };
            notify(event);
            self.qr().lock().await.take();
        });
        Ok(())
    }

    pub async fn cancel_qr(&self) {
        if let Some(handle) = self.qr().lock().await.take() {
            handle.cancel();
        }
    }

    pub async fn login_password(
        &self,
        request: &PasswordLogin,
    ) -> Result<LoginOutcome, EngineError> {
        let identity = self.identity().await?;
        let step = password::login(identity, identity::API_BASE, request).await?;
        self.finish_step(step).await
    }

    pub async fn login_mfa(
        &self,
        ticket: &str,
        method: MfaMethod,
        code: &str,
    ) -> Result<LoginOutcome, EngineError> {
        let identity = self.identity().await?;
        let step = password::mfa(identity, identity::API_BASE, ticket, method, code).await?;
        self.finish_step(step).await
    }

    async fn finish_step(&self, step: Step) -> Result<LoginOutcome, EngineError> {
        Ok(match step {
            Step::Token(token) => {
                let user = self.fetch_user(&token).await?;
                LoginOutcome::Success {
                    account_id: self.save_account(user, &token)?,
                }
            }
            Step::Mfa { ticket, methods } => LoginOutcome::MfaRequired { ticket, methods },
            Step::Captcha(challenge) => LoginOutcome::CaptchaRequired { challenge },
            Step::Invalid => LoginOutcome::InvalidCredentials,
        })
    }

    async fn fetch_user(&self, token: &str) -> Result<User, EngineError> {
        let identity = self.identity().await?.clone();
        let me = rest::RestClient::new(identity, identity::API_BASE.into())?
            .with_token(token)
            .me()
            .await?;
        let avatar_url = me
            .avatar
            .map(|hash| format!("https://cdn.discordapp.com/avatars/{}/{hash}.png", me.id));
        Ok(User {
            id: me.id,
            username: me.username,
            global_name: me.global_name,
            avatar_url,
            bot: false,
        })
    }

    fn save_account(&self, user: User, token: &str) -> Result<AccountId, EngineError> {
        let id = user.id.clone();
        self.accounts().add(user, token)?;
        tracing::info!(account = %id, "compte ajouté");
        Ok(id)
    }
}

async fn forward_qr<F: Fn(QrAuthEvent)>(mut events: mpsc::Receiver<QrAuthEvent>, notify: &F) {
    while let Some(event) = events.recv().await {
        notify(event);
    }
}

fn failed(e: &EngineError) -> QrAuthEvent {
    tracing::error!("connexion QR échouée : {e:?}");
    QrAuthEvent::Failed {
        message: format!("{e:?}"),
    }
}
