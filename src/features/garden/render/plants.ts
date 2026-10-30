/**
 * The species drawings. paintPlant() draws one potted plant at a continuous growth g (0..1) in box units
 * (224 x 420, soil at SOIL_Y). Every shape is a smooth function of g and of the plant's seed, so a plant that
 * gets 0.01 more growth looks 0.01 more grown: stems lengthen and thicken, leaves unfold, buds swell, sepals
 * open and petals unfurl one by one. Dev contact sheet: src/features/garden/dev/sheet.html.
 */
import { BOX_H, BOX_W, SOIL_X, SOIL_Y, type PlantSpeciesId } from '../growth';
import { petal, type Frame, type Petal3 } from './flower3d';
import {
  SHAPE, TAU, along, blade, blob, clamp01, curve, easeOut, hex, inkLine, inkOutline, lerp, line, mix, mixPal, noise,
  paintBlade, paintStem, painter, pal, paperGrain, rnd, rng, rr, ss, trace, vary, wash, wiltPal, win, rgba,
  type C, type Pal, type Painter, type V,
} from './paint';

const PI = Math.PI;
const UP = -PI / 2;

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */
const LEAF = pal('#c9e29a', '#8dbd6f', '#4f8a5b');
const LEAF_Y = pal('#e0ecaa', '#b5d481', '#76a561'); // young
const LEAF_BLUE = pal('#c4e0cf', '#86b8a6', '#4a8179');
const LEAF_SILVER = pal('#d6e2bd', '#a4bd91', '#6e8f6c');
const STEM = pal('#bfdf94', '#82b063', '#4c7a4c');
const STEM_PALE = pal('#f4f1d8', '#dfe5b4', '#a9bd83');
const BARK = pal('#cfa883', '#9a7152', '#5f4132');
const PETAL_YELLOW = pal('#ffe879', '#f7c531', '#d88b1a');
const PETAL_TULIP = pal('#ffd2dc', '#f49ab4', '#d6557f');
const PETAL_ROSE = pal('#ef7c8c', '#c93353', '#7b1633');
const PETAL_SAKURA = pal('#fff4f6', '#fbcfdb', '#ee94b3');
const VIOLET = pal('#d3c0f4', '#9a7bd9', '#5e41a3');
const SOIL_DK: C = hex('#4b3224');

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */
interface Ctx {
  P: Painter;
  g: number;
  seed: number;
  /** thirst palette */
  G: (p: Pal, k?: number) => Pal;
}

/** a stem or branch: fixed 5-unit steps, so points at a given arc length never move as it grows */
function strand(x: number, y: number, a0: number, Lcur: number, Lmax: number, bend: number, wob: number, seed: number, hook = 0): V[] {
  const pts: V[] = [[x, y]];
  const ds = 5;
  let s = 0;
  while (s < Lcur - 0.01) {
    const step = Math.min(ds, Lcur - s);
    const t = (s + step * 0.5) / Lmax;
    const a = a0 + bend * t + wob * noise(seed, t * 4) + hook * PI * 0.92 * Math.min(1, (s / Lcur) ** 3);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    s += step;
    pts.push([x, y]);
  }
  if (pts.length < 2) pts.push([x, y - 0.5]);
  return pts;
}
/** point and direction at arc length s along a strand */
function atLen(pts: V[], s: number) {
  const f = Math.max(0, s) / 5;
  const i = Math.min(pts.length - 2, Math.floor(f));
  const k = Math.min(1, f - i);
  const a = pts[i];
  const b = pts[i + 1];
  return { p: [lerp(a[0], b[0], k), lerp(a[1], b[1], k)] as V, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
const lenOf = (pts: V[]) => (pts.length - 1) * 5;

function leafAt(P: Painter, o: { x: number; y: number; ang: number; len: number; wid: number; bend: number; curl?: number; shape: (u: number) => number; veins?: 'pinnate' | 'parallel' | 'triple' | 'none'; teeth?: number; depth?: number; pal: Pal; seed: number; alpha?: number; turn?: number }) {
  if (!(o.len >= 0.8) || !(o.wid >= 0.25)) return null;
  const b = blade({ x: o.x, y: o.y, ang: o.ang, len: o.len, wid: o.wid, bend: o.bend, curl: o.curl, shape: o.shape, turn: o.turn, teeth: o.teeth, toothDepth: o.depth, n: P.lod === 0 ? 8 : 15 });
  paintBlade(P, b, { pal: o.pal, seed: o.seed, veins: o.veins, alpha: o.alpha });
  return b;
}

/** soft contact shadow in the soil and crumbs pushed up by a sprout */
function soilShadow(c: Ctx, width: number) {
  const { P, g } = c;
  blob(P, SOIL_X + 5, SOIL_Y + 2, 12 + width, 3.6 + width * 0.12, SOIL_DK, 0.42);
  const k = 1 - ss(win(g, 0.04, 0.3));
  if (k <= 0.02) return;
  const r = rng(c.seed + 90);
  for (let i = 0; i < 9; i++) {
    const a = r.range(0, TAU);
    const d = r.range(2, 15) * (0.6 + 0.4 * k);
    const x = SOIL_X + Math.cos(a) * d * 1.5;
    const y = SOIL_Y + 1 + Math.sin(a) * d * 0.3 - (1 - d / 16) * 2.4 * k;
    const s = r.range(1.5, 3.6) * (0.5 + 0.5 * k);
    blob(P, x, y, s, s * 0.7, i % 3 ? hex('#6a4a36') : hex('#8a6648'), 0.9 * k);
    blob(P, x - s * 0.25, y - s * 0.3, s * 0.55, s * 0.4, hex('#a98462'), 0.55 * k);
  }
}

/* ---------- the seed: cracks, sends a root down, the husk is left behind ---------- */
const SEEDS: Record<PlantSpeciesId, { w: number; h: number; col: Pal; stripe?: boolean }> = {
  sunflower: { w: 11, h: 5.4, col: pal('#d6d0c2', '#8f887c', '#4a443c'), stripe: true },
  tulip: { w: 10, h: 5.5, col: pal('#e8cf9e', '#c4a066', '#8d6a3a') },
  rose: { w: 6.5, h: 4.8, col: pal('#e0a98a', '#b4724f', '#7a4630') },
  lavender: { w: 5, h: 3.2, col: pal('#6d5a4c', '#3a2c26', '#1e1612') },
  sakura: { w: 8.5, h: 8, col: pal('#cf9d73', '#9d6a47', '#64402b') },
};
function seedStage(c: Ctx, sp: PlantSpeciesId) {
  const { P, g } = c;
  const S = SEEDS[sp];
  const hide = 1 - ss(win(g, 0.1, 0.22)); // the husk fades out
  if (hide <= 0) return;
  const crack = ss(win(g, 0.004, 0.03));
  const tilt = (rnd(c.seed, 3) - 0.5) * 0.5;
  const pos = ss(win(g, 0.03, 0.09)); // husk is pushed aside
  const cx = SOIL_X + 3 + pos * (rnd(c.seed, 4) < 0.5 ? -16 : 16);
  const cy = SOIL_Y - 1.5 - pos * 2;
  const c2 = P.c;
  c2.save();
  c2.globalAlpha = hide;
  c2.translate(cx, cy);
  c2.rotate(tilt + pos * 0.5);
  const poly = (k: number, off = 0): V[] => {
    const pts: V[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      const taper = sp === 'sunflower' ? 1 - 0.55 * Math.max(0, Math.cos(a)) ** 2 : 1;
      pts.push([Math.cos(a) * S.w * 0.5 * k * (sp === 'tulip' ? 1.05 : 1), Math.sin(a) * S.h * 0.5 * k * taper + off]);
    }
    return pts;
  };
  // the root: pale, comes out of the split end and dives into the soil
  if (g < 0.2) {
    const rl = ss(win(g, 0.01, 0.07)) * 13;
    if (rl > 0.5) {
      const rp = curve(S.w * 0.4, 1, rl, (t) => 0.9 + t * 0.7, 8);
      c2.globalAlpha = hide * (1 - ss(win(g, 0.07, 0.14)));
      paintStem(P, rp, (t) => 1.9 * (1 - t * 0.7), STEM_PALE, c.seed + 5, { ink: 0.5 });
      c2.globalAlpha = hide;
    }
  }
  // a seed sits half sunk in the soil
  wash(P, poly(1), S.col, { seed: c.seed + 1, rim: 0.6, glaze: false });
  if (S.stripe && P.lod > 0) for (const o of [-1.4, 0, 1.4]) line(P, [[-S.w * 0.38, o], [S.w * 0.38, o * 0.5]], hex('#f2eee3'), 0.7, 0.7);
  if (crack > 0) {
    // the coat splits along the seam; the pale inside shows
    const len = S.w * 0.46 * crack;
    const gap = 0.3 + 1.8 * crack;
    trace(c2, [[-len, 0], [-len * 0.4, -gap], [len * 0.6, -gap * 1.1], [len, 0.2], [len * 0.5, gap * 0.7], [-len * 0.5, gap * 0.8]]);
    c2.fillStyle = rgba(hex('#e9f0bd'), 0.95);
    c2.fill();
    inkLine(P, [[-len, 0], [0, -gap - 0.4], [len, 0.2]], c.seed + 8, { w: 0.7, alpha: 0.7 });
  }
  inkOutline(P, poly(1), c.seed + 3, { w: 0.9, alpha: 0.7 });
  c2.restore();
}

/** the two seed leaves of a dicot (or one spear of a monocot) on top of the little stem */
function cotyledons(c: Ctx, tip: V, ang: number, size: number, open: number, fade: number, tint: Pal) {
  if (fade <= 0.02 || size < 1) return;
  const { P } = c;
  P.c.save();
  P.c.globalAlpha = fade;
  for (const side of [-1, 1]) {
    const a = ang + side * (0.12 + 1.2 * open);
    leafAt(P, { x: tip[0], y: tip[1], ang: a, len: size, wid: size * 0.4, bend: side * (0.1 + 0.5 * open), shape: SHAPE.oblong, veins: 'none', pal: c.G(tint), seed: c.seed + 20 + side });
  }
  P.c.restore();
}

/** stem width: thicker at the base and over time */
const stemW = (w0: number, w1: number, g: number, taper = 0.5) => (t: number) => lerp(w0, w1, easeOut(g)) * (1 - taper * t);

/* ------------------------------------------------------------------ */
/* Petal painting                                                      */
/* ------------------------------------------------------------------ */
interface Item {
  z: number;
  draw: () => void;
}
function paintPetal3(P: Painter, pe: Petal3, p: Pal, seed: number, o: { veins?: boolean; ink?: number; dark?: number; alpha?: number } = {}) {
  const pp = pe.front ? p : mixPal(p, { lt: p.md, md: p.dk, dk: p.dk }, 0.5 + (o.dark ?? 0));
  const a = o.alpha ?? 1;
  P.c.save();
  P.c.globalAlpha = a;
  wash(P, pe.outline, pp, { seed, from: pe.tip, to: pe.base, rim: 0.8, glaze: P.lod > 1 });
  if (o.veins && P.lod > 0) {
    const n = pe.mid.length;
    for (const v of [-0.55, 0, 0.55]) {
      const pts: V[] = [];
      for (let i = 1; i < n - 1; i++) pts.push([pe.mid[i][0] + (pe.R[i][0] - pe.mid[i][0]) * v, pe.mid[i][1] + (pe.R[i][1] - pe.mid[i][1]) * v]);
      line(P, pts, p.dk, 0.28, Math.max(0.3, P.ink * 0.42));
    }
  }
  inkOutline(P, pe.outline, seed, { w: o.ink ?? 0.9, alpha: 0.72 });
  P.c.restore();
}
const runItems = (items: Item[]) => items.sort((a, b) => a.z - b.z).forEach((i) => i.draw());

/** a tiny leafy tip for a stem that has not made its head yet */
function apex(c: Ctx, tip: V, ang: number, size: number) {
  if (size < 1) return;
  for (const side of [-1, 1]) leafAt(c.P, { x: tip[0], y: tip[1], ang: ang + side * 0.35, len: size, wid: size * 0.32, bend: side * 0.2, shape: SHAPE.elliptic, veins: 'none', pal: c.G(LEAF_Y), seed: c.seed + 60 + side });
}

/* ------------------------------------------------------------------ */
/* Sunflower                                                           */
/* ------------------------------------------------------------------ */
function sunflower(c: Ctx) {
  const { P, g, seed } = c;
  const Hmax = 218;
  const hyp = 0.075 * ss(win(g, 0.03, 0.085));
  const H = Hmax * (hyp + (1 - 0.075) * ss(win(g, 0.1, 0.8)) ** 1.15);
  if (g < 0.2) seedStage(c, 'sunflower');
  const lean = rr(-0.1, 0.1, seed, 1);
  const hook = 1 - ss(win(g, 0.04, 0.1));
  const stem = strand(SOIL_X, SOIL_Y, UP, Math.max(H, 3), Hmax, lean, 0.35, seed + 2, g > 0.012 ? hook : 0);
  const tip = stem[stem.length - 1];
  const tipAng = atLen(stem, lenOf(stem)).a;
  const wBase = lerp(2.1, 8.5, easeOut(g ** 0.8));
  const thick = (t: number) => wBase * (1 - 0.5 * t);
  soilShadow(c, 8 + 18 * ss(win(g, 0.2, 0.7)));

  // true leaves: nodes at fixed heights, they open as the tip runs ahead of them
  const nodes = [24, 38, 54, 72, 92, 114, 138, 164, 190];
  const leaves = nodes.map((s, i) => {
    const side = (i % 2 ? 1 : -1) * (rnd(seed, 40) < 0.5 ? 1 : -1);
    const u = ss(clamp01((H - s - 6) / 52));
    return { s, side, u, i };
  });
  const drawLeaf = (L: (typeof leaves)[number]) => {
    if (L.u <= 0.01 || L.s > H - 2) return;
    const { p, a } = atLen(stem, L.s);
    const big = 1 - 0.5 * (L.s / Hmax) ** 1.2;
    const size = (62 * big + rr(-4, 4, seed, L.i)) * (0.3 + 0.7 * easeOut(L.u));
    const sp = 0.25 + (0.95 - 0.05 * L.i * 0.1) * ss(L.u);
    leafAt(P, {
      x: p[0], y: p[1], ang: a + L.side * sp, len: size, wid: size * 0.46, bend: L.side * (0.25 + 0.7 * L.u + c.P.wilt * 0.5 + (L.s < 100 ? 0.25 : 0)),
      curl: L.side * 0.4, shape: SHAPE.ovate, veins: 'triple', teeth: 9, depth: 0.1, pal: c.G(L.u < 0.5 ? LEAF_Y : LEAF, 0), seed: seed + 100 + L.i, turn: rr(-0.3, 0.3, seed, L.i + 9),
    });
  };
  leaves.filter((L) => L.i % 2 === 1).forEach(drawLeaf);
  paintStem(P, stem, stemW(2.2, 8.5, g ** 0.8, 0.5), mixPal(STEM_PALE, STEM, ss(win(g, 0.04, 0.16))), seed + 3);
  if (g > 0.35 && P.lod > 1) {
    // fine hairs on the stem
    const r = rng(seed + 7);
    for (let i = 0; i < 26; i++) {
      const s = r.range(8, H - 8);
      const { p } = atLen(stem, s);
      const sd = r.sign();
      line(P, [[p[0] + sd * thick(s / H) * 0.5, p[1]], [p[0] + sd * (thick(s / H) * 0.5 + 2.6), p[1] - 1.6]], hex('#d8e8b4'), 0.7, 0.45);
    }
  }
  leaves.filter((L) => L.i % 2 === 0).forEach(drawLeaf);

  // seed leaves (cotyledons): they open on the little arch, then keep working low on the stem
  const cot = stem[Math.min(stem.length - 1, Math.round(Math.min(H, 20) / 5))];
  const cotAng = atLen(stem, Math.min(lenOf(stem), 20)).a;
  cotyledons(c, cot, cotAng, 11 + 8 * ss(win(g, 0.06, 0.2)), ss(win(g, 0.05, 0.14)), 1 - ss(win(g, 0.45, 0.6)), LEAF_Y);

  // the head
  const growTop = ss(win(g, 0.1, 0.5));
  if (g < 0.42) apex(c, tip, tipAng, (g > 0.12 ? 10 : 0) * growTop + 3);
  else sunHead(c, tip, tipAng);
}

function sunHead(c: Ctx, tip: V, tipAng: number) {
  const { P, g, seed } = c;
  const bud = ss(win(g, 0.42, 0.74));
  const open = ss(win(g, 0.72, 0.8));
  const Rd = lerp(3, 14, bud) + 6 * ss(win(g, 0.8, 1));
  // the bud looks up, then nods and finally faces you
  const tilt = lerp(1.35, 0.14, ss(win(g, 0.66, 0.97))) + 0.06 * Math.sin(seed);
  const droop = 0.7 * (1 - ss(win(g, 0.4, 0.7))) * (rnd(seed, 6) < 0.5 ? 1 : -1);
  const F: Frame = { x: tip[0] + Math.cos(tipAng) * Rd * 0.25, y: tip[1] + Math.sin(tipAng) * Rd * 0.25, tilt, roll: tipAng + PI / 2 + droop * 0.0 };
  const items: Item[] = [];
  // green hip + bracts
  const nB = 22;
  const bractOpen = ss(win(g, 0.66, 0.84));
  for (let i = 0; i < nB; i++) {
    const ring = i % 2;
    const th = (i / nB) * TAU * 1 + ring * 0.14 + rr(-0.05, 0.05, seed, i);
    const len = Rd * (1.15 + 0.5 * ring) * (0.55 + 0.45 * bud);
    const pe = petal(F, { th, r0: Rd * (0.9 - ring * 0.12), z0: -Rd * 0.04 - ring * 0.5, len, wid: Rd * 0.2, lift: (u) => lerp(1.45 - bractOpen * 1.0, 1.1 - bractOpen * 0.9 + 0.5 * u, u) + 0 * u, cup: 0.1, shape: (u) => Math.max(0, Math.sin(PI * Math.min(1, u ** 0.7))) ** 0.6, n: 7 });
    items.push({ z: pe.z - 100 * (bractOpen > 0.4 ? 1 : 0) + (bractOpen > 0.4 ? 0 : 3), draw: () => paintPetal3(P, pe, c.G(ring ? LEAF : LEAF_Y), seed + i, { ink: 0.8 }) });
  }
  // yellow rays unfurl one at a time
  const nR = 21;
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < nR; i++) {
      const order = (i * 8) % nR;
      const t0 = 0.76 + 0.15 * ((order + r * 10.5) / (nR + 10));
      const o = ss(win(g, t0, t0 + 0.09));
      if (o <= 0.01) continue;
      const th = (i / nR) * TAU + r * (PI / nR) + rr(-0.08, 0.08, seed, i + 50 * r);
      const L = Rd * (1.5 + 0.25 * (1 - r)) * (0.5 + 0.5 * o) * (0.9 + 0.2 * rnd(seed, i + r * 30));
      const pe = petal(F, {
        th, r0: Rd * 0.88 - r * 1.5, z0: -r * 1.5, len: L, wid: Rd * 0.3 * (0.45 + 0.55 * o), lift: (u) => lerp(1.4, 0.05 - 0.2 * u + 0.1 * rnd(seed, i), o) + 0.35 * u * (1 - o), cup: 0.12 * (1 - o),
        shape: (u) => Math.max(0, Math.sin(PI * Math.min(1, u ** 0.85))) ** 0.7 * (1 - 0.25 * u ** 4), skew: rr(-0.25, 0.25, seed, i + 5), n: 9,
      });
      items.push({ z: pe.z - r * 2, draw: () => paintPetal3(P, pe, c.G(r ? mixPal(PETAL_YELLOW, { lt: hex('#f4a926'), md: hex('#e29418'), dk: hex('#b86b10') }, 0.5) : PETAL_YELLOW, 0), seed + i * 3 + r, { veins: true, ink: 0.85 }) });
    }
  }
  // the disc
  const discAfter = open > 0.15 ? 1 : 0;
  if (bud > 0.3 || open > 0) {
    const disc: Item = {
      z: discAfter ? 1e3 : -50,
      draw: () => {
        const ring = (k: number, z: number): V[] => {
          const pts: V[] = [];
          for (let i = 0; i < 28; i++) {
            const a = (i / 28) * TAU;
            const dome = Rd * 0.14 * (1 - k * k);
            const q = petalProj(F, Math.cos(a) * Rd * k, Math.sin(a) * Rd * k, z * dome);
            pts.push(q);
          }
          return pts;
        };
        const gold = ss(win(g, 0.85, 1));
        const cols: Pal[] = [pal('#c9b25a', '#a58a34', '#7a5f22'), pal('#a97a2c', '#7e5420', '#563510'), pal('#6d4620', '#4d2e14', '#321c0c'), pal('#3d2410', '#2b180a', '#1a0e05')];
        const ks = [1, 0.8, 0.55, 0.3];
        const open2 = discAfter ? 1 : 0.0;
        ks.forEach((k, i) => {
          if (i === 0) wash(P, ring(1, 1), mixPal(pal('#9ab04d', '#7d9a3e', '#587a2c'), cols[0], gold), { seed: seed + 70, rim: 0.7, glaze: false });
          else {
            const pts = ring(k, 1);
            trace(P.c, pts);
            P.c.fillStyle = rgba(mix(cols[i].md, hex('#8fa83f'), (1 - gold) * (i < 3 ? 0.55 : 0.3)), 0.95);
            P.c.fill();
          }
        });
        if (P.lod > 0 && gold > 0 && open2) {
          // the seed spiral (sunflower head: golden angle)
          const n = P.lod > 1 ? 150 : 60;
          for (let k = 4; k < n; k++) {
            const rr2 = Math.sqrt(k / n) * 0.96;
            const a = k * 2.399963;
            const q = petalProj(F, Math.cos(a) * Rd * rr2, Math.sin(a) * Rd * rr2, Rd * 0.14 * (1 - rr2 * rr2));
            const s = 0.9 + 0.7 * rr2;
            P.c.fillStyle = rgba(mix(hex('#e6b94c'), hex('#2b180a'), clamp01(1 - rr2 * 1.1)), 0.55 * gold);
            P.c.beginPath();
            P.c.ellipse(q[0], q[1], s, s * (0.5 + 0.5 * Math.cos(F.tilt)), F.roll, 0, TAU);
            P.c.fill();
          }
        }
        inkOutline(P, ring(1, 1), seed + 71, { w: 0.9, alpha: 0.7 });
      },
    };
    items.push(disc);
  }
  runItems(items);
}
function petalProj(F: Frame, x: number, y: number, z: number): V {
  const ct = Math.cos(F.tilt);
  const st = Math.sin(F.tilt);
  const y1 = y * ct - z * st;
  const cr = Math.cos(F.roll);
  const sr = Math.sin(F.roll);
  return [F.x + x * cr - y1 * sr, F.y + x * sr + y1 * cr];
}

/* ------------------------------------------------------------------ */
/* Tulip                                                               */
/* ------------------------------------------------------------------ */
function tulip(c: Ctx) {
  const { P, g, seed } = c;
  const Hmax = 190;
  if (g < 0.2) seedStage(c, 'tulip');
  soilShadow(c, 8 + 16 * ss(win(g, 0.1, 0.5)));
  const spear = ss(win(g, 0.03, 0.09));
  // basal leaves: a spear first, then blades that unroll and arch outward
  const defs = [
    { side: -1, b: 0.05, L: 120, ang: -0.1 }, { side: 1, b: 0.09, L: 135, ang: 0.15 },
    { side: -1, b: 0.2, L: 92, ang: 0.35 }, { side: 1, b: 0.26, L: 84, ang: -0.35 },
  ];
  const stemT = ss(win(g, 0.16, 0.72));
  const H = 12 * spear * (1 - ss(win(g, 0.1, 0.2))) + Hmax * stemT ** 1.1;
  const stem = strand(SOIL_X + 1, SOIL_Y, UP, Math.max(H, 0.1), Hmax, rr(-0.12, 0.12, seed, 1), 0.2, seed + 2);
  const tip = stem[stem.length - 1];
  const tipAng = atLen(stem, lenOf(stem)).a;
  const drawLeaf = (d: (typeof defs)[number], i: number) => {
    const u = ss(win(g, d.b, d.b + 0.28));
    if (u < 0.01) return;
    const grow = i === 0 && g < 0.09 ? ss(win(g, 0.03, 0.09)) : 1;
    const len = d.L * (0.12 + 0.88 * easeOut(u)) * grow * (0.95 + 0.1 * rnd(seed, i));
    const spread = 0.04 + (0.16 + 0.05 * i) * ss(u) + d.ang * 0.35 * ss(u);
    leafAt(P, { x: SOIL_X + d.side * 3, y: SOIL_Y - 0.5, ang: UP + d.side * spread, len, wid: 17 * (0.35 + 0.65 * easeOut(u)) * (i > 1 ? 0.8 : 1), bend: d.side * (0.1 + 0.55 * ss(u) ** 1.4 + 0.5 * P.wilt), curl: d.side * 0.9 * ss(u) ** 2, shape: SHAPE.lance, veins: 'parallel', pal: c.G(i % 2 ? LEAF_BLUE : mixPal(LEAF_BLUE, LEAF_Y, 0.25)), seed: seed + 30 + i, turn: d.side * 0.25 * ss(u) });
  };
  defs.forEach((d, i) => i < 2 && drawLeaf(d, i));
  if (H > 1) paintStem(P, stem, stemW(2.5, 5.6, g, 0.25), mixPal(STEM_PALE, mixPal(STEM, { lt: hex('#c8e6d0'), md: hex('#8fc0a8'), dk: hex('#4f867a') }, 0.4), ss(win(g, 0.06, 0.2))), seed + 3);
  defs.forEach((d, i) => i >= 2 && drawLeaf(d, i));
  // one stem leaf clasping the stem
  if (g > 0.35) {
    const u = ss(win(g, 0.35, 0.6));
    const { p, a } = atLen(stem, Math.min(lenOf(stem) - 4, 60));
    leafAt(P, { x: p[0], y: p[1], ang: a + 0.35, len: 62 * u, wid: 10 * u, bend: 0.55, shape: SHAPE.lance, veins: 'parallel', pal: c.G(LEAF_BLUE), seed: seed + 39 });
  }
  if (g < 0.5) {
    // the spear / first leaves tip
    if (g < 0.09 && g > 0.03) apex(c, [SOIL_X, SOIL_Y - 8 * spear], UP, 0);
    return;
  }
  // flower: green bud, tepals open slowly into a cup
  const budS = ss(win(g, 0.46, 0.74));
  const open = ss(win(g, 0.76, 1));
  const R = lerp(5, 17, budS) + 4 * open;
  const F: Frame = { x: tip[0], y: tip[1] - 1, tilt: lerp(1.5, 1.22, open), roll: tipAng + PI / 2 + lerp(0.15, 0, open) };
  const items: Item[] = [];
  const colorT = ss(win(g, 0.56, 0.74)); // green bud blushes pink
  for (let k = 0; k < 6; k++) {
    const outer = k < 3;
    const th = (k * 120 + (outer ? 0 : 60) + 10) * (PI / 180) + rr(-0.05, 0.05, seed, k);
    const L = R * (outer ? 2.55 : 2.4) * (0.55 + 0.45 * budS);
    const o = ss(win(open, outer ? 0 : 0.15, outer ? 0.75 : 1));
    const pe = petal(F, {
      th, r0: R * 0.25, z0: 0, len: L, wid: R * (outer ? 0.78 : 0.86), lift: (u) => lerp(1.5, 1.2, u * 0.6) - o * (0.55 * u + 0.15) + 0.0, cup: 0.32 - 0.18 * o,
      shape: (u) => Math.max(0, Math.sin(PI * Math.min(1, u ** 0.72))) ** 0.62 * (1 - 0.1 * u ** 3), skew: 0.08 * (outer ? 1 : -1), n: 10,
    });
    const col = mixPal(pal('#cfe5a8', '#a9cf84', '#6e9d5a'), mixPal(PETAL_TULIP, outer ? pal('#ffc4d2', '#f2859f', '#c8446f') : PETAL_TULIP, 0.5), colorT);
    items.push({ z: pe.z + (outer ? 0.4 : 0), draw: () => paintPetal3(P, pe, c.G(col, 0), seed + k * 5, { veins: colorT > 0.5, ink: 0.9, dark: 0.1 }) });
  }
  if (open > 0.25) {
    // stamens and pistil inside the cup
    items.push({ z: -3, draw: () => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const b = petalProj(F, Math.cos(a) * 2, Math.sin(a) * 2, 2);
        const t = petalProj(F, Math.cos(a) * 4.2 * open, Math.sin(a) * 4.2 * open, R * 1.5 * ss(open));
        line(P, [b, t], hex('#f3efd0'), 0.95, Math.max(0.5, P.ink * 0.5));
        P.c.fillStyle = rgba(hex('#4a3a5a'), 0.9);
        P.c.beginPath();
        P.c.ellipse(t[0], t[1], 1.3, 0.8, F.roll, 0, TAU);
        P.c.fill();
      }
      const p0 = petalProj(F, 0, 0, 1);
      const p1 = petalProj(F, 0, 0, R * 1.2 * open);
      line(P, [p0, p1], hex('#bfd88a'), 1, Math.max(0.8, P.ink * 0.8));
    } });
  }
  // calyx-like shadow where stem meets flower
  blob(P, F.x, F.y + 2, R * 0.5, R * 0.3, hex('#6e9d5a'), 0.45);
  runItems(items);
}

/* ------------------------------------------------------------------ */
/* Rose                                                                */
/* ------------------------------------------------------------------ */
function rose(c: Ctx) {
  const { P, g, seed } = c;
  if (g < 0.2) seedStage(c, 'rose');
  soilShadow(c, 10 + 22 * ss(win(g, 0.15, 0.6)));
  const canes = [
    { x: SOIL_X, a: UP + rr(-0.05, 0.05, seed, 1), L: 175, b: 0.0, bend: rr(-0.25, 0.25, seed, 2), bud: [0.5, 0.72, 0.96], k: 1 },
    { x: SOIL_X - 4, a: UP - 0.5, L: 128, b: 0.22, bend: 0.5, bud: [0.58, 0.8, 1.04], k: 0.78 },
    { x: SOIL_X + 4, a: UP + 0.55, L: 140, b: 0.3, bend: -0.5, bud: [0.62, 0.84, 1.06], k: 0.8 },
  ];
  const hyp = 0.06 * ss(win(g, 0.03, 0.085));
  const drawOrder: Item[] = [];
  canes.forEach((cn, ci) => {
    const grow = ci === 0 ? hyp + (1 - 0.06) * ss(win(g, 0.1, 0.62)) : ss(win(g, cn.b, cn.b + 0.4));
    const H = cn.L * grow;
    if (H < 1) return;
    const hook = ci === 0 ? 1 - ss(win(g, 0.04, 0.1)) : 0;
    const base: V = [cn.x, SOIL_Y - 0.5];
    const stem = strand(base[0], base[1], cn.a, Math.max(H, 3), cn.L, cn.bend, 0.3, seed + 5 + ci, g > 0.012 ? hook : 0);
    const tip = stem[stem.length - 1];
    const tipAng = atLen(stem, lenOf(stem)).a;
    drawOrder.push({
      z: ci === 0 ? 0 : -1 + ci * 0.1,
      draw: () => {
        // compound leaves
        const nodes: number[] = [];
        for (let s = 24; s < cn.L; s += 26) nodes.push(s);
        nodes.forEach((s, i) => {
          const u = ss(clamp01((H - s - 5) / 36));
          if (u < 0.02 || s > H - 2) return;
          const side = i % 2 ? 1 : -1;
          const { p, a } = atLen(stem, s);
          compoundLeaf(c, p, a + side * (0.4 + 0.75 * u), u * (0.8 + 0.2 * rnd(seed, i + ci * 9)), side, seed + 200 + i + ci * 20);
        });
        paintStem(P, stem, stemW(2.0 * cn.k, 4.6 * cn.k, g, 0.45), mixPal(STEM_PALE, mixPal(STEM, pal('#c9ad7e', '#9b7a56', '#6a4a36'), 0.35), ss(win(g, 0.06, 0.2))), seed + 6 + ci);
        if (P.lod > 1 && g > 0.25) {
          // thorns
          for (let s = 20; s < H - 12; s += 23) {
            const { p, a } = atLen(stem, s);
            const sd = Math.floor(s / 23) % 2 ? 1 : -1;
            trace(P.c, [[p[0], p[1] - 1.2], [p[0] + Math.cos(a + sd * 1.2) * 4.5, p[1] + Math.sin(a + sd * 1.2) * 4.5], [p[0], p[1] + 1.4]]);
            P.c.fillStyle = rgba(hex('#8a3a3a'), 0.85);
            P.c.fill();
          }
        }
        if (ci === 0) {
          const cot = atLen(stem, Math.min(lenOf(stem), 16));
          cotyledons(c, cot.p, cot.a, 9 + 6 * ss(win(g, 0.06, 0.2)), ss(win(g, 0.05, 0.14)), 1 - ss(win(g, 0.35, 0.5)), LEAF_Y);
        }
        const bt = cn.bud;
        const budT = ss(win(g, bt[0], bt[1]));
        if (budT < 0.02) apex(c, tip, tipAng, H > 14 ? 9 * ss(win(g, 0.1, 0.4)) + 2 : 0);
        else roseHead(c, tip, tipAng, ci, cn.k, g, bt);
      },
    });
  });
  runItems(drawOrder);
}
function compoundLeaf(c: Ctx, p: V, ang: number, u: number, side: number, seed: number) {
  const { P } = c;
  const L = 16 + 14 * u;
  const rachis = curve(p[0], p[1], L, (t) => ang + side * 0.25 * t + (u < 0.4 ? 0 : 0.35 * side * t), 5);
  line(P, rachis, hex('#6e9d5a'), 0.95, Math.max(0.7, P.ink * 0.9));
  const pls = P.lod === 0 ? [1] : [0.45, 0.78, 1];
  pls.forEach((f, i) => {
    const q = along(rachis, f).p;
    const term = i === pls.length - 1;
    const sz = (term ? 31 : 24) * (0.4 + 0.6 * easeOut(u)) * (0.85 + 0.3 * rnd(seed, i));
    const dirs = term ? [0] : [-1, 1];
    for (const d of dirs) {
      const aa = ang + d * (0.75 - 0.2 * u) + (term ? side * 0.25 : 0);
      leafAt(P, { x: q[0], y: q[1], ang: aa, len: sz, wid: sz * 0.4, bend: -d * 0.12 + side * 0.25 + P.wilt * side * 0.3, shape: SHAPE.elliptic, veins: 'pinnate', teeth: 11, depth: 0.12, pal: c.G(mixPal(LEAF_Y, mixPal(pal('#b9d98a', '#6fa65c', '#3d7a4e'), pal('#d5a99a', '#a56e5e', '#6e3b3a'), 0.1), ss(u * 1.6))), seed: seed + i * 7 + (d + 1) * 3 });
    }
  });
}
function roseHead(c: Ctx, tip: V, ang: number, ci: number, k: number, g: number, bt: number[]) {
  const { P, seed } = c;
  const budS = ss(win(g, bt[0], bt[1]));
  const open = ss(win(g, bt[1] + 0.02, bt[2]));
  const R = lerp(3.5, 12.5, budS) * k + 6.5 * open * k;
  const nodding = (1 - ss(win(g, bt[1] - 0.05, bt[2]))) * 0.0;
  const F: Frame = { x: tip[0] + Math.cos(ang) * R * 0.45, y: tip[1] + Math.sin(ang) * R * 0.45, tilt: lerp(1.35, 0.5, ss(open ** 0.7)) + nodding, roll: ang + PI / 2 + (ci === 0 ? 0.0 : (ci === 1 ? -0.2 : 0.2)) };
  const items: Item[] = [];
  const colorT = ss(win(g, bt[0] + 0.08, bt[1]));
  const N = 22;
  const petPal = (f: number): Pal => {
    const inner = mixPal(pal('#ea6b80', '#b92848', '#6d1230'), PETAL_ROSE, 1 - f * 0.65);
    return mixPal(pal('#d9e6a8', '#b4cf86', '#78a25c'), inner, colorT);
  };
  // hip + sepals
  items.push({ z: -500, draw: () => {
    blob(P, F.x - Math.cos(ang) * R * 0.2, F.y - Math.sin(ang) * R * 0.2, R * 0.85, R * 0.9, hex('#7fae62'), 0.9, ang);
  } });
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1); // 0 inner .. 1 outer
    const th = i * 2.399963 + seed * 0.1;
    const o = ss(win(open, (1 - f) * 0.55, (1 - f) * 0.55 + 0.45));
    const budOpen = ss(win(budS, 0.6, 1)) * 0.06;
    const len = R * lerp(0.9, 2.1, f ** 0.8) * (0.7 + 0.3 * budS);
    const base = 1.5 - 0.4 * f;
    const lift = (u: number) => lerp(base, lerp(1.25, 0.2, f) + 0.55 * u, o * (0.5 + 0.5 * u)) - budOpen * u + 0.1 * (1 - o) * u;
    const pe = petal(F, {
      th, r0: R * lerp(0.05, 0.42, f), z0: R * 0.04 * (1 - f), len, wid: len * lerp(0.52, 0.62, f), lift, cup: 0.35 - 0.12 * o * f,
      shape: (u) => Math.max(0, Math.sin(PI * Math.min(1, u ** 0.7))) ** 0.5 * (1 - 0.1 * u ** 4), skew: rr(-0.2, 0.2, seed, i), n: 9,
    });
    items.push({ z: pe.z + (1 - f) * 0.2 + (pe.front ? 0 : -3) + (f > 0.6 ? 0 : 0), draw: () => paintPetal3(P, pe, c.G(petPal(f), 0), seed + i * 11, { ink: 0.85 - 0.2 * (1 - f), dark: 0.05 }) });
  }
  // centre: dark spiral where the inner petals wrap
  if (open > 0.15) items.push({ z: 0.5, draw: () => {
    const q = petalProj(F, 0, 0, R * 0.3);
    blob(P, q[0], q[1], R * 0.42 * (1 - open * 0.3), R * 0.3, hex('#6d1230'), 0.55 * open);
  } });
  // sepals: five slender green leaves hugging the bud, then turning back
  const sepOpen = ss(win(g, bt[1] - 0.04, bt[1] + 0.1));
  for (let i = 0; i < 5; i++) {
    const th = (i / 5) * TAU + 0.3;
    const sl = R * (1.25 + 0.5 * (i % 2)) * (0.6 + 0.4 * budS);
    const pe = petal(F, { th, r0: R * 0.25, z0: -R * 0.1, len: sl, wid: R * 0.22, lift: (u) => lerp(1.3 - 0.2 * sepOpen, 0.2 - 1.0 * sepOpen * 0 , u * 0.5) - sepOpen * (1.7 * u), cup: 0.1, shape: (u) => Math.max(0, Math.sin(PI * Math.min(1, u ** 0.6))) ** 0.7, n: 6 });
    items.push({ z: pe.z - (sepOpen > 0.5 ? 400 : 0) + (sepOpen > 0.5 ? 0 : 5), draw: () => paintPetal3(P, pe, c.G(LEAF), seed + 300 + i, { ink: 0.8 }) });
  }
  runItems(items);
}

/* ------------------------------------------------------------------ */
/* Lavender                                                            */
/* ------------------------------------------------------------------ */
function lavender(c: Ctx) {
  const { P, g, seed } = c;
  if (g < 0.2) seedStage(c, 'lavender');
  soilShadow(c, 12 + 20 * ss(win(g, 0.1, 0.5)));
  const items: Item[] = [];
  // cotyledons + hypocotyl
  const hyp = ss(win(g, 0.03, 0.085));
  if (g < 0.4) {
    const stem = strand(SOIL_X, SOIL_Y, UP, Math.max(1, 14 * hyp), 20, rr(-0.1, 0.1, seed, 2), 0, seed, g > 0.012 ? 1 - ss(win(g, 0.04, 0.1)) : 0);
    items.push({ z: 0, draw: () => {
      if (hyp > 0.05) paintStem(P, stem, stemW(1.6, 2.4, g, 0.2), mixPal(STEM_PALE, STEM, ss(win(g, 0.06, 0.2))), seed + 3);
      cotyledons(c, stem[stem.length - 1], atLen(stem, lenOf(stem)).a, 8 + 5 * ss(win(g, 0.06, 0.2)), ss(win(g, 0.05, 0.14)), 1 - ss(win(g, 0.25, 0.4)), LEAF_SILVER);
    } });
  }
  // narrow silvery leaves in pairs
  const nL = 22;
  for (let i = 0; i < nL; i++) {
    const f = i / nL;
    const b = 0.1 + 0.4 * f * f;
    const u = ss(win(g, b, b + 0.2));
    if (u < 0.01) continue;
    const side = i % 2 ? 1 : -1;
    const spread = lerp(0.12, 0.95, ((i * 7) % nL) / nL) * (0.5 + 0.5 * u);
    const len = (34 + 38 * (1 - Math.abs(spread - 0.5) * 0.5) * rnd(seed, i) + 12) * (0.2 + 0.8 * easeOut(u));
    const x = SOIL_X + side * rr(1, 8, seed, i + 100);
    items.push({ z: -spread + (i % 3), draw: () => leafAt(P, { x, y: SOIL_Y - 0.5, ang: UP + side * spread, len, wid: 3 + 1.6 * rnd(seed, i + 3), bend: side * (0.35 + 0.9 * u * (0.4 + spread) + P.wilt * 0.6), shape: SHAPE.linear, veins: 'none', pal: c.G(mixPal(LEAF_Y, LEAF_SILVER, ss(u)), 0), seed: seed + 400 + i }) });
  }
  // flower stalks with spikes
  const stalks = 8;
  for (let i = 0; i < stalks; i++) {
    const f = i / (stalks - 1);
    const t0 = 0.34 + 0.12 * rnd(seed, i + 50);
    const grow = ss(win(g, t0, t0 + 0.36));
    if (grow < 0.01) continue;
    const spread = (f - 0.5) * 1.15 + rr(-0.06, 0.06, seed, i);
    const Lmax = 135 + 40 * (1 - Math.abs(f - 0.5) * 1.6) + rr(-8, 8, seed, i + 7);
    const H = Lmax * grow;
    const stem = strand(SOIL_X + (f - 0.5) * 12, SOIL_Y - 1, UP + spread * 0.55, Math.max(H, 3), Lmax, -spread * 0.35, 0.25, seed + 60 + i);
    items.push({ z: i % 2 ? -0.5 : 1.5, draw: () => {
      paintStem(P, stem, stemW(1.7, 2.4, g, 0.3), mixPal(STEM, pal('#b6cf9c', '#8bab78', '#5b7d5a'), 0.5), seed + 80 + i, { ink: 0.5 });
      // leaf pairs low on the stalk
      for (let s = 16; s < Math.min(H * 0.3, 50); s += 24) {
        const { p, a } = atLen(stem, s);
        for (const sd of [-1, 1]) leafAt(P, { x: p[0], y: p[1], ang: a + sd * 0.7, len: 18 * (1 - s / Lmax), wid: 2, bend: -sd * 0.3, shape: SHAPE.linear, veins: 'none', pal: c.G(LEAF_SILVER), seed: seed + s });
      }
      // the spike: whorls of florets, green buds that blush violet from the bottom up
      const spikeStart = Lmax * 0.6;
      const nW = P.lod === 0 ? 6 : 12;
      const bloom = ss(win(g, 0.62 + 0.04 * rnd(seed, i), 1));
      for (let w = 0; w < nW; w++) {
        const s = spikeStart + (w / nW) * (H - spikeStart) * 1;
        if (H < spikeStart + 4 || s > H) continue;
        const { p, a } = atLen(stem, s);
        const tfrac = w / nW;
        const col = clamp01(bloom * 1.5 - tfrac * 0.55);
        const size = (1.5 + 1.5 * (1 - tfrac * 0.6)) * (0.4 + 0.6 * ss(win(g, 0.45, 0.85)));
        for (let k = 0; k < 4; k++) {
          const sd = k % 2 ? 1 : -1;
          const off = (k < 2 ? 0 : 1) * 1.9 - 1;
          const bx = p[0] + sd * (1.8 + 1.0 * (1 - tfrac)) + Math.cos(a) * off;
          const by = p[1] + Math.sin(a) * off + (k < 2 ? 0 : -1);
          const pl = mixPal(pal('#d9e4b0', '#aabf80', '#6f8f5c'), VIOLET, col);
          wash(P, ellipsePoly(bx, by, size * 1.05, size * 0.75, a + sd * 0.9 + PI / 2, 10), c.G(pl, 0), { seed: seed + w * 5 + k, rim: 0.6, glaze: false });
        }
        P.c.fillStyle = rgba(mix(hex('#8aa66e'), hex('#6a4fb0'), col), 0.9);
        P.c.beginPath();
        P.c.arc(p[0], p[1], size * 0.8, 0, TAU);
        P.c.fill();
      }
      // tip bud
      const q = along(stem, 1).p;
      P.c.fillStyle = rgba(mix(hex('#9ab07a'), hex('#8f6fd2'), bloom), 0.95);
      P.c.beginPath();
      P.c.ellipse(q[0], q[1] - 1, 1.8, 3, atLen(stem, lenOf(stem)).a + PI / 2, 0, TAU);
      P.c.fill();
    } });
  }
  runItems(items);
}
function ellipsePoly(x: number, y: number, rx: number, ry: number, rot: number, n = 12): V[] {
  const pts: V[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    pts.push([x + ex * c - ey * s, y + ex * s + ey * c]);
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/* Sakura bonsai                                                       */
/* ------------------------------------------------------------------ */
function sakura(c: Ctx) {
  const { P, g, seed } = c;
  if (g < 0.2) seedStage(c, 'sakura');
  soilShadow(c, 10 + 22 * ss(win(g, 0.1, 0.6)));
  const Hmax = 150;
  const hyp = 0.09 * ss(win(g, 0.03, 0.09));
  const H = Hmax * (hyp + 0.91 * ss(win(g, 0.1, 0.62)) ** 1.1);
  const lean = rr(0.35, 0.6, seed, 1) * (rnd(seed, 2) < 0.5 ? 1 : -1);
  const hook = 1 - ss(win(g, 0.04, 0.1));
  // an S-shaped bonsai trunk: it curves more as it thickens
  const sBend = ss(win(g, 0.2, 0.6));
  const trunk = strand(SOIL_X, SOIL_Y - 0.5, UP + lean * 0.12 * sBend, Math.max(H, 3), Hmax, 0, 0, seed, 0);
  // custom S curve (strand with a bend() fn isn't enough): rebuild with a sinusoidal bend
  const pts: V[] = [[SOIL_X, SOIL_Y - 0.5]];
  {
    let x = SOIL_X;
    let y = SOIL_Y - 0.5;
    let s = 0;
    while (s < H - 0.01) {
      const step = Math.min(5, H - s);
      const t = (s + step / 2) / Hmax;
      const a = UP + lean * Math.sin(t * PI * 2.1 + 0.2) * (0.35 + 0.65 * sBend) + (g > 0.012 ? hook * PI * 0.92 * Math.min(1, (s / Math.max(H, 1)) ** 3) : 0) + 0.15 * noise(seed, t * 5);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      s += step;
      pts.push([x, y]);
    }
    if (pts.length < 2) pts.push([x, y - 0.5]);
  }
  void trunk;
  const tipAng = atLen(pts, lenOf(pts)).a;
  const tip = pts[pts.length - 1];
  const wood = ss(win(g, 0.14, 0.5));
  const trunkPal = mixPal(mixPal(STEM_PALE, STEM, ss(win(g, 0.06, 0.16))), BARK, wood);
  const tW = (t: number) => lerp(2.0, 17, easeOut(g) ** 1.1) * (1 - 0.82 * t ** 0.8) + 0.6;
  // branches
  const bdefs = [
    { s: 0.28, side: 1, L: 72, b: 0.3, ang: 1.05 }, { s: 0.4, side: -1, L: 80, b: 0.34, ang: 1.0 }, { s: 0.55, side: 1, L: 76, b: 0.4, ang: 0.85 },
    { s: 0.68, side: -1, L: 66, b: 0.44, ang: 0.8 }, { s: 0.82, side: 1, L: 52, b: 0.5, ang: 0.7 },
  ];
  const tips: { p: V; a: number; r: number; size: number }[] = [];
  const twigs: { pts: V[]; w: number }[] = [];
  const leavesAt: { p: V; a: number; u: number; i: number }[] = [];
  bdefs.forEach((bd, bi) => {
    const grow = easeOut(win(g, bd.b, bd.b + 0.3));
    const sPos = bd.s * Hmax;
    if (grow < 0.02 || sPos > H - 4) return;
    const { p, a } = atLen(pts, sPos);
    const bl = bd.L * grow * (1 - 0.5 * ((bd.s - 0.28) / 0.6) * 0.5);
    const bs = strand(p[0], p[1], a + bd.side * bd.ang, bl, bd.L, -bd.side * (0.8 + 0.3 * rnd(seed, bi)), 0.5, seed + 30 + bi);
    twigs.push({ pts: bs, w: 5.5 * ss(grow) * (1 - bd.s * 0.4) + 1 });
    // twigs
    [0.45, 0.75, 1].forEach((f, ti) => {
      const tg = easeOut(win(g, bd.b + 0.08 + ti * 0.05, bd.b + 0.38));
      if (tg < 0.05) return;
      const q = atLen(bs, Math.min(lenOf(bs), bl * f));
      const sd = ti % 2 ? 1 : -1;
      const tl = 30 * tg * (1 - 0.15 * ti) * (0.8 + 0.4 * rnd(seed, bi * 7 + ti));
      const ts = strand(q.p[0], q.p[1], q.a + sd * (0.7 + 0.2 * ti) * (ti === 2 ? 0.3 : 1), tl, 30, -sd * 0.5, 0.6, seed + 50 + bi * 5 + ti);
      twigs.push({ pts: ts, w: 2.4 * tg });
      const e = ts[ts.length - 1];
      tips.push({ p: e, a: atLen(ts, lenOf(ts)).a, r: rnd(seed, bi * 11 + ti), size: tg });
      // leaves + blossoms along the twig
      [0.4, 0.75].forEach((ff, k) => {
        const m = atLen(ts, lenOf(ts) * ff);
        tips.push({ p: m.p, a: m.a, r: rnd(seed, bi * 13 + ti * 3 + k + 77), size: tg });
      });
    });
    tips.push({ p: bs[bs.length - 1], a: atLen(bs, lenOf(bs)).a, r: rnd(seed, bi + 300), size: grow });
  });
  // crown from the trunk top
  if (g > 0.4) {
    const cg = easeOut(win(g, 0.42, 0.72));
    for (let k = 0; k < 4; k++) {
      const sd = k % 2 ? 1 : -1;
      const q = atLen(pts, Math.max(0, lenOf(pts) - 2 - k * 10));
      const ts = strand(q.p[0], q.p[1], q.a + sd * (0.35 + 0.18 * k), 44 * cg * (1 - 0.1 * k), 44, -sd * 0.5, 0.5, seed + 90 + k);
      twigs.push({ pts: ts, w: 2.6 * cg });
      tips.push({ p: ts[ts.length - 1], a: atLen(ts, lenOf(ts)).a, r: rnd(seed, k + 400), size: cg });
      const m = atLen(ts, lenOf(ts) * 0.6);
      tips.push({ p: m.p, a: m.a, r: rnd(seed, k + 410), size: cg });
    }
    tips.push({ p: tip, a: tipAng, r: 0.5, size: cg });
  }
  // leaves on the sapling's young trunk
  const nodes = [22, 36, 52, 68, 84, 100];
  nodes.forEach((s, i) => {
    const u = ss(clamp01((H - s - 4) / 40));
    if (u > 0.01 && s < H - 2 && g < 0.62) leavesAt.push({ p: atLen(pts, s).p, a: atLen(pts, s).a, u, i });
  });
  // roots flare at the surface
  if (g > 0.3) {
    const fl = ss(win(g, 0.3, 0.8));
    for (const sd of [-1, 1]) {
      const rp = curve(SOIL_X + sd * 2, SOIL_Y - 1, 14 * fl, (t) => (sd > 0 ? 0.25 : PI - 0.25) + sd * t * 0.3, 5);
      paintStem(P, rp, (t) => 8 * fl * (1 - t * 0.8), BARK, seed + sd, { ink: 0.7 });
    }
  }
  // sapling leaves behind the trunk
  const drawSapLeaf = (L: (typeof leavesAt)[number]) => {
    const side = L.i % 2 ? 1 : -1;
    const sz = (30 - L.i * 2) * (0.3 + 0.7 * easeOut(L.u));
    leafAt(P, { x: L.p[0], y: L.p[1], ang: L.a + side * (0.3 + 0.8 * ss(L.u)), len: sz, wid: sz * 0.42, bend: side * (0.3 + 0.4 * L.u + P.wilt * 0.4), shape: SHAPE.elliptic, veins: 'pinnate', teeth: 10, depth: 0.1, pal: c.G(mixPal(pal('#e8c9a0', '#cfa57a', '#a06a4a'), LEAF, ss(L.u * 1.2))), seed: seed + 500 + L.i });
  };
  leavesAt.filter((L) => L.i % 2).forEach(drawSapLeaf);
  twigs.forEach((t) => {
    if (t.pts.length > 1) paintStem(P, t.pts, (u) => t.w * (1 - 0.65 * u) + 0.4, BARK, seed + 600 + t.pts.length, { ink: 0.55 });
  });
  paintStem(P, pts, tW, trunkPal, seed + 4, { ink: 0.95 });
  if (P.lod > 1 && wood > 0.4) {
    // bark marks
    const r = rng(seed + 12);
    for (let i = 0; i < 16; i++) {
      const s = r.range(4, lenOf(pts) * 0.8);
      const q = atLen(pts, s);
      const w = tW(s / lenOf(pts)) * 0.35 * r.sign();
      line(P, [[q.p[0] + w, q.p[1]], [q.p[0] + w + 0.6, q.p[1] - 3.6]], hex('#4a3226'), 0.4 * wood, 0.6);
    }
  }
  leavesAt.filter((L) => !(L.i % 2)).forEach(drawSapLeaf);
  const cot = atLen(pts, Math.min(lenOf(pts), 14));
  cotyledons(c, cot.p, cot.a, 10 + 6 * ss(win(g, 0.06, 0.2)), ss(win(g, 0.05, 0.14)), 1 - ss(win(g, 0.25, 0.4)), LEAF_Y);
  if (g < 0.3 && H > 10) apex(c, tip, tipAng, 8 * ss(win(g, 0.1, 0.3)) + 2);

  // canopy: leaves, then buds and blossoms in sequence
  const leafT = ss(win(g, 0.46, 0.8));
  tips.sort((a, b) => a.p[1] - b.p[1]);
  const N = tips.length;
  tips.forEach((t, i) => {
    const rank = (i * 0.618 + t.r * 0.5) % 1;
    // young bronze leaves first
    if (leafT > 0.02 && P.lod > 0) {
      for (let k = 0; k < 2; k++) {
        const side = k % 2 ? 1 : -1;
        const sz = (19 + 5 * rnd(seed, i + k * 3)) * leafT * t.size;
        leafAt(P, { x: t.p[0], y: t.p[1], ang: t.a + side * (0.5 + 0.9 * rnd(seed, i * 3 + k)), len: sz, wid: sz * 0.4, bend: side * 0.3, shape: SHAPE.elliptic, veins: 'none', teeth: 8, depth: 0.1, pal: c.G(mixPal(pal('#f1deb0', '#d6c081', '#9b8a52'), pal('#c9e29a', '#86b86d', '#4f8a5b'), ss(win(g, 0.4 + rank * 0.1, 0.62)))), seed: seed + i * 5 + k });
      }
    }
  });
  const gr = rng(seed + 800);
  tips.forEach((t, i) => {
    const rank = ((i * 0.618) % 1 + t.r) % 1;
    const t0 = 0.7 + 0.24 * rank;
    const bud = ss(win(g, 0.6 + 0.1 * rank, t0));
    const open = ss(win(g, t0, t0 + 0.07));
    if (bud < 0.02) return;
    const sz = (3.4 + 2.6 * t.r) * t.size;
    const off = 3;
    const bx = t.p[0] + Math.cos(t.a) * off + (rnd(seed, i + 9) - 0.5) * 5;
    const by = t.p[1] + Math.sin(t.a) * off + (rnd(seed, i + 19) - 0.5) * 4 + 1;
    blossom(c, bx, by, sz * (0.7 + 0.5 * bud), open, bud, rnd(seed, i + 29) * TAU, rnd(seed, i + 39));
    gr();
  });
  void N;
  // a few fallen petals on the soil
  const fall = ss(win(g, 0.92, 1));
  for (let i = 0; i < 6; i++) {
    if (fall * 6 < i + 0.5) break;
    const x = SOIL_X + rr(-34, 34, seed, 900 + i);
    const y = SOIL_Y + rr(-5, 8, seed, 910 + i);
    wash(P, ellipsePoly(x, y, 2.6, 1.5, rr(0, PI, seed, 920 + i), 8), PETAL_SAKURA, { seed: i, glaze: false, rim: 0.4 });
  }
  void N;
}

function blossom(c: Ctx, x: number, y: number, size: number, open: number, _bud: number, rot: number, view: number) {
  const { P } = c;
  if (open < 0.12) {
    // a swelling bud: red-pink calyx and a tight pink tip
    const s = size * 0.7;
    wash(P, ellipsePoly(x, y, s * 0.55, s, rot * 0.3 - 0.4, 10), mixPal(pal('#f7c6d1', '#e98ab0', '#c2506f'), pal('#fbd9e1', '#f4a8c2', '#e06c95'), ss(open * 6)), { seed: 5, glaze: false, rim: 0.6 });
    P.c.fillStyle = rgba(hex('#b04a5d'), 0.9);
    P.c.beginPath();
    P.c.ellipse(x, y + s * 0.8, s * 0.35, s * 0.32, 0, 0, TAU);
    P.c.fill();
    return;
  }
  const o = ss(open);
  const R = size * 1.9 * (0.5 + 0.5 * o);
  const sq = lerp(0.55, 1, view * view);
  P.c.save();
  P.c.translate(x, y);
  P.c.rotate(rot * 0.2);
  P.c.scale(1, sq);
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * TAU;
    const L = R * (0.92 + 0.12 * rnd(k, Math.round(rot * 100)));
    const W = L * 0.54 * (0.5 + 0.5 * o);
    const cA = Math.cos(a);
    const sA = Math.sin(a);
    const pt = (u: number, v: number): V => [(cA * u - sA * v) * L, (sA * u + cA * v) * L];
    const pts: V[] = [pt(0, 0), pt(0.32, -W / L * 0.72), pt(0.72, -W / L * 0.98), pt(0.97, -W / L * 0.42), pt(0.88, -0.04), pt(0.97, W / L * 0.42), pt(0.72, W / L * 0.98), pt(0.32, W / L * 0.72)];
    wash(P, pts, PETAL_SAKURA, { seed: k, from: pt(1, 0), to: pt(0, 0), rim: 0.55, glaze: false });
    if (P.lod > 1 && size > 3.4) inkOutline(P, pts, k + Math.round(rot * 50), { w: 0.6, alpha: 0.5 });
  }
  blob(P, 0, 0, R * 0.36, R * 0.36, hex('#d94f7c'), 0.7);
  if (P.lod > 0 && size > 3) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + rot;
      P.c.fillStyle = rgba(hex('#c24a6a'), 0.85);
      P.c.fillRect(Math.cos(a) * R * 0.3 - 0.35, Math.sin(a) * R * 0.3 - 0.35, 0.8, 0.8);
    }
  }
  P.c.restore();
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */
const DRAW: Record<PlantSpeciesId, (c: Ctx) => void> = { sunflower, tulip, rose, lavender, sakura };

export interface PaintOptions {
  species: PlantSpeciesId;
  /** growth 0..1 */
  g: number;
  seed?: number;
  /** thirst 0..1 (paler, olive greens) */
  wilt?: number;
}

/** Paint a plant into a canvas (any size; the plant box 224 x 420 is scaled to fit its height). */
export function paintPlant(canvas: HTMLCanvasElement, o: PaintOptions) {
  const c = canvas.getContext('2d');
  if (!c) return;
  const k = canvas.height / BOX_H;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.setTransform(k, 0, 0, k, (canvas.width - BOX_W * k) / 2, 0);
  const P = painter(c, k / (window.devicePixelRatio || 1), o.wilt ?? 0);
  const seed = Math.floor(o.seed ?? 1) >>> 0;
  const g = Math.min(1, Math.max(0, o.g));
  const ctx: Ctx = { P, g, seed, G: (p) => vary(wiltPal(p, o.wilt ?? 0), seed + 3, 6) };
  DRAW[o.species](ctx);
  // paper grain over the paint only
  c.setTransform(1, 0, 0, 1, 0, 0);
  paperGrain(P, canvas.width, canvas.height, 0.16);
}
