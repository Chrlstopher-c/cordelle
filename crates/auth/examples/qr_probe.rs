//! Sonde : vérifie contre le vrai Discord que la connexion QR atteint l'étape `ready` (aucun compte touché).
#[tokio::main]
async fn main() {
    let t = std::time::Instant::now();
    let http = reqwest::Client::new();
    let build = rest::fetch_build_number(&http)
        .await
        .unwrap_or_else(|e| panic!("{e:?} / {:?}", std::error::Error::source(&e)));
    println!("build {build} en {:?}", t.elapsed());
    let t = std::time::Instant::now();
    let identity = identity::ClientIdentity::new(build, "fr");
    let (handle, mut events, _outcome) =
        auth::qr::start(&identity, identity::REMOTE_AUTH_URL, identity::API_BASE);
    match tokio::time::timeout(std::time::Duration::from_secs(90), events.recv()).await {
        Ok(Some(ev)) => println!(
            "QR en {:?} : {}",
            t.elapsed(),
            serde_json::to_string(&ev).unwrap_or_default()
        ),
        other => println!("aucun événement : {other:?}"),
    }
    handle.cancel();
}
