# Cordelle — passation design v1

De l'instance design vers la session qui code Cordelle (`/mnt/projects/cordelle`, React 19 + Vite, `src/app/` et
`src/features/<domaine>/`). Rien ici ne touche au moteur ni à `CONTRACT.md`.

- Canvas (prototype cliquable complet, références) : https://claude.ai/artifact/NJFYyppXpsNKTvocAMjAKT
  — pages Accès, Accueil et MP, Serveur, Vocal, Réglages, Réglages du serveur, Composants. Lisible avec l'outil
  Artifact (`action: "read"`, même compte). En Play, les écrans sont reliés entre eux par leurs liens.
- `tokens.css` : toutes les couleurs, tailles, rayons et durées. À reprendre tel quel dans `src/app/`.
- `screens/*.dc.html` : source des 67 écrans et des 6 composants. Format du canvas : `{{x}}` = valeur calculée,
  `<sc-if>` = rendu conditionnel, `<sc-for>` = liste, `onClick="{{f}}"` = gestionnaire,
  `<dc-import name="X" prop="…">` = composant `X.dc.html`, `<a href="Y.dc.html">` = navigation vers l'écran Y.
  Le HTML et les styles inline sont la référence visuelle exacte (valeurs en px) ; la logique est à refaire en React.

## Inventaire

| Zone | Écrans (`screens/<nom>.dc.html`) |
|---|---|
| Composants | `Titlebar` (label ; recherche → palette Ctrl K), `Rail` (active ; dossiers de serveurs repliables), `ChannelList` (active, voice off/on/share ; catégories repliables), `DmList` (active), `UserBar` (menu de statut : en ligne / inactif / ne pas déranger / invisible / statut perso, micro et son), `SettingsNav` (scope user/server, active) → un composant React chacun |
| Accès et système | `Connexion` (QR prêt/scanné/expiré, mot de passe, captcha, erreur, création de compte), `Connexion-2FA`, `Comptes`, `Etats` (démarrage, hors ligne, mise à jour, toasts), `Theme-clair`, `Petite-fenetre` (860 et 480 px, tiroir de salons), `Systeme` (superposition en jeu, notifications du système, zone de notification) |
| Accueil et MP | `MP`, `MP-groupe`, `Amis`, `Activite`, `Explorer`, `Ajouter-serveur` |
| Serveur | `Ecran-principal` (barre d'actions au survol des messages), `Fil`, `Forum`, `Menu-serveur`, `Inviter`, `Profil-membre`, `Recherche`, `Message-actions`, `Emoji-picker`, `Envoi-fichier`, `Epingles`, `Palette` (Ctrl K), `Menus-contextuels` (salon, serveur, membre), `Saisie-assistee` (@ # : /, composants de bots), `Messages-riches` (markdown complet, embeds, sondage, vocal, transféré, échec d'envoi), `Visionneuse` (image et vidéo), `Etats-vides`, `Signaler` (signaler, bloquer), `Onboarding-serveur`, `Evenements`, `Stage`, `Salon-annonces` |
| Vocal | `Appel`, `Appel-MP`, `Partage-source`, `Stream-spectateur`, `Appel-flottant`, `Activites-vocal`, `Salon-Parametres` |
| Réglages | `Settings-Compte`, `-Profil`, `-Confidentialite`, `-Appareils`, `-Comptes-lies`, `-Voix`, `-Notifications`, `-Raccourcis`, `-Apparence`, `-Messages`, `-Accessibilite`, `-Langue`, `-Activites`, `-Extensions`, `-Avance`, `-Abonnement` |
| Réglages du serveur | `Serveur-Vue`, `-Roles`, `-Emoji`, `-Membres`, `-Invitations`, `-Bans`, `-AutoMod`, `-Audit`, `-Integrations` |

Les sélecteurs d'état en pointillés (Connexion, Connexion-2FA, Etats) et les réglages Tweaks (Envoi-fichier,
Epingles) servent seulement à montrer les états dans la maquette : ils ne font pas partie de l'interface.
- **Dépôt public** : les maquettes contiennent de vrais pseudos (Chris et ses amis). Ne pas committer `screens/` ;
  dans le code et les tests, utiliser des données fictives.

## Principe validé par Chris

On garde Discord : serveurs → salons → salons vocaux, même vocabulaire, mêmes repères. On corrige seulement ce qui
gêne, chaque correction vient d'une app réelle. Une première série de 4 styles inventés a été rejetée
(« surfait, pas naturel ») : ne pas réinventer l'esthétique, ne pas ajouter d'effets.

| Problème dans Discord | Référence | Ce que fait Cordelle |
|---|---|---|
| Trop de colonnes à la fois | Cinny, Telegram | Navigation + conversation ; membres fermés par défaut |
| Notifications éparpillées | Slack (Activité) | Une entrée « Activité » en haut du rail |
| Vocal invisible ou bloc encombrant | Stoat, Slack (huddles) | Participants sous le salon ; une ligne « vocal connecté » |
| Changer de micro = ouvrir les réglages | Fluxer | Flèche sur chaque bouton de la barre d'appel |
| On ne sait pas ce que les autres voient | Tuple, Fluxer | Liseré vert + « Tu partages cette fenêtre » + LIVE/qualité/spectateurs |
| Lourd, défilement qui accroche | Telegram Desktop | Changement de salon instantané depuis le cache, 60 i/s |

## Structure de la fenêtre

`titlebar 34` · `rail 64` · `sidebar 252` · `contenu` (+ `membres 248` ou `chat d'appel 320` à la demande).
Fenêtre de référence 1440×900. Cible Linux (WebKitGTK) : les boutons de fenêtre suivent la plateforme.

### Rail des serveurs (`guildsList`)
- Haut : **Messages privés** et **Activité**, chacun avec un compteur rouge (`unread`).
- Séparateur, puis serveurs 40×40, rayon 12 → 10 au survol et pour l'actif (150 ms).
- Indicateur blanc à gauche : barre 24 px = serveur actif, 8 px = non lu. Respecter l'ordre et les dossiers du contrat.
- Bas : ajouter un serveur, explorer.

### Liste des salons (`channelsList`)
- En-tête : bannière du serveur 84 px (image du serveur, sinon couleur), nom, chevron, « N en ligne · N membres ».
- Catégories repliables en capitales 11.5 px. Salon : 32 px. Lu = `--text-faint`, non lu = `--text-strong` 600,
  mention = pastille rouge avec le nombre, actif = `--surface-selected`.
- Salon vocal : icône verte s'il est occupé, compteur à droite, participants dessous (avatar 22, anneau vert qui
  pulse quand la personne parle, icône micro coupé, badge LIVE rouge si elle partage).
- Connecté en vocal : une ligne `--voice-strip-bg` au-dessus du profil (« vocal-1 · Tu partages ton écran »,
  boutons arrêter le partage / raccrocher). Un clic sur le nom rouvre l'appel.
- Profil : une ligne de 52 px (avatar 32 + statut, nom, statut texte, micro, son, réglages). Pas de grande carte.

### Conversation (`messagesGet`, `message_*`, `typing`)
- En-tête 52 : `#` + nom + séparateur + sujet tronqué, puis boutons **avec libellé** : Fils (n), Épinglés, Membres,
  et la recherche du serveur (210 px).
- Messages en disposition « confortable » de Discord : avatar 38, nom coloré par rôle, heure 11.5 px, corps 15 px /
  1.45. Messages consécutifs groupés (pas d'avatar, retrait 72 px). Liste virtualisée (TanStack Virtual).
- Réponse : une seule ligne au-dessus (flèche, auteur, extrait tronqué). Jamais le message cité en entier.
- Événements système (arrivée…) : une ligne grise 13 px avec icône.
- Séparateur de date au centre ; séparateur rouge « Nouveaux messages » à la position du dernier lu.
- Mention de l'utilisateur : fond de ligne `--mention-row-bg`, pastille `@nom` en `--mention-pill-*`.
- Réactions en pastilles 24 px ; la sienne en contour accent.
- Fil : bouton sous le message (avatars, « Fil · titre », « N réponses · il y a X »).
- Saisie : champ 48 px `--surface-input`, rayon 10, avec joindre (gauche), GIF et emoji (droite). **Pas de bouton
  cadeau / Nitro.** « X est en train d'écrire… » sous le champ (événement `typing`).

### Membres (`presence`)
Fermé par défaut, ouvert par le bouton « Membres » de l'en-tête (état mémorisé par salon). Groupes par rôle, ligne
avatar 32 + nom + activité.

## Appel (E4)

Un clic sur un salon vocal remplace la conversation par la scène (fond `--surface-call`), comme Discord.
- En-tête : nom, « N personnes · durée · ping », bascule **Focus / Grille**, **Chat** (panneau 320 du chat du salon
  vocal), fenêtre flottante, plein écran.
- Focus : le partage en grand ; vignettes 200×112 des participants dessous. Grille : 2×2 égale.
- Tuile de partage : badge LIVE, « 1080p · 60 i/s », « N regardent ». Pour celui qui partage : liseré vert 2 px et
  pastille « Tu partages cette fenêtre · Changer ».
- Qui parle : contour vert 2 px sur sa tuile. Micro coupé : icône rouge dans l'étiquette du nom.
- Barre de contrôle centrée, boutons 48 : micro, son, caméra, partage (fond vert quand actif), activités, raccrocher
  (rouge, 64 de large). Micro, son, caméra et partage ont une flèche qui ouvre un menu :
  - Micro : choix du périphérique (coche), volume d'entrée + vumètre, suppression du bruit, lien vers les réglages voix.
  - Partage : source (cette fenêtre / écran entier / autre fenêtre), qualité 720p 30 · 1080p 60 · Source,
    son du jeu, arrêter le partage.
  - Clic en dehors ou Échap ferme le menu.

## Réglages

Plein écran comme Discord, fermeture par le bouton rond ou Échap. Lisibilité calquée sur les Paramètres de Windows 11.
- Nav 280 : avatar et pseudo, **recherche de réglages**, groupes Compte / Application / Avancé (dont
  « Extensions et thèmes »), puis Abonnement et Se déconnecter en petit, en bas.
- Contenu centré, 820 max : titre 26 px, sections, cartes `--surface-raised` rayon 10, une ligne par réglage
  (min 64 px) : titre, phrase d'explication, contrôle à droite (menu 240, interrupteur 40×22, segmenté, touches).
- Réglages modifiés : point `--accent-text` à côté + « N réglages modifiés · Tout réinitialiser » sous le titre.
- Les 16 pages utilisateur et les 9 pages serveur sont maquettées. Réglages d'un salon : même modèle, nav propre au
  salon, barre flottante « Modifications non enregistrées · Annuler · Enregistrer » dès qu'un réglage change.

## Mouvement

Sobre. Aucune animation sur le contenu au changement de salon : c'est instantané (Telegram). Seulement :

| Où | Effet | Durée |
|---|---|---|
| Survol, sélection, rayon des serveurs | couleur / rayon | 120–150 ms |
| Menus de la barre d'appel | opacité + montée de 6 px + échelle .98 → 1 | 160 ms |
| Panneau membres / chat d'appel | opacité + glissement de 12 px | 180 ms |
| Focus ↔ Grille, entrée dans l'appel, changement de page de réglages | opacité .4 → 1 + échelle .985 → 1 | 200–220 ms |
| Quelqu'un parle | halo vert qui pulse | boucle 1.3 s |

| Appui sur tout bouton | `transform: scale(.97)` | 80 ms |
| Modales | voile en fondu 180 ms + boîte échelle .96 → 1 | 200 ms |
| Changement d'onglet | fondu du contenu | 200 ms |
| Barre « Modifications non enregistrées », toasts | montée depuis le bas | 200 ms |
| Dépliage (journal d'audit, AutoMod) | `clip-path` + fondu (pas d'animation de hauteur) | 200 ms |
| Visionneuse | zoom depuis la vignette .9 → 1 | 220 ms |

Courbe `--ease`. Focus clavier : `:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px }`.
`prefers-reduced-motion` coupe tout. Objectif : 60 i/s constant, rien ne doit faire attendre.

Règle d'interaction : aucun contrôle mort. Un menu déroulant ouvre une liste (choix coché, fermeture au choix ou au clic
dehors), un curseur montre sa valeur, une recherche filtre à la frappe, une action destructrice a une confirmation ou un
toast avec « Annuler ».

## Limites connues des maquettes

- Simulé faute de vrai backend : flux vidéo et écrans partagés (aplats étiquetés), vumètre, envois de fichiers,
  vérification du code 2FA, minuteries d'appel. Le glisser-déposer des rôles est remplacé par Monter/Descendre.
- Les montants d'Abonnement sont des emplacements `[prix Discord]` / `[montant]` à remplir avec les vrais tarifs.
- Les maquettes utilisent `onInput`, `onKeyDown`, `defaultValue`, `disabled`, `autofocus` : comportement attendu,
  à reproduire en React (le rendu canvas n'a pas été vérifié pour ces gestes).
- Un écran absent de l'inventaire (boutique, quêtes, Nitro) se demande à l'instance design avant d'être inventé.
