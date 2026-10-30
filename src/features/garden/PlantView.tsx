/**
 * PlantView: one painted potted plant that grows and wilts. Reusable anywhere (garden, idle strip, the
 * "together" shared plant, ...).
 *
 *   import { PlantView } from '@/features/garden/PlantView';
 *   <PlantView species="sunflower" growth={0.4} wilt={0} size={160} seed="pot-1" />
 *
 * Props
 * - species  'sunflower' | 'tulip' | 'rose' | 'lavender' | 'sakura'   (PLANT_SPECIES lists them)
 * - growth   0..1   (negative = an empty pot) continuous: 0 = a seed in the soil, 1 = full bloom. The plant is PAINTED live by
 *                   render/plants.ts (Canvas 2D) as a smooth function of growth: stems lengthen, leaves unfold, buds
 *                   swell, petals open one by one. No stage images, nothing swaps.
 * - wilt     0..1   0 = healthy, 1 = very droopy (paler olive greens, leaves sag, leans).
 * - seed     number | string   makes this plant unique (shape wobbles, leaf count/angles); same seed = same plant.
 * - size     px     height of the box. Width is size * PLANT_RATIO.
 * - sway     boolean (default true) gentle breeze sway (CSS only; off with prefers-reduced-motion).
 *
 * Cheap on purpose: the painter (≈ 25 KB) is loaded lazily on first use; a repaint (~3-8 ms) only happens when growth
 * changed visibly, at most 4 times a second; big jumps (opening the garden) are tweened; nothing is painted while the tab
 * is hidden. The pot is a plain lazy <img> under the canvas.
 */
import { useEffect, useInsertionEffect, useRef, useState, type CSSProperties } from 'react';
import { BOX_H, BOX_W, PLANT_INFO, PLANT_RATIO, PLANT_READY, PLANT_SPECIES, POT, SOIL_Y, STAGE_AT, STAGE_NAMES, plantTop, plantTopAt, stageOf, type PlantSpeciesId } from './growth';

// the light, shared bits other features already import from here
export { PLANT_INFO, PLANT_RATIO, PLANT_READY, PLANT_SPECIES, STAGE_AT, STAGE_NAMES, plantTop, plantTopAt, stageOf };
export type { PlantSpeciesId };

const SOIL = SOIL_Y / BOX_H;

const CSS = `
@keyframes pv-sway { 0%,100% { transform: skewX(-1.5deg) } 50% { transform: skewX(1.5deg) } }
.pv-sway { animation: pv-sway var(--pv-sway, 6s) ease-in-out infinite; transform-origin: 50% ${SOIL * 100}%; }
.pv-paused .pv-sway { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .pv-sway { animation: none; } }
`;
let injected = false;
function useStyles() {
  useInsertionEffect(() => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const el = document.createElement('style');
    el.dataset.plantView = '';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

type Painter = typeof import('./render/plants');
let painterP: Promise<Painter> | null = null;
let painterM: Painter | null = null;
const loadPainter = () => (painterP ??= import('./render/plants').then((m) => (painterM = m)));

const hashStr = (s: string | number) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 1000003;
};

export interface PlantViewProps {
  species: PlantSpeciesId;
  /** 0 = seed, 1 = full bloom (continuous) */
  growth: number;
  /** 0 = healthy, 1 = very droopy */
  wilt?: number;
  /** makes the plant unique */
  seed?: number | string;
  /** box height in px (width = size * PLANT_RATIO) */
  size: number;
  sway?: boolean;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

const MIN_STEP = 0.0004;
const MIN_GAP_MS = 250;

export function PlantView({ species, growth, wilt = 0, seed, size, sway = true, className, style, alt }: PlantViewProps) {
  useStyles();
  const sp = PLANT_INFO[species] && PLANT_READY[species] ? species : 'sunflower';
  const empty = growth < 0;
  const g = empty ? 0 : Math.min(1, Math.max(0, growth || 0));
  const w = Math.min(1, Math.max(0, wilt || 0));
  const wq = Math.round(w * 10) / 10;
  const sd = hashStr(seed ?? sp);
  const [ready, setReady] = useState(!!painterM);
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef({ shown: -1, last: 0, timer: 0, tween: 0, key: '', target: g });
  st.current.target = g;
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const ph = Math.max(60, Math.min(900, Math.round(size * dpr)));
  const pw = Math.round(ph * PLANT_RATIO);

  useEffect(() => {
    if (painterM) return;
    let off = false;
    loadPainter().then(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);

  // paint now (full repaint when the look-defining props changed)
  useEffect(() => {
    if (!ready || !painterM || !cv.current) return;
    const c = cv.current;
    const s = st.current;
    const key = `${sp}|${sd}|${wq}|${ph}|${empty}`;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const paint = (v: number) => {
      s.shown = v;
      s.last = performance.now();
      if (empty) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
      else painterM!.paintPlant(c, { species: sp, g: v, seed: sd, wilt: wq });
    };
    const stop = () => {
      clearTimeout(s.timer);
      cancelAnimationFrame(s.tween);
      s.timer = 0;
      s.tween = 0;
    };
    const request = () => {
      stop();
      if (document.hidden) return; // repainted on visibilitychange
      const target = s.target;
      const first = s.key !== key || s.shown < 0;
      s.key = key;
      if (first) {
        c.width = pw;
        c.height = ph;
        paint(target);
        return;
      }
      const d = target - s.shown;
      if (Math.abs(d) < MIN_STEP) return;
      if (Math.abs(d) > 0.02 && !reduced) {
        // a big jump (opening the garden, changing pot): grow into it over ~0.8 s
        const from = s.shown;
        const t0 = performance.now();
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / 800);
          const e = 1 - (1 - k) ** 3;
          if (performance.now() - s.last > 40 || k === 1) paint(from + (s.target - from) * e);
          if (k < 1) s.tween = requestAnimationFrame(step);
        };
        s.tween = requestAnimationFrame(step);
        return;
      }
      const wait = MIN_GAP_MS - (performance.now() - s.last);
      if (wait <= 0) paint(target);
      else s.timer = window.setTimeout(request, wait);
    };
    const vis = () => !document.hidden && request();
    document.addEventListener('visibilitychange', vis);
    request();
    return () => {
      document.removeEventListener('visibilitychange', vis);
      stop();
    };
  }, [ready, sp, sd, wq, ph, pw, g, empty]);

  const doSway = sway && w < 0.6;
  const delay = `-${(sp.length * 0.7 + (sd % 7)) % 6}s`;
  const stage = stageOf(g);
  return (
    <div
      role="img"
      aria-label={alt ?? `${PLANT_INFO[sp].name}, ${stage.name.toLowerCase()}${w > 0.3 ? ', thirsty' : ''}`}
      className={className}
      style={{ position: 'relative', height: size, width: Math.round(size * PLANT_RATIO), flexShrink: 0, ...style }}
    >
      <img
        src="/img/garden/pot.webp"
        alt=""
        draggable={false}
        decoding="async"
        loading="lazy"
        style={{ position: 'absolute', left: `${(POT.x / BOX_W) * 100}%`, top: `${(POT.y / BOX_H) * 100}%`, width: `${(POT.w / BOX_W) * 100}%`, height: `${(POT.h / BOX_H) * 100}%`, userSelect: 'none', pointerEvents: 'none' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: `50% ${SOIL * 100}%`,
          transform: `scaleY(${1 - 0.1 * w}) skewX(${-7 * w}deg)`,
          transition: 'transform 1.6s cubic-bezier(.3,1.4,.5,1)',
          opacity: ready ? 1 : 0,
        }}
      >
        <div className={doSway ? 'pv-sway' : undefined} style={{ position: 'absolute', inset: 0, animationDelay: delay }}>
          <canvas ref={cv} width={pw} height={ph} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
}

export default PlantView;
