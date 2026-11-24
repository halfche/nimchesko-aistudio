#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
PORT="${PORT:-4173}"
URL="http://localhost:${PORT}"

echo "Starting nimchesko AI studio on ${URL}"

if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1 && xdg-open "${URL}") >/dev/null 2>&1 &
fi

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "${PORT}" --bind 127.0.0.1
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -s . -l "${PORT}"
else
  echo "Error: Python 3 or Node.js (npx) is required to serve the compiled web app." >&2
  exit 1
fi
