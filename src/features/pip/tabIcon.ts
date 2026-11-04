/**
 * The browser tab shows the session too: while a session runs, the favicon becomes a progress ring with the cat
 * running inside it (the steam engine on a train ride), and on a train ride the title names the next station.
 * Redrawn on the timer engine's ticks (a worker), which keep coming while the tab is in the background.
 * Back to the normal icon when the timer is idle.
 */
import { formatClock } from '@/lib/time';
import { remainingAt, useClock, useTimer, type Mode } from '@/store/timer';
import { useCat } from '../cat/brain';
import { stripUrl, stripUrlNow, type StripFile } from '../cat/skins';
import { setTitleFor } from '../timer/engine';
import { rideNow, trainNow } from './trainNow';

const SIZE = 64;
let canvas: HTMLCanvasElement | null = null;
let link: HTMLLinkElement | null = null;
let original: { href: string; type: string } | null = null;
let frame = 0;
let lastFrameAt = 0;
let lastUrl = '';

const images = new Map<string, HTMLImageElement>();
function ready(url: string) {
  let i = images.get(url);
  if (!i) {
    i = new Image();
    i.src = url;
    images.set(url, i);
  }
  return i.complete && i.naturalWidth ? i : null;
}
function catStrip(file: StripFile) {
  const skin = useCat.getState().skin;
  const url = stripUrlNow(skin, file);
  if (url) return ready(url);
  void stripUrl(skin, file);
  return null;
}

function restore() {
  if (link && original) {
    link.href = original.href;
    link.type = original.type;
  }
  original = null;
  lastUrl = '';
}

function draw() {
  const s = useTimer.getState();
  if (s.status === 'idle') return restore();
  link ??= document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  original ??= { href: link.href, type: link.type };
  canvas ??= Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const now = Date.now();
  const running = s.status === 'running';
  const focus = s.mode === 'focus';
  const p = Math.min(1, Math.max(0, 1 - remainingAt(s, now) / Math.max(1, s.durationMs)));
  const train = focus ? trainNow() : null;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (running && !still && now - lastFrameAt >= 200) {
    frame++;
    lastFrameAt = now;
  }

  ctx.clearRect(0, 0, SIZE, SIZE);
  // a light disc, so the icon reads on dark and light tab strips alike
  ctx.fillStyle = 'rgba(255,255,255,.94)';
  ctx.beginPath();
  ctx.arc(32, 32, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(40,30,60,.14)';
  ctx.beginPath();
  ctx.arc(32, 32, 27, 0, Math.PI * 2);
  ctx.stroke();
  if (p > 0) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    ctx.strokeStyle = train?.color || accent || '#8b6cf0';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(32, 32, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
  }

  if (train) {
    // the locomotive (x 385-635 of the strip's train picture), bouncing along
    const img = ready('/img/strip/train.webp');
    if (img) {
      const bob = running && !still ? (frame % 2) * 1.2 : 0;
      ctx.drawImage(img, 385, 0, 250, 180, 11, 19 - bob, 42, 30);
    }
  } else {
    const file: StripFile = focus && running ? 'run' : 'idle';
    const img = catStrip(file);
    if (img) {
      const n = file === 'run' ? 8 : 10;
      const fw = img.naturalWidth / n;
      const f = file === 'run' ? frame % n : 0;
      ctx.drawImage(img, f * fw, 0, fw, img.naturalHeight, 9, 12, 46, 40);
    }
  }

  const url = canvas.toDataURL('image/png');
  if (url === lastUrl) return;
  lastUrl = url;
  link.type = 'image/png';
  link.href = url;
}

/** On a train ride: "🚂 18:20 · Next: Rogers Pass". Other sessions keep the engine's usual title. */
function trainTitle(rem: number, mode: Mode) {
  const t = mode === 'focus' ? trainNow() : null;
  if (!t) return null;
  const { next } = rideNow(t);
  const clock = formatClock(rem);
  if (useTimer.getState().status === 'paused') return `⏸ ${clock} · Stopped at a signal — YouFloww`;
  const last = t.geo.stations[t.geo.stations.length - 1];
  return `🚂 ${clock} · ${next ? `Next: ${next.name}` : `Arriving at ${last?.name ?? t.name}`}`;
}

let started = false;
/** Start the live tab icon and title (once, for the life of the page). */
export function startTabIcon() {
  if (started || typeof document === 'undefined') return;
  started = true;
  setTitleFor(trainTitle);
  useClock.subscribe(draw);
  useTimer.subscribe((s, prev) => {
    if (s.status !== prev.status || s.mode !== prev.mode || s.sessionStartedAt !== prev.sessionStartedAt) draw();
  });
  draw();
}
