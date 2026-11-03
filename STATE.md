# État

## 2026-11-03
- Projet créé, PROJET.md écrit. Squelette Tauri 2 + React, workspace de crates par domaine, contrat typé (tauri-specta).
- Accélération GPU WebKitGTK forcée (`gpu.rs`) ; NVIDIA → `WEBKIT_DISABLE_DMABUF_RENDERER=1`. Non vérifiée visuellement :
  sway headless tué au démarrage sur la tour (cause inconnue), test à faire sur l'écran réel.
- Build Rust hors de /mnt/projects (disque plein) : `.cargo/config.toml` local → `~/.cache/cordelle/target`.
- Versions figées : specta 2.0.0-rc.26, tauri-specta 2.0.0-rc.26, specta-typescript 0.0.13 (compatibles entre elles).
