# YouFloww v4 — rules for every feature agent

You are one of several agents building YouFloww features **at the same time in the same folder**
(`~/Desktop/YouFloww`, Vite 7 + React 19 + TypeScript + Tailwind v4 + zustand + motion/react + lucide-react).
The lead (main session) integrates everything at the end. Follow these rules exactly.

## 1. Your folder, and only your folder
- Build everything in `src/features/<your-feature>/` (and `public/<your-feature>/` for assets, if given).
- Do **not** edit shared files: `src/App.tsx`, `src/store/*`, `src/lib/bus.ts`, `src/features/registry.ts`,
  `src/features/shell/*`, `src/styles/index.css`, `vite.config.ts`, `package.json`, other agents' folders.
  Exceptions are named in your own brief.
- Need a shared change (a new bus event, a store field, a Dock button, CSS, a vite setting, Firebase rules)?
  Write the exact change into `src/features/<your-feature>/INTEGRATION.md` and keep going. The lead applies it.
- No `npm install` (installed already: maplibre-gl, pdfjs-dist, docx-preview, jszip, pptx-preview, firebase, motion,
  idb-keyval, lucide-react). Need another package? Put it in INTEGRATION.md and do without.
- No git commits, pushes, deploys or Firebase-console changes.

## 2. How a feature plugs in (no shared edits needed)
- `src/features/<x>/meta.ts` exports `meta: FeatureMeta` (see `src/features/registry.ts`). It is loaded eagerly,
  so it must import nothing but the type. `load: () => import('./YourEntry')` points at a default-exported component.
- `kind: 'mode'`: a full-screen place. Render `fixed inset-0 z-[45]` (see `src/features/cafe/Cafe.tsx`, a finished
  mode to copy patterns from). Close with `useUI.getState().set({ mode: null })`. It appears in the Worlds launcher
  (dock ✨ button, key W) and the command menu automatically.
- `kind: 'layer'`: something living on top of the normal app (shown when switched on in the launcher, hidden while a
  mode is open). Use `pointer-events-none` on the wrapper and enable pointer events only on interactive bits; never
  cover the timer or the dock; stay below panels (z-index ≤ 30).
- Saved state: `useFeatureData / getFeatureData / updateFeatureData` (`src/lib/featureData.ts`) under ONE key
  for your feature. Synced to the cloud when signed in. Keep it small (no images, no long logs).
- Coins: `src/features/economy/wallet.ts` (`useWallet, earn, spend, buy, giveItem, takeItem, itemCount`).
  Fish coins 🐟 are earned automatically (1 per focused minute). No other currencies.
- Events: `bus.on(...)` from `src/lib/bus.ts`: `session:start|complete|early`, `break:complete`, `task:done`,
  `tab:away|back` (left the tab mid-session), `wallet:earn|spend`, `mode:open|close`, `mascot:say`, `confetti`,
  `cat:event`. Timer state: `useTimer` (`src/store/timer.ts`), `useTimerView()` from `src/features/timer/TimerOrb.tsx`,
  actions in `src/features/timer/engine.ts` (`start`, `pause`, `toggle`, `requestEnd`, `requestFocusFor(min, label, task, emoji)`).
- UI kit: `src/ui/primitives.tsx` (Button, IconButton, Switch, Slider, Segmented), `src/ui/Sheet.tsx` (Dialog, Sheet),
  `toast()` from `src/store/ui.ts`, `glass`/`glass-strong`/`pressable`/`tabular` utilities, theme tokens
  (`bg-bg text-ink text-muted bg-surface bg-accent text-accent ...`). Works in 7 themes incl. dark (midnight, nebula).

## 3. Fast and light (the user's top rule: "the website should never hang")
- Nothing of yours loads until it is needed: heavy libraries (maplibre, pdf.js, docx-preview, pptx-preview, firebase
  database) only via `await import()` inside your entry, never at module top level of anything eager.
- Unmount = stop everything: cancel requestAnimationFrame, intervals, timeouts, audio nodes, listeners, `map.remove()`,
  Firebase listeners/`goOffline`. Pause animation loops while `document.hidden`.
- Images: WebP, backgrounds ≤ 300 KB, sprites/items ≤ 80 KB, `loading="lazy"`/`decoding="async"`. Prefer CSS/GSAP
  transforms over layout changes. Respect `prefers-reduced-motion`.
- `npm run build` must keep your code in its own chunk(s); the main `index-*.js` must not grow by more than a few KB.

## 4. Look and feel ("each and everything perfect and beautiful")
- Cozy, cute, premium. Fonts: Fredoka (display, `font-display`) and Nunito. Rounded, soft shadows, springy motion.
- House art style (the user LOVES it): soft hand-painted watercolour with delicate warm-brown ink outlines, cream /
  peach / pink / terracotta / sage palette, a hint of lavender in shadows. See `public/img/cafe/*.webp`.
  The cat is the app's own cartoon sprite art (`public/img/cat/*.webp`, 336×288 frames in horizontal strips).
- New art: generate it, never copy art from other apps or games.
  - `ask gimage "detailed prompt" -o out.png -a 1:1 [-i reference.png]` = Gemini (preferred, real aspect ratios;
    add `-i public/img/cafe/interior.webp` to match the house style). It leaves a faint ✦ watermark in the bottom-right
    corner: crop or paint it out.
  - `ask image "detailed prompt" -o out.png` = ChatGPT (only ~4 a day; can do transparent PNG backgrounds).
  - Calls are queued by a lock (other agents use the same browser): they can take a few minutes. Batch several
    items into one sheet image when you can (e.g. "6 furniture pieces in a 3×2 grid on pure white") and cut them out
    (`python3` + Pillow/numpy are installed). LOOK at every image before using it; regenerate if it's off.
  - Convert: `magick in.png -resize ... -quality 82 out.webp`.
- Code/data from GitHub or elsewhere: only permissive licences (MIT, BSD, Apache-2.0, CC0, CC-BY with credit).
  List every source + licence in `src/features/<x>/CREDITS.md`.
- Polish: empty states, loading states, mobile (390 px wide) AND desktop, keyboard + aria labels, dark themes.

## 5. Testing
- Run your OWN dev server on the port in your brief: `npx vite --port <PORT> --strictPort --host 127.0.0.1`
  (5173 is the user's, 5180 the lead's). Stop it when done: `pkill -f "vite --port <PORT>"`.
- Drive it with Python Playwright (headless). Before reloading set
  `localStorage['floww:prefs'] = '{"state":{"lastSeenVersion":"3.0","memePops":false},"version":1}'`, then press Escape.
  Open your mode with `useUI` via the launcher (key W) or your mode's key.
- Type check: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "src/features/<your-feature>"` — fix only YOUR errors
  (other agents are mid-edit in other folders).
- Look at screenshots of every screen you build, desktop 1280×800 and phone 390×844, light and a dark theme.

## 6. When you finish
Reply with: what you built (plain words), how to open/use it, files, screenshots you checked, anything in
INTEGRATION.md, and honest known limits. Keep your dev server stopped.
