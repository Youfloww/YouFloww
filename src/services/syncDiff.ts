/**
 * Pure helpers for cloud sync (no Firebase import, so they can be tested against the emulator).
 * Counters are written as atomic increments of (local - lastKnownServer); everything else is written
 * per top-level field, only when it changed. Sessions are never written by replacing the whole document.
 */
import { recordFocusSession } from '@/data/model';
import type { SessionLogEntry, UserData } from '@/data/types';

export const COUNTER_TOP = ['totalFocusSeconds', 'totalSessions'] as const;
/** { day: seconds|count } */
export const COUNTER_MAPS = ['dailyFocusSeconds', 'weeklyFocusSeconds', 'weeklySessions', 'weeklyCompletedSessions', 'weeklyEarlyEndedSessions', 'weeklyAnonymousSeconds', 'weeklyAnonymousSessions'] as const;
/** { day: { key: seconds|count } } */
export const COUNTER_MAPS2 = ['weeklyTaskSecondsByDate', 'weeklyCategorySecondsByDate', 'weeklyCategoryCompletionsByDate'] as const;
/** Fields computed from the counters (recomputed by `derive`, never written). */
const DERIVED = ['totalFocusMinutes', 'weeklyFocus'];
const OWNED = new Set<string>([...COUNTER_TOP, ...COUNTER_MAPS, ...COUNTER_MAPS2, ...DERIVED, 'hourlyFocusSeconds', 'sessionLog', 'wallet']);

interface FsHelpers {
  increment: (n: number) => unknown;
  arrayUnion: (...v: unknown[]) => unknown;
  deleteField: () => unknown;
  FieldPath: new (...segs: string[]) => unknown;
}

const asRec = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
export const clean = <T>(d: T) => JSON.parse(JSON.stringify(d)) as T; // Firestore rejects `undefined`

/** The document as stored: hours are a map so each hour can be incremented atomically. */
export function toWire(d: UserData) {
  const c = clean(d) as Record<string, unknown>;
  c.hourlyFocusSeconds = Object.fromEntries((d.hourlyFocusSeconds ?? Array(24).fill(0)).map((v, i) => [String(i), v]));
  return c;
}

/** Recompute fields that follow from the counters. */
export function derive(d: UserData) {
  d.totalFocusMinutes = Math.floor(d.totalFocusSeconds / 60);
  for (const [k, v] of Object.entries(d.weeklyFocusSeconds)) d.weeklyFocus[k] = Math.floor(v / 60);
  return d;
}

export interface Writes {
  /** alternating FieldPath, value ... for updateDoc */
  args: unknown[];
  /** log entries that changed after they were sent (a rating); written by a best-effort transaction */
  edited: SessionLogEntry[];
}

export function buildWrites(fs: FsHelpers, base: UserData, cur: UserData): Writes {
  const args: unknown[] = [];
  const put = (value: unknown, ...path: string[]) => args.push(new fs.FieldPath(...path), value);
  const add = (delta: number, ...path: string[]) => delta && put(fs.increment(delta), ...path);
  const b = base as Record<string, unknown>;
  const c = cur as Record<string, unknown>;

  for (const k of COUNTER_TOP) add(n(c[k]) - n(b[k]), k);
  // a key missing locally was only pruned (old day): never a negative delta
  for (const k of COUNTER_MAPS) for (const [key, v] of Object.entries(asRec(c[k]))) add(n(v) - n(asRec(b[k])[key]), k, key);
  for (const k of COUNTER_MAPS2)
    for (const [day, m] of Object.entries(asRec(c[k]))) for (const [key, v] of Object.entries(asRec(m))) add(n(v) - n(asRec(asRec(b[k])[day])[key]), k, day, key);
  for (let i = 0; i < 24; i++) add(n(cur.hourlyFocusSeconds?.[i]) - n(base.hourlyFocusSeconds?.[i]), 'hourlyFocusSeconds', String(i));

  // wallet: coins and owned items are counters too (two devices earning/spending must both count)
  const cw = asRec(c.wallet);
  const bw = asRec(b.wallet);
  add(n(cw.coins) - n(bw.coins), 'wallet', 'coins');
  add(n(cw.earned) - n(bw.earned), 'wallet', 'earned');
  const items = new Set([...Object.keys(asRec(cw.items)), ...Object.keys(asRec(bw.items))]);
  for (const id of items) add(n(asRec(cw.items)[id]) - n(asRec(bw.items)[id]), 'wallet', 'items', id);

  // new sessions: appended atomically, matched by their start time
  const sent = new Map((base.sessionLog ?? []).map((e) => [e.at, e]));
  const edited: SessionLogEntry[] = [];
  const fresh: SessionLogEntry[] = [];
  for (const e of cur.sessionLog ?? []) {
    const old = sent.get(e.at);
    if (!old) fresh.push(clean(e));
    else if (JSON.stringify(old) !== JSON.stringify(e)) edited.push(clean(e));
  }
  if (fresh.length) put(fs.arrayUnion(...fresh), 'sessionLog');

  // everything else: replace the field, but only if this device changed it
  for (const k of Object.keys(c)) {
    if (OWNED.has(k) || c[k] === undefined) continue;
    if (JSON.stringify(c[k]) !== JSON.stringify(b[k])) put(clean(c[k]), k);
  }
  for (const k of Object.keys(b)) if (!OWNED.has(k) && !(k in c)) put(fs.deleteField(), k);
  return { args, edited };
}

/** Streak fields are not counters: when two devices disagree keep the later day (then the higher count). */
export function betterStreak(a: UserData, b: UserData): UserData {
  const key = (d: UserData) => `${d.lastStreakDate ?? ''}|${String(d.streakCount).padStart(6, '0')}`;
  return key(a) >= key(b) ? a : b;
}

/**
 * Record sessions that `target` doesn't have yet (matched by start time) through the normal accounting path.
 * `guardOld` skips sessions older than a full (150) log can show, which can't be told apart from trimmed ones.
 */
export function replayMissing(target: UserData, entries: SessionLogEntry[] | undefined, guardOld = true): number {
  const log = target.sessionLog ?? [];
  const have = new Set(log.map((e) => e.at));
  const oldest = guardOld && log.length >= 150 ? log[0].at : 0;
  const todo = (entries ?? [])
    .filter((e) => e && Number.isFinite(e.at) && e.sec > 0 && !have.has(e.at) && e.at >= oldest)
    .sort((x, y) => x.at - y.at);
  for (const e of todo) {
    recordFocusSession(target, { seconds: e.sec, completed: !!e.done, startedAt: e.at, replay: true });
    target.sessionLog![target.sessionLog!.length - 1] = { ...e }; // keep task / rating of the original
  }
  if (todo.length) target.updatedAt = Date.now();
  return todo.length;
}

/** What to do with a document snapshot. Nothing is seeded or saved until one really came from the server. */
export function snapshotAction(ready: boolean, meta: { fromCache: boolean; hasPendingWrites: boolean }, exists: boolean): 'cache' | 'seed' | 'load' | 'live' | 'skip' {
  if (!ready) return meta.fromCache ? 'cache' : exists ? 'load' : 'seed';
  return meta.fromCache || meta.hasPendingWrites || !exists ? 'skip' : 'live';
}
