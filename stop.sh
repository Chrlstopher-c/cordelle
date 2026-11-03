#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f .pid ] || { echo "pas lancé"; exit 0; }
pkill -P "$(cat .pid)" 2>/dev/null || true
kill "$(cat .pid)" 2>/dev/null || true
rm -f .pid
echo "Cordelle arrêté"
