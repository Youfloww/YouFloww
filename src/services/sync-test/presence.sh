#!/bin/sh
# The live count under the real firestore.rules (emulator only; nothing touches the live project).
set -e
cd "$(dirname "$0")"
ROOT="$(cd ../../.. && pwd)"
cp "$ROOT/firestore.rules" .presence.rules  # the emulator only reads rules inside its config's folder
trap 'rm -f .presence.rules' EXIT
npx -y firebase-tools@15 emulators:exec --project demo-presence --config presence.json --only firestore \
  "cd $ROOT && npx -y tsx@4 --tsconfig tsconfig.json src/services/sync-test/presence.ts"
