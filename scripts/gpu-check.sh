#!/usr/bin/env bash
# Vérifie que le processus web de Cordelle en cours utilise le GPU (WebKit masque le nom réel côté page).
set -euo pipefail
APP=$(pgrep -f 'cordelle$' | head -1) || { echo "Cordelle n'est pas lancé"; exit 1; }
for c in $(pgrep -f 'WebKit(Web|GPU)Process' || true); do
  [ "$(ps -o ppid= "$c" | tr -d ' ')" = "$APP" ] || continue
  if ls -l "/proc/$c/fd" 2>/dev/null | grep -qE '/dev/(nvidia[0-9]|dri/renderD)'; then
    driver=$(grep -oE 'libEGL_[a-z]+' "/proc/$c/maps" | sort -u | tr '\n' ' ')
    echo "accelerated (processus $c, EGL : ${driver:-inconnu})"; exit 0
  fi
done
echo "software : aucun processus web de Cordelle n'a ouvert de périphérique GPU"; exit 2
