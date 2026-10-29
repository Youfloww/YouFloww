# Scenic Train (+ Window Seat): notes for the lead

Both modes plug in through their `meta.ts` (train: key `x`, order 45; window: order 46, no key). No shared file
edits are required for them to work. Suggested shared changes:

## 1. PWA precache (vite.config.ts → `workbox`)
The precache glob (`**/*.{js,css,html,svg,webp,woff2}`) would pull the Window Seat paintings (~630 KB), the
maplibre chunk (~1 MB) and the train chunks into every install. Suggest:

```ts
globIgnores: [..., '**/img/window/**', '**/img/train/**', '**/maplibre*', '**/WindowView*'],
runtimeCaching: [
  ...,
  { urlPattern: ({ url }) => url.pathname.startsWith('/img/window/'), handler: 'CacheFirst', options: { cacheName: 'floww-window', expiration: { maxEntries: 12 } } },
  { urlPattern: ({ url }) => url.pathname.startsWith('/data/train/'), handler: 'StaleWhileRevalidate', options: { cacheName: 'floww-train-data', expiration: { maxEntries: 20 } } },
],
```
(`.geojson` files are not in the precache glob, so they are fetched on demand: 3–25 KB per line.)

## 2. maplibre worker under Vite (affects the flights mode too)
maplibre-gl 6 finds its worker via `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Vite's dependency
pre-bundling moves the module, so the worker 404s in dev ("Worker failed to load"). The train fixes it locally:

```ts
const [ml, worker] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')]);
ml.setWorkerUrl(worker.default);
```
Also: maplibre's CSS sets `.maplibregl-map { position: relative }`, which beats Tailwind's `absolute inset-0`
on the same element (the map ends up 0 px tall). Give maplibre an inner `h-full w-full` div.

## 3. Completion dialog over modes (optional)
When a session completes inside a mode, the app's global "Session complete!" dialog opens on top of the mode,
so the train's own arrival card ("Welcome to Darjeeling!") is only seen after "Maybe later". Both work; if you'd
rather let modes own the moment, skip `completion` while `useUI.mode` is set (or let a mode opt out).

## 4. Regenerating the railway data
`python3 src/features/train/tools/build_routes.py [ids...]` (needs `curl`; Overpass answers are cached in
`$TRAIN_OSM_CACHE`). Stations and corridors are curated in `tools/routes_src.py`. After a rebuild, update
`km`/`stops` in `routes.ts` (the platform cards show them without downloading every line).

## 5. Art I could not generate (Gemini kept refusing / failing)
Built without them; everything has a drawn fallback:
- painted train-window frame (`/img/train/frame.webp`): the frame is CSS/SVG (wood, brass trim, rivets, pelmet, curtains)
- painted curtain + chai props: SVG curtains; the chai glass reuses `/img/cafe/chai.webp`
- route vignettes for the platform cards (`RouteInfo.art`): drawn SVG landscapes in each line's colour
