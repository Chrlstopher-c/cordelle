//! Sonde : prépare la source micro exactement comme l'appel et affiche l'erreur de songbird s'il y en a une.
use songbird::input::codecs;

#[tokio::main]
async fn main() {
    let input = voice::mic_input(voice::new_buffer());
    match input
        .make_playable_async(codecs::get_codec_registry(), codecs::get_probe())
        .await
    {
        Ok(_) => println!("source micro préparée : OK"),
        Err(e) => println!("échec de préparation : {e:?}"),
    }
}
