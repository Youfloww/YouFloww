# Cat life + Cat's Home: integration notes

Nothing here is required for the feature to work: the Cat's Home is a normal `kind: 'mode'` feature
(`meta.ts`, key **H**, order 20) and the study corner / care card live inside the existing CatWorld.

## Recommended (small, shared file): count sessions while a mode is open
`CatWorld` is unmounted while any mode is open (`{showCat && !mode && <CatWorld />}` in `App.tsx`), so a
focus session that finishes inside the Café (or any other mode) never reaches the cat's brain: no bond xp,
no free treat, and her knitting/reading piece is only finished later (when she comes back on screen; this
part is already handled by `settleStudy()` on mount).

Fix: start the cat's always-on bookkeeping once at startup, next to `startEarnings()`:

```ts
// wherever startEarnings() is called (app startup)
import { startCatLife } from '@/features/cat/life';
startCatLife();
```

`life.ts` is tiny (brain + study bookkeeping, no UI). It is safe next to CatWorld's and the Cat's Home's own
listeners: `onSessionDone` / `onSessionEarly` count each session once (keyed by its start time) and
`settleStudy()` hands every listener the same finished piece.
Note: it pulls `cat/brain.ts` (zustand persist store, ~4 KB) into the main chunk.

## Data
- `data.catHome` (via `updateFeatureData`): `{ project, made[], n, room, rooms[], place{room:{slot:item}} }`.
  `made` is capped at 300 small entries (~40 bytes each).
- Wallet items used: `cat:fish|milk|tuna|salmon|cake|catnip` (snacks), `home:<itemId>` (furniture).

## Assets
- `public/img/cathome/*.webp`: study props, snacks, furniture, four room paintings.
