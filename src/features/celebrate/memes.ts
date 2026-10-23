/** Meme pop-up images, built by tools/memes/make.sh into /img/memes/<kind>-<n>.webp */
export type MemeKind = 'start' | 'done' | 'quit';

const COUNTS: Record<MemeKind, number> = { start: 20, done: 20, quit: 20 };
const last: Partial<Record<MemeKind, number>> = {};
const queued: Partial<Record<MemeKind, string>> = {};

function roll(kind: MemeKind) {
  const n = COUNTS[kind];
  let i: number;
  do i = 1 + Math.floor(Math.random() * n);
  while (n > 1 && i === last[kind]);
  last[kind] = i;
  return `/img/memes/${kind}-${i}.webp`;
}

function queue(kind: MemeKind) {
  const src = roll(kind);
  queued[kind] = src;
  new Image().src = src;
}

/** A meme for this moment; the next one is preloaded so pop-ups appear instantly. */
export function takeMeme(kind: MemeKind) {
  const src = queued[kind] ?? roll(kind);
  queue(kind);
  return src;
}

export const preloadMemes = () => (['start', 'done', 'quit'] as const).forEach(queue);
