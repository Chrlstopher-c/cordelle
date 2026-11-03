# Contrat moteur ↔ interface

La seule frontière entre le moteur Rust et l'interface. L'interface (design géré à part) n'importe que
`src/contract/bindings.ts`, généré depuis `crates/contract` + `src-tauri/src/commands.rs` :

```bash
pnpm bindings
```

Ne jamais éditer `bindings.ts` à la main. Toute évolution du contrat passe par ces deux fichiers Rust, puis régénération.

## Règles
- Identifiants Discord = `string` (snowflakes > 2^53).
- Chaque commande renvoie `{ status: "ok", data } | { status: "error", error: EngineError }`.
- `EngineError.kind` : `not_found`, `unauthorized`, `rate_limited`, `network`, `discord`, `internal`, `not_implemented`.
- Le contenu des messages est le markdown Discord brut ; le rendu est fait côté interface.
- L'interface est passive : l'état temps réel arrive par les événements, elle ne sonde jamais.

## Commandes
| Commande | Rôle |
|---|---|
| `accountsList()` | comptes enregistrés et état de connexion |
| `accountSwitch(id)` / `accountRemove(id)` | basculer / retirer un compte |
| `authQrStart()` / `authQrCancel()` | connexion par QR ; progression via l'événement `authQr` |
| `authPassword(login)` | email/mot de passe → `LoginOutcome` (succès, 2FA, captcha, identifiants faux) |
| `authMfa(ticket, method, code)` | second facteur |
| `guildsList(account)` | serveurs (ordre et dossiers de la barre latérale) |
| `channelsList(account, guild)` / `dmsList(account)` | salons d'un serveur / MP |
| `messagesGet(account, channel, before, limit)` | page d'historique, plus récent d'abord |
| `messageSend(account, channel, message)` | envoi ; `nonce` pour l'affichage optimiste |

## Événements
- `engine` → `EngineEvent` : `connection`, `guild_upsert/remove`, `channel_upsert/remove`, `message_create/update/delete`,
  `typing`, `presence`, `unread`.
- `authQr` → `QrAuthEvent` : `ready{url}` (à afficher en QR), `scanned{user}`, `completed{account_id}`, `cancelled`,
  `expired`, `failed{message}`.

## Flux de connexion attendu côté interface
1. `authQrStart()` → afficher le QR de `ready.url` ; à `scanned`, montrer l'avatar ; à `completed`, ouvrir le compte.
2. Repli `authPassword` : `captcha_required` → afficher le captcha (hCaptcha, `sitekey`, `rqdata`) puis rappeler
   `authPassword` avec `captcha_key` ; `mfa_required` → demander le code puis `authMfa`.

## Vocal (contrat fixé, implémentation en cours)
Commandes : `voiceJoin(account, guildId|null, channelId)`, `voiceLeave(account)`, `voiceSetMute(account, bool)`,
`voiceSetDeaf(account, bool)`, `voiceDevices()` → `AudioDevices`, `voiceSetDevices(inputId|null, outputId|null)`.
Événements `engine` : `voice_states` (qui est dans quel salon vocal, par serveur) et `voice_session` (sa connexion,
micro, sourdine, ping, qui parle).
