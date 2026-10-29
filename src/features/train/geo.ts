/** Route geometry: loading the OSM-derived GeoJSON and walking along it by distance. */

export interface Station {
  name: string;
  /** distance from the start of the trip, km */
  km: number;
  motif: string;
  note: string;
  lon: number;
  lat: number;
}

export interface RouteGeo {
  id: string;
  /** total length, km */
  km: number;
  coords: [number, number][];
  /** cumulative km at each coordinate */
  cum: number[];
  tunnels: [number, number][];
  stations: Station[];
}

interface FC {
  features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
}

const R = 6371.0088;
const rad = Math.PI / 180;

export function distKm(a: [number, number], b: [number, number]) {
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function cumulative(coords: [number, number][]) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distKm(coords[i - 1], coords[i]));
  return cum;
}

const cache = new Map<string, Promise<RouteGeo>>();

/** The route in its OSM direction (from → to). Fetched once per visit. */
export function loadRoute(id: string): Promise<RouteGeo> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/data/train/${id}.geojson`)
      .then((r) => {
        if (!r.ok) throw new Error(`route ${id}: ${r.status}`);
        return r.json() as Promise<FC>;
      })
      .then((fc) => {
        const line = fc.features.find((f) => f.geometry.type === 'LineString')!;
        const coords = line.geometry.coordinates as [number, number][];
        const cum = cumulative(coords);
        const total = cum[cum.length - 1];
        // stored km are along the full-resolution track; rescale onto the simplified line
        const k = total / ((line.properties.km as number) || total);
        const stations = fc.features
          .filter((f) => f.geometry.type === 'Point')
          .map((f) => {
            const [lon, lat] = f.geometry.coordinates as [number, number];
            const p = f.properties as { name: string; km: number; motif: string; note: string };
            return { name: p.name, km: p.km * k, motif: p.motif, note: p.note, lon, lat };
          })
          .sort((a, b) => a.km - b.km);
        const tunnels = ((line.properties.tunnels as [number, number][]) ?? []).map(([a, b]) => [a * k, b * k] as [number, number]);
        return { id, km: total, coords, cum, tunnels, stations };
      });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** The same route travelled the other way. */
export function reverse(g: RouteGeo): RouteGeo {
  const coords = [...g.coords].reverse();
  return {
    ...g,
    coords,
    cum: g.cum.map((c) => g.km - c).reverse(),
    tunnels: g.tunnels.map(([a, b]) => [g.km - b, g.km - a] as [number, number]).reverse(),
    stations: g.stations.map((s) => ({ ...s, km: g.km - s.km })).reverse(),
  };
}

function indexAt(g: RouteGeo, km: number) {
  let lo = 0;
  let hi = g.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.cum[mid] <= km) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** [lon, lat] at `km` along the trip. */
export function pointAt(g: RouteGeo, km: number): [number, number] {
  const k = Math.min(g.km, Math.max(0, km));
  const i = indexAt(g, k);
  const a = g.coords[i];
  const b = g.coords[Math.min(i + 1, g.coords.length - 1)];
  const span = g.cum[Math.min(i + 1, g.cum.length - 1)] - g.cum[i] || 1;
  const t = (k - g.cum[i]) / span;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function bearing(a: [number, number], b: [number, number]) {
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad);
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** Direction of travel at `km`, averaged over ±span km so the camera doesn't jitter on every curve. */
export function headingAt(g: RouteGeo, km: number, span: number) {
  const a = pointAt(g, Math.max(0, km - span));
  const b = pointAt(g, Math.min(g.km, km + span));
  return bearing(a, b);
}

/** Move `km` along a bearing (degrees) from a point. */
export function offset(p: [number, number], brg: number, km: number): [number, number] {
  const d = km / R;
  const t = brg * rad;
  const la1 = p[1] * rad;
  const lo1 = p[0] * rad;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(t));
  const lo2 = lo1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [lo2 / rad, la2 / rad];
}

/** Last station at or behind `km` (index), -1 before the first. */
export function passedIndex(g: RouteGeo, km: number) {
  let i = -1;
  for (let s = 0; s < g.stations.length; s++) if (g.stations[s].km <= km + 0.05) i = s;
  return i;
}

export const inTunnel = (g: RouteGeo, km: number) => g.tunnels.some(([a, b]) => km >= a && km <= b);
