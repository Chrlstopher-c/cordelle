# État

## 2026-11-03
- Projet créé, PROJET.md écrit. Squelette Tauri 2 + React, workspace de crates par domaine, contrat typé (tauri-specta).
- Accélération GPU WebKitGTK forcée (`gpu.rs`) ; NVIDIA → `WEBKIT_DISABLE_DMABUF_RENDERER=1`. Non vérifiée visuellement :
  sway headless tué au démarrage sur la tour (cause inconnue), test à faire sur l'écran réel.
- Build Rust hors de /mnt/projects (disque plein) : `.cargo/config.toml` local → `~/.cache/cordelle/target`.
- Versions figées : specta 2.0.0-rc.26, tauri-specta 2.0.0-rc.26, specta-typescript 0.0.13 (compatibles entre elles).
- Crates livrées (agents Haiku, vérifiées + fusionnées) : accounts (trousseau), rest (API + limites de débit + build
  number), gateway (zlib-stream, heartbeat, resume), auth (QR remote auth v2, mot de passe, 2FA, captcha), store
  (état + cache SQLite). ~90 tests, CI verte.
- Moteur `src-tauri/src/engine/` : comptes, connexion, une session par compte (gateway → store → événements `engine`),
  serveurs/salons/MP/messages (cache d'abord, API au 1er passage), envoi.
- Sonde `cargo run -p auth --example qr_probe` : QR atteint `ready` contre le vrai Discord (build 660103 le 03/11).
- `[~]` dans PROJET.md = codé, en attente du test réel sur le compte secondaire.
- Disque /mnt/projects plein le 03/11 : `target/` Rust de 7 projets inactifs vidés (48 Go, régénérables).
