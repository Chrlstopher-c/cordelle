# Architecture

Monolithe modulaire : un binaire Tauri, des crates par domaine aux frontières explicites.

## Domaines (crates/)
| Dossier | Rôle (définition non ambiguë) |
|---|---|
| `contract` | Types qui traversent la frontière Tauri. Aucun code de protocole. Source de `src/contract/bindings.ts`. |
| `accounts` | Comptes enregistrés : jetons dans le trousseau système, compte actif, liste. Ne parle pas au réseau. |
| `auth` | Obtenir un jeton : connexion QR (remote auth), mot de passe, 2FA, captcha. |
| `rest` | Client HTTP de l'API Discord : en-têtes du client web, limites de débit, erreurs typées. |
| `gateway` | Connexion temps réel par compte : identify, heartbeat, resume, décompression, événements bruts. |
| `store` | État en mémoire + cache SQLite : serveurs, salons, messages, non-lus. Seul producteur des `EngineEvent`. |

## Coquille
- `src-tauri/` : commandes Tauri (`commands.rs`), GPU (`gpu.rs`), câblage des crates. Pas de logique métier.
- `src/contract/` : types générés, seule dépendance de l'interface vers le moteur.
- `src/app/`, `src/features/<domaine>/` : interface, par fonctionnalité (gérée par l'instance design).

## Règles de frontière
- Une crate n'importe une autre crate que via sa racine publique (`lib.rs`), jamais un module interne.
- Dépendances autorisées : `auth → rest`, `gateway → contract`, `store → contract`, `src-tauri → toutes`.
  `accounts`, `auth`, `gateway`, `rest` ne dépendent jamais de `store`.
- Aucun jeton ne sort de `accounts` sauf vers `rest` et `gateway`, et n'est jamais journalisé.
