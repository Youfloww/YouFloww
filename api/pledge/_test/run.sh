#!/bin/sh
# Runs the Focus Pledge server tests against the Firebase Auth + Firestore emulators (no real Firebase, no Razorpay).
# Needs: java, `npx firebase-tools`, `npx tsx` (both fetched by npx on first use).
set -e
cd "$(dirname "$0")"
FIREBASE="${FIREBASE:-npx -y firebase-tools@15}"
TSX="${TSX:-npx -y tsx@4}"
unset RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET FIREBASE_SERVICE_ACCOUNT VERCEL_ENV
export GCLOUD_PROJECT=demo-youfloww
exec $FIREBASE emulators:exec --project demo-youfloww --config firebase.json --only auth,firestore \
  "FIRESTORE_EMULATOR_HOST=127.0.0.1:8188 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 $TSX run.ts"
