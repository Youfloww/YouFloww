#!/bin/sh
# Runs the focus ledger tests (rules + POST /api/focus/log) against the Firebase Auth + Firestore emulators.
# Needs: java, `npx firebase-tools`, `npx tsx` (both fetched by npx on first use). Shares the pledge tests' emulator config.
set -e
cd "$(dirname "$0")"
FIREBASE="${FIREBASE:-npx -y firebase-tools@15}"
TSX="${TSX:-npx -y tsx@4}"
unset RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET FIREBASE_SERVICE_ACCOUNT VERCEL_ENV
export GCLOUD_PROJECT=demo-youfloww
exec $FIREBASE emulators:exec --project demo-youfloww --config ../../pledge/_test/firebase.json --only auth,firestore \
  "FIRESTORE_EMULATOR_HOST=127.0.0.1:8188 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 $TSX $(pwd)/run.ts"
