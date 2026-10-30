# Garden credits

- The garden background and pot in `public/img/garden/` were generated for
  YouFloww with Google Gemini image generation (2026-10), then cut out, cleaned (watermark removed) and converted
  to WebP with our own Pillow / numpy / scipy / OpenCV script. No third-party art was copied.
- Butterflies, bee, watering can and the fallback garden drawing are hand-written SVG in this folder.
- Code: written for YouFloww (no external sources).

- Plants are painted live by `render/plants.ts`, `render/paint.ts`, `render/flower3d.ts` (written for YouFloww). Techniques
  credited: layered translucent washes with edge pooling, after Tyler Hobbs, "A Guide to Simulating Watercolor Paint with
  Generative Art" (technique only, no code copied); leaf/petal as bent midrib + width profile, after LingDong Huang's
  "nonflowers" (MIT, idea only); sunflower seed spiral = Vogel's golden-angle phyllotaxis (public formula).
- The old per-stage WebP paintings (species-0..6) were removed; they are in git history.
