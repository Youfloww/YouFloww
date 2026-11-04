/**
 * Focus ledger reporter. Every focus session this tab finishes live (the timer's complete() and endEarly(), never a
 * replayed or a guest session) is queued on this device and sent to POST /api/focus/log, which credits it on the
 * server's own clock into focusLedger/{uid}. Focus Pledges and the public leaderboard trust only that ledger.
 *
 * - Queue: localStorage `floww:ledgerQ:<uid>`, oldest first. Sessions older than 48 h are dropped unsent.
 * - Sending: batches of up to 20, one request at a time, one tab at a time (a Web Lock per account).
 * - Answers: 200 = done. 400 = dropped, never retried. 401 = the ID token is refreshed once, then retried later.
 *   429, 5xx, offline, or no endpoint at all (local dev serves a 404 page) = kept and retried with backoff
 *   (30 s up to 5 min), and also when the browser comes back online, the tab is shown again, or the person signs in.
 *
 * Never throws and never blocks the UI. The pure parts are unit-tested in src/services/sync-test/ledger.ts.
 */
import { create } from 'zustand';
import { useData } from '@/store/data';
import type { FB } from './firebase';

export interface LedgerItem {
  /** random: a sent batch is removed exactly, even when another tab queued more meanwhile */
  id: string;
  sec: number;
  done: boolean;
  /** when the session ended (this device's clock) */
  end: number;
}

export const ENDPOINT = '/api/focus/log';
export const BATCH_MAX = 20;
export const MAX_AGE_MS = 48 * 3600_000;
export const SEC_MIN = 30;
export const SEC_MAX = 6 * 3600;
/** the server answers 429 to reports under 3 s apart: batches of one drain are spaced by this */
export const GAP_MS = 3500;
const QUEUE_MAX = 400;
const DEFAULT_NAME = 'Floww User';
export const queueKey = (uid: string) => `floww:ledgerQ:${uid}`;

/* ------------------------------------------------------------------ pure parts */

const rid = () => Math.random().toString(36).slice(2, 12);

/** The queue item for a finished session of `seconds`, or null when it is too short to report (under 30 s). */
export function makeItem(seconds: number, done: boolean, now: number, id = rid()): LedgerItem | null {
  if (!Number.isFinite(seconds)) return null;
  const sec = Math.min(SEC_MAX, Math.round(seconds));
  return sec >= SEC_MIN ? { id, sec, done: !!done, end: now } : null;
}

const isItem = (x: unknown): x is LedgerItem => {
  const o = x as LedgerItem;
  return (
    !!o && typeof o === 'object' && typeof o.id === 'string' && Number.isInteger(o.sec) && o.sec >= SEC_MIN && o.sec <= SEC_MAX && typeof o.done === 'boolean' && Number.isFinite(o.end)
  );
};

/** The stored queue, checked: well-formed items from the last 48 h, oldest first (at most 400, the newest kept). */
export function prune(raw: unknown, now: number): LedgerItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is LedgerItem => isItem(x) && x.end > now - MAX_AGE_MS)
    .sort((a, b) => a.end - b.end)
    .slice(-QUEUE_MAX);
}

export type Outcome = 'sent' | 'drop' | 'auth' | 'retry';

/**
 * What an answer means for its batch. 401: refresh the token. A 2xx JSON answer: sent. A 400 JSON answer: the
 * server will never take it, drop it. Anything else (no JSON: a dev server's 404 page or a proxy's error page; 404,
 * 429, 5xx; status 0 = no connection): keep it and try later.
 */
export function classify(status: number, json: unknown): Outcome {
  if (status === 401) return 'auth';
  if (!json || typeof json !== 'object') return 'retry';
  if (status >= 200 && status < 300) return 'sent';
  if (status === 400) return 'drop';
  return 'retry';
}

/** Wait before retry after `failures` failed rounds in a row (1, 2, ...): 30 s, 1 min, 2 min, 4 min, then 5 min. */
export const backoff = (failures: number) => Math.min(300_000, 30_000 * 2 ** Math.max(0, Math.min(10, failures - 1)));

/** The profile name as sent: trimmed, at most 40 UTF-16 units (never half an emoji), never empty. */
export function clipName(raw: unknown) {
  let n = typeof raw === 'string' ? raw.trim().slice(0, 40) : '';
  if (/[\uD800-\uDBFF]$/.test(n)) n = n.slice(0, -1);
  return n.trim() || DEFAULT_NAME;
}

/** An IANA zone the server accepts, else 'UTC' (a zone it can't read would get the whole batch dropped). */
export function zoneOrUtc(tz: unknown) {
  if (typeof tz === 'string' && tz.length <= 64 && /^[A-Za-z0-9_+\-/]+$/.test(tz)) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      /* unknown zone */
    }
  }
  return 'UTC';
}

/** The body of POST /api/focus/log for a batch (oldest first). */
export function requestBody(batch: readonly LedgerItem[], tz: unknown, name: unknown) {
  return { sessions: batch.map((x) => ({ sec: x.sec, done: x.done })), tz: zoneOrUtc(tz), name: clipName(name) };
}

export interface FlushDeps {
  /** the stored queue, as parsed (unchecked) */
  read: () => unknown;
  write: (q: LedgerItem[]) => void;
  /** a Firebase ID token for the account (force = refresh it), or null when nobody is signed in */
  token: (force: boolean) => Promise<string | null>;
  post: (body: unknown, token: string) => Promise<{ status: number; json: unknown }>;
  tz: () => string;
  name: () => string;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** ids already sent or dropped (kept for the page's life): never sent twice even if the queue can't be written */
  handled: Set<string>;
}

export interface FlushReport {
  sent: number;
  dropped: number;
  /** 'empty' = nothing left; 'auth' = a 401; 'retry' = the rest waits for a later try */
  stop: 'empty' | 'auth' | 'retry';
}

/** Send the queue in batches until it is empty or an answer says to stop. Removes what was sent or dropped. */
export async function flushQueue(d: FlushDeps, forceToken = false): Promise<FlushReport> {
  let sent = 0;
  let dropped = 0;
  let force = forceToken;
  for (let round = 0; ; round++) {
    if (round > 0) await d.sleep(GAP_MS);
    const raw = d.read();
    const all = prune(raw, d.now());
    if (Array.isArray(raw) ? all.length !== raw.length : raw != null) d.write(all); // stale or broken items go for good
    const q = all.filter((x) => !d.handled.has(x.id));
    if (!q.length) return { sent, dropped, stop: 'empty' };
    const batch = q.slice(0, BATCH_MAX);
    const token = await d.token(force).catch(() => null);
    if (!token) return { sent, dropped, stop: 'retry' };
    let res: { status: number; json: unknown } = { status: 0, json: null };
    try {
      res = await d.post(requestBody(batch, d.tz(), d.name()), token);
    } catch {
      /* no connection: status 0 */
    }
    const out = classify(res.status, res.json);
    if (out === 'auth' || out === 'retry') return { sent, dropped, stop: out };
    for (const x of batch) d.handled.add(x.id);
    // read again: another tab may have queued a session while this batch was on its way
    d.write(prune(d.read(), d.now()).filter((x) => !d.handled.has(x.id)));
    if (out === 'sent') sent += batch.length;
    else dropped += batch.length;
    force = false;
  }
}

/* ------------------------------------------------------------------ in the browser */

/** Bumps whenever this device's queue changes (in this tab or another), for views that show unsent sessions. */
export const useLedgerQueue = create<{ rev: number }>(() => ({ rev: 0 }));
const bump = () => useLedgerQueue.setState((s) => ({ rev: s.rev + 1 }));

const TAB = rid();
const handled = new Set<string>();
let fb: FB | null = null;
/** the account being reported for (set on sign-in by sync.ts) */
let uid: string | null = null;
let busy = false;
let failures = 0;
let authFails = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let wired = false;
/** sessions finished before Firebase said who is signed in: theirs if someone is, dropped for a guest */
let early: LedgerItem[] = [];
let unsubEarly: (() => void) | null = null;

function read(u: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(queueKey(u)) || 'null');
  } catch {
    return null;
  }
}
function write(u: string, q: LedgerItem[]) {
  try {
    if (q.length) localStorage.setItem(queueKey(u), JSON.stringify(q));
    else localStorage.removeItem(queueKey(u));
  } catch {
    /* storage full or blocked */
  }
  bump();
}
function enqueue(u: string, items: LedgerItem[]) {
  write(u, prune([...prune(read(u), Date.now()), ...items], Date.now()));
  void flushLedger();
}

/** This device's sessions for `u` that the server hasn't confirmed yet, oldest first. */
export const queuedSessions = (u: string) => prune(read(u), Date.now());

/**
 * The timer finished a focus session of `seconds` in this tab (`done` = ran to the end). Queued and sent in the
 * background for a signed-in person; guests have no ledger. Replays never come through here.
 */
export function reportSession(seconds: number, done: boolean) {
  try {
    const item = makeItem(seconds, done, Date.now());
    if (!item) return;
    const { user, authReady } = useData.getState();
    if (user) return enqueue(user.uid, [item]);
    if (authReady) return; // a guest
    early.push(item);
    unsubEarly ??= useData.subscribe((s) => {
      if (!s.authReady) return;
      unsubEarly?.();
      unsubEarly = null;
      const items = early;
      early = [];
      if (s.user) enqueue(s.user.uid, items);
    });
  } catch {
    /* the ledger never gets in the way of the timer */
  }
}

async function post(body: unknown, token: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
      cache: 'no-store',
    });
    const json = /json/i.test(r.headers.get('content-type') ?? '') ? await r.json().catch(() => null) : null;
    return { status: r.status, json };
  } finally {
    clearTimeout(t);
  }
}

/** Run `fn` while holding a lock no other tab holds; undefined (without running it) when another tab has it. */
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (navigator.locks?.request) return navigator.locks.request(name, { ifAvailable: true }, async (lock) => (lock ? await fn() : undefined));
  // no Web Locks (old browsers): a claim in localStorage, good for 2 minutes
  const key = `${name}:claim`;
  const holder = () => {
    try {
      const c = JSON.parse(localStorage.getItem(key) || 'null') as { tab?: string; until?: number } | null;
      return c && (c.until ?? 0) > Date.now() ? c.tab : undefined;
    } catch {
      return undefined;
    }
  };
  const other = holder();
  if (other && other !== TAB) return undefined;
  try {
    localStorage.setItem(key, JSON.stringify({ tab: TAB, until: Date.now() + 120_000 }));
  } catch {
    /* storage blocked: nothing to share with other tabs either */
  }
  const h = holder();
  if (h && h !== TAB) return undefined;
  try {
    return await fn();
  } finally {
    try {
      if (holder() === TAB) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushLedger();
  }, ms);
}

/** Send what is queued now (no-op while a send is running, offline, or signed out). */
export async function flushLedger(): Promise<void> {
  const me = uid;
  const f = fb;
  if (busy || !me || !f || useData.getState().user?.uid !== me) return;
  if (navigator.onLine === false) return; // the 'online' event brings us back
  busy = true;
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    const r = await withLock(`floww:ledger:${me}`, () =>
      flushQueue(
        {
          read: () => read(me),
          write: (q) => write(me, q),
          token: async (force) => {
            const u = f.auth.currentUser;
            return u && u.uid === me ? u.getIdToken(force) : null;
          },
          post,
          tz: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
          name: () => useData.getState().data.profileName,
          now: Date.now,
          sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
          handled,
        },
        authFails === 1,
      ),
    );
    if (!r) return schedule(10_000); // another tab is sending this account's queue right now
    if (r.sent || r.dropped) failures = authFails = 0;
    if (r.stop === 'empty') return;
    if (r.stop === 'auth') authFails++;
    failures++;
    schedule(backoff(failures));
  } catch {
    failures++;
    schedule(backoff(failures));
  } finally {
    busy = false;
  }
}

/** Signed in (sync.ts attachUser): report for this account, starting with anything left from before. */
export function startLedger(f: FB, u: string) {
  fb = f;
  uid = u;
  failures = authFails = 0;
  if (!wired) {
    wired = true;
    addEventListener('online', () => void flushLedger());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void flushLedger());
    window.addEventListener('storage', (e: StorageEvent) => e.key?.startsWith('floww:ledgerQ:') && bump());
  }
  void flushLedger();
}

/** Signed out: stop sending. The queue stays on this device for the next time this account signs in (48 h). */
export function stopLedger() {
  uid = null;
  if (timer) clearTimeout(timer);
  timer = null;
}
