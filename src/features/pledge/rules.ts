/**
 * Focus Pledge rules, shared by the browser (live progress, goal builder) and the Vercel functions in
 * api/pledge (create / verify / settle). Pure: no imports, no DOM, no Node APIs, so both sides compute
 * exactly the same thing from the same focus log.
 *
 * A pledge is a commitment device, not a bet: the person puts their own money behind their own goal.
 * Goal met -> full refund. Missed -> the money is donated to charity. Nobody can ever win money.
 */

/** Allowed pledge amounts, in rupees. The server only accepts these. */
export const PLEDGE_AMOUNTS = [49, 99, 199, 499] as const;
export type PledgeAmount = (typeof PLEDGE_AMOUNTS)[number];

export const HOURS_MIN = 2;
export const HOURS_MAX = 40;
export const DAYS_MIN = 1;
export const DAYS_MAX = 14;
export const STREAK_DAYS_MIN = 2;
export const STREAK_DAYS_MAX = 14;
/** A streak day counts when at least this much focus is logged on it. */
export const STREAK_DAY_MINUTES = 15;
/** The app records at most 6 h per session; anything bigger in a log is clipped. */
const MAX_SESSION_SEC = 6 * 3600;
/** The app keeps the newest 150 sessions in `sessionLog`. */
const LOG_CAP = 150;
/** Settlement waits this long after the deadline, so a last session can finish syncing. */
export const SETTLE_GRACE_MS = 60 * 60 * 1000;
/** Bump when the terms the person accepts change; the server refuses an older version. */
export const TERMS_VERSION = '2026-10-29';

export type Goal =
  | { kind: 'hours'; hours: number; days: number }
  | { kind: 'streak'; days: number; from: 'today' | 'tomorrow' };

export type PledgeStatus = 'active' | 'refund_pending' | 'refunded' | 'forfeited';
export type PledgeOutcome = 'met' | 'missed' | 'duplicate' | 'unclaimed';

/** The Firestore `pledges/{id}` document (written only by the server). */
export interface PledgeDoc {
  id: string;
  uid: string;
  amountPaise: number;
  goal: Goal;
  tz: string;
  startAt: number;
  deadline: number;
  baselineFocusSeconds: number;
  status: PledgeStatus;
  outcome?: PledgeOutcome | null;
  progressSeconds?: number | null;
  daysMet?: number | null;
  orderId: string;
  paymentId: string;
  refundId?: string | null;
  refundedAt?: number | null;
  settledAt?: number | null;
  createdAt: number;
  /** 'stub' = local test, nothing charged. 'test' = Razorpay test keys. 'live' = real money. */
  mode: 'stub' | 'test' | 'live';
}

/** The public `pledgeStats/public` document (written by the server and by the owner in the console). */
export interface PledgeStats {
  /** live pledges that were missed (money waiting to be / already donated) */
  forfeitedPaise?: number;
  /** what the owner has actually donated so far (updated by hand after each monthly donation) */
  donatedPaise?: number;
  keptCount?: number;
  missedCount?: number;
  /** owner-maintained: latest donations, newest first */
  donations?: { month: string; amountPaise: number; receiptUrl?: string }[];
  /** owner override of the charity shown in the app */
  charity?: Partial<Charity>;
  updatedAt?: number;
}

export interface Charity {
  name: string;
  blurb: string;
  url: string;
}

/** Where people write about a payment (shown in the terms when set). Fill in before going live. */
export const SUPPORT_EMAIL = '';

/** Default charity; the owner can change it in `pledgeStats/public.charity` without a deploy. */
export const DEFAULT_CHARITY: Charity = {
  name: 'Akshaya Patra Foundation',
  blurb: 'Freshly cooked mid-day meals for children in government schools across India.',
  url: 'https://www.akshayapatra.org/',
};

export const isAmount = (n: unknown): n is PledgeAmount => typeof n === 'number' && (PLEDGE_AMOUNTS as readonly number[]).includes(n);

const isInt = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/** Strict server-side goal parser: returns a clean copy or null. */
export function parseGoal(raw: unknown): Goal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const g = raw as Record<string, unknown>;
  if (g.kind === 'hours' && isInt(g.hours, HOURS_MIN, HOURS_MAX) && isInt(g.days, DAYS_MIN, DAYS_MAX)) {
    return { kind: 'hours', hours: g.hours, days: g.days };
  }
  if (g.kind === 'streak' && isInt(g.days, STREAK_DAYS_MIN, STREAK_DAYS_MAX) && (g.from === 'today' || g.from === 'tomorrow')) {
    return { kind: 'streak', days: g.days, from: g.from };
  }
  return null;
}

/* ------------------------------------------------------------------ time zones */

const dayFmt = new Map<string, Intl.DateTimeFormat>();
const fullFmt = new Map<string, Intl.DateTimeFormat>();

function getDayFmt(tz: string) {
  let f = dayFmt.get(tz);
  if (!f) dayFmt.set(tz, (f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })));
  return f;
}

export function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length < 1 || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try {
    getDayFmt(tz);
    return true;
  } catch {
    return false;
  }
}

/** 'YYYY-MM-DD' of an instant in a time zone (matches the app's local `dateKey`). */
export function zonedDateKey(ms: number, tz: string) {
  const parts = getDayFmt(tz).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Milliseconds the zone is ahead of UTC at an instant. */
function zoneOffsetMs(ms: number, tz: string) {
  let f = fullFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    fullFmt.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** Shift a 'YYYY-MM-DD' key by n calendar days. */
export function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** The instant a calendar day begins (local midnight) in a zone. */
export function zonedMidnight(key: string, tz: string) {
  const [y, m, d] = key.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let t = wall - zoneOffsetMs(wall, tz);
  t = wall - zoneOffsetMs(t, tz); // second pass settles DST edges
  return t;
}

/* ------------------------------------------------------------------ windows */

/** When the counting starts for a pledge activated at `activatedAt`. */
export function windowStart(goal: Goal, activatedAt: number, tz: string) {
  if (goal.kind === 'streak' && goal.from === 'tomorrow') return zonedMidnight(addDaysKey(zonedDateKey(activatedAt, tz), 1), tz);
  return activatedAt;
}

/** The deadline: exactly `days` × 24 h for hours goals; midnight after the last day for streaks. */
export function deadlineFor(goal: Goal, startAt: number, tz: string) {
  if (goal.kind === 'hours') return startAt + goal.days * 86400000;
  return zonedMidnight(addDaysKey(zonedDateKey(startAt, tz), goal.days), tz);
}

/** The calendar days a pledge covers, in its own zone. */
export function windowDays(goal: Goal, startAt: number, deadline: number, tz: string) {
  const first = zonedDateKey(startAt, tz);
  const last = zonedDateKey(deadline - 1, tz);
  const keys: string[] = [];
  for (let k = first; k <= last && keys.length < 20; k = addDaysKey(k, 1)) keys.push(k);
  return goal.kind === 'streak' ? keys.slice(0, goal.days) : keys;
}

export const targetSeconds = (goal: Goal) => (goal.kind === 'hours' ? goal.hours * 3600 : goal.days * STREAK_DAY_MINUTES * 60);

/* ------------------------------------------------------------------ progress */

/** The slice of the synced user data (Firestore `users/{uid}`) the pledge looks at. */
export interface FocusLog {
  totalFocusSeconds?: unknown;
  sessionLog?: unknown;
  dailyFocusSeconds?: unknown;
}

export interface PledgeWindow {
  goal: Goal;
  tz: string;
  startAt: number;
  deadline: number;
  baselineFocusSeconds: number;
}

export interface DayProgress {
  key: string;
  seconds: number;
  met: boolean;
}

export interface Progress {
  /** focus seconds that count toward the pledge */
  seconds: number;
  target: number;
  /** 0..1 */
  fraction: number;
  days: DayProgress[];
  daysMet: number;
  met: boolean;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function cleanLog(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const out: { at: number; sec: number }[] = [];
  for (const e of raw.slice(-LOG_CAP * 2)) {
    if (!e || typeof e !== 'object') continue;
    const at = num((e as { at?: unknown }).at);
    const sec = Math.min(MAX_SESSION_SEC, Math.max(0, num((e as { sec?: unknown }).sec)));
    if (at > 0 && sec > 0) out.push({ at, sec });
  }
  return out;
}

/**
 * Focus that counts toward a pledge, from the person's own YouFloww data.
 *
 * Primary source: `sessionLog` (each session's start time and length). A session counts when it STARTED inside
 * the window. When the log has rolled over (the app keeps 150 sessions), lifetime `totalFocusSeconds` minus the
 * baseline taken at pledge time (minus sessions after the deadline) fills the gap. For streak days, the
 * per-day `dailyFocusSeconds` is also used for whole days inside the window.
 *
 * `liveSeconds` is the browser's running, not-yet-recorded session (live ring only; the server passes 0).
 */
export function computeProgress(p: PledgeWindow, data: FocusLog | null | undefined, now = Date.now(), liveSeconds = 0): Progress {
  const log = cleanLog(data?.sessionLog);
  const end = Math.min(now, p.deadline);
  const inWin = log.filter((e) => e.at >= p.startAt && e.at < p.deadline);
  const after = log.filter((e) => e.at >= p.deadline).reduce((a, e) => a + e.sec, 0);
  const truncated = log.length >= LOG_CAP && log[0].at > p.startAt;
  const live = now < p.deadline ? Math.max(0, liveSeconds) : 0;

  let seconds = inWin.reduce((a, e) => a + e.sec, 0);
  if (truncated) seconds = Math.max(seconds, num(data?.totalFocusSeconds) - p.baselineFocusSeconds - after);
  seconds += live;
  // can't have focused longer than the window has existed (plus one session that started just before its end)
  seconds = Math.max(0, Math.min(seconds, Math.max(0, end - p.startAt) / 1000 + MAX_SESSION_SEC));

  const keys = windowDays(p.goal, p.startAt, p.deadline, p.tz);
  const perDay = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const e of inWin) {
    // a session over midnight is split across both days, exactly as the app's own per-day totals are
    let at = e.at;
    let left = e.sec;
    for (let guard = 0; left > 0 && guard < 4; guard++) {
      const k = zonedDateKey(at, p.tz);
      const nextMidnight = zonedMidnight(addDaysKey(k, 1), p.tz);
      const chunk = Math.min(left, Math.max(1, Math.ceil((nextMidnight - at) / 1000)));
      if (perDay.has(k)) perDay.set(k, perDay.get(k)! + chunk);
      left -= chunk;
      at += chunk * 1000;
    }
  }
  if (live) {
    const k = zonedDateKey(now, p.tz);
    if (perDay.has(k)) perDay.set(k, perDay.get(k)! + live);
  }
  const daily = data?.dailyFocusSeconds && typeof data.dailyFocusSeconds === 'object' ? (data.dailyFocusSeconds as Record<string, unknown>) : {};
  const firstKey = keys[0];
  const firstIsPartial = firstKey !== undefined && zonedMidnight(firstKey, p.tz) < p.startAt;
  const dayGoal = STREAK_DAY_MINUTES * 60;
  const days: DayProgress[] = keys.map((key) => {
    let s = perDay.get(key) ?? 0;
    // whole days inside the window can also trust the app's per-day total (it never rolls over)
    if (!(key === firstKey && firstIsPartial)) s = Math.max(s, Math.min(86400, num(daily[key])));
    return { key, seconds: s, met: s >= dayGoal };
  });
  const daysMet = days.filter((d) => d.met).length;

  if (p.goal.kind === 'streak') {
    const total = Math.max(seconds, days.reduce((a, d) => a + d.seconds, 0));
    return { seconds: total, target: targetSeconds(p.goal), fraction: daysMet / p.goal.days, days, daysMet, met: daysMet >= p.goal.days };
  }
  const target = targetSeconds(p.goal);
  return { seconds, target, fraction: Math.min(1, seconds / target), days, daysMet, met: seconds >= target };
}

/* ------------------------------------------------------------------ words */

export const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

export function goalSummary(goal: Goal) {
  if (goal.kind === 'hours') return `${goal.hours} focus hours in ${goal.days} ${goal.days === 1 ? 'day' : 'days'}`;
  return `${STREAK_DAY_MINUTES}+ min of focus every day for ${goal.days} days`;
}
