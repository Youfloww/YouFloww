# Focus music: integration notes

The layer registers itself (`meta.ts`, kind 'layer', off by default, shown via the Worlds launcher). No shared
edits are required. Optional extras for the lead:

## 1. Sounds-panel hook
In `SoundsPanel.tsx`, next to the "Focus beats" 40 Hz card, add a card that switches the layer on and opens its card:

```ts
import { updateFeatureData } from '@/lib/featureData';
// ...how the launcher stores layer on/off: use the same helper the Launcher uses to toggle 'focusmusic'
<button onClick={() => { enableLayer('focusmusic'); updateFeatureData('focusmusic', {}, d => { d.open = true; }); }}>
  🧠 Focus music: brain-tuned beds (Deep focus, Calm, ...)
</button>
```
(`enableLayer` = whatever Launcher.tsx uses to turn a layer on.) Note: the 40 Hz Focus beats track and this layer
can play together; consider muting one when the other starts.

## 2. Extension hand-off (extension/)
The new-tab timer links to `/?focus=25&label=...`. On app boot (App.tsx) you could add:
```ts
const q = new URLSearchParams(location.search);
const m = Number(q.get('focus'));
if (m > 0) { requestFocusFor(m, q.get('label') ?? '', null, '🎯'); history.replaceState(null, '', location.pathname); }
```
(use the real signature of `requestFocusFor(min, label, task, emoji)` from `timer/engine.ts`.)

## 3. Misc
- Honest framing: it is "focus-tuned modulation" (rhythmic amplitude modulation of music, 8-16 Hz). No medical claim.
- Depth is capped at 60% and uses a sine LFO, so loudness never drops to silence (smooth, never harsh).
- The visual pulse is a slow 4 s breathing glow on purpose; flashing at 8-16 Hz would be a photosensitivity risk.
- Audio files: `public/sounds/focusmusic/{lofi,piano,pads,synth}.mp3` (original, generated with MusicGen).
