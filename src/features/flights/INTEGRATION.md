# Focus Flights: changes for the lead

Everything lives in `src/features/flights/**` and `public/data/flights/**`. The mode registers itself via
`meta.ts` (id `flights`, key `i`, order 40). Nothing below is required for it to run; these make it complete.

## 1. Firestore rule for the public departures board (needed for "Everyone" rows)

Add inside `match /databases/{database}/documents { ... }` in `firestore.rules`, above the deny-all fallback:

```
    // ========================================
    // FLIGHTS - anonymous public departures board (Focus Flights)
    // ========================================
    match /flights/{flightId} {
      allow read: if true;
      // exactly { from, to, minutes, createdAt }: two IATA codes, a believable length, the server's time
      allow create: if request.resource.data.keys().hasOnly(['from', 'to', 'minutes', 'createdAt'])
        && request.resource.data.keys().hasAll(['from', 'to', 'minutes', 'createdAt'])
        && request.resource.data.from is string && request.resource.data.from.matches('^[A-Z]{3}$')
        && request.resource.data.to is string && request.resource.data.to.matches('^[A-Z]{3}$')
        && request.resource.data.minutes is int
        && request.resource.data.minutes >= 1 && request.resource.data.minutes <= 360
        && request.resource.data.createdAt == request.time;
      allow update, delete: if false;
    }
```

- Guests can post too (the board is anonymous). If you'd rather only count signed-in people, add
  `request.auth != null &&` at the start of the `create` condition.
- The query is `orderBy('createdAt', 'desc'), limit(14)`: a single-field index, so no composite index is needed.
- Until the rule is deployed, writes fail quietly (one `console.info` line) and the board shows the person's own flights.
- Optional cleanup: a TTL policy on `flights.createdAt` (e.g. 7 days) in the Firebase console keeps the collection tiny.

## 2. PWA precache (vite.config.ts): keep MapLibre out of the install

`globPatterns` includes `**/*.js`, so the ~1 MB MapLibre chunk would be precached for everyone on install.
Please add to `workbox.globIgnores`:

```ts
'**/maplibre-gl*', '**/FlightMap*',
```

(`maplibre-gl-worker-*.mjs` is not matched by `globPatterns` anyway.) Optional runtime caching for the airport data:

```ts
{
  urlPattern: ({ url }) => url.pathname.startsWith('/data/flights/'),
  handler: 'StaleWhileRevalidate',
  options: { cacheName: 'floww-flights-data', expiration: { maxEntries: 4 } },
},
```

## 3. Landing while the mode is closed (optional)

A flight is tied to the timer session (`sessionStartedAt`). If the person leaves the mode mid-flight, the plane keeps
flying with the timer; the landing (stamp, km, coins) is written the next time they open Focus Flights (it reads the
app's `sessionLog`, so nothing is lost). If you want the stamp written the instant the session ends even with the mode
closed, a tiny always-on hook could call it; not needed for correctness.

## 4. Notes

- MapLibre v6 is ESM with a separate module worker: `FlightMap.tsx` imports `maplibre-gl/dist/maplibre-gl-worker.mjs?url`
  and calls `setWorkerUrl()`. No vite config change needed.
- In dev the first open of a flight makes Vite optimise `maplibre-gl` once (one automatic page reload). Adding
  `optimizeDeps: { include: ['maplibre-gl'] }` to `vite.config.ts` avoids that reload; production is unaffected.
- Keys inside the mode: `V` toggles the window-seat view during a flight; Space/K/E keep working as usual.
  (The Study Hall agent also uses `v` as its mode key; the app ignores mode keys while a mode is open, so no clash.)

## 5. Art that could be added later

The AI art bridge failed twice during this build (file-upload timeout, then "prompt box not found"), so the window-seat
sky, clouds, takeoff scene and stamps are hand-built SVG in the house palette. If you want painted versions later:

- `public/img/flights/sky-day.webp`, `sky-sunset.webp`, `sky-night.webp`: watercolour "above the clouds" views, portrait,
  ≤ 200 KB each (they would replace `SkyBack` in `Scenes.tsx`).
- `public/img/flights/runway.webp`: watercolour airport/runway panorama for the takeoff moment.
