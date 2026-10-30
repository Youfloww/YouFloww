/**
 * Flowers are built in a tiny 3D frame (disc in the x/y plane, axis = z) and projected flat, so petals overlap,
 * cup and foreshorten like real ones while a bud turns its face towards you.
 */
import { lerp, type V } from './paint';

export type V3 = [number, number, number];

export interface Frame {
  /** centre of the flower on screen */
  x: number;
  y: number;
  /** 0 = facing the viewer, PI/2 = facing straight up */
  tilt: number;
  /** turn in the screen plane (follows the stem) */
  roll: number;
}

export function proj(F: Frame, p: V3): V3 {
  const ct = Math.cos(F.tilt);
  const st = Math.sin(F.tilt);
  const y1 = p[1] * ct - p[2] * st;
  const z1 = p[1] * st + p[2] * ct;
  const cr = Math.cos(F.roll);
  const sr = Math.sin(F.roll);
  return [F.x + p[0] * cr - y1 * sr, F.y + p[0] * sr + y1 * cr, z1];
}

export interface PetalSpec {
  /** angle round the axis */
  th: number;
  /** radius of the base on the disc, and its height on the axis */
  r0: number;
  z0?: number;
  len: number;
  /** max half-width */
  wid: number;
  /** angle above the disc plane along the petal (s = 0..1); PI/2 = straight up the axis */
  lift: (s: number) => number;
  /** edges curl up (+) into a cup / spoon */
  cup?: number;
  shape: (u: number) => number;
  /** sideways lean of the petal (radians) */
  skew?: number;
  n?: number;
}

export interface Petal3 {
  outline: V[];
  mid: V[];
  L: V[];
  R: V[];
  hw: number[];
  /** mean depth (bigger = nearer the viewer) */
  z: number;
  /** true when we see the inside (upper) face */
  front: boolean;
  /** projected tip / base */
  tip: V;
  base: V;
}

export function petal(F: Frame, s: PetalSpec): Petal3 {
  const n = s.n ?? 12;
  const c = Math.cos(s.th);
  const si = Math.sin(s.th);
  const mid3: V3[] = [];
  const L: V[] = [];
  const R: V[] = [];
  const mid: V[] = [];
  const hw: number[] = [];
  let x = s.r0 * c;
  let y = s.r0 * si;
  let z = s.z0 ?? 0;
  const ds = s.len / (n - 1);
  let zs = 0;
  const sk = s.skew ?? 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const b = s.lift(u);
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    // radial direction with a small sideways lean
    const dx = Math.cos(s.th + sk * u);
    const dy = Math.sin(s.th + sk * u);
    if (i > 0) {
      x += dx * cb * ds;
      y += dy * cb * ds;
      z += sb * ds;
    }
    const w = s.wid * Math.max(0, s.shape(u));
    // width runs tangentially; the cup lifts the edges along the petal's upper normal
    const tx = -dy;
    const ty = dx;
    const nx = -dx * sb;
    const ny = -dy * sb;
    const nz = cb;
    const lift = (s.cup ?? 0) * w;
    const pl: V3 = [x - tx * w + nx * lift, y - ty * w + ny * lift, z + nz * lift];
    const pr: V3 = [x + tx * w + nx * lift, y + ty * w + ny * lift, z + nz * lift];
    const pm = proj(F, [x, y, z]);
    const a = proj(F, pl);
    const bb = proj(F, pr);
    mid3.push([x, y, z]);
    mid.push([pm[0], pm[1]]);
    L.push([a[0], a[1]]);
    R.push([bb[0], bb[1]]);
    hw.push(w);
    zs += pm[2];
  }
  // which face: winding of the projected blade near its middle
  const k = Math.floor(n / 2);
  const m0 = mid[Math.max(0, k - 1)];
  const m1 = mid[Math.min(n - 1, k + 1)];
  const crs = (m1[0] - m0[0]) * (R[k][1] - mid[k][1]) - (m1[1] - m0[1]) * (R[k][0] - mid[k][0]);
  return { outline: L.concat(R.slice().reverse()), mid, L, R, hw, z: zs / n, front: crs > 0, tip: mid[n - 1], base: mid[0] };
}

/** a lift profile: from a0 at the base to a1 at the tip, bending mostly near `at` */
export const liftCurve = (a0: number, a1: number, pow = 1) => (u: number) => lerp(a0, a1, u ** pow);
