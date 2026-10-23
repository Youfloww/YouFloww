/** Local-timezone date key, e.g. 2026-10-05. Matches the v2 data format. */
export function dateKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function keyToDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Whole days from a to b (b - a), DST safe. */
export function diffDays(a: string, b: string) {
  const da = keyToDate(a);
  const db = keyToDate(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Keys for the last n days, oldest first, ending today. */
export function lastNDays(n: number, end = new Date()) {
  return Array.from({ length: n }, (_, i) => dateKey(addDays(end, i - (n - 1))));
}

/** mm:ss or h:mm:ss for a millisecond countdown (rounded up so 0:01 shows until done). */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m).padStart(2, '0');
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/** Friendly duration: 45s, 12m, 1h 05m, 132h */
export function formatDuration(seconds: number, opts: { long?: boolean } = {}) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return opts.long ? `${m} min` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h >= 100) return `${h}h`;
  return rm ? `${h}h ${String(rm).padStart(2, '0')}m` : `${h}h`;
}

export function formatHours(seconds: number, digits = 1) {
  return `${(seconds / 3600).toFixed(digits)}h`;
}

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const todayWeekday = (): Weekday => WEEKDAYS[new Date().getDay()];

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

/** "HH:MM" (24h) -> minutes since midnight */
export const hmToMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function formatHM(hm: string, h24 = false) {
  const [h, m] = hm.split(':').map(Number);
  if (h24) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ap = h >= 12 && h < 24 ? 'pm' : 'am'; // 24:00 is midnight, the end of the day
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')}${ap}`;
}

export const relativeDay = (key: string) => {
  const d = diffDays(key, dateKey());
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return keyToDate(key).toLocaleDateString(undefined, { weekday: 'long' });
  return keyToDate(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d > 300 ? 'numeric' : undefined });
};
