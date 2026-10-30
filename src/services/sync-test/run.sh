#!/bin/sh
set -e
cd "$(dirname "$0")"
ROOT="$(cd ../../.. && pwd)"
export GCLOUD_PROJECT=demo-sync
exec npx -y firebase-tools@15 emulators:exec --project demo-sync --config firebase.json --only firestore \
  "cd $ROOT && FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 npx -y tsx@4 --tsconfig tsconfig.json src/services/sync-test/run.ts"
