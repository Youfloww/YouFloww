/**
 * The focus ledger: focus time witnessed by the server, the only focus record Focus Pledges and the public
 * leaderboards trust. Stored at `focusLedger/{uid}`, written only by POST /api/focus/log through the Admin SDK
 * (the owner may read it; no browser may write it).
 *
 * The browser reports finished sessions; the server credits them against REAL elapsed time on its own clock.
 * A batch is laid back to back so that it ends at the moment it arrives, and it never reaches back past the end
 * of the previous batch (for a person's very first batch: past the account's creation or 12 h ago, whichever is
 * later). When a batch claims more than that, its oldest sessions are trimmed. So whatever the browser sends,
 * nobody can log more focus than time has passed, backdate focus, or log the same minutes twice. (Time spent
 * idle can still be claimed: the server can't see what happened in front of the screen.)
 *
 * One-time grandfathering when a person's ledger is created, so nobody loses a streak to the switch: their old,
 * browser-written `publicUsers/{uid}` entry carries over
 *  - its streak, only while still alive (last updated today or yesterday in the person's zone) and never longer
 *    than the account has existed in calendar days;
 *  - today's minutes, only if the entry is from today and never more than the time since local midnight (or
 *    since the account was created, if later). They count toward today's leaderboard only: not toward the
 *    lifetime `totalSec` or the session list, so never toward a pledge.
 * After that the server overwrites the entry and nothing the browser wrote is trusted again.
 *
 * Pure (imports only rules.ts): shared by the Vercel function and the browser, unit-tested without Firebase.
 */
import { addDaysKey, splitZonedDays, validTimeZone, zonedDateKey, zonedMidnight, type FocusLog } from './rules.js';

/** sessions kept in the ledger (the oldest are dropped) */
export const LEDGER_SESSION_CAP = 400;
/** calendar days kept in `days` (older ones are dropped) */
export const LEDGER_DAYS_KEPT = 70;
/** at most one report per this many ms per person (HTTP 429) */
export const LEDGER_MIN_CALL_GAP_MS = 3000;
/** how far a person's very first batch may reach back (never before the account existed) */
export const LEDGER_FIRST_LOOKBACK_MS = 12 * 3600 * 1000;
export const SESSION_SEC_MIN = 30;
export const SESSION_SEC_MAX = 6 * 3600;
export const BATCH_MAX = 20;
export const NAME_MAX = 40;
export const DEFAULT_NAME = 'Floww User';

export interface LedgerSession {
  /** start, server time (ms) */
  at: number;
  /** credited seconds */
  sec: number;
}

/** Firestore `focusLedger/{uid}`. */
export interface FocusLedgerDoc {
  v: 1;
  /** server time (ms) up to which focus has been credited: no later batch can reach back past it */
  lastEnd: number;
  /** lifetime credited seconds (a pledge's baseline is this value at activation) */
  totalSec: number;
  /** zone of the latest report; each report's sessions are filed under the days of the zone it was sent in */
  tz: string;
  /** credited seconds per local calendar day, the last 70 days (may include grandfathered minutes, see above) */
  days: Record<string, number>;
  /** streak as of `streakDay`; it is alive while `streakDay` is today or yesterday */
  streak: number;
  /** the last day with credited focus, 'YYYY-MM-DD' ('' = none yet) */
  streakDay: string;
  /** credited sessions, oldest first, at most 400 */
  sessions: LedgerSession[];
  updatedAt: number;
  /** server time of the latest report (rate limit) */
  lastCall: number;
}

/** A checked request body of POST /api/focus/log. */
export interface FocusBatch {
  /** oldest first */
  sessions: { sec: number; done: boolean }[];
  tz: string;
  /** already cleaned */
  name: string;
}

/** What the server writes to `publicUsers/{uid}` (the shape src/services/community.ts reads). */
export interface PublicEntry {
  profileName: string;
  todayFocusMinutes: number;
  currentStreak: number;
  lastStreakUpdate: string;
  date: string;
  isGuest: false;
}

/** What a person's first report needs, when they have no ledger yet. */
export interface FirstLedger {
  /** Firebase Auth account creation time (ms) */
  createdAt: number;
  /** their old browser-written `publicUsers/{uid}` entry, or null */
  publicUser?: unknown;
}

export interface BatchResult {
  ledger: FocusLedgerDoc;
  /** seconds credited by this batch */
  credited: number;
  /** the sessions credited by this batch, oldest first */
  added: LedgerSession[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A real calendar day 'YYYY-MM-DD'. */
export const isDayKey = (k: unknown): k is string => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && addDaysKey(k, 0) === k;

/** Whole calendar days from day `a` to day `b`. */
export function dayGap(a: string, b: string) {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}

/* ------------------------------------------------------------------ the request */

// control characters, lone surrogates, line/paragraph separators and invisible format characters (bidi
// overrides, zero-width spaces, BOM); ZWNJ/ZWJ stay, Indic scripts and emoji need them
const INVISIBLE = /(?![‌‍])[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/gu;

/** A display name fit for the public leaderboard: visible characters only, single spaces, at most 40 UTF-16 units. */
export function cleanProfileName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_NAME;
  const s = raw.slice(0, 1000).replace(INVISIBLE, '').replace(/\s+/gu, ' ').trim();
  let out = '';
  for (const ch of s) {
    if (out.length + ch.length > NAME_MAX) break;
    out += ch;
  }
  return out.trim() || DEFAULT_NAME;
}

/**
 * The body of POST /api/focus/log, checked strictly: 1..20 sessions, each `{ sec: integer 30..21600, done:
 * boolean }`, a valid IANA `tz`, and `name` a string (cleaned; a missing name gets the default). Null otherwise.
 */
export function parseFocusBatch(body: unknown): FocusBatch | null {
  if (!isObj(body)) return null;
  const list = body.sessions;
  if (!Array.isArray(list) || list.length < 1 || list.length > BATCH_MAX) return null;
  const sessions: FocusBatch['sessions'] = [];
  for (const e of list) {
    if (!isObj(e)) return null;
    const { sec, done } = e;
    if (typeof sec !== 'number' || !Number.isInteger(sec) || sec < SESSION_SEC_MIN || sec > SESSION_SEC_MAX) return null;
    if (typeof done !== 'boolean') return null;
    sessions.push({ sec, done });
  }
  if (!validTimeZone(body.tz)) return null;
  if (body.name !== undefined && typeof body.name !== 'string') return null;
  return { sessions, tz: body.tz, name: cleanProfileName(body.name) };
}

/* ------------------------------------------------------------------ the ledger */

/** A stored ledger, read defensively: a broken field gets a safe value (a broken `lastEnd` means nothing to credit yet). */
export function readLedger(raw: unknown, now: number): FocusLedgerDoc {
  const r = isObj(raw) ? raw : {};
  const days: Record<string, number> = {};
  if (isObj(r.days)) for (const [k, v] of Object.entries(r.days)) if (isDayKey(k) && fin(v) && v > 0) days[k] = v;
  const sessions: LedgerSession[] = [];
  if (Array.isArray(r.sessions)) {
    for (const e of r.sessions.slice(-LEDGER_SESSION_CAP)) {
      if (isObj(e) && fin(e.at) && e.at > 0 && fin(e.sec) && e.sec > 0) sessions.push({ at: e.at, sec: e.sec });
    }
  }
  return {
    v: 1,
    lastEnd: fin(r.lastEnd) && r.lastEnd > 0 ? r.lastEnd : now,
    totalSec: fin(r.totalSec) && r.totalSec > 0 ? r.totalSec : 0,
    tz: validTimeZone(r.tz) ? r.tz : 'UTC',
    days,
    streak: fin(r.streak) && r.streak > 0 ? Math.floor(r.streak) : 0,
    streakDay: isDayKey(r.streakDay) ? r.streakDay : '',
    sessions,
    updatedAt: fin(r.updatedAt) ? r.updatedAt : 0,
    lastCall: fin(r.lastCall) ? r.lastCall : 0,
  };
}

/** True when the person's previous report was under 3 s ago (HTTP 429). */
export const tooSoon = (l: Pick<FocusLedgerDoc, 'lastCall'>, now: number) => now - l.lastCall < LEDGER_MIN_CALL_GAP_MS;

/** The app's streak rule (src/data/model.ts bumpStreak): any focus counts; the next day +1, the same day nothing, a gap restarts at 1. */
function bumpStreak(l: FocusLedgerDoc, day: string) {
  if (l.streakDay && l.streakDay >= day) return;
  l.streak = l.streakDay && dayGap(l.streakDay, day) === 1 ? l.streak + 1 : 1;
  l.streakDay = day;
}

/** One-time: a still-alive streak from the old public entry, at most as many days as the account has existed. */
function grandfatherStreak(l: FocusLedgerDoc, pub: unknown, created: number, tz: string, today: string) {
  if (!isObj(pub)) return;
  const day = pub.lastStreakUpdate;
  const n = pub.currentStreak;
  if (!isDayKey(day) || (day !== today && day !== addDaysKey(today, -1))) return;
  if (!fin(n) || n < 1) return;
  const maxDays = dayGap(zonedDateKey(created, tz), day) + 1;
  if (maxDays < 1) return;
  l.streak = Math.min(Math.floor(n), maxDays);
  l.streakDay = day;
}

/** One-time: today's minutes from the old public entry, never more than the time since local midnight (or account creation). */
function carryToday(l: FocusLedgerDoc, pub: unknown, created: number, now: number, tz: string, today: string) {
  if (!isObj(pub) || pub.date !== today || !fin(pub.todayFocusMinutes) || pub.todayFocusMinutes <= 0) return;
  const since = Math.max(zonedMidnight(today, tz), created);
  const room = Math.floor((now - since) / 1000) - (l.days[today] ?? 0);
  const carry = Math.min(Math.round(pub.todayFocusMinutes * 60), room);
  if (carry > 0) l.days[today] = (l.days[today] ?? 0) + carry;
}

/**
 * Credit a batch of finished sessions (oldest first) at server time `now`, filed under the days of zone `tz`.
 * `prev` is the stored ledger, or null for a person's first report ever (then `first` gives the account's
 * creation time and the old public entry to grandfather). Credits at most the whole seconds since
 * `prev.lastEnd`; the sessions are laid back to back ending at `now`, the oldest trimmed when they don't fit.
 */
export function applyBatch(prev: FocusLedgerDoc | null, batch: readonly { sec: number }[], tz: string, now: number, first?: FirstLedger): BatchResult {
  const today = zonedDateKey(now, tz);
  const created = first && fin(first.createdAt) ? Math.min(first.createdAt, now) : now;
  const from = prev ? prev.lastEnd : Math.max(created, now - LEDGER_FIRST_LOOKBACK_MS);
  let room = Math.max(0, Math.floor((now - from) / 1000));

  const added: LedgerSession[] = [];
  let end = now;
  for (let i = batch.length - 1; i >= 0 && room > 0; i--) {
    const want = fin(batch[i].sec) ? Math.floor(Math.min(SESSION_SEC_MAX, batch[i].sec)) : 0;
    const sec = Math.min(want, room);
    if (sec <= 0) continue;
    end -= sec * 1000;
    added.unshift({ at: end, sec });
    room -= sec;
  }
  const credited = added.reduce((a, s) => a + s.sec, 0);

  const l: FocusLedgerDoc = prev
    ? { ...prev, days: { ...prev.days }, sessions: [...prev.sessions] }
    : { v: 1, lastEnd: from, totalSec: 0, tz, days: {}, streak: 0, streakDay: '', sessions: [], updatedAt: now, lastCall: 0 };
  if (!prev && first) grandfatherStreak(l, first.publicUser, created, tz, today);
  for (const s of added) {
    for (const [day, sec] of splitZonedDays(s.at, s.sec, tz)) {
      l.days[day] = (l.days[day] ?? 0) + sec;
      bumpStreak(l, day);
    }
  }
  if (!prev && first) carryToday(l, first.publicUser, created, now, tz, today);

  l.totalSec += credited;
  l.sessions = [...l.sessions, ...added].slice(-LEDGER_SESSION_CAP);
  const oldest = addDaysKey(today, -(LEDGER_DAYS_KEPT - 1));
  for (const day of Object.keys(l.days)) if (day < oldest) delete l.days[day];
  l.lastEnd = Math.max(prev ? prev.lastEnd : 0, now);
  l.tz = tz;
  l.updatedAt = now;
  l.lastCall = now;
  return { ledger: l, credited, added };
}

/* ------------------------------------------------------------------ reading it */

/** The streak as shown on `today`: alive while the last focus day is today or yesterday, otherwise 0. */
export function aliveStreak(l: Pick<FocusLedgerDoc, 'streak' | 'streakDay'>, today: string) {
  return l.streakDay && l.streakDay >= addDaysKey(today, -1) ? l.streak : 0;
}

/** Seconds as the leaderboard's minutes (2 decimals, at most a day). */
export const ledgerMinutes = (sec: number) => Math.min(1440, parseFloat((Math.max(0, sec) / 60).toFixed(2)));

/** The public leaderboard entry `publicUsers/{uid}`, as of `now` in zone `tz`. */
export function publicEntryFor(l: FocusLedgerDoc, name: string, now: number, tz: string): PublicEntry {
  const today = zonedDateKey(now, tz);
  return {
    profileName: cleanProfileName(name),
    todayFocusMinutes: ledgerMinutes(l.days[today] ?? 0),
    currentStreak: aliveStreak(l, today),
    lastStreakUpdate: l.streakDay || today,
    date: today,
    isGuest: false,
  };
}

/**
 * A ledger document (as stored, or null) as the focus log `computeProgress` reads, for pledges with
 * `src: 'ledger'`. Sessions and lifetime total only: no per-day totals, so only witnessed sessions count.
 */
export function ledgerFocusLog(raw: unknown): FocusLog {
  const r = isObj(raw) ? raw : {};
  return {
    sessionLog: Array.isArray(r.sessions) ? r.sessions : [],
    totalFocusSeconds: fin(r.totalSec) ? r.totalSec : 0,
    logCap: LEDGER_SESSION_CAP,
  };
}
