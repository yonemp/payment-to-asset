#!/usr/bin/env bash
set -euo pipefail
export HOME="${HOME:-/home/vboxuser}"
ROOT="${HOME}/apps/payment-to-asset"
RUNTIME="${ROOT}/swap-runtime"
mkdir -p "$ROOT/data/wallets" "$ROOT/logs"
chmod 700 "$ROOT/data" "$ROOT/data/wallets" || true
if [[ -f "$ROOT/data/wallets/watcher.pid" ]]; then
  old="$(cat "$ROOT/data/wallets/watcher.pid" 2>/dev/null || true)"
  if [[ -n "${old}" ]] && kill -0 "$old" 2>/dev/null; then
    kill "$old" 2>/dev/null || true
    sleep 1
    kill -9 "$old" 2>/dev/null || true
  fi
fi
pkill -f "$RUNTIME/swap-watcher.js" 2>/dev/null || true
sleep 1
# Local isolated store. Token stays on disk; not printed.
if [[ -f "$ROOT/data/token.txt" ]]; then
  export DATABASE_URL="${DATABASE_URL:-http://127.0.0.1:7450}"
  export DATABASE_TOKEN="$(tr -d '\n' < "$ROOT/data/token.txt")"
fi
export SWAP_DATA_DIR="${SWAP_DATA_DIR:-$ROOT/data/wallets}"
export SWAP_WATCH_MS="${SWAP_WATCH_MS:-20000}"
nohup bash -c "while true; do
  node '$RUNTIME/swap-watcher.js' >>'$ROOT/logs/swap-watcher.log' 2>&1 || true
  sleep 5
done" >/dev/null 2>&1 &
echo $! > "$ROOT/data/wallets/watcher.pid"
echo "WATCHER_OK pid=$(cat "$ROOT/data/wallets/watcher.pid")"
