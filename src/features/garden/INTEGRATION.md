# Garden + Little garden: shared-file changes for the lead

Both features plug in through their own `meta.ts` (`src/features/garden/meta.ts` = mode, key `n`;
`src/features/gardenstrip/meta.ts` = layer, on by default). Nothing below is required for them to work.

## 1. PWA: don't precache the garden art (vite.config.ts)
`public/img/garden/` now holds only `garden-day.webp` (200 KB) and `pot.webp`; plants are painted live (no stage images).
Only what is on screen is downloaded, so keep them out of the install like the café art:

```ts
// workbox.globIgnores: add
'**/img/garden/**',
// workbox.runtimeCaching: add
{
  urlPattern: ({ url }) => url.pathname.startsWith('/img/garden/'),
  handler: 'CacheFirst',
  options: { cacheName: 'floww-garden', expiration: { maxEntries: 60 } },
},
```

## 2. (optional) Help / shortcuts list
Key `n` opens the Garden (the shell already reads `meta.key`). If HelpDialog lists keys by hand: `N: Garden 🌸`.

## Notes
- Saved state: `data.garden` (`src/features/garden/model.ts`): `{ pot, plants[], spots, freeUsed }`, about 120 bytes
  per grown plant.
- Seeds are wallet items `seed:<species>` (bought with `buy()`); garden spots cost coins via `spend()`.
- Growth follows `data.totalFocusSeconds`, so focus done in other modes (café, etc.) still counts the next time the
  strip or the garden is on screen. No global listener needed.
- `src/features/garden/PlantView.tsx` is the reusable plant for the "together" shared plant: React only,
  documented at the top of the file (`<PlantView species growth wilt size />`).
- The strip keeps clear of the brain-dump button (bottom-right, 80 px) and, on phones, perches on the right part of
  the dock because the cat's study corner uses the left part. If either of those moves, adjust `RIGHT_CLEAR` /
  the perch rule in `src/features/gardenstrip/GardenStrip.tsx` (`usePlacement`).

## Art that could still be nicer (optional, nothing is missing)
- Butterflies, bee and watering can are small inline SVGs (`src/features/garden/sprites.tsx`), drawn in the house
  colours: the image bridge was down when they were due. A painted sheet would match the plants better.
- Night in the garden is the day painting under a moonlit CSS wash, moon, stars and fireflies (no night painting).
- The garden painting is 1024×572 upscaled to 1600 px: a little soft on big desktop screens.

## Live-painted plants (growth rebuild)
- Nothing required. `render/plants.ts` is its own lazy chunk (~30 KB, 13 KB gzip). Main index unchanged.
- Dev contact sheet: `npx vite` then open `/src/features/garden/dev/sheet.html?T=1&g=1` (params: sp, g=list, seed, wilt, k);
  rendered copy at `src/features/garden/dev/contact-sheet.png`. Dev-only `window.__garden.set('rose', 0.5)` fast-forwards the pot.
- `PlantView` gained `seed` (unique look per plant; pass pot/plant id) and `growth={-1}` for an empty pot. Together's usage
  (species, growth, wilt, size) keeps working unchanged.
