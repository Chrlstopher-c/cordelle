# Cordelle

Client Discord natif léger (Rust + Tauri 2), Arch Linux.

> ⚠️ Client non officiel : les conditions d'utilisation de Discord interdisent les clients tiers pour les comptes
> utilisateurs. Usage personnel, à vos risques.

## Lancer
```bash
./start.sh     # dev : Vite (http://localhost:1420) + fenêtre Tauri, journal dans logs/cordelle.log
./stop.sh
```
Dépendances système (Arch) : `webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg pipewire opus`, Rust stable, pnpm.

## Stack
Rust (tokio, tauri 2, tauri-specta) · React 19 + Vite · pnpm. Ports : 1420 (Vite dev).

## Docs
`PROJET.md` (vision, plan) · `CONTRACT.md` (frontière moteur/interface) · `ARCHITECTURE.md` · `STATE.md` · `TODO.md`.
