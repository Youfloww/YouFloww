/**
 * Realtime layer for the Study Hall and Study Together (Firebase RTDB, imported dynamically).
 * It knows nothing about React: session.ts owns one connection for as long as the person has a hall seat
 * or a group, whatever screen they are on. `conn.close()` removes every listener, takes the connection
 * offline and deletes the secondary Firebase app.
 *
 * Data (see database.rules.json):
 *   halls/{r1..r50}/seats/{s0..s35}      = { u uid, n name, a animal 0-7, w working-on, s f|b|i|p, e endsAt|remaining, d duration, h heartbeat, g '', q last request }
 *   halls/{rid}/kudos/{toUid}/{fromUid}  = { t, k hf|kd|yg, c count }          2 min per pair
 *   halls/{rid}/say/{toUid}/{fromUid}    = { t, k gl|yg|nf|bb, s fromSlot, r toSlot }   preset only, 10 s per pair
 *   halls/{rid}/req/{toUid}/{fromUid}    = { t, s, r, g requester's group }   "study together?", 2 min per pair, 20 s per sender
 *   halls/{rid}/ans/{requester}/{answerer} = { t, q request t, r y|n, g group } private
 *   groups/{ABCDE} = { host, cr, plant, dur, st lobby|running|done, at, res, rest, members/{uid}: {n,a,m,j},
 *                      chat/{uid}/{m0..m24}: {t,x,n}, last/{uid}: {t,k} }      members-only
 */
import type { Database, DatabaseReference } from 'firebase/database';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { KudosKind } from './animals';
import { SEATS, SEAT_LIMIT } from './hallLayout';
import { isSayKind, type SayKind } from './presets';

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
}
export interface KudosRec {
  from: string;
  to: string;
  t: number;
  k: KudosKind;
  c: number;
}
export interface SayRec {
  from: string;
  to: string;
  t: number;
  k: SayKind;
}
export interface ReqRec {
  from: string;
  t: number;
  g: string;
}
export interface AnsRec {
  from: string;
  t: number;
  q: number;
  r: 'y' | 'n';
  g: string;
}
export interface Member {
  uid: string;
  n: string;
  a: number;
  m: 'in' | 'away' | 'left' | 'out';
  j: number;
}
export interface ChatMsg {
  id: string;
  uid: string;
  n: string;
  x: string;
  t: number;
}
export type Plant = 'sunflower' | 'tulip' | 'rose' | 'lavender' | 'sakura';
export interface Group {
  code: string;
  host: string;
  cr: number;
  plant: Plant;
  dur: number;
  st: 'lobby' | 'running' | 'done';
  at: number;
  res?: 'bloom' | 'rest';
  rest: boolean;
  members: Member[];
  chat: ChatMsg[];
  /** my next chat ring slot */
  nextSlot: number;
}

export class AuthNeeded extends Error {
  constructor(public reason: 'anon-disabled' | 'popup-blocked' | 'network') {
    super(reason);
  }
}

/** Emulator mode, dev builds only (explicit flag): `?emu=1` on the first load, or localStorage['together:emu']='1'. */
const EMU =
  import.meta.env.DEV &&
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
      databaseURL: 'https://youfloww2-default-rtdb.firebaseio.com',
    };

export interface Conn {
  uid: string;
  db: Database;
  m: DB;
  offset: () => number;
  now: () => number;
  /** called every time the socket comes back after a drop (not on the first connect) */
  onReconnect: (fn: () => void) => () => void;
  track: (off: () => void) => () => void;
  close: () => Promise<void>;
}

export async function openConn(google = false): Promise<Conn> {
  const [{ initializeApp, deleteApp, getApps }, authMod, m] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/database')]);
  const old = getApps().find((a) => a.name === 'together');
  if (old) await deleteApp(old).catch(() => {});
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
  const again = new Set<() => void>();
  let wasUp = false;
  let dropped = false;
  track(
    m.onValue(m.ref(db, '.info/connected'), (s) => {
      if (s.val() === true) {
        if (wasUp && dropped) again.forEach((f) => f());
        wasUp = true;
        dropped = false;
      } else if (wasUp) dropped = true;
    }),
  );

  return {
    uid: user!.uid,
    db,
    m,
    offset: () => off,
    now: () => Date.now() + off,
    onReconnect: (fn) => {
      again.add(fn);
      return () => again.delete(fn);
    },
    track,
    close,
  };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
type Obj = Record<string, unknown>;
const obj = (v: unknown): Record<string, Obj> => (v && typeof v === 'object' ? (v as Record<string, Obj>) : {});

export function parseSeats(val: unknown): Seat[] {
  return Object.entries(obj(val))
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
    }))
    .filter((s) => s.i >= 0 && s.i < SEAT_LIMIT)
    .sort((x, y) => x.i - y.i);
}

export interface Profile {
  name: string;
  animal: number;
  working: string;
}
type SeatFields = Pick<Seat, 'n' | 'a' | 'w' | 's' | 'e' | 'd'>;

export interface HallEvents {
  seats: (s: Seat[]) => void;
  kudos: (k: KudosRec[]) => void;
  says: (s: SayRec[]) => void;
  reqs: (r: ReqRec[]) => void;
  answers: (a: AnsRec[]) => void;
  /** the room changed after a reconnect (our old seat was taken) */
  moved: (room: string, slot: number) => void;
}

export interface Hall {
  room: () => string;
  slot: () => number;
  patch: (p: Partial<SeatFields>) => void;
  sendKudos: (to: string, k: KudosKind, prev: number) => Promise<boolean>;
  sendSay: (to: string, toSlot: number, k: SayKind) => Promise<boolean>;
  ask: (to: string, toSlot: number, group: string) => Promise<boolean>;
  answer: (from: string, q: number, yes: boolean, group: string) => Promise<boolean>;
  dropAns: (from: string) => void;
  leave: () => Promise<void>;
}

const ROOMS = 50;
const GHOST_MS = 10 * 60_000;
const STALE_MS = 5 * 60_000;
const HEARTBEAT_MS = 90_000;
export const isStale = (h: number, now: number) => !!h && now - h > STALE_MS;

/**
 * Sit down (the remembered room first, then r1, r2, ...). The rules refuse a 37th seat and a taken slot, so a race
 * just moves on. A watchdog takes the seat back after a dropped connection (the server's onDisconnect removed it).
 */
export async function joinHall(c: Conn, p: Profile, initial: Partial<SeatFields>, ev: HallEvents, prefer = ''): Promise<Hall> {
  const { m, db, uid } = c;
  let room = '';
  let slot = -1;
  let leaving = false;
  let fields: SeatFields = { n: p.name.slice(0, 20) || 'Friend', a: p.animal, w: p.working.slice(0, 40), s: initial.s ?? 'i', e: initial.e ?? 0, d: initial.d ?? 0 };
  const body = () => ({ u: uid, ...fields, g: '', h: m.serverTimestamp() });
  const seatRef = (): DatabaseReference => m.ref(db, `halls/${room}/seats/s${slot}`);
  const mine = (rid: string) => ({ [`kudos/${uid}`]: null, [`say/${uid}`]: null, [`req/${uid}`]: null, [`ans/${uid}`]: null, ...(rid === room && slot >= 0 ? { [`seats/s${slot}`]: null } : {}) });

  const arm = () => m.onDisconnect(m.ref(db, `halls/${room}`)).update(mine(room));

  async function tryRoom(rid: string): Promise<boolean> {
    const seats = parseSeats((await m.get(m.ref(db, `halls/${rid}/seats`))).val());
    const now = c.now();
    for (const s of seats) if (s.uid !== uid && s.h && now - s.h > GHOST_MS) void m.remove(m.ref(db, `halls/${rid}/seats/s${s.i}`)).catch(() => {});
    const taken = new Set(seats.filter((s) => s.uid !== uid && !(s.h && now - s.h > GHOST_MS)).map((s) => s.i));
    const back = seats.find((s) => s.uid === uid);
    const order = back ? [back.i, ...SEATS.map((_, i) => i)] : SEATS.map((_, i) => i);
    for (const i of order) {
      if (taken.has(i)) continue;
      try {
        await m.set(m.ref(db, `halls/${rid}/seats/s${i}`), body());
        // a second seat of ours in this room (an older tab of the same browser): keep only this one
        for (const s of seats) if (s.uid === uid && s.i !== i) void m.remove(m.ref(db, `halls/${rid}/seats/s${s.i}`)).catch(() => {});
        room = rid;
        slot = i;
        await arm();
        return true;
      } catch {
        /* taken a moment ago: next seat */
      }
    }
    return false;
  }

  async function sit(first: string) {
    const order = [first, ...Array.from({ length: ROOMS }, (_, i) => `r${i + 1}`).filter((r) => r !== first)].filter(Boolean);
    for (const rid of order) if (await tryRoom(rid)) return true;
    return false;
  }

  if (!(await sit(prefer))) throw new Error('hall-full');

  // room listeners (re-attached if a reconnect lands us in another room)
  let offRoom: (() => void)[] = [];
  const listen = () => {
    offRoom.forEach((o) => o());
    const r = room;
    const on = (path: string, fn: (v: unknown) => void) => c.track(m.onValue(m.ref(db, `halls/${r}/${path}`), (s) => fn(s.val()), () => fn(null)));
    offRoom = [
      on('seats', (v) => {
        const seats = parseSeats(v);
        ev.seats(seats);
        // someone (a ghost cleaner after a long sleep, or our own old onDisconnect) removed our seat: sit again
        if (!leaving && slot >= 0 && !seats.some((s) => s.i === slot && s.uid === uid)) void heal();
      }),
      on('kudos', (v) => {
        const out: KudosRec[] = [];
        for (const [to, froms] of Object.entries(obj(v)))
          for (const [from, r] of Object.entries(obj(froms))) out.push({ from, to, t: num(r.t), k: (['hf', 'kd', 'yg'].includes(str(r.k)) ? r.k : 'hf') as KudosKind, c: num(r.c, 1) });
        ev.kudos(out);
      }),
      on('say', (v) => {
        const out: SayRec[] = [];
        for (const [to, froms] of Object.entries(obj(v))) for (const [from, r] of Object.entries(obj(froms))) if (isSayKind(r.k)) out.push({ from, to, t: num(r.t), k: r.k });
        ev.says(out);
      }),
      on(`req/${uid}`, (v) => ev.reqs(Object.entries(obj(v)).map(([from, r]) => ({ from, t: num(r.t), g: str(r.g) })))),
      on(`ans/${uid}`, (v) => ev.answers(Object.entries(obj(v)).map(([from, r]) => ({ from, t: num(r.t), q: num(r.q), r: r.r === 'y' ? 'y' : 'n', g: str(r.g) })))),
    ];
  };
  listen();

  let healing: Promise<void> | null = null;
  function heal() {
    if (leaving) return Promise.resolve();
    return (healing ??= (async () => {
      try {
        const snap = await m.get(seatRef());
        const v = obj({ x: snap.val() }).x;
        if (v && v.u === uid) {
          await arm();
          return;
        }
        const before = room;
        await m.onDisconnect(m.ref(db, `halls/${before}`)).cancel().catch(() => {});
        slot = -1;
        if (await sit(before)) {
          if (room !== before) listen();
          ev.moved(room, slot);
        }
      } catch {
        /* offline again: the next reconnect retries */
      } finally {
        healing = null;
      }
    })());
  }
  c.track(c.onReconnect(() => void heal()));

  const beat = () => {
    if (!leaving && slot >= 0) void m.update(seatRef(), { h: m.serverTimestamp() }).catch(() => void heal());
  };
  const hb = setInterval(beat, HEARTBEAT_MS);
  c.track(() => clearInterval(hb));
  const onVis = () => !document.hidden && beat();
  document.addEventListener('visibilitychange', onVis);
  c.track(() => document.removeEventListener('visibilitychange', onVis));

  const hallRef = () => m.ref(db, `halls/${room}`);
  const ok = (pr: Promise<unknown>) => pr.then(() => true).catch(() => false);

  return {
    room: () => room,
    slot: () => slot,
    patch: (patch) => {
      const clean: Partial<SeatFields> = { ...patch };
      if (typeof clean.n === 'string') clean.n = clean.n.slice(0, 20) || 'Friend';
      if (typeof clean.w === 'string') clean.w = clean.w.slice(0, 40);
      fields = { ...fields, ...clean };
      if (slot >= 0 && !leaving) void m.update(seatRef(), { ...clean, h: m.serverTimestamp() }).catch(() => {});
    },
    sendKudos: (to, k, prev) => ok(m.set(m.ref(db, `halls/${room}/kudos/${to}/${uid}`), { t: m.serverTimestamp(), k, c: prev + 1 })),
    sendSay: (to, toSlot, k) => ok(m.set(m.ref(db, `halls/${room}/say/${to}/${uid}`), { t: m.serverTimestamp(), k, s: `s${slot}`, r: `s${toSlot}` })),
    ask: (to, toSlot, group) => ok(m.update(hallRef(), { [`req/${to}/${uid}`]: { t: m.serverTimestamp(), s: `s${slot}`, r: `s${toSlot}`, g: group }, [`seats/s${slot}/q`]: m.serverTimestamp() })),
    // the request stays in our inbox (hidden once answered): deleting it would let the asker skip the 2-minute gap
    answer: (from, q, yes, group) => ok(m.set(m.ref(db, `halls/${room}/ans/${from}/${uid}`), { t: m.serverTimestamp(), q, r: yes ? 'y' : 'n', ...(yes ? { g: group } : {}) })),
    dropAns: (from) => void m.remove(m.ref(db, `halls/${room}/ans/${uid}/${from}`)).catch(() => {}),
    leave: async () => {
      leaving = true;
      offRoom.forEach((o) => o());
      offRoom = [];
      try {
        await m.onDisconnect(hallRef()).cancel();
        await m.update(hallRef(), mine(room));
      } catch {
        /* the connection may already be gone: onDisconnect handles it */
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Study Together groups                                               */
/* ------------------------------------------------------------------ */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomCode = () => Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
export const GROUP_MAX = 12;
const RING = 25;
const CHAT_KEEP = 50;
const PLANTS: Plant[] = ['sunflower', 'tulip', 'rose', 'lavender', 'sakura'];

export function parseGroup(code: string, v: unknown, me: string): Group | null {
  const g = obj({ x: v }).x as Obj | undefined;
  if (!g || typeof g.host !== 'string') return null;
  const members = Object.entries(obj(g.members))
    .map(([uid, x]) => ({ uid, n: str(x.n, '?'), a: num(x.a), m: (['in', 'away', 'left', 'out'].includes(str(x.m)) ? x.m : 'in') as Member['m'], j: num(x.j) }))
    .sort((p, q) => (p.uid === g.host ? -1 : q.uid === g.host ? 1 : p.j - q.j || (p.uid < q.uid ? -1 : 1)));
  const chat: ChatMsg[] = [];
  for (const [uid, ring] of Object.entries(obj(g.chat)))
    for (const [k, x] of Object.entries(obj(ring))) if (typeof x.x === 'string') chat.push({ id: `${uid}/${k}`, uid, n: str(x.n, '?'), x: x.x.slice(0, 200), t: num(x.t) });
  chat.sort((a, b) => a.t - b.t);
  const last = obj(g.last)[me];
  const lastK = last ? Number(str(last.k).slice(1)) : -1;
  return {
    code,
    host: g.host,
    cr: num(g.cr),
    plant: PLANTS.includes(g.plant as Plant) ? (g.plant as Plant) : 'sunflower',
    dur: num(g.dur, 25),
    st: g.st === 'running' || g.st === 'done' ? g.st : 'lobby',
    at: num(g.at),
    res: g.res === 'bloom' || g.res === 'rest' ? g.res : undefined,
    rest: g.rest === true,
    members,
    chat: chat.slice(-CHAT_KEEP),
    nextSlot: Number.isFinite(lastK) && lastK >= 0 ? (lastK + 1) % RING : 0,
  };
}

export interface GroupCtl {
  code: string;
  setMine: (m: Member['m']) => void;
  rename: (n: string, a: number) => void;
  start: () => Promise<boolean>;
  finish: (res: 'bloom' | 'rest') => void;
  again: () => Promise<boolean>;
  plan: (p: { plant?: Plant; dur?: number }) => void;
  chat: (text: string, name: string, slot: number) => Promise<boolean>;
  leave: (running: boolean) => Promise<void>;
  detach: () => void;
}

/**
 * Create (host) or join a group. Non-members cannot read a group, so joining writes our member node first
 * (the rules refuse it for a missing or expired code) and then listens. `onGroup(null)` = gone / no access.
 */
export async function openGroup(
  c: Conn,
  code: string,
  me: { name: string; animal: number },
  create: { plant: Plant; dur: number } | null,
  onGroup: (g: Group | null) => void,
): Promise<GroupCtl | 'missing' | 'full' | 'taken'> {
  const { m, db, uid } = c;
  const gref = m.ref(db, `groups/${code}`);
  const mref = m.ref(db, `groups/${code}/members/${uid}`);
  const mine = () => ({ n: me.name.slice(0, 20) || 'Friend', a: me.animal, m: 'in', j: m.serverTimestamp() });
  if (create) {
    try {
      await m.set(gref, { host: uid, cr: m.serverTimestamp(), plant: create.plant, dur: create.dur, st: 'lobby', at: 0, members: { [uid]: mine() } });
    } catch {
      return 'taken';
    }
  } else {
    try {
      await m.update(mref, mine());
    } catch {
      return 'missing';
    }
    const g = parseGroup(code, (await m.get(gref)).val(), uid);
    if (!g) return 'missing';
    const idx = g.members.findIndex((x) => x.uid === uid);
    if (idx >= GROUP_MAX) {
      await m.remove(mref).catch(() => {});
      return 'full';
    }
  }

  // a dropped tab shows as "reconnecting"; we stay a member, so a reload rejoins
  const arm = () => void m.onDisconnect(m.ref(db, `groups/${code}/members/${uid}/m`)).set('left').catch(() => {});
  arm();
  let gone = false;
  const offV = c.track(
    m.onValue(
      gref,
      (s) => {
        const g = parseGroup(code, s.val(), uid);
        if (!g || !g.members.some((x) => x.uid === uid)) {
          gone = true;
          onGroup(null);
          return;
        }
        onGroup(g);
      },
      () => {
        gone = true;
        onGroup(null);
      },
    ),
  );
  const offR = c.track(
    c.onReconnect(() => {
      if (gone) return;
      arm();
      void m.update(mref, { m: document.hidden ? 'away' : 'in', j: m.serverTimestamp() }).catch(() => {});
    }),
  );
  const detach = () => {
    offV();
    offR();
  };
  const ok = (pr: Promise<unknown>) => pr.then(() => true).catch(() => false);

  return {
    code,
    setMine: (st) => void m.update(mref, st === 'in' ? { m: st, j: m.serverTimestamp() } : { m: st }).catch(() => {}),
    rename: (n, a) => void m.update(mref, { n: n.slice(0, 20) || 'Friend', a }).catch(() => {}),
    start: () => ok(m.update(gref, { st: 'running', at: m.serverTimestamp() })),
    finish: (res) => void m.update(gref, { st: 'done', res }).catch(() => {}),
    again: () => ok(m.update(gref, { st: 'lobby', at: 0, res: null, rest: null })),
    plan: (p) => void m.update(gref, p).catch(() => {}),
    chat: (text, name, slot) =>
      ok(m.update(gref, { [`chat/${uid}/m${slot}`]: { t: m.serverTimestamp(), x: text.slice(0, 200), n: name.slice(0, 20) || 'Friend' }, [`last/${uid}`]: { t: m.serverTimestamp(), k: `m${slot}` } })),
    leave: async (running) => {
      detach();
      gone = true;
      try {
        await m.onDisconnect(m.ref(db, `groups/${code}/members/${uid}/m`)).cancel();
        await m.update(gref, running ? { rest: true, [`members/${uid}`]: null } : { [`members/${uid}`]: null });
      } catch {
        /* offline: our node stays as "reconnecting" until the group expires */
      }
    },
    detach,
  };
}
