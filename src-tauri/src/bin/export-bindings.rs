//! Régénère src/contract/bindings.ts sans lancer l'app (utilisé par la CI).
fn main() {
    if let Err(e) = cordelle_lib::export_bindings() {
        eprintln!("export des types TS impossible : {e}");
        std::process::exit(1);
    }
}
