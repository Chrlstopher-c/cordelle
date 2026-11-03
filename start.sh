#!/usr/bin/env bash
# Lance Cordelle en mode dev (Vite + Tauri). Logs remis à zéro à chaque lancement.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs && : > logs/cordelle.log
[ -f .pid ] && kill -0 "$(cat .pid)" 2>/dev/null && { echo "déjà lancé (pid $(cat .pid))"; exit 0; }
[ -d node_modules ] || pnpm install
CARGO_BUILD_JOBS=2 nohup pnpm tauri dev >logs/cordelle.log 2>&1 &
echo $! > .pid
echo "Cordelle lancé (pid $(cat .pid)) — journal : logs/cordelle.log — Vite : http://localhost:1420"
