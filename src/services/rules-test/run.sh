#!/bin/sh
# Firestore rules tests (and, with `e2e`, the browser test) on this folder's own emulators:
# Auth 9299 + Firestore 8288, project demo-youfloww-rules (a demo- project never reaches a real one).
#   sh src/services/rules-test/run.sh        rules tests for firestore.rules (repo root)
#   sh src/services/rules-test/run.sh e2e    rules tests + the browser test against the dev server on :5173 (npm run dev)
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# firebase-tools only loads rules from inside the config's folder: run from a copy
cp "$HERE/firebase.json" "$ROOT/firestore.rules" "$TMP/"
CMD="cd '$ROOT' && npx -y tsx@4 --tsconfig tsconfig.json src/services/rules-test/rules.test.ts"
[ "$1" = "e2e" ] && CMD="$CMD && /usr/local/bin/python3 src/services/rules-test/e2e.py"
cd "$TMP" && npx -y firebase-tools@15 emulators:exec --project demo-youfloww-rules --config firebase.json --only auth,firestore "$CMD"
