/**
 * Watercolour painting primitives for the plant renderer (Canvas 2D).
 *
 * Everything is drawn in "box units": the plant box is 224 × 420 units (see ../growth.ts), the soil surface is at
 * y = SOIL_Y. All randomness is seeded and lives in shape-local parameter space, so a leaf keeps the same wobbles
 * and pigment pools while it grows: nothing flickers between redraws.
 *
 * Techniques (credits in ../CREDITS.md):
 * - layered translucent washes with jittered outlines and darker edge pooling (after Tyler Hobbs' essay
 *   "A Guide to Simulating Watercolor Paint with Generative Art", reduced to a few layers so it stays cheap);
 * - tapered, slightly uneven ink strokes built as filled "tubes" around a polyline, and leaves/petals built
 *   from a bent midrib plus a width profile (ideas adapted from LingDong Huang's nonflowers, MIT).
 */
export type V = [number, number];

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0..1 progress of g through the window [a, b] */
export const win = (g: number, a: number, b: number) => clamp01((g - a) / (b - a));
export const ss = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
export const easeIn = (x: number) => clamp01(x) ** 2;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const TAU = Math.PI * 2;

/** 32-bit integer hash of a few numbers */
export function hash(...n: number[]) {
  let h = 0x9e3779b9;
  for (const v of n) {
    h ^= Math.imul((v * 1000003) | 0, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
/** stateless random 0..1 */
export const rnd = (...n: number[]) => hash(...n) / 4294967296;
/** stateless random in [a, b] */
export const rr = (a: number, b: number, ...n: number[]) => a + (b - a) * rnd(...n);

/** seeded sequence (mulberry32) for building plans */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(next, {
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    sign: () => (next() < 0.5 ? -1 : 1),
  });
}
export type Rng = ReturnType<typeof rng>;

/** smooth 1D value noise in [-1, 1] */
export function noise(seed: number, x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const a = rnd(seed, i) * 2 - 1;
  const b = rnd(seed, i + 1) * 2 - 1;
  return a + (b - a) * f * f * (3 - 2 * f);
}

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */
export type C = [number, number, number];
export const hex = (h: string): C => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a: C, b: C, t: number): C => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgba = (c: C, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
/** a palette for one painted shape: light side, body, shadow side */
export interface Pal {
  lt: C;
  md: C;
  dk: C;
}
export const pal = (lt: string, md: string, dk: string): Pal => ({ lt: hex(lt), md: hex(md), dk: hex(dk) });
export const mixPal = (a: Pal, b: Pal, t: number): Pal => (t <= 0 ? a : t >= 1 ? b : { lt: mix(a.lt, b.lt, t), md: mix(a.md, b.md, t), dk: mix(a.dk, b.dk, t) });
/** thirst: greens go olive and a little paler */
const DRY: Pal = pal('#d8cf98', '#a8a064', '#6f6a3e');
export const wiltPal = (p: Pal, w: number) => mixPal(p, DRY, w * 0.42);
/** tiny per-organ hue drift so no two leaves are the same colour */
export const vary = (p: Pal, seed: number, amt = 10): Pal => {
  const d = (rnd(seed, 7) * 2 - 1) * amt;
  const e = (rnd(seed, 8) * 2 - 1) * amt * 0.6;
  const f = (c: C): C => [c[0] + d * 0.6 + e, c[1] + d, c[2] + d * 0.3 - e];
  return { lt: f(p.lt), md: f(p.md), dk: f(p.dk) };
};

export const INK: C = hex('#5b3f2c');

/* ------------------------------------------------------------------ */
/* Painter                                                             */
/* ------------------------------------------------------------------ */
export interface Painter {
  c: CanvasRenderingContext2D;
  /** css px per unit (decides line weights and level of detail) */
  css: number;
  /** base ink width in units */
  ink: number;
  /** 0 tiny (strip on phones), 1 small, 2 full detail */
  lod: 0 | 1 | 2;
  /** thirst 0..1 */
  wilt: number;
}

export function painter(c: CanvasRenderingContext2D, css: number, wilt: number): Painter {
  // ink about 0.8 css px on small plants, up to ~1.3 px on big ones
  const ink = Math.max(1.15, 0.78 / css);
  const lod = css < 0.3 ? 0 : css < 0.55 ? 1 : 2;
  return { c, css, ink, lod, wilt };
}

export function trace(c: CanvasRenderingContext2D, pts: V[], close = true) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (close) c.closePath();
}

export function bbox(pts: V[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

const centroid = (pts: V[]): V => {
  let x = 0,
    y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
};

/** the outline pulled towards its centre and wobbled (stable per seed) */
function glazeOf(pts: V[], seed: number, shrink: number, wob: number, dx: number, dy: number): V[] {
  const [cx, cy] = centroid(pts);
  const n = pts.length;
  return pts.map(([x, y], i) => {
    const t = i / n;
    const j = 1 - shrink * (0.75 + 0.5 * (noise(seed, t * 7) * 0.5 + 0.5));
    return [cx + (x - cx) * j + dx + noise(seed + 3, t * 9) * wob, cy + (y - cy) * j + dy + noise(seed + 5, t * 9) * wob];
  });
}

export interface WashOpts {
  seed: number;
  alpha?: number;
  /** gradient from → to (defaults: the shape's top-left → bottom-right, light from the top-left) */
  from?: V;
  to?: V;
  /** pigment pooling at the edge (0..1) */
  rim?: number;
  /** extra glaze layers */
  glaze?: boolean;
}

/** One watercolour shape: a graded wash, a lighter and a darker glaze, darker pooled edges. */
export function wash(P: Painter, pts: V[], p: Pal, o: WashOpts) {
  const c = P.c;
  const a = o.alpha ?? 1;
  let from = o.from;
  let to = o.to;
  if (!from || !to) {
    const b = bbox(pts);
    from = [b.x0, b.y0];
    to = [b.x1, b.y1];
  }
  const g = c.createLinearGradient(from[0], from[1], to[0], to[1]);
  g.addColorStop(0, rgba(p.lt, 0.94 * a));
  g.addColorStop(0.55, rgba(p.md, 0.94 * a));
  g.addColorStop(1, rgba(p.dk, 0.94 * a));
  trace(c, pts);
  c.fillStyle = g;
  c.fill();
  if (o.glaze !== false && P.lod > 0) {
    const b = bbox(pts);
    const s = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    // a lighter glaze where the light hits, a darker one in the shade
    trace(c, glazeOf(pts, o.seed, 0.28, s * 0.03, -s * 0.05, -s * 0.05));
    c.fillStyle = rgba(p.lt, 0.32 * a);
    c.fill();
    trace(c, glazeOf(pts, o.seed + 11, 0.2, s * 0.04, s * 0.07, s * 0.06));
    c.fillStyle = rgba(p.dk, 0.14 * a);
    c.fill();
  }
  const rim = o.rim ?? 0.5;
  if (rim > 0) {
    trace(c, pts);
    c.strokeStyle = rgba(p.dk, 0.5 * rim * a);
    c.lineWidth = P.ink * 0.9;
    c.lineJoin = 'round';
    c.stroke();
  }
}

/** Soft round wash (shadows, glows, blossom clouds). */
export function blob(P: Painter, x: number, y: number, rx: number, ry: number, col: C, a: number, rot = 0) {
  const c = P.c;
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.6, rgba(col, a * 0.55));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rx, 0, TAU);
  c.fill();
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Ink                                                                 */
/* ------------------------------------------------------------------ */
/** Polygon around a polyline with width w(t) (t = 0..1 along it). */
export function tube(pts: V[], w: (t: number, i: number) => number): V[] {
  const n = pts.length;
  const L: V[] = [];
  const R: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const hw = w(n > 1 ? i / (n - 1) : 0, i) / 2;
    L.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
    R.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  return L.concat(R.reverse());
}

/** A hand-inked line: tapered ends, slightly uneven pressure. */
export function inkLine(P: Painter, pts: V[], seed: number, o: { w?: number; alpha?: number; col?: C; taper?: number } = {}) {
  if (pts.length < 2) return;
  const w = (o.w ?? 1) * P.ink;
  const tp = o.taper ?? 1;
  const poly = tube(pts, (t) => {
    const end = Math.min(1, Math.min(t, 1 - t) * (6 / tp));
    return w * (0.25 + 0.75 * Math.sqrt(end)) * (0.8 + 0.35 * noise(seed, t * 5));
  });
  trace(P.c, poly);
  P.c.fillStyle = rgba(o.col ?? INK, o.alpha ?? 0.82);
  P.c.fill();
}

/** Ink round a closed outline in two or three strokes with tiny gaps (a drawn line, not a vector border). */
export function inkOutline(P: Painter, pts: V[], seed: number, o: { w?: number; alpha?: number; col?: C } = {}) {
  const n = pts.length;
  if (n < 4) return;
  const parts = P.lod === 0 ? 1 : 2 + (rnd(seed, 1) < 0.4 ? 1 : 0);
  const start = Math.floor(rnd(seed, 2) * n);
  const gap = Math.max(1, Math.round(n * 0.035));
  const len = Math.floor(n / parts);
  for (let k = 0; k < parts; k++) {
    const seg: V[] = [];
    const a = start + k * len;
    const b = a + len - (parts > 1 ? gap : 0) + (parts === 1 ? 1 : 0);
    for (let i = a; i <= b; i++) seg.push(pts[i % n]);
    inkLine(P, seg, seed + k * 17, o);
  }
}

/** a thin plain stroke (veins, striations) */
export function line(P: Painter, pts: V[], col: C, a: number, w: number) {
  const c = P.c;
  trace(c, pts, false);
  c.strokeStyle = rgba(col, a);
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

/* ------------------------------------------------------------------ */
/* Leaves & petals: a bent midrib + a width profile                    */
/* ------------------------------------------------------------------ */
export interface BladeSpec {
  /** attachment point */
  x: number;
  y: number;
  /** screen angle of the midrib at its base (radians; -PI/2 = straight up) */
  ang: number;
  len: number;
  /** max half-width */
  wid: number;
  /** total turn of the midrib (radians; + = clockwise on screen) */
  bend: number;
  /** extra turn concentrated at the tip (curl) */
  curl?: number;
  /** half-width profile 0..1 along the midrib */
  shape: (u: number) => number;
  /** -1..1: one half narrower (blade turned / folded) */
  turn?: number;
  /** serration: teeth per side and depth (fraction of width) */
  teeth?: number;
  toothDepth?: number;
  /** points along the midrib */
  n?: number;
}

export interface Blade {
  mid: V[];
  L: V[];
  R: V[];
  outline: V[];
  /** half-widths along the midrib */
  hw: number[];
  /** midrib normals */
  nx: number[];
  ny: number[];
}

export function blade(s: BladeSpec): Blade {
  const n = s.n ?? 18;
  const mid: V[] = [];
  const L: V[] = [];
  const R: V[] = [];
  const hw: number[] = [];
  const nx: number[] = [];
  const ny: number[] = [];
  let x = s.x;
  let y = s.y;
  const ds = s.len / (n - 1);
  const turn = s.turn ?? 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = s.ang + s.bend * u + (s.curl ?? 0) * u * u * u;
    if (i > 0) {
      x += Math.cos(a) * ds;
      y += Math.sin(a) * ds;
    }
    let w = s.wid * Math.max(0, s.shape(u));
    if (s.teeth && u > 0.12 && u < 0.97) {
      const f = (u * s.teeth) % 1;
      w *= 1 - (s.toothDepth ?? 0.08) * (1 - f * f);
    }
    const ax = -Math.sin(a);
    const ay = Math.cos(a);
    mid.push([x, y]);
    hw.push(w);
    nx.push(ax);
    ny.push(ay);
    L.push([x - ax * w * (1 - Math.max(0, turn) * 0.75), y - ay * w * (1 - Math.max(0, turn) * 0.75)]);
    R.push([x + ax * w * (1 + Math.min(0, turn) * 0.75), y + ay * w * (1 + Math.min(0, turn) * 0.75)]);
  }
  return { mid, L, R, hw, nx, ny, outline: L.concat(R.slice().reverse()) };
}

/** A point on a blade: u along the midrib, v across (-1 = left edge, 1 = right edge). */
export function onBlade(b: Blade, u: number, v: number): V {
  const n = b.mid.length;
  const f = clamp01(u) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const t = f - i;
  const side = v < 0 ? b.L : b.R;
  const m0 = b.mid[i];
  const m1 = b.mid[i + 1];
  const s0 = side[i];
  const s1 = side[i + 1];
  const av = Math.abs(v);
  return [lerp(lerp(m0[0], s0[0], av), lerp(m1[0], s1[0], av), t), lerp(lerp(m0[1], s0[1], av), lerp(m1[1], s1[1], av), t)];
}

/** Common leaf outlines */
export const SHAPE = {
  /** ovate with a soft heart base (sunflower, cherry) */
  ovate: (u: number) => (u < 0.34 ? Math.sin((u / 0.34) * (Math.PI / 2)) ** 0.8 : Math.max(0, Math.cos(((u - 0.34) / 0.66) * (Math.PI / 2))) ** 1.15),
  /** pointed tip (cherry leaves, rose leaflets) */
  elliptic: (u: number) => Math.max(0, Math.sin(Math.PI * u ** 0.85)) ** 0.9 * (1 - 0.35 * u ** 3),
  /** long strap (tulip leaves) */
  lance: (u: number) => (u < 0.18 ? 0.55 + 0.45 * Math.sin((u / 0.18) * (Math.PI / 2)) : Math.max(0, Math.cos(((u - 0.18) / 0.82) * (Math.PI / 2))) ** 0.75),
  /** needle-thin (lavender) */
  linear: (u: number) => Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.05))) ** 0.35 * (1 - 0.3 * u),
  /** cotyledon: a rounded oblong */
  oblong: (u: number) => Math.max(0, Math.sin(Math.PI * u)) ** 0.55,
  /** petal widest near the tip */
  obovate: (u: number) => Math.max(0, Math.sin(Math.PI * Math.min(1, u ** 1.45))) ** 0.7,
};

export interface LeafPaint {
  pal: Pal;
  seed: number;
  /** vein style: 'pinnate' (net), 'parallel' (monocot), 'none' */
  veins?: 'pinnate' | 'parallel' | 'triple' | 'none';
  alpha?: number;
  ink?: number;
}

/** Paint a leaf (or petal) blade: wash, veins, ink. */
export function paintBlade(P: Painter, b: Blade, o: LeafPaint) {
  const len = Math.hypot(b.mid[b.mid.length - 1][0] - b.mid[0][0], b.mid[b.mid.length - 1][1] - b.mid[0][1]);
  if (len < 0.4) return;
  // light from the top-left: across the blade, the upper/left half is lighter
  const a = o.alpha ?? 1;
  const m = b.mid[Math.floor(b.mid.length / 2)];
  const w = Math.max(...b.hw);
  wash(P, b.outline, o.pal, { seed: o.seed, alpha: a, from: [m[0] - w * 1.2 - len * 0.2, m[1] - w * 1.2 - len * 0.2], to: [m[0] + w * 1.1, m[1] + w * 1.1], rim: 0.6 });
  const v = o.veins ?? 'pinnate';
  if (v !== 'none' && P.lod > 0 && len * P.css > 7) {
    const vw = Math.max(0.35, P.ink * 0.42);
    const vein = mix(o.pal.lt, [255, 250, 225], 0.35);
    line(P, b.mid.slice(0, Math.max(2, Math.floor(b.mid.length * 0.93))), vein, 0.75 * a, vw * 1.25);
    if (v === 'parallel') {
      for (const s of [-0.55, -0.25, 0.3, 0.6]) {
        const pts: V[] = [];
        for (let i = 0; i <= 10; i++) pts.push(onBlade(b, 0.04 + i * 0.088, s));
        line(P, pts, o.pal.dk, 0.32 * a, vw * 0.8);
      }
    } else if (P.lod > 1 || len * P.css > 14) {
      const k = v === 'triple' ? 4 : 5;
      for (let j = 0; j < k; j++) {
        const u = 0.14 + (j / k) * 0.66;
        for (const sd of [-1, 1]) {
          const reach = v === 'triple' && j === 0 ? 0.55 : 0.22;
          const p0 = onBlade(b, u, 0);
          const p1 = onBlade(b, u + reach * 0.55, sd * 0.45);
          const p2 = onBlade(b, u + reach, sd * 0.86);
          line(P, [p0, p1, p2], vein, 0.6 * a, vw);
        }
      }
    }
  }
  inkOutline(P, b.outline, o.seed, { w: o.ink ?? 1, alpha: 0.78 * a });
}

/* ------------------------------------------------------------------ */
/* Stems                                                               */
/* ------------------------------------------------------------------ */
/** A painted stem along a polyline: body, light edge, shadow edge, inked sides. */
export function paintStem(P: Painter, pts: V[], w: (t: number) => number, p: Pal, seed: number, o: { ink?: number; alpha?: number } = {}) {
  if (pts.length < 2) return;
  const c = P.c;
  const a = o.alpha ?? 1;
  const body = tube(pts, (t) => w(t));
  trace(c, body);
  c.fillStyle = rgba(p.md, 0.96 * a);
  c.fill();
  // light on the left, shade on the right
  const shift = (f: number, ww: number) => tube(pts.map((q, i) => [q[0] + f * w(i / (pts.length - 1)), q[1]] as V), (t) => w(t) * ww);
  trace(c, shift(-0.22, 0.38));
  c.fillStyle = rgba(p.lt, 0.7 * a);
  c.fill();
  trace(c, shift(0.3, 0.32));
  c.fillStyle = rgba(p.dk, 0.55 * a);
  c.fill();
  const maxW = w(0);
  const iw = o.ink ?? (maxW * P.css < 1.4 ? 0.55 : 0.9);
  if (maxW * P.css < 0.9) {
    // hairline: one ink line down the middle is enough
    inkLine(P, pts, seed, { w: iw * 0.6, alpha: 0.55 * a });
    return;
  }
  const n = pts.length;
  const side = (s: number): V[] =>
    pts.map((q, i) => {
      const a0 = pts[Math.max(0, i - 1)];
      const b0 = pts[Math.min(n - 1, i + 1)];
      const d = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1;
      const hw = w(i / (n - 1)) / 2;
      return [q[0] + (-(b0[1] - a0[1]) / d) * hw * s, q[1] + ((b0[0] - a0[0]) / d) * hw * s] as V;
    });
  inkLine(P, side(1), seed, { w: iw, alpha: 0.72 * a, taper: 0.5 });
  inkLine(P, side(-1), seed + 9, { w: iw * 0.85, alpha: 0.6 * a, taper: 0.5 });
}

/** Follow a curve given by a direction function a(t) from a base point. */
export function curve(x: number, y: number, len: number, a: (t: number) => number, n = 14): V[] {
  const pts: V[] = [[x, y]];
  const ds = len / (n - 1);
  for (let i = 1; i < n; i++) {
    const t = (i - 0.5) / (n - 1);
    const an = a(t);
    x += Math.cos(an) * ds;
    y += Math.sin(an) * ds;
    pts.push([x, y]);
  }
  return pts;
}

/** Point and direction at fraction t of a polyline. */
export function along(pts: V[], t: number): { p: V; a: number } {
  const n = pts.length;
  const f = clamp01(t) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const k = f - i;
  const a = pts[i];
  const b = pts[i + 1];
  return { p: [lerp(a[0], b[0], k), lerp(a[1], b[1], k)], a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

/* ------------------------------------------------------------------ */
/* Paper grain                                                         */
/* ------------------------------------------------------------------ */
let grainTile: HTMLCanvasElement | null = null;
function grain() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = t.height = 96;
  const g = t.getContext('2d')!;
  const img = g.createImageData(96, 96);
  for (let i = 0; i < 96 * 96; i++) {
    const x = i % 96;
    const y = (i / 96) | 0;
    const v = noise(31, x * 0.21 + noise(5, y * 0.13) * 2) * 0.5 + noise(77, y * 0.27 + x * 0.05) * 0.5;
    const r = rnd(9, i);
    const dark = v > 0.35 || r > 0.93;
    img.data[i * 4] = dark ? 70 : 255;
    img.data[i * 4 + 1] = dark ? 45 : 250;
    img.data[i * 4 + 2] = dark ? 30 : 235;
    img.data[i * 4 + 3] = dark ? Math.round(40 + r * 60) : Math.round(r * 70);
  }
  g.putImageData(img, 0, 0);
  return (grainTile = t);
}

/** Paper texture over everything painted so far (only where there is paint). */
export function paperGrain(P: Painter, w: number, h: number, a = 0.22) {
  const c = P.c;
  const pat = c.createPattern(grain(), 'repeat');
  if (!pat) return;
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = a;
  c.fillStyle = pat;
  c.fillRect(0, 0, w, h);
  c.restore();
}
