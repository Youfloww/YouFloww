# Focus Pledge: integration notes

Focus Pledge = a commitment device, **not a bet**: a signed-in person pledges ₹49 / ₹99 / ₹199 / ₹499 on their own
focus goal. Met → full refund. Missed → donated to charity. Nobody can ever win money.

What's in this feature:
- `src/features/pledge/**`: the mode (id `pledge`, key **Q**, order 70). It mounts by itself through `meta.ts`.
- `public/pledge/*.webp`: three watercolour illustrations.
- `api/pledge/*.ts`: Vercel serverless functions (Node runtime, Web `Request`/`Response` handlers):
  `create`, `verify`, `settle` (cron), `webhook`. Helpers live in `api/pledge/_lib/` (Vercel doesn't deploy
  `_`-prefixed paths as functions). Tests are in `api/pledge/_test/`.
- `src/features/pledge/rules.ts` is shared by the browser and the server. It's pure, with no imports.

Firestore collections (all written only by the server through the Admin SDK):
`pledges/{orderId}` (the person can read their own), `pledgeStats/public` (public totals),
`pledgeOrders/{orderId}` and `pledgeUsers/{uid}` (server-only).

---

## 1. vercel.json (lead applies)

Replace the whole file with this. It keeps everything that's already there and adds four things: `api/` (and
`pledge/` art) are no longer rewritten to index.html, a daily cron, a function time limit, and no caching for the API.

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/__/:path*", "destination": "https://youfloww2.firebaseapp.com/__/:path*" },
    { "source": "/((?!__/|api/|assets/|sounds/|img/|icons/|pledge/|sw.js|workbox-).*)", "destination": "/index.html" }
  ],
  "crons": [{ "path": "/api/pledge/settle", "schedule": "30 3 * * *" }],
  "functions": { "api/pledge/*.ts": { "maxDuration": 30 } },
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/sounds/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=2592000" }] },
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/api/(.*)", "headers": [{ "key": "Cache-Control", "value": "no-store" }] }
  ]
}
```

- `30 3 * * *` is 03:30 UTC (09:00 IST). The Hobby plan allows one run a day, and Vercel may start it any time
  within that hour. Settlement waits 1 h after each deadline anyway, and the copy says "we check the morning
  after your deadline".
- Vercel Cron runs **only on the production deployment**. It sends `Authorization: Bearer $CRON_SECRET` by itself
  once the `CRON_SECRET` env var exists.
- `package.json` already has `"type": "module"` and `firebase-admin`, so the functions build as ESM. The relative
  imports use `.js` endings on purpose (that's what Node ESM needs). `api/pledge/tsconfig.json` is the server
  tsconfig, and the root `tsc -b` doesn't include `api/`.

## 2. vite.config.ts (lead applies, small)

Keep the pledge art out of the PWA precache (it only loads when the mode is opened), and never answer `/api/*`
with the app shell:

```ts
// workbox.globIgnores: add
'**/pledge/**',
// workbox.navigateFallbackDenylist: becomes
navigateFallbackDenylist: [/^\/__\//, /^\/api\//],
```

## 3. Firestore rules (lead applies to `firestore.rules`, then the user deploys them)

Paste this block just **above** the `FALLBACK - Deny all other collections` section. The full proposed file,
which the tests ran against in the emulator, is `api/pledge/_test/firestore.rules`.

```
    // ========================================
    // FOCUS PLEDGE - written only by the server (Admin SDK in api/pledge)
    // ========================================
    match /pledges/{pledgeId} {
      // a person can read their own pledges; nobody can write them from a browser
      allow read: if request.auth != null && request.auth.uid == resource.data.uid;
      allow write: if false;
    }
    match /pledgeStats/{doc} {
      // public running totals for the charity card
      allow read: if true;
      allow write: if false;
    }
    // pledgeOrders/* and pledgeUsers/* are server-only: covered by the deny-all fallback below
```

Deploy: `npx firebase-tools deploy --only firestore:rules --project youfloww2` (or paste it into Firebase console →
Firestore → Rules). No composite indexes are needed: every query is a single-field one.

## 4. Environment variables (the user sets them in Vercel → Project → Settings → Environment Variables)

| Name | What | Where it comes from |
|---|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_…` (Preview) / `rzp_live_…` (Production) | giftasite's Razorpay dashboard → Account & Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | the matching secret (shown once when generated) | same place |
| `RAZORPAY_WEBHOOK_SECRET` | a random string you choose (optional, for the webhook) | `openssl rand -hex 32`; paste the same value into the Razorpay webhook form |
| `FIREBASE_SERVICE_ACCOUNT` | the whole service-account JSON (raw, or base64 of it) | Firebase console → youfloww2 → Project settings → Service accounts → Generate new private key |
| `CRON_SECRET` | random, 16+ chars | `openssl rand -hex 32` |

- Without the Razorpay keys, a **deployed** site (preview or production) refuses pledges (HTTP 503, "Pledges are
  paused"). It never fakes a payment. The clearly labelled **STUB mode** (nothing charged, nothing refunded) only
  runs on a local machine.
- A pledge records whether it was paid with test or live keys. Only **live** missed pledges count toward the public
  donation total, and a test payment is never "refunded" with live keys (or the other way round).
- Never commit or print any of these values. The code never logs them.

## 5. Testing with Razorpay TEST keys, then going live (for the user)

1. **Test keys.** Log in to the giftasite Razorpay dashboard and switch the **Test Mode** toggle on (top bar). Go to
   **Account & Settings → API Keys → Generate Test Key** and copy the Key ID (`rzp_test_…`) and the Key Secret.
2. **Vercel (Preview environment only):** set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` to the test pair, and set
   `FIREBASE_SERVICE_ACCOUNT` and `CRON_SECRET`. Push a branch and open the preview URL. (If Vercel Deployment
   Protection is on for previews, sign in to Vercel in that browser first.)
3. **Optional webhook (test):** in Test Mode go to **Account & Settings → Webhooks → Add New Webhook**. URL:
   `https://<preview-or-prod-domain>/api/pledge/webhook`. Secret = your `RAZORPAY_WEBHOOK_SECRET`. Events:
   `payment.captured`, `order.paid`, `refund.processed`, `refund.failed`.
   The Razorpay account is shared with giftasite, so each app's webhook also receives the other's events. Both
   ignore orders that aren't theirs. giftasite's handler only updates its own `razorpayOrderId` rows (checked, read-only).
4. **Make a pledge** on the preview: sign in with Google → Worlds (W) → Focus Pledge (or press **Q**). Pick
   "2 hours in 1 day", ₹49, tick 18+, pay. Use Razorpay's test details:
   - UPI ID **`success@razorpay`** (succeeds) or **`failure@razorpay`** (fails)
   - or a domestic test card from <https://razorpay.com/docs/payments/payments/test-card-details/> (any future
     expiry, any CVV, any OTP).
   The checkout shows "giftasite", and the app then shows the active pledge with a ring.
5. **Settle it now** instead of waiting a day: in Firebase console → Firestore → `pledges/<order id>`, set `deadline`
   (and optionally `startAt`) to a time more than 1 hour in the past. Log some focus first if you want a "met"
   result. Then run:
   ```sh
   curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-domain>/api/pledge/settle
   ```
   You get JSON like `{"due":1,"refunded":1,...}`. In Razorpay Test Mode → Transactions → Refunds the refund shows
   up at once (test refunds process instantly). A missed test pledge shows `forfeited` and no refund. Run the curl
   again: nothing changes, with no second refund.
6. **Go live:** in the dashboard, switch Test Mode off, then **API Keys → Generate Live Key**. Put the live pair in
   the Vercel **Production** environment only. If you use the webhook, add a live one with the same URL and events
   (live and test webhooks are separate). Redeploy production. Optionally make one real ₹49 pledge, settle it as
   above, and check the refund.
7. **Every month:** look up the month's missed live pledges (Firestore `pledges` where `status == "forfeited"` and
   `mode == "live"`, or the `forfeitedPaise` total in `pledgeStats/public`), donate that amount to the charity, then
   edit `pledgeStats/public` in the console:
   - `donatedPaise`: add the amount donated, **in paise** (₹1,234 = `123400`)
   - `donations`: an array of maps, newest first: `{ month: "Oct 2026", amountPaise: 123400, receiptUrl: "https://…" }`
   - optional `charity`: a map `{ name, blurb, url }` to change the charity shown in the app without a deploy.
   The card shows "Donated so far" = `donatedPaise` and "This month's gift" = `forfeitedPaise − donatedPaise`.

## 6. Before going live (decisions for the user)

- **Charity:** the default is *Akshaya Patra Foundation* (`DEFAULT_CHARITY` in `rules.ts`). That's a placeholder
  choice. Change it there or with `pledgeStats/public.charity`.
- **Support contact:** set `SUPPORT_EMAIL` in `rules.ts`. It then appears in the terms sheet ("Questions about a
  payment? Write to …"). Error messages already tell people to "contact us with your payment ID".

## 7. Run the tests

```sh
cd ~/Desktop/YouFloww/api/pledge/_test && ./run.sh     # needs java; fetches firebase-tools + tsx via npx
```
This starts the Auth + Firestore emulators (project `demo-youfloww`, ports 9199/8188) and runs 89 checks. It never
talks to real Firebase or Razorpay.
