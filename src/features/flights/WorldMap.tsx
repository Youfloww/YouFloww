/**
 * A small flat world (Natural Earth 1:110m, public domain) drawn as SVG: visited countries, past routes,
 * airports. Also the no-WebGL fallback for the live map, and "which country are we over?".
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { arc, loadCountries, type Airport, type LngLat } from './geo';

export const W = 360;
export const H = 150;
export const toXY = ([lon, lat]: LngLat): [number, number] => [(((lon + 180) % 360) + 360) % 360, 90 - lat];

export function useCountries(enabled = true) {
  const [paths, setPaths] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadCountries()
      .then((p) => live && setPaths(p))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [enabled]);
  return { paths, failed };
}

/* ---------------- which country is under a point ---------------- */
type Ring = [number, number][];
const ringCache = new WeakMap<Record<string, string>, [string, Ring[]][]>();
function rings(paths: Record<string, string>) {
  let r = ringCache.get(paths);
  if (!r) {
    r = Object.entries(paths).map(([cc, d]) => [
      cc,
      d
        .split('M')
        .filter(Boolean)
        .map((s) =>
          s
            .replace('Z', '')
            .split('L')
            .map((pt) => pt.trim().split(' ').map(Number) as [number, number]),
        ),
    ]);
    ringCache.set(paths, r);
  }
  return r;
}
function inside(pt: [number, number], ring: Ring) {
  let ok = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}
/** ISO code of the country below a point, or null over the sea. */
export function countryAt(paths: Record<string, string>, p: LngLat): string | null {
  const xy = toXY(p);
  for (const [cc, rs] of rings(paths)) if (rs.some((r) => inside(xy, r))) return cc;
  return null;
}

/* ---------------- drawing ---------------- */
/** Split a projected polyline where it wraps around the edge of the flat map. */
function polyline(points: LngLat[]) {
  const segs: string[] = [];
  let cur = '';
  let prev: [number, number] | null = null;
  for (const p of points) {
    const [x, y] = toXY(p);
    if (!prev || Math.abs(x - prev[0]) > 180) {
      if (cur) segs.push(cur);
      cur = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    } else cur += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    prev = [x, y];
  }
  if (cur) segs.push(cur);
  return segs.join('');
}

export interface Route {
  from: Airport;
  to: Airport;
  /** 0..1 flown (draws the rest dashed) */
  f?: number;
  dim?: boolean;
}

export function WorldMap({
  paths,
  visited,
  routes = [],
  dots = [],
  plane,
  className,
  land = 'var(--ff-land)',
  sea = 'transparent',
  viewBox = `0 0 ${W} ${H}`,
  children,
}: {
  paths: Record<string, string> | null;
  visited?: Record<string, unknown>;
  routes?: Route[];
  dots?: Airport[];
  plane?: { at: LngLat; heading: number };
  className?: string;
  land?: string;
  sea?: string;
  /** crop (SVG viewBox in map units) */
  viewBox?: string;
  children?: ReactNode;
}) {
  const lines = useMemo(
    () =>
      routes.map((r) => {
        const f = r.f ?? 1;
        return { done: f > 0 ? polyline(arc(r.from, r.to, 0, f)) : '', rest: f < 1 ? polyline(arc(r.from, r.to, f, 1)) : '', dim: r.dim };
      }),
    [routes],
  );
  return (
    <svg viewBox={viewBox} className={cn('block h-auto w-full', className)} role="img" aria-label="World map">
      <rect width={W} height={H} fill={sea} rx={6} />
      {paths &&
        Object.entries(paths).map(([cc, d]) => (
          <path key={cc} d={d} fill={visited?.[cc] ? 'var(--ff-visited)' : land} stroke="var(--ff-border)" strokeWidth={0.25} strokeLinejoin="round">
            <title>{cc}</title>
          </path>
        ))}
      {lines.map((l, i) => (
        <g key={i} fill="none" strokeLinecap="round" opacity={l.dim ? 0.55 : 1}>
          {l.done && <path d={l.done} stroke="var(--ff-route)" strokeWidth={0.9} />}
          {l.rest && <path d={l.rest} stroke="var(--ff-route)" strokeWidth={0.7} strokeDasharray="1.6 1.6" opacity={0.7} />}
        </g>
      ))}
      {dots.map((a) => {
        const [x, y] = toXY([a.lon, a.lat]);
        return <circle key={a.iata} cx={x} cy={y} r={1.3} fill="var(--ff-dot)" stroke="#fff" strokeWidth={0.4} />;
      })}
      {plane && (
        <g transform={`translate(${toXY(plane.at).join(' ')}) rotate(${plane.heading}) scale(0.16)`}>
          <PlaneTopPath />
        </g>
      )}
      {children}
    </svg>
  );
}

/** Top-down plane centred on 0,0, nose up, about 64 units wide. */
export function PlaneTopPath() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M0 -30 C4 -30 5 -24 5 -18 L5 -6 L30 6 L30 11 L5 5 L4 20 L12 26 L12 30 L0 27 L-12 30 L-12 26 L-4 20 L-5 5 L-30 11 L-30 6 L-5 -6 L-5 -18 C-5 -24 -4 -30 0 -30 Z" fill="#fffaf1" stroke="#5b3f2c" strokeWidth={2.4} />
      <path d="M-3 -22 Q0 -25 3 -22" fill="none" stroke="#5b3f2c" strokeWidth={2} />
      <path d="M5 -2 L28 8.5 M-5 -2 L-28 8.5" stroke="#e07a5f" strokeWidth={2.6} />
      <path d="M0 21 L0 28" stroke="#e07a5f" strokeWidth={2.4} />
    </g>
  );
}

/** A 2:1 crop around a route (falls back to the whole world when it wraps the map edge). */
export function cropAround(from: Airport, to: Airport) {
  const pts = arc(from, to, 0, 1, 40).map(toXY);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x1 - x0 > 180) return `0 0 ${W} ${H}`;
  let w = Math.max(50, (x1 - x0) * 1.6);
  let h = Math.max(25, (y1 - y0) * 1.6);
  if (w / h > 2) h = w / 2;
  else w = h * 2;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
}
