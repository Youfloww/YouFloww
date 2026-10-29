# Study Desk + Floating buddy: integration notes for the lead

Nothing here is required for the features to work. The mode registers itself through `meta.ts`
(key **U**), and the floating buddy keeps the old `usePip()` / `<PipPortal win>` API, so `App.tsx` works unchanged.
These are polish and performance items in shared files I'm not allowed to edit.

## 1. Names in the shell (Dock.tsx, CommandPalette.tsx, HelpDialog.tsx)
The pop-out is now the **Floating buddy**: a cat, the timer, play/pause and the current task, floating over any app.
- `src/features/shell/Dock.tsx`: change the label `'Pop-out timer'` to `'Floating buddy'`.
- `src/features/shell/CommandPalette.tsx`: change `'Pop-out timer (Picture-in-Picture)'` to
  `'Floating buddy (stays on top of any app)'`.
- `src/features/panels/HelpDialog.tsx`: describe **O** as "Floating buddy". If mode keys are listed, add **U = Study Desk**.
  Keys inside the desk: ←/→ or PgUp/PgDn turn pages, ↑/↓ scroll, + / − zoom, 0 fits the width, Home/End,
  O pops the buddy out or back in, Esc goes back to the desk (Esc again leaves the mode). Ctrl/⌘ + wheel zooms the document.

## 2. (Optional) Let the O key explain itself on browsers without Document PiP
`App.tsx` currently passes `pip.supported ? pip.open : undefined`, so on Firefox and Safari the O key does nothing.
`pip.open` (`toggleBuddy`) now shows a friendly toast when the API is missing, so this is safe:
```diff
-  useShortcuts(pip.supported ? pip.open : undefined);
+  useShortcuts(pip.open);
```
Keep the dock button hidden when unsupported (as it is now). Phones never support it.

## 3. Studying in another app is not "leaving the tab" (FeatureHosts.tsx)
With the buddy floating, people deliberately switch to a PDF reader or Word. The tab presence events then shouldn't
make the cat sad or the plants wilt. In `src/features/shell/FeatureHosts.tsx`, `useTabPresence()`:
```diff
+import { isBuddyOpen } from '../pip/PipTimer';
 ...
-      const focusing = t.mode === 'focus' && t.status === 'running';
+      // the floating buddy is open: they're studying in another app, not wandering off
+      const focusing = t.mode === 'focus' && t.status === 'running' && !isBuddyOpen();
```

## 4. Keep the big reader libraries out of the PWA install (vite.config.ts)
`workbox.globPatterns` precaches every `.js`, so installing the app would also download the readers (pdf.js 437 KB,
pptx-preview 1.25 MB, docx-preview 76 KB, jszip). They are only needed when someone opens a file of that kind:
```diff
-        globIgnores: ['**/*{cyrillic,greek,hebrew,vietnamese}*.woff2', '**/img/memes/**', '**/img/cafe/**'],
+        globIgnores: ['**/*{cyrillic,greek,hebrew,vietnamese}*.woff2', '**/img/memes/**', '**/img/cafe/**',
+          '**/assets/pdf-*.js', '**/assets/pptx-preview*.js', '**/assets/docx-preview*.js', '**/assets/jszip*.js'],
```
and cache them after first use (add to `runtimeCaching`):
```ts
{
  urlPattern: ({ url }) => /\/assets\/(pdf-|pdf\.worker|pptx-preview|docx-preview|jszip)/.test(url.pathname),
  handler: 'CacheFirst',
  options: { cacheName: 'floww-readers', expiration: { maxEntries: 12 } },
},
```
(`pdf.worker.min-*.mjs`, 1.26 MB, is already outside `globPatterns`.)

## 5. (Optional, recommended) Drop echarts from the PowerPoint chunk (vite.config.ts)
pptx-preview imports all of `echarts` only to draw charts inside slides, which it does badly (in tests: empty bars and a
Chinese placeholder title). Aliasing it to the tiny stand-in in this folder shrinks the PowerPoint chunk from
**1.25 MB to 215 KB** (57 KB gzip); charts then show as a tidy "📊 Chart" card. Nothing else in the app uses echarts.
```diff
-  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
+  resolve: {
+    alias: {
+      '@': fileURLToPath(new URL('./src', import.meta.url)),
+      echarts: fileURLToPath(new URL('./src/features/studydesk/echarts-lite.ts', import.meta.url)),
+    },
+  },
```

## 6. (Optional) pdf.js extras for unusual PDFs (public/)
CJK PDFs without embedded fonts, PDFs that use the 14 standard fonts without embedding them, and JPEG2000/JBIG2
images look better with pdf.js's data files. The viewer finds them by itself (one HEAD request) if they're copied:
```sh
mkdir -p public/studydesk/pdfjs
cp -R node_modules/pdfjs-dist/cmaps node_modules/pdfjs-dist/standard_fonts node_modules/pdfjs-dist/wasm public/studydesk/pdfjs/
```
About 4 MB on the server; a file is fetched only when a PDF needs it. They're `.bcmap/.pfb/.ttf/.wasm`, so the PWA
precache ignores them. Without the copy, pdf.js falls back to system fonts (fine for normal PDFs).

## Files
- `src/features/pip/PipTimer.tsx`: the shared floating-buddy window (`usePip`, `PipPortal`, `openBuddy`,
  `closeBuddy`, `toggleBuddy`, `useBuddyWindow`, `isBuddyOpen`, `pipSupported`). Eager but tiny.
- `src/features/pip/FloatingBuddy.tsx`: the window's contents and styles (lazy chunk, 9 KB).
- `src/features/studydesk/*`: the mode (lazy). Each reader is its own chunk.
- Saved data: feature key `studydesk` = `{ paper, sidebar, buddy, pos }` (a few bytes). Files, file names and covers
  live only in this device's IndexedDB (`youfloww-studydesk`), never in synced data.
