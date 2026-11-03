# Cordelle — client Discord natif (Rust + Tauri) léger, rapide et complet

## Pourquoi et pour qui
Chris utilise Discord tous les jours sous Arch. Le client officiel est une brique : RAM élevée au repos, latence à chaque
navigation, UI/UX subie. Vesktop allège un peu mais crashe encore plus. Cordelle remplace le client officiel pour
tout l'usage quotidien, sur plusieurs comptes.

## Ce que ça apporte
- Moteur Rust qui parle directement au protocole Discord (gateway + REST + voix), cache local → navigation instantanée.
- Interface découplée du moteur : refaite librement (design géré par une instance séparée) sans toucher au protocole.
- Tout Discord dans l'app, y compris les écrans rares (reproduits d'après le client web analysé avec REA).
- Multi-comptes connectés en parallèle.

## Référence visée
Réactivité de Zed / Linear. Étalon chiffré : client officiel Discord Linux mesuré sur la tour (RAM PSS au repos,
temps de changement de salon) — Cordelle doit faire nettement mieux.

## Voie retenue
Tauri 2 (WebKitGTK, accélération GPU forcée) + React 19 / Vite / TanStack Virtual côté interface, moteur Rust tokio.
Voix : `songbird` (driver seul) + `davey` (DAVE E2EE, obligatoire depuis 03/2026). Partage d'écran : `discord-stream-rs`
à évaluer, sinon port maison sur la même base. Connexion : QR (remote auth officielle) d'abord, email/mot de passe/2FA
avec captcha affiché dans l'app en secours. Jetons dans le trousseau système (`keyring`), jamais sur disque en clair.

## Réussite
1. RAM PSS au repos (1 compte, 20 serveurs) < 200 Mo, et < client officiel mesuré.
2. Changement de salon déjà visité < 50 ms (mesure instrumentée), premier affichage < 300 ms.
3. 8 h d'utilisation sans crash ; voix + partage d'écran fonctionnels sur le compte de test.

## Raté si
Compte banni · plantages · une fonction utilisée par Chris absente · plus lent ou plus lourd que le client officiel.

## Hors périmètre (v1)
Windows/macOS · design final (instance dédiée) · automatisation / self-bot · système de plugins.

## Décisions
- 2026-11-03 — Tauri plutôt que GPUI — choix de Chris (polyvalence web, tout Discord dans l'app).
- 2026-11-03 — Arch seulement en v1 — choix de Chris.
- 2026-11-03 — Dépôt git public — aucun jeton/identifiant dans les fichiers suivis, `.env.local` ignoré.
- 2026-11-03 — Tests uniquement sur le compte secondaire de Chris jusqu'à stabilité.
- 2026-11-03 — Contrat moteur ↔ interface écrit (CONTRACT.md + types TS générés) pour que le design avance en parallèle.
- 2026-11-03 — Écrans rares rendus DANS l'app ; REA (analyze-web-bundle) sur le client web pour en extraire endpoints et
  structures ; repli : vue web Discord intégrée dans la fenêtre principale.

## Plan
### E1 — Squelette qui tourne
- [ ] E1.S1 — App Tauri 2 + React + pnpm, accélération GPU forcée — VERIFY: `pnpm tauri build --debug` OK et `scripts/gpu-check.sh` affiche « accelerated »
- [ ] E1.S2 — Structure projet (start/stop/restart, docs, logs, .env.example) — VERIFY: `./start.sh && ./stop.sh` sans erreur
- [ ] E1.S3 — CI GitHub (cargo fmt/clippy/test, pnpm lint/typecheck/test/build) — VERIFY: `gh run watch --exit-status`
- [ ] E1.S4 — CONTRACT.md + types TS générés depuis Rust (`specta`) — VERIFY: `pnpm typecheck` sur les types générés
- [ ] E1.S5 — Bancs de mesure RAM/latence (Cordelle et client officiel) — VERIFY: `scripts/bench.sh` sort un JSON

### E2 — Comptes et connexion
- [ ] E2.S1 — Connexion QR (remote auth) — VERIFY: test d'intégration sur le compte de test → jeton obtenu
- [ ] E2.S2 — Email + mot de passe + 2FA + captcha dans l'app — VERIFY: test manuel guidé sur le compte de test
- [ ] E2.S3 — Trousseau multi-comptes (ajout, retrait, bascule) — VERIFY: `cargo test -p accounts`
- [ ] E2.S4 — Gateway (identify, resume, heartbeat, compression zstd) par compte — VERIFY: `cargo test -p gateway` + 1 h connecté sans coupure

### E3 — Messagerie complète
- [ ] E3.S1 — Serveurs, salons, catégories, MP, permissions, non-lus — VERIFY: `cargo test -p state`
- [ ] E3.S2 — Messages virtualisés + cache SQLite (historique instantané) — VERIFY: bench changement de salon < 50 ms
- [ ] E3.S3 — Envoi, édition, suppression, réponses, réactions, pièces jointes, emojis/stickers — VERIFY: tests e2e sur serveur de test
- [ ] E3.S4 — Rendu markdown, embeds, mentions, liens — VERIFY: tests de rendu sur corpus de messages réels
- [ ] E3.S5 — Fils, forums, annonces, recherche, épingles — VERIFY: tests e2e
- [ ] E3.S6 — Notifications système, présence, statut, saisie en cours — VERIFY: test e2e + notification reçue

### E4 — Voix et partage d'écran
- [ ] E4.S1 — Rejoindre un salon vocal (songbird + DAVE), micro/sortie PipeWire — VERIFY: appel test entre les 2 comptes
- [ ] E4.S2 — Mute/sourdine, push-to-talk, volume par personne, suppression de bruit — VERIFY: test manuel guidé
- [ ] E4.S3 — Appels MP / groupes — VERIFY: appel test
- [ ] E4.S4 — Partage d'écran / Go Live (capture PipeWire + son) et visionnage — VERIFY: stream vu depuis le compte principal
- [ ] E4.S5 — Caméra — VERIFY: appel vidéo test

### E5 — Écrans rares dans l'app
- [ ] E5.S1 — Analyse REA du bundle web Discord → catalogue endpoints/écrans — VERIFY: `docs/discord-surfaces.md` généré
- [ ] E5.S2 — Paramètres utilisateur et serveur (rôles, salons, membres, modération) — VERIFY: tests e2e
- [ ] E5.S3 — Profils, amis, invitations, découverte, événements, sondages, soundboard — VERIFY: tests e2e
- [ ] E5.S4 — Activités et boutique dans une vue intégrée à la fenêtre — VERIFY: une Activité lancée dans l'app
