#!/bin/sh
# Runs rules.test.mjs against the RTDB emulator with ../database.rules.json (needs java + network for npx once).
set -e
PORT="${RTDB_PORT:-9000}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
cp "$HERE/../database.rules.json" "$TMP/database.rules.json"
printf '{"database":{"rules":"database.rules.json"},"emulators":{"database":{"port":'"$PORT"'},"ui":{"enabled":false},"singleProjectMode":true}}' > "$TMP/firebase.json"
cd "$TMP"
npx -y firebase-tools@15 emulators:exec --only database --project demo-youfloww "node '$HERE/rules.test.mjs'"
