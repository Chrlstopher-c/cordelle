# TODO

## En cours
- Validé par Chris le 03/11 : connexion QR, historique, envoi, réception en direct (serveurs et MP).
- Interface v1 : coque faite (rail, salons, MP, profil, connexion QR minimale). Conversation faite. À faire par moi seul, sans sous-agents : accès complet, accueil/MP, réglages, réglages serveur, vocal.

## Ensuite
- Partage d'écran / caméra / regarder un stream : écrire le transport vidéo (voir STATE.md), puis SHARE_READY = true.
- Tester sur compte réel : appel vocal, envoi de fichiers, réglages serveur (permissions).
- E3.S3+ : édition, suppression, réactions, pièces jointes ; markdown/embeds (côté interface, instance design).
- E4 : voix (songbird 0.6 + davey), partage d'écran (évaluer discord-stream-rs).
- E5.S1 : analyse REA du bundle web Discord → catalogue des écrans rares.
- Bancs : RAM PSS au repos et changement de salon, Cordelle vs client officiel.

## Backlog
- (fait 03/11) GPU vérifié : WebKitWebProcess ouvre /dev/nvidia0, EGL NVIDIA → `scripts/gpu-check.sh`.
- sway headless tué au lancement sur la tour : trouver la cause pour les captures automatiques.
- Ordre et dossiers des serveurs (user_settings_proto), présences de READY_SUPPLEMENTAL.
- Adaptateurs `api.ts` des zones (invoke direct) : passer aux `commands.*` maintenant que bindings.ts contient toutes les commandes.
