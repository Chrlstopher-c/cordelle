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
- Jetons : trousseau si dispo, sinon `~/.local/share/cordelle/secrets.json` en 0600 (KWallet sans portefeuille refuse).
  Pas d'activation forcée de KWallet (évite la fenêtre de création de portefeuille).
- Interface v1 : passation design dans docs/design/ (HANDOFF + tokens versionnés, maquettes locales non versionnées :
  vrais pseudos). Coque faite. 6 agents Opus lancés puis annulés (coût) : tout le reste se fait en direct, sans agents.
- Connexion QR validée par Chris sur son compte secondaire le 03/11.
- Clic droit complet (messages, personnes, salons, serveurs, MP, amis) : uniquement des actions réelles ; confirmations
  pour supprimer / quitter / bloquer / retirer. Menu personne selon la relation réelle.
- Mode démo `pnpm demo` (http://localhost:1421) : faux moteur `src/dev/` + données fictives, pour vérifier l'interface
  dans le navigateur intégré sans compte. Absent du bundle de production (vérifié).

## 2026-11-03 nuit
- Vague 1 fusionnée (agents Haiku) : connexion complète (QR, mot de passe, captcha, 2FA) + comptes + bandeau/toasts ;
  fichiers, emojis, saisie assistée ; recherche, épinglés, fils, forums ; menu serveur, invitations, 9 pages de
  réglages serveur + réglages de salon ; 9 pages de réglages utilisateur de plus (sessions, comptes liés, voix,
  notifications de bureau, raccourcis, messages, CSS perso, mode dev, abonnement) ; rejoindre/créer un serveur,
  explorer, événements.
- Vocal : moteur songbird + DAVE + cpal (rejoindre, quitter, micro, sourdine, qui parle, périphériques) + interface
  d'appel. NON testé sur un vrai appel.
- Finitions : début de salon, chargement, séparateur « Nouveaux messages », petite fenêtre (tiroir), thème clair
  thémable, info-bulles du rail, frappe animée, compteurs du serveur.
- Mode démo `pnpm demo` : faux moteurs par zone (`src/dev/zone-*.ts`) pour vérifier sans compte.
- CI : ALSA (libasound2-dev) requis par cpal.
- Partage d'écran : base fusionnée (crate `stream` : paquetisation RTP H264, opcodes Go Live 18/19/22, 18 tests),
  transport vidéo NON écrit (connexion au serveur de stream, UDP chiffré, DAVE vidéo, capture portail + H264) →
  bouton masqué (`SHARE_READY = false` dans CallControls). discord-stream-rs 0.1.3 inutilisable (ébauche).
- Réglages voix : bloc « En appel » branché sur les périphériques du moteur (cpal).
