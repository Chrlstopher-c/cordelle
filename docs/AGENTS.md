# Guide des agents de zone

Chaque agent ajoute une zone complète de l'interface **et** ce qu'il faut côté moteur pour qu'elle marche vraiment.
Référence visuelle : `docs/design/HANDOFF.md`, `src/app/styles/tokens.css`, maquettes `/mnt/projects/cordelle/docs/design/screens/<Écran>.dc.html`
(HTML + styles en px = référence exacte ; logique à refaire en React). Interface en français.

## Fichiers d'une zone `<z>` (tu ne crées / modifies que ceux-là)
| Couche | Fichier |
|---|---|
| Types du contrat | `crates/contract/src/<z>.rs` + une ligne `pub mod <z>;` dans `crates/contract/src/lib.rs` |
| Moteur (appels Discord) | `src-tauri/src/engine/<z>.rs` (`impl Engine { pub async fn … }`) + `mod <z>;` dans `src-tauri/src/engine/mod.rs` |
| Commandes Tauri | `src-tauri/src/commands/<z>.rs` (`#[tauri::command] #[specta::specta]`) + `pub mod <z>;` dans `commands/mod.rs` + chaque commande dans la liste `collect_commands!` de `src-tauri/src/lib.rs` |
| Interface | `src/features/<z>/**` |
| Faux moteur (démo) | `src/dev/zone-<z>.ts` : `export const handlers: Record<string, Handler> = { nom_commande: (args) => … }` (données FICTIVES) |

Ne touche à aucun autre fichier. Si un fichier partagé doit changer (coque, store, conversation), décris le changement exact
dans ton rapport : l'intégrateur le fera.

## Recettes moteur
- Session d'un compte : `let session = self.session(account_id)?;` puis `session.rest.get_json::<Value>(path)`, `post_json`,
  `patch_json`, `put(path, &body)` (réponse vide), `post(path, &body)` (réponse vide), `delete(path)`. Chemins relatifs à l'API v9
  (`/channels/{id}/pins`…). Erreurs : `?` convertit en `EngineError`. Jamais de jeton dans les journaux.
- Conversion JSON Discord → contrat : `store::convert::{user, message, channel}`.
- Gateway (opcode) : `session.gateway` est privé ; demande à l'intégrateur si tu en as besoin.
- Commande type :
```rust
#[tauri::command]
#[specta::specta]
pub async fn pins_list(engine: Eng<'_>, account_id: AccountId, channel_id: Snowflake) -> Res<Vec<Message>> {
    engine.pins(&account_id, &channel_id).await
}
```
  (`use super::{Eng, Res};` — les alias `Eng`/`Res` sont `pub(crate)` dans `commands/mod.rs`.)
- Après ajout de commandes : `pnpm bindings` régénère `src/contract/bindings.ts` (ne jamais l'éditer à la main) ; l'interface
  appelle `commands.pinsList(...)` qui renvoie `{ status: "ok", data } | { status: "error", error }`.

## Interface
- Données partagées : `useEngine` (serveurs, salons, MP, messages, présences, relations), `useNav` (vue, surcouches),
  `useActiveAccount()`, `usePresence(id)`. Composants partagés : `Avatar`, `StatusAvatar`, `useContextMenu`/`item`/`sep`,
  `useConfirm` (actions destructrices), profils `useProfiles().openPopout/openModal`.
- Mouvement selon HANDOFF (menus 160 ms, panneaux 180 ms, modales 200 ms) ; rien au changement de salon.
- **Aucun contrôle mort** : chaque bouton fait quelque chose de réel. Si Discord ne le permet pas, ne l'affiche pas.

## Règles
- Dépôt PUBLIC : aucune vraie donnée (pseudos, serveurs, ids) des maquettes ; données fictives seulement.
- TypeScript : zéro `any`, zéro `as` sans commentaire, types de retour explicites sur les exports. Rust : clippy propre.
- Fichier ≤ 500 lignes, fonction ≤ 35 lignes (composants de rendu ≤ 80), ligne ≤ 120 caractères.
- Compilation Rust : préfixe `CARGO_TARGET_DIR=$HOME/.cache/cordelle/target-<z> CARGO_BUILD_JOBS=2 systemd-run --user --scope -q -p MemoryMax=6G -p MemorySwapMax=0`.

## Vérification obligatoire avant commit
```bash
cargo fmt --all --check && cargo clippy -p cordelle --all-targets -- -D warnings
pnpm bindings && pnpm typecheck && pnpm lint && pnpm build
```
Puis vérification visuelle en mode démo : `pnpm demo` (port 1421) dans ton worktree avec un autre port si occupé
(`VITE_MOCK=1 pnpm exec vite --port 14xx`), ouvre l'écran et contrôle qu'aucune erreur n'apparaît dans la console.
