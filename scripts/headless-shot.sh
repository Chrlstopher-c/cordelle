#!/usr/bin/env bash
# Lance Cordelle dans un sway headless isolé (jamais l'écran réel), capture l'écran et mesure la RAM.
# Usage : scripts/headless-shot.sh <binaire> <capture.png> [secondes]
set -euo pipefail
BIN="${1:?binaire}"; SHOT="${2:?capture.png}"; WAIT="${3:-12}"
RUN="$(mktemp -d /tmp/cdl-XXXX)"; chmod 700 "$RUN"
CONF="$RUN/sway.conf"; echo 'output HEADLESS-1 resolution 1600x900' > "$CONF"
cleanup() { kill "${APP:-}" "${SWAY:-}" 2>/dev/null || true; rm -rf "$RUN"; }
trap cleanup EXIT

env -u DISPLAY -u WAYLAND_DISPLAY XDG_RUNTIME_DIR="$RUN" WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 \
  sway -c "$CONF" >"$RUN/sway.log" 2>&1 & SWAY=$!
for _ in $(seq 50); do [ -S "$RUN/wayland-1" ] && break; sleep 0.1; done
export XDG_RUNTIME_DIR="$RUN" WAYLAND_DISPLAY=wayland-1 GDK_BACKEND=wayland
env -u DISPLAY "$BIN" >"$RUN/app.log" 2>&1 & APP=$!
sleep "$WAIT"
grim "$SHOT"
pss() { awk '/^Pss:/{print $2}' "/proc/$1/smaps_rollup" 2>/dev/null || echo 0; }
total=$(pss "$APP")
for c in $(pgrep -P "$APP" || true); do total=$((total + $(pss "$c"))); done
for c in $(pgrep -f 'WebKit(Web|Network|GPU)Process' || true); do
  [ "$(ps -o ppid= "$c" | tr -d ' ')" = "$APP" ] || continue
done
echo "{\"pss_kb_app_and_children\": $total}"
tail -n 5 "$RUN/app.log" >&2
