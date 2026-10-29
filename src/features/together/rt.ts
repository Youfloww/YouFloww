/**
 * Realtime layer for the Study Hall. Everything here runs only while the mode is open:
 * `openConn()` dynamically imports firebase/database, `conn.close()` removes every listener, cancels the
 * onDisconnect handlers we armed, takes the connection offline and deletes the secondary Firebase app.
 *
 * Data (see database.rules.json):
 *   halls/{r1..r50}/seats/{s0..s11}    = { u uid, n name, a animal 0-7, w working-on, s f|b|i|p, e endsAt|remaining, d duration, h heartbeat, g group }
 *   halls/{rid}/kudos/{toUid}/{fromUid} = { t serverTime, k hf|kd|yg, c count }
 *   groups/{ABCDE}                     = { host, cr, plant, dur, st lobby|running|done, at startedAt, res bloom|rest, members/{uid}: {n,a,m in|away|left|out} }
 */
import type { Database, DatabaseReference } from 'firebase/database';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { KudosKind } from './animals';

type DB = typeof import('firebase/database');

export interface Seat {
  uid: string;
  n: string;
  a: number;
  w: string;
  s: 'f' | 'b' | 'i' | 'p';
  e: number;
  d: number;
  h: number;
  i: number;
  g: string;
}
export interface KudosRec {
  from: string;
  to: string;
  t: number;
  k: KudosKind;
  c: number;
}
export interface Member {
  uid: string;
  n: string;
  a: number;
  m: 'in' | 'away' | 'left' | 'out';
}
export interface Group {
  code: string;
  host: string;
  cr: number;
  plant: 'sunflower' | 'tulip' | 'rose' | 'lavender' | 'sakura';
  dur: number;
  st: 'lobby' | 'running' | 'done';
  at: number;
  res?: 'bloom' | 'rest';
  members: Member[];
}

export class AuthNeeded extends Error {
  constructor(public reason: 'anon-disabled' | 'popup-blocked' | 'network') {
    super(reason);
  }
}

/** Emulator mode: `?emu=1` in the URL, or localStorage['together:emu']='1' (the app strips the query after boot). */
const EMU =
  typeof location !== 'undefined' &&
  (new URLSearchParams(location.search).get('emu') === '1' ||
    (() => {
      try {
        return localStorage.getItem('together:emu') === '1';
      } catch {
        return false;
      }
    })());

const CONFIG = EMU
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-youfloww', appId: 'demo', databaseURL: 'https://demo-youfloww-default-rtdb.firebaseio.com' }
  : {
      apiKey: 'AIzaSyBCi5Ea0r2c9tdgk_6RnpSuqDV5CE3nGbo',
      authDomain: 'youfloww2.firebaseapp.com',
      projectId: 'youfloww2',
      appId: '1:816836186464:web:e1f816020e6798f9b3ce05',
      // Default RTDB URL for projects created in the US. If the console shows another URL, put it here.
      databaseURL: 'https://youfloww2-default-rtdb.firebaseio.com',
    };

export interface Conn {
  uid: string;
  db: Database;
  m: DB;
  /** milliseconds to add to Date.now() to get server time */
  offset: () => number;
  now: () => number;
  /** register something to run on close (listeners, timers) */
  track: (off: () => void) => () => void;
  close: () => Promise<void>;
}

export async function openConn(google = false): Promise<Conn> {
  const [{ initializeApp, deleteApp }, authMod, m] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/database')]);
  const app: FirebaseApp = initializeApp(CONFIG, 'together');
  const auth: Auth = authMod.getAuth(app);
  if (EMU) authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = m.getDatabase(app);

  const offs = new Set<() => void>();
  let closed = false;
  const track = (off: () => void) => {
    offs.add(off);
    return () => {
      if (offs.delete(off)) off();
    };
  };
  const close = async () => {
    if (closed) return;
    closed = true;
    offs.forEach((o) => {
      try {
        o();
      } catch {
        /* ignore */
      }
    });
    offs.clear();
    try {
      m.goOffline(db);
    } catch {
      /* ignore */
    }
    try {
      await deleteApp(app);
    } catch {
      /* ignore */
    }
  };

  const fail = async (e: unknown): Promise<never> => {
    const code = (e as { code?: string })?.code ?? '';
    await close();
    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') throw new AuthNeeded('anon-disabled');
    if (code === 'auth/network-request-failed') throw new AuthNeeded('network');
    if (code.includes('popup')) throw new AuthNeeded('popup-blocked');
    throw e;
  };

  let user = null as import('firebase/auth').User | null;
  try {
    await auth.authStateReady();
    user = auth.currentUser;
    if (!user) user = (google ? await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()) : await authMod.signInAnonymously(auth)).user;
  } catch (e) {
    return fail(e);
  }

  // the emulator build of the SDK drops the auth token unless it is handed over explicitly
  if (EMU) m.connectDatabaseEmulator(db, '127.0.0.1', 9000, { mockUserToken: await user!.getIdToken() });

  let off = 0;
  track(m.onValue(m.ref(db, '.info/serverTimeOffset'), (s) => void (off = Number(s.val()) || 0)));

  return {
    uid: user!.uid,
    db,
    m,
    offset: () => off,
    now: () => Date.now() + off,
    track,
    close,
  };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

function parseSeats(val: Record<string, Record<string, unknown>> | null): Seat[] {
  if (!val) return [];
  return Object.entries(val)
    .filter(([, v]) => v && typeof v.u === 'string')
    .map(([slot, v]) => ({
      uid: str(v.u),
      n: str(v.n, '?'),
      a: num(v.a),
      w: str(v.w),
      s: (['f', 'b', 'i', 'p'].includes(str(v.s)) ? v.s : 'i') as Seat['s'],
      e: num(v.e),
      d: num(v.d),
      h: num(v.h),
      i: Number(slot.slice(1)) || 0,
      g: str(v.g),
    }))
    .sort((x, y) => x.i - y.i);
}

export interface Profile {
  name: string;
  animal: number;
  working: string;
}
export interface HallState {
  seats: Seat[];
  /** total received per uid and every raw record */
  kudos: KudosRec[];
}

export interface Hall {
  room: string;
  /** write a partial seat update (also refreshes the heartbeat) */
  patch: (p: Partial<Pick<Seat, 'n' | 'a' | 'w' | 's' | 'e' | 'd' | 'g'>>) => void;
  sendKudos: (to: string, k: KudosKind) => Promise<boolean>;
  leave: () => Promise<void>;
}

const ROOMS = 50;
const SEAT_LIMIT = 12;
const STALE_MS = 5 * 60_000;
export const isStale = (h: number, now: number) => !!h && now - h > STALE_MS;

/**
 * Sit down in the first hall with a free seat. The rules refuse a 13th seat, so a race just moves on to the next hall.
 */
export async function joinHall(
  c: Conn,
  p: Profile,
  initial: Partial<Seat>,
  onSeats: (s: Seat[]) => void,
  onKudos: (k: KudosRec[]) => void,
): Promise<Hall> {
  const { m, db, uid } = c;
  let room = '';
  let seatRef: DatabaseReference | null = null;

  const base = (_slot: number) => ({
    u: uid,
    n: p.name.slice(0, 20) || 'Friend',
    a: p.animal,
    w: p.working.slice(0, 40),
    s: initial.s ?? 'i',
    e: initial.e ?? 0,
    d: initial.d ?? 0,
    g: initial.g ?? '',
    h: m.serverTimestamp(),
  });

  for (let r = 1; r <= ROOMS && !seatRef; r++) {
    const rid = `r${r}`;
    const snap = await m.get(m.ref(db, `halls/${rid}/seats`));
    const seats = parseSeats(snap.val());
    const now = c.now();
    // clear ghosts left by a crashed browser (the rules allow removing a seat silent for 10 minutes)
    for (const s of seats) if (s.h && now - s.h > 10 * 60_000) void m.remove(m.ref(db, `halls/${rid}/seats/s${s.i}`)).catch(() => {});
    // a seat of mine from a crashed visit: take it back
    const taken = new Set(seats.filter((s) => s.uid !== uid && !(s.h && now - s.h > 10 * 60_000)).map((s) => s.i));
    for (let slot = 0; slot < SEAT_LIMIT && !seatRef; slot++) {
      if (taken.has(slot)) continue;
      const ref = m.ref(db, `halls/${rid}/seats/s${slot}`);
      try {
        // claim first (the rules only let the owner remove a seat), then arm the clean-up for a closed tab
        await m.set(ref, base(slot));
        await m.onDisconnect(ref).remove();
        await m.onDisconnect(m.ref(db, `halls/${rid}/kudos/${uid}`)).remove();
        room = rid;
        seatRef = ref;
      } catch {
        /* somebody sat there a moment ago: try the next seat */
        void m.onDisconnect(ref).cancel().catch(() => {});
      }
    }
  }
  if (!seatRef) throw new Error('hall-full');

  const ref = seatRef;
  c.track(
    m.onValue(m.ref(db, `halls/${room}/seats`), (s) => {
      onSeats(parseSeats(s.val()));
    }),
  );

  let kudosCache: KudosRec[] = [];
  c.track(
    m.onValue(m.ref(db, `halls/${room}/kudos`), (s) => {
      const out: KudosRec[] = [];
      const v = (s.val() ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
      for (const [to, froms] of Object.entries(v))
        for (const [from, r] of Object.entries(froms ?? {})) out.push({ from, to, t: num(r.t), k: (str(r.k) as KudosKind) || 'hf', c: num(r.c, 1) });
      kudosCache = out;
      onKudos(out);
    }),
  );

  const hb = setInterval(() => {
    if (document.hidden) return;
    void m.update(ref, { h: m.serverTimestamp() }).catch(() => {});
  }, 60_000);
  c.track(() => clearInterval(hb));
  // wake up after the laptop slept: refresh straight away
  const onVis = () => {
    if (!document.hidden) void m.update(ref, { h: m.serverTimestamp() }).catch(() => {});
  };
  document.addEventListener('visibilitychange', onVis);
  c.track(() => document.removeEventListener('visibilitychange', onVis));

  return {
    room,
    patch: (patch) => {
      const clean: Record<string, unknown> = { ...patch, h: m.serverTimestamp() };
      if (typeof patch.n === 'string') clean.n = patch.n.slice(0, 20) || 'Friend';
      if (typeof patch.w === 'string') clean.w = patch.w.slice(0, 40);
      void m.update(ref, clean).catch(() => {});
    },
    sendKudos: async (to, k) => {
      const prev = kudosCache.find((x) => x.from === uid && x.to === to);
      try {
        await m.set(m.ref(db, `halls/${room}/kudos/${to}/${uid}`), { t: m.serverTimestamp(), k, c: (prev?.c ?? 0) + 1 });
        return true;
      } catch {
        return false;
      }
    },
    leave: async () => {
      try {
        await m.remove(ref);
        await m.remove(m.ref(db, `halls/${room}/kudos/${uid}`));
        await m.onDisconnect(ref).cancel();
      } catch {
        /* the connection may already be gone: onDisconnect handles it */
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Focus together                                                      */
/* ------------------------------------------------------------------ */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomCode = () => Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

function parseGroup(code: string, v: Record<string, unknown> | null): Group | null {
  if (!v || !v.host) return null;
  const mem = (v.members ?? {}) as Record<string, Record<string, unknown>>;
  return {
    code,
    host: str(v.host),
    cr: num(v.cr),
    plant: (str(v.plant, 'sunflower') as Group['plant']),
    dur: num(v.dur, 25),
    st: (str(v.st, 'lobby') as Group['st']),
    at: num(v.at),
    res: v.res === 'bloom' || v.res === 'rest' ? v.res : undefined,
    members: Object.entries(mem)
      .map(([uid, x]) => ({ uid, n: str(x.n, '?'), a: num(x.a), m: (str(x.m, 'in') as Member['m']) }))
      .sort((p, q) => (p.uid === v.host ? -1 : q.uid === v.host ? 1 : p.uid < q.uid ? -1 : 1)),
  };
}

export interface GroupCtl {
  code: string;
  setMine: (m: Member['m']) => void;
  start: () => Promise<boolean>;
  finish: (res: 'bloom' | 'rest') => void;
  leave: () => Promise<void>;
}

/** Create (host) or join a group; `onGroup(null)` means the code doesn't exist or has expired. */
export async function openGroup(
  c: Conn,
  code: string,
  me: { name: string; animal: number },
  create: { plant: Group['plant']; dur: number } | null,
  onGroup: (g: Group | null) => void,
): Promise<GroupCtl | 'missing' | 'started' | 'full'> {
  const { m, db, uid } = c;
  const gref = m.ref(db, `groups/${code}`);
  const mref = m.ref(db, `groups/${code}/members/${uid}`);
  const mine = { n: me.name.slice(0, 20) || 'Friend', a: me.animal, m: 'in' };
  if (create) {
    await m.set(gref, { host: uid, cr: m.serverTimestamp(), plant: create.plant, dur: create.dur, st: 'lobby', at: 0, members: { [uid]: mine } });
  } else {
    const snap = await m.get(gref);
    const g = parseGroup(code, snap.val());
    if (!g) return 'missing';
    const already = g.members.some((x) => x.uid === uid);
    if (g.st !== 'lobby' && !already) return 'started';
    if (!already) {
      if (g.members.length >= 12) return 'full';
      try {
        await m.set(mref, mine);
      } catch {
        return 'started';
      }
    } else if (g.members.find((x) => x.uid === uid)!.m !== 'out') {
      void m.update(mref, { m: 'in' });
    }
  }

  let status: Group['st'] = 'lobby';
  let host = '';
  const arm = async () => {
    // lobby: vanish if we drop. running: show as "left" (recoverable if we come back)
    try {
      await m.onDisconnect(mref).cancel();
      if (status === 'lobby') await (create ? m.onDisconnect(gref).remove() : m.onDisconnect(mref).remove());
      else if (status === 'running') await m.onDisconnect(m.ref(db, `groups/${code}/members/${uid}/m`)).set('left');
    } catch {
      /* offline */
    }
  };
  c.track(
    m.onValue(gref, (s) => {
      const g = parseGroup(code, s.val());
      if (g) {
        host = g.host;
        if (g.st !== status) {
          status = g.st;
          void arm();
        }
      }
      onGroup(g);
    }),
  );
  void arm();

  return {
    code,
    setMine: (st) => void m.update(mref, { m: st }).catch(() => {}),
    start: async () => {
      try {
        await m.update(gref, { st: 'running', at: m.serverTimestamp() });
        return true;
      } catch {
        return false;
      }
    },
    finish: (res) => {
      void m.update(gref, { res }).catch(() => {});
      void m.set(m.ref(db, `groups/${code}/st`), 'done').catch(() => {});
    },
    leave: async () => {
      try {
        await m.onDisconnect(mref).cancel();
        if (status === 'lobby') await m.remove(host === uid ? gref : mref);
        else await m.update(mref, { m: 'out' });
      } catch {
        /* ignore */
      }
    },
  };
}
