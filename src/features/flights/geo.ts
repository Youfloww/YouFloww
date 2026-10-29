/**
 * Airports, great-circle maths and the flight profile. Data lives in public/data/flights and is only fetched
 * while the Focus Flights mode is open (OurAirports, public domain; time zones from mwgg/Airports, MIT).
 */
export interface Airport {
  iata: string;
  name: string;
  city: string;
  /** ISO 3166-1 alpha-2 */
  cc: string;
  lat: number;
  lon: number;
  tz: string;
  big: boolean;
}

export type LngLat = [number, number];

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
let airportsReq: Promise<Airport[]> | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      last = e;
      await new Promise((ok) => setTimeout(ok, 600 * (i + 1)));
    }
  }
  throw last;
}

export function loadAirports(): Promise<Airport[]> {
  return (airportsReq ??= fetchJson<{ tz: string[]; a: [string, string, string, string, number, number, number, number][] }>(
    `${import.meta.env.BASE_URL}data/flights/airports.json`,
  )
    .then((d) => d.a.map(([iata, name, city, cc, lat, lon, tz, big]) => ({ iata, name, city, cc, lat, lon, tz: d.tz[tz], big: !!big })))
    .catch((e) => {
      airportsReq = null;
      throw e;
    }));
}

let countriesReq: Promise<Record<string, string>> | null = null;
/** Natural Earth 1:110m outlines as SVG paths in a 360×150 equirectangular box (x = lon+180, y = 90-lat). */
export const loadCountries = () =>
  (countriesReq ??= fetchJson<Record<string, string>>(`${import.meta.env.BASE_URL}data/flights/countries.json`).catch((e) => {
    countriesReq = null;
    throw e;
  }));

/** Forget the cached data when the mode closes (it's small, but nothing of ours should linger). */
export function releaseData() {
  airportsReq = null;
  countriesReq = null;
}

/* ------------------------------------------------------------------ */
/* Countries, flags, local time                                        */
/* ------------------------------------------------------------------ */
let regionNames: Intl.DisplayNames | null = null;
export function countryName(cc: string) {
  try {
    regionNames ??= new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' });
    return regionNames.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** 🇮🇳 from "IN" (regional indicator symbols, no images needed). */
export const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️');

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions, key: string) {
  const k = `${tz}|${key}`;
  let f = fmtCache.get(k);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz });
    } catch {
      f = new Intl.DateTimeFormat(undefined, opts);
    }
    fmtCache.set(k, f);
  }
  return f;
}
export const localTime = (tz: string, at: number = Date.now()) => fmt(tz, { hour: 'numeric', minute: '2-digit' }, 't').format(at);
export const localDay = (tz: string, at: number = Date.now()) => fmt(tz, { weekday: 'short' }, 'd').format(at);
/** Hour of day (0-23.99) in that time zone. */
export function localHour(tz: string, at: number = Date.now()) {
  const parts = fmt(tz, { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }, 'h').formatToParts(at);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return (h % 24) + m / 60;
}
export type Sky = 'day' | 'sunset' | 'night';
export function skyAt(tz: string, at = Date.now()): Sky {
  const h = localHour(tz, at);
  if (h >= 7 && h < 17.5) return 'day';
  if ((h >= 17.5 && h < 19.5) || (h >= 5.5 && h < 7)) return 'sunset';
  return 'night';
}

/* ------------------------------------------------------------------ */
/* Great circles                                                       */
/* ------------------------------------------------------------------ */
const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point a fraction `f` of the way along the great circle from a to b. */
export function along(a: { lat: number; lon: number }, b: { lat: number; lon: number }, f: number): LngLat {
  const φ1 = rad(a.lat), λ1 = rad(a.lon), φ2 = rad(b.lat), λ2 = rad(b.lon);
  const δ = distanceKm(a, b) / R;
  if (δ < 1e-9) return [a.lon, a.lat];
  const A = Math.sin((1 - f) * δ) / Math.sin(δ);
  const B = Math.sin(f * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return [deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))];
}

/** Longitudes made continuous so a line never jumps across the map at ±180°. */
export function unwrap(points: LngLat[]): LngLat[] {
  const out: LngLat[] = [];
  let offset = 0;
  points.forEach(([lon, lat], i) => {
    if (i > 0) {
      const prev = points[i - 1][0];
      if (lon - prev > 180) offset -= 360;
      else if (prev - lon > 180) offset += 360;
    }
    out.push([lon + offset, lat]);
  });
  return out;
}

export function arc(a: { lat: number; lon: number }, b: { lat: number; lon: number }, from = 0, to = 1, n = 96): LngLat[] {
  const pts: LngLat[] = [];
  const steps = Math.max(2, Math.ceil(n * (to - from)));
  for (let i = 0; i <= steps; i++) pts.push(along(a, b, from + ((to - from) * i) / steps));
  return unwrap(pts);
}

/** Compass heading (0 = north) from p towards q. */
export function bearing(p: LngLat, q: LngLat) {
  const φ1 = rad(p[1]), φ2 = rad(q[1]), Δλ = rad(q[0] - p[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/* ------------------------------------------------------------------ */
/* Flight times                                                        */
/* ------------------------------------------------------------------ */
export const CRUISE_KMH = 800;
export const GROUND_MIN = 15;
export const MAX_MIN = 180;
export const MIN_MIN = 15;
/** taxi + climb + approach: the full 15 min on real routes, a little less on short hops (so 15-25 min sessions have places to go) */
const groundMin = (km: number) => Math.min(GROUND_MIN, 5 + km / 36);
export const flightMinutes = (km: number) => Math.max(MIN_MIN, Math.round((km / CRUISE_KMH) * 60 + groundMin(km)));
/** inverse of flightMinutes (for "about N km away") */
export function kmForMinutes(min: number) {
  let lo = 0;
  let hi = 4000;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if ((mid / CRUISE_KMH) * 60 + groundMin(mid) < min) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`) : `${m} min`;
}
export const fmtKm = (km: number) => `${Math.round(km).toLocaleString()} km`;

/* ------------------------------------------------------------------ */
/* Flight profile: where the plane is, how high and how fast           */
/* ------------------------------------------------------------------ */
export type Phase = 'boarding' | 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'landing' | 'gate' | 'arrived';
export interface FlightState {
  phase: Phase;
  /** 0..1 of the route distance */
  f: number;
  altM: number;
  kmh: number;
  kmLeft: number;
  seatbelt: boolean;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** relative speed while airborne (u = 0..1 of the airborne time) */
const speedShape = (u: number) => 0.32 + 0.68 * Math.min(smooth(u / 0.16), smooth((1 - u) / 0.22));
const TABLE = (() => {
  const n = 400;
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + speedShape((i - 0.5) / n));
  const total = cum[n];
  return { n, cum: cum.map((c) => c / total), mean: total / n };
})();
function distFrac(u: number) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const x = u * TABLE.n;
  const i = Math.floor(x);
  return TABLE.cum[i] + (TABLE.cum[Math.min(TABLE.n, i + 1)] - TABLE.cum[i]) * (x - i);
}

/** Everything the cockpit shows at progress p (0..1 of the session) for a flight of `km` lasting `min` minutes. */
export function flightAt(p: number, km: number, min: number): FlightState {
  // the boarding → taxi → takeoff moment plays in the first seconds; the end is the taxi to the gate
  const taxiOut = Math.min(8 / 60, min * 0.05) / min;
  const taxiIn = Math.min(2, min * 0.05) / min;
  const airStart = taxiOut;
  const airEnd = 1 - taxiIn;
  const cruiseAlt = Math.min(11300, Math.max(3600, km * 14));
  if (p < airStart) {
    const q = p / airStart;
    return { phase: q < 0.25 ? 'boarding' : q < 0.85 ? 'taxi' : 'takeoff', f: 0, altM: 0, kmh: q < 0.25 ? 0 : q < 0.85 ? 22 : Math.round(30 + 220 * smooth((q - 0.85) / 0.15)), kmLeft: km, seatbelt: true };
  }
  if (p >= airEnd) {
    const q = (p - airEnd) / Math.max(1e-6, 1 - airEnd);
    return { phase: p >= 1 ? 'arrived' : 'gate', f: 1, altM: 0, kmh: p >= 1 ? 0 : Math.round(40 * (1 - q) + 10), kmLeft: 0, seatbelt: true };
  }
  const u = (p - airStart) / (airEnd - airStart);
  const f = distFrac(u);
  const airborneH = ((airEnd - airStart) * min) / 60;
  const kmh = Math.round((km / Math.max(0.05, airborneH)) * (speedShape(u) / TABLE.mean));
  const climb = smooth(u / 0.2);
  const descend = smooth((1 - u) / 0.26);
  const altM = Math.round(cruiseAlt * Math.min(climb, descend));
  const phase: Phase = u < 0.2 ? 'climb' : u > 0.74 ? (u > 0.95 ? 'landing' : 'descent') : 'cruise';
  return { phase, f, altM, kmh, kmLeft: Math.max(0, km * (1 - f)), seatbelt: phase !== 'cruise' };
}

export const PHASE_LABEL: Record<Phase, string> = {
  boarding: 'Boarding',
  taxi: 'Taxiing to the runway',
  takeoff: 'Taking off',
  climb: 'Climbing',
  cruise: 'Cruising',
  descent: 'Descending',
  landing: 'Final approach',
  gate: 'Taxiing to the gate',
  arrived: 'Arrived',
};

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function searchAirports(list: Airport[], q: string, max = 8): Airport[] {
  const t = norm(q.trim());
  if (!t) return [];
  const scored: [number, Airport][] = [];
  for (const a of list) {
    let s = 0;
    const iata = a.iata.toLowerCase();
    const city = norm(a.city);
    if (iata === t) s = 100;
    else if (city === t) s = 90;
    else if (city.startsWith(t)) s = 70;
    else if (t.length >= 3 && norm(a.name).includes(t)) s = 45;
    else if (t.length >= 3 && city.includes(t)) s = 40;
    else if (t.length >= 4 && norm(countryName(a.cc)).startsWith(t)) s = 25;
    if (s) scored.push([s + (a.big ? 8 : 0), a]);
  }
  return scored
    .sort((x, y) => y[0] - x[0] || x[1].city.localeCompare(y[1].city))
    .slice(0, max)
    .map((x) => x[1]);
}

export interface Reach {
  a: Airport;
  km: number;
  min: number;
}

/** Destinations from `from` that take about `minutes` (one airport per city, big airports first). */
export function reachable(list: Airport[], from: Airport, minutes: number, max = 24): Reach[] {
  const tol = Math.max(4, minutes * 0.12);
  const byCity = new Map<string, Reach>();
  for (const a of list) {
    if (a.iata === from.iata) continue;
    const km = distanceKm(from, a);
    const min = flightMinutes(km);
    if (Math.abs(min - minutes) > tol || min > MAX_MIN) continue;
    if (km < 40) continue;
    const key = `${a.cc}|${norm(a.city)}`;
    const prev = byCity.get(key);
    if (!prev || (a.big && !prev.a.big)) byCity.set(key, { a, km, min });
  }
  return [...byCity.values()]
    .sort((x, y) => Number(y.a.big) - Number(x.a.big) || Math.abs(x.min - minutes) - Math.abs(y.min - minutes))
    .slice(0, max)
    .sort((x, y) => x.min - y.min || x.a.city.localeCompare(y.a.city));
}

/** Closest airport to a point (for a diverted landing). */
export function nearestAirport(list: Airport[], p: LngLat, preferBig = true): Airport | null {
  let best: Airport | null = null;
  let bd = Infinity;
  for (const a of list) {
    const d = distanceKm({ lat: p[1], lon: p[0] }, a) * (preferBig && !a.big ? 1.6 : 1);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}

/** Stable small hash (flight numbers, gates, stamp shapes). */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Same route, same flight number, like a real airline. */
export const flightNo = (from: string, to: string) => `YF${100 + (hash(`${from}>${to}`) % 8900)}`;
