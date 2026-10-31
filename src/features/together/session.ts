/**
 * The live Study Hall / Study Together session of this tab. It owns everything that keeps a person connected:
 * the one Firebase connection, the hall seat (heartbeat + onDisconnect live in rt.ts), the group, every listener
 * and the timer / tab hooks. It is a plain module store, so views (the full-screen hall, the tray) come and go
 * freely: going Home, opening another world or a panel never ends anything. Only leaveHall() / leaveGroup() do.
 * Loaded lazily (by the hall view or the tray host); live.ts is the only piece in the main bundle.
 */
import { create } from 'zustand';
import { bus } from '@/lib/bus';
import { toast, useUI } from '@/store/ui';
import { useTimer } from '@/store/timer';
import { getFeatureData, updateFeatureData } from '@/lib/featureData';
import { haptic } from '@/lib/utils';
import { earn } from '../economy/wallet';
import { requestFocusFor } from '../timer/engine';
import { KUDOS, type KudosKind } from './animals';
import { EMPTY_DATA, type TogetherData } from './data';
import { readFlag, setLive, writeFlag } from './live';
import { ASK_ANY_GAP, ASK_GAP, ASK_TEXT, ASK_TTL, CHAT_GAP, CHAT_MAX, SAYS, SAY_GAP, isMuted, mask, setMuted, type SayKind } from './presets';
import { AuthNeeded, isStale, joinHall, openConn, openGroup, randomCode, type AnsRec, type Conn, type Group, type GroupCtl, type Hall, type KudosRec, type Member, type Plant, type ReqRec, type SayRec, type Seat } from './rt';
import { hallSound } from './sound';

export interface Item {
  id: string;
  kind: 'say' | 'kudos' | 'ask' | 'yes' | 'no';
  from: string;
  name: string;
  animal: number;
  text: string;
  /** server time */
  t: number;
  /** "study together?" only: the requester's group code ('' = none) */
  g?: string;
  done?: 'y' | 'n' | 'busy';
}
/** a speech bubble over the sender (say) or an emoji flying over the receiver (kudos) */
export interface Fx {
  id: number;
  uid: string;
  to: string;
  text: string;
  kind: 'say' | 'kudos';
}
export interface OutAsk {
  name: string;
  t: number;
  state: 'wait' | 'yes' | 'no' | 'gone';
}
export type Err = { kind: 'signin' | 'retry'; msg: string };

export interface TState {
  conn: 'off' | 'connecting' | 'live';
  uid: string;
  err: Err | null;
  hall: 'off' | 'joining' | 'in';
  room: string;
  slot: number;
  seats: Seat[];
  kudos: KudosRec[];
  says: SayRec[];
  items: Item[];
  /** hall inbox items newer than this (server time) are unseen */
  seenAt: number;
  fx: Fx[];
  out: Record<string, OutAsk>;
  lastAsk: number;
  /** Study Together group code ('' = none); set while joining too */
  code: string;
  group: Group | null;
  groupBusy: boolean;
  groupErr: string | null;
  groupClosed: boolean;
  /** chat messages newer than this (server time) are unread */
  readAt: number;
  /** tray */
  tray: boolean;
  trayTab: 'hall' | 'group';
  /** what the hall view should show when it opens */
  focus: 'hall' | 'group' | null;
  /** bumped when the mute list changes */
  muteTick: number;
}

export const useSession = create<TState>()(() => ({
  conn: 'off',
  uid: '',
  err: null,
  hall: 'off',
  room: '',
  slot: -1,
  seats: [],
  kudos: [],
  says: [],
  items: [],
  seenAt: 0,
  fx: [],
  out: {},
  lastAsk: 0,
  code: '',
  group: null,
  groupBusy: false,
  groupErr: null,
  groupClosed: false,
  readAt: 0,
  tray: false,
  trayTab: 'hall',
  focus: null,
  muteTick: 0,
}));
const get = useSession.getState;
const set = useSession.setState;

let conn: Conn | null = null;
let connP: Promise<Conn> | null = null;
let hall: Hall | null = null;
let gctl: GroupCtl | null = null;

export const serverNow = () => Date.now() + (conn?.offset() ?? 0);
export const myUid = () => conn?.uid ?? '';

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */
const ss = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

export function profile() {
  const d = getFeatureData<TogetherData>('together', EMPTY_DATA);
  return { name: (d.name || '').trim().slice(0, 20) || 'Friend', animal: Math.max(0, Math.min(7, d.animal | 0)), working: (d.working || '').slice(0, 40) };
}
export const hasProfile = () => !!(getFeatureData<TogetherData>('together', EMPTY_DATA).name || '').trim();

export function saveProfile(p: { name: string; animal: number; working: string }) {
  const name = p.name.trim().slice(0, 20);
  updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => {
    d.name = name;
    d.animal = p.animal;
    d.working = p.working.trim().slice(0, 40);
  });
  hall?.patch({ n: name || 'Friend', a: p.animal, w: p.working.trim() });
  gctl?.rename(name || 'Friend', p.animal);
}

let workTimer: ReturnType<typeof setTimeout> | undefined;
export function setWorking(w: string) {
  const v = w.slice(0, 40);
  updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => void (d.working = v));
  clearTimeout(workTimer);
  workTimer = setTimeout(() => hall?.patch({ w: v.trim() }), 700);
}

export function personOf(uid: string) {
  const s = get().seats.find((x) => x.uid === uid);
  if (s) return { name: s.n, animal: s.a };
  const m = get().group?.members.find((x) => x.uid === uid);
  return { name: m?.n ?? 'Someone', animal: m?.a ?? 0 };
}

/** people visibly in the hall (silent seats hidden, mine always shown) */
export function people(s: TState, now: number) {
  return s.seats.filter((x) => !isStale(x.h, now) || x.uid === s.uid);
}

function errOf(e: unknown): Err {
  if (e instanceof AuthNeeded)
    return e.reason === 'anon-disabled'
      ? { kind: 'signin', msg: 'The hall needs a quick sign-in so everyone has their own seat.' }
      : e.reason === 'popup-blocked'
        ? { kind: 'signin', msg: 'The sign-in window was blocked. Allow pop-ups and try again.' }
        : { kind: 'retry', msg: 'No connection. Check your internet and try again.' };
  const msg = String((e as Error)?.message ?? '');
  if (msg === 'hall-full') return { kind: 'retry', msg: 'Every hall is full right now (that is 1,800 people!). Try again soon.' };
  if (/permission/i.test(msg)) return { kind: 'retry', msg: 'The hall is not open yet (the owner still has to switch it on). Try again later.' };
  return { kind: 'retry', msg: 'Could not reach the hall. Try again in a moment.' };
}

/** remember the session in this tab (reload rejoins) and tell the main bundle whether the tray host is needed */
function sync() {
  const s = get();
  const inHall = s.hall !== 'off';
  writeFlag(inHall || s.code ? { hall: inHall, room: s.room, group: s.code } : null);
  setLive(inHall || !!s.code || s.conn !== 'off' || !!connP);
}

async function ensureConn(google = false): Promise<Conn> {
  if (conn) return conn;
  if (!connP) {
    set({ conn: 'connecting' });
    connP = openConn(google)
      .then((c) => {
        conn = c;
        set({ conn: 'live', uid: c.uid });
        return c;
      })
      .catch((e) => {
        set({ conn: 'off' });
        throw e;
      })
      .finally(() => {
        connP = null;
      });
  }
  return connP;
}

/** nothing left that needs the connection: take it offline (after the current step settles) */
function maybeClose() {
  setTimeout(() => {
    const s = get();
    if (hall || gctl || connP || s.hall !== 'off' || s.code || s.groupBusy) return sync();
    const c = conn;
    conn = null;
    set({ conn: 'off', uid: '' });
    sync();
    void c?.close();
  }, 0);
}

/* ------------------------------------------------------------------ */
/* views: unread / unseen bookkeeping                                  */
/* ------------------------------------------------------------------ */
const views = { chat: 0, hall: 0 };
const readKey = (code: string) => `together:read:${code}`;
function touch() {
  const s = get();
  if (views.chat > 0 && s.group) {
    const last = s.group.chat.reduce((a, m) => Math.max(a, m.t), 0);
    if (last > s.readAt) {
      set({ readAt: last });
      ss.set(readKey(s.group.code), String(last));
    }
  }
  if (views.hall > 0) {
    const last = s.items.reduce((a, i) => Math.max(a, i.t), 0);
    if (last > s.seenAt) set({ seenAt: last });
  }
}
/** a visible chat / hall inbox marks everything as read while it stays on screen */
export function viewing(kind: 'chat' | 'hall') {
  views[kind]++;
  touch();
  return () => void views[kind]--;
}

export const unreadChat = (s: TState) => (s.group ? s.group.chat.filter((m) => m.uid !== s.uid && m.t > s.readAt && !isMuted(m.uid)).length : 0);
export const openAsks = (s: TState, now: number) => s.items.filter((i) => i.kind === 'ask' && !i.done && i.t + ASK_TTL > now);
export const unseenHall = (s: TState) => s.items.filter((i) => i.t > s.seenAt && i.kind !== 'ask').length;

let fxId = 1;
function addFx(f: Omit<Fx, 'id'>) {
  const id = fxId++;
  set((s) => ({ fx: [...s.fx.slice(-24), { ...f, id }] }));
  setTimeout(() => set((s) => ({ fx: s.fx.filter((x) => x.id !== id) })), f.kind === 'say' ? 6000 : 2200);
}
function addItem(i: Item) {
  set((s) => ({ items: [i, ...s.items.filter((x) => x.id !== i.id)].slice(0, 30) }));
  touch();
}
const ANSWERED = 'together:answered';
const answered = () => new Set(ss.get(ANSWERED).split(',').filter(Boolean));
const rememberAnswered = (id: string) => ss.set(ANSWERED, [...answered(), id].slice(-40).join(','));

/* ------------------------------------------------------------------ */
/* hall                                                                */
/* ------------------------------------------------------------------ */
const baseline = new Set<string>();
const seen = new Map<string, number>();

function onKudos(recs: KudosRec[]) {
  set({ kudos: recs });
  const first = !baseline.has('kudos');
  baseline.add('kudos');
  const me = myUid();
  for (const r of recs) {
    const key = `k:${r.from}>${r.to}`;
    if (r.t <= (seen.get(key) ?? 0)) continue;
    seen.set(key, r.t);
    if (first || isMuted(r.from)) continue;
    const k = KUDOS[r.k] ?? KUDOS.hf;
    addFx({ uid: r.to, to: r.to, text: k.emoji, kind: 'kudos' });
    if (r.to === me) {
      const p = personOf(r.from);
      addItem({ id: `kudos:${r.from}:${r.t}`, kind: 'kudos', from: r.from, name: p.name, animal: p.animal, text: `${k.emoji} ${k.said}`, t: r.t });
      hallSound('kudos');
      haptic([12, 40, 12]);
      updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => void (d.got += 1));
      if (useUI.getState().mode !== 'together') toast({ emoji: k.emoji, title: `${p.name} ${k.said}`, ms: 3500 });
    }
  }
}

function onSays(recs: SayRec[]) {
  set({ says: recs });
  const first = !baseline.has('says');
  baseline.add('says');
  const me = myUid();
  for (const r of recs) {
    const key = `s:${r.from}>${r.to}`;
    if (r.t <= (seen.get(key) ?? 0)) continue;
    seen.set(key, r.t);
    if (first || isMuted(r.from)) continue;
    const say = SAYS[r.k];
    addFx({ uid: r.from, to: r.to, text: say.text, kind: 'say' });
    if (r.to === me) {
      const p = personOf(r.from);
      addItem({ id: `say:${r.from}:${r.t}`, kind: 'say', from: r.from, name: p.name, animal: p.animal, text: say.text, t: r.t });
      hallSound('join');
      toast({ emoji: say.emoji, title: `${p.name}: ${say.text}`, ms: 3500 });
    }
  }
}

function onReqs(recs: ReqRec[]) {
  const now = serverNow();
  const done = answered();
  for (const r of recs) {
    const id = `ask:${r.from}:${r.t}`;
    if (done.has(id) || isMuted(r.from) || r.t + ASK_TTL < now || get().items.some((i) => i.id === id)) continue;
    const p = personOf(r.from);
    addItem({ id, kind: 'ask', from: r.from, name: p.name, animal: p.animal, text: ASK_TEXT, t: r.t, g: r.g });
    hallSound('kudos');
    haptic([10, 30, 10]);
    // the card disappears by itself when it expires
    setTimeout(() => set((s) => ({ items: [...s.items] })), ASK_TTL + 500);
  }
}

function onAnswers(recs: AnsRec[]) {
  for (const a of recs) {
    const key = `a:${a.from}:${a.t}`;
    if (seen.has(key)) continue;
    seen.set(key, a.t);
    hall?.dropAns(a.from);
    const p = personOf(a.from);
    set((s) => ({ out: s.out[a.from] ? { ...s.out, [a.from]: { ...s.out[a.from], state: a.r === 'y' ? 'yes' : 'no' } } : s.out }));
    if (a.r === 'y') {
      addItem({ id: `yes:${a.from}:${a.t}`, kind: 'yes', from: a.from, name: p.name, animal: p.animal, text: 'said yes! Studying together 🌱', t: a.t });
      void joinFromAnswer(a.g, p.name);
    } else {
      addItem({ id: `no:${a.from}:${a.t}`, kind: 'no', from: a.from, name: p.name, animal: p.animal, text: 'says not now 💛', t: a.t });
      toast({ emoji: '💛', title: `${p.name} says not now`, body: 'No worries. Maybe after this session.', ms: 3500 });
    }
  }
}

function timerSeat(): Partial<Pick<Seat, 's' | 'e' | 'd'>> {
  const t = useTimer.getState();
  const off = conn?.offset() ?? 0;
  if (t.status === 'running') return { s: t.mode === 'focus' ? 'f' : 'b', e: Math.round((t.endAt ?? 0) + off), d: Math.round(t.durationMs) };
  if (t.status === 'paused') return { s: 'p', e: Math.round(t.remainingMs), d: Math.round(t.durationMs) };
  return { s: 'i', e: 0, d: 0 };
}
let offTimer: (() => void) | null = null;
function startSeatSync() {
  offTimer?.();
  let last = '';
  const push = () => {
    const s = timerSeat();
    const key = `${s.s}|${s.e}|${s.d}`;
    if (key === last) return;
    last = key;
    hall?.patch(s);
  };
  push();
  offTimer = useTimer.subscribe(push);
}

/** Sit down in the hall (the remembered room first). Resolves true when seated. */
export async function enterHall(opts: { google?: boolean; prefer?: string; quiet?: boolean } = {}): Promise<boolean> {
  if (hall || get().hall === 'joining') return !!hall;
  const prefer = opts.prefer ?? readFlag()?.room ?? '';
  set({ hall: 'joining', err: null });
  sync();
  try {
    const c = await ensureConn(opts.google);
    baseline.clear();
    const h = await joinHall(c, profile(), timerSeat(), {
      seats: (seats) => set({ seats }),
      kudos: onKudos,
      says: onSays,
      reqs: onReqs,
      answers: onAnswers,
      moved: (room, slot) => {
        baseline.clear();
        set({ room, slot });
        sync();
      },
    }, prefer);
    if (get().hall !== 'joining') {
      // "Leave" was pressed while we were still sitting down
      await h.leave();
      maybeClose();
      return false;
    }
    hall = h;
    set({ hall: 'in', room: h.room(), slot: h.slot() });
    sync();
    startSeatSync();
    if (!opts.quiet) hallSound('join');
    return true;
  } catch (e) {
    console.warn('[together]', e);
    set({ hall: 'off', err: errOf(e) });
    sync();
    maybeClose();
    return false;
  }
}

export async function leaveHall() {
  const h = hall;
  hall = null;
  offTimer?.();
  offTimer = null;
  set({ hall: 'off', room: '', slot: -1, seats: [], kudos: [], says: [], items: [], fx: [], out: {} });
  sync();
  await h?.leave();
  maybeClose();
}

/* ------------------------------------------------------------------ */
/* hall actions                                                        */
/* ------------------------------------------------------------------ */
/** ms until the next say / kudos / ask to this person is allowed (mirrors the rules) */
export function cooldowns(s: TState, to: string, now: number) {
  const say = s.says.find((r) => r.from === s.uid && r.to === to);
  const kd = s.kudos.find((r) => r.from === s.uid && r.to === to);
  const o = s.out[to];
  const askPair = o ? o.t + ASK_GAP - now : 0;
  return {
    say: say ? Math.max(0, say.t + SAY_GAP - now) : 0,
    kudos: kd ? Math.max(0, kd.t + 120_000 - now) : 0,
    ask: Math.max(0, askPair, s.lastAsk + ASK_ANY_GAP - now),
    asking: !!o && o.state === 'wait' && now - o.t < ASK_TTL,
  };
}

export async function sendSay(to: string, k: SayKind) {
  const seat = get().seats.find((x) => x.uid === to);
  if (!hall || !seat) return false;
  if (cooldowns(get(), to, serverNow()).say > 0) {
    toast({ emoji: '🍵', title: 'One moment', body: 'You can send them another message in a few seconds.' });
    return false;
  }
  haptic(8);
  const ok = await hall.sendSay(to, seat.i, k);
  if (!ok) toast({ emoji: '🍵', title: 'Not sent', body: 'Give it a few seconds and try again.' });
  return ok;
}

export async function sendKudos(to: string, k: KudosKind) {
  if (!hall) return false;
  const s = get();
  const prev = s.kudos.find((r) => r.from === s.uid && r.to === to);
  if (cooldowns(s, to, serverNow()).kudos > 0) {
    toast({ emoji: '🍵', title: 'Give them a minute', body: 'You can cheer for the same friend once every 2 minutes.' });
    return false;
  }
  haptic(10);
  const ok = await hall.sendKudos(to, k, prev?.c ?? 0);
  if (ok) updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => void (d.given += 1));
  else toast({ emoji: '🍵', title: 'Give them a minute', body: 'You can cheer for the same friend once every 2 minutes.' });
  return ok;
}

export async function askTogether(to: string) {
  const s = get();
  const seat = s.seats.find((x) => x.uid === to);
  if (!hall || !seat) return false;
  const now = serverNow();
  const cd = cooldowns(s, to, now);
  if (cd.asking) return false;
  if (cd.ask > 0) {
    toast({ emoji: '🍵', title: 'Not so fast', body: `You can ask again in ${Math.ceil(cd.ask / 1000)} s.` });
    return false;
  }
  haptic(10);
  const code = s.group && s.code ? s.code : '';
  const ok = await hall.ask(to, seat.i, code);
  if (!ok) {
    toast({ emoji: '🍵', title: 'Not sent', body: 'You can ask the same person once every 2 minutes.' });
    return false;
  }
  set((x) => ({ out: { ...x.out, [to]: { name: seat.n, t: now, state: 'wait' } }, lastAsk: now }));
  setTimeout(() => set((x) => (x.out[to]?.t === now && x.out[to].state === 'wait' ? { out: { ...x.out, [to]: { ...x.out[to], state: 'gone' } } } : {})), ASK_TTL + 500);
  toast({ emoji: '📚', title: `Asked ${seat.n}`, body: 'They have 2 minutes to answer.', ms: 3000 });
  return true;
}

const markItem = (id: string, done: Item['done']) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, done } : i)) }));

/** the group both of us end up in: theirs, mine (busy or no group from them) or a fresh one */
async function groupForAccept(theirs: string): Promise<string> {
  const s = get();
  if (s.code && s.group && (s.group.st === 'running' || !theirs || theirs === s.code)) return s.code;
  if (theirs) {
    if (s.code) await leaveGroup();
    if (await attachGroup(theirs, null)) return theirs;
  }
  if (get().code && get().group) return get().code;
  const code = randomCode();
  return (await attachGroup(code, { plant: 'sunflower', dur: 25 })) ? code : '';
}

export async function answerAsk(item: Item, yes: boolean) {
  if (!hall || item.kind !== 'ask' || item.done) return;
  if (serverNow() > item.t + ASK_TTL) {
    markItem(item.id, 'n');
    return;
  }
  markItem(item.id, 'busy');
  rememberAnswered(item.id);
  if (!yes) {
    await hall.answer(item.from, item.t, false, '');
    markItem(item.id, 'n');
    return;
  }
  const code = await groupForAccept(item.g ?? '');
  if (!code || !hall) {
    markItem(item.id, undefined);
    toast({ emoji: '🍵', title: 'Could not open a group', body: 'Try again in a moment.' });
    return;
  }
  const ok = await hall.answer(item.from, item.t, true, code);
  markItem(item.id, 'y');
  if (ok) {
    toast({ emoji: '🌱', title: `Studying together with ${item.name}`, body: 'Your group is open. Say hi in the chat!' });
    showGroup();
  } else toast({ emoji: '⌛', title: 'That ask just expired', body: 'Your group is open; you can ask them back.' });
}

async function joinFromAnswer(code: string, name: string) {
  const s = get();
  if (!/^[A-Z]{5}$/.test(code)) return;
  if (s.code === code) {
    toast({ emoji: '🌱', title: `${name} said yes!`, body: 'They joined your group.' });
    showGroup();
    return;
  }
  if (s.group?.st === 'running') {
    toast({ emoji: '🌱', title: `${name} said yes!`, body: `You are mid-focus. Join their group ${code} afterwards.`, ms: 8000 });
    return;
  }
  if (s.code) await leaveGroup();
  if (await attachGroup(code, null)) {
    toast({ emoji: '🌱', title: `${name} said yes!`, body: 'You are in a Study Together group now.' });
    showGroup();
  }
}

export function toggleMute(uid: string) {
  const on = !isMuted(uid);
  setMuted(uid, on);
  set((s) => ({ muteTick: s.muteTick + 1, ...(on ? { items: s.items.filter((i) => i.from !== uid), fx: s.fx.filter((f) => f.uid !== uid) } : {}) }));
  toast({ emoji: on ? '🔕' : '🔔', title: on ? 'Muted' : 'Unmuted', body: on ? 'You will not see their messages, asks or chat.' : 'You will see them again.', ms: 2500 });
}

/* ------------------------------------------------------------------ */
/* Study Together groups                                               */
/* ------------------------------------------------------------------ */
export const teamBonus = (n: number) => Math.min(30, 8 + 4 * Math.max(0, n - 1));
export type GroupPhase = 'none' | 'joining' | 'lobby' | 'running' | 'bloom' | 'rest' | 'closed';

export function groupView(s: TState, now: number) {
  const g = s.group;
  const me = g?.members.find((m) => m.uid === s.uid);
  const dur = (g?.dur ?? 25) * 60_000;
  const elapsed = g && g.st !== 'lobby' && g.at ? Math.max(0, now - g.at) : 0;
  const remaining = Math.max(0, dur - elapsed);
  const away = g?.members.filter((m) => m.m === 'away' || m.m === 'left') ?? [];
  const out = g?.members.filter((m) => m.m === 'out') ?? [];
  let phase: GroupPhase = 'none';
  if (g) phase = g.st === 'lobby' ? 'lobby' : g.st === 'running' ? 'running' : g.res === 'bloom' ? 'bloom' : g.res === 'rest' ? 'rest' : 'running';
  else if (s.groupBusy || s.code) phase = 'joining';
  else if (s.groupClosed) phase = 'closed';
  const finished = phase === 'bloom' || phase === 'rest';
  const growth = finished ? 1 : phase === 'running' ? Math.min(0.98, elapsed / dur) : 0.02;
  const wilt = phase === 'bloom' ? 0 : Math.min(0.95, (out.length ? 0.5 : 0) + (away.length && !finished ? 0.4 : 0));
  return { group: g, me, phase, remaining, away, out, growth, wilt, bonus: teamBonus(g?.members.length ?? 1) };
}

function groupMsg(r: 'missing' | 'full' | 'taken') {
  return r === 'missing' ? 'We could not find that code (or the group has ended). Check the letters?' : r === 'full' ? 'That group is full (12 friends).' : 'That code was just taken. Try again.';
}

async function attachGroup(code: string, create: { plant: Plant; dur: number } | null): Promise<boolean> {
  if (get().groupBusy) return false;
  set({ groupBusy: true, groupErr: null, groupClosed: false, code, group: null });
  sync();
  try {
    const c = await ensureConn();
    const p = profile();
    const r = await openGroup(c, code, { name: p.name, animal: p.animal }, create, (g) => onGroup(code, g));
    if (typeof r === 'string') {
      set({ groupBusy: false, code: '', group: null, groupErr: groupMsg(r) });
      sync();
      maybeClose();
      return false;
    }
    if (get().code !== code) {
      await r.leave(false);
      set({ groupBusy: false });
      maybeClose();
      return false;
    }
    gctl = r;
    set({ groupBusy: false, readAt: Number(ss.get(readKey(code))) || get().readAt });
    startGroupWatch();
    sync();
    const g = get().group;
    if (g) groupEffects(g);
    return true;
  } catch (e) {
    console.warn('[together]', e);
    set({ groupBusy: false, code: '', group: null, groupErr: e instanceof AuthNeeded ? errOf(e).msg : 'Could not reach the hall. Try again in a moment.' });
    sync();
    maybeClose();
    return false;
  }
}

function onGroup(code: string, g: Group | null) {
  if (get().code !== code) return;
  if (!g) {
    gctl?.detach();
    gctl = null;
    stopGroupWatch();
    set({ group: null, code: '', groupClosed: true });
    sync();
    toast({ emoji: '🌿', title: 'The Study Together group ended', ms: 3500 });
    maybeClose();
    return;
  }
  const first = !get().group;
  if (first && !ss.get(readKey(code))) {
    // a new member starts with the old messages already read
    const last = g.chat.reduce((a, m) => Math.max(a, m.t), 0);
    set({ readAt: last });
    ss.set(readKey(code), String(last));
  }
  set({ group: g });
  touch();
  if (gctl) groupEffects(g);
}

function groupEffects(g: Group) {
  const uid = myUid();
  const me = g.members.find((m) => m.uid === uid);
  if (!me) return;
  const now = serverNow();
  if (g.st === 'running' && g.at && me.m !== 'out') {
    const key = `${g.code}-${g.at}`;
    const left = g.dur * 60_000 - (now - g.at);
    if (ss.get('together:timerFor') !== key) {
      ss.set('together:timerFor', key);
      // everyone starts their own focus timer, so seats, the ring and fish coins all just work;
      // already focusing? that session simply counts for the group (one session at a time, never a second one)
      const t = useTimer.getState();
      if (t.mode === 'focus' && t.status !== 'idle') toast({ emoji: '🫶', title: 'The group started', body: 'You’re already focusing, so this session counts for the group.', ms: 4500 });
      else if (left > 30_000) requestFocusFor(Math.max(1, Math.ceil(left / 60_000)), 'Focus together', undefined, '🫶', 'together');
      gctl?.setMine('in');
    } else if (me.m === 'left' && !document.hidden) gctl?.setMine('in');
  }
  if (g.st === 'done' && g.res) reward(g, me);
}

function reward(g: Group, me: Member) {
  const key = `${g.code}-${g.at}`;
  if (getFeatureData<TogetherData>('together', EMPTY_DATA).history.some((h) => h.key === key)) return;
  const bonus = me.m !== 'out' && g.res === 'bloom' ? teamBonus(g.members.length) : 0;
  updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => {
    if (d.history.some((h) => h.key === key)) return;
    d.history.unshift({ key, at: g.at, dur: g.dur, n: g.members.length, res: g.res!, plant: g.plant });
    d.history.length = Math.min(d.history.length, 30);
    if (g.res === 'bloom' && me.m !== 'out') d.blooms += 1;
  });
  if (bonus) {
    earn(bonus, 'Team bloom');
    bus.emit('confetti', { big: true });
    hallSound('bloom');
    bus.emit('mascot:say', { text: 'Team bloom! You all did it 🌸', mood: 'love', ms: 4500 });
  } else hallSound('sad');
}

let watch: (() => void)[] = [];
function startGroupWatch() {
  stopGroupWatch();
  const mine = () => get().group?.members.find((m) => m.uid === myUid())?.m;
  const running = () => get().group?.st === 'running';
  let grace: ReturnType<typeof setTimeout> | undefined;
  watch.push(
    bus.on('tab:away', () => {
      clearTimeout(grace);
      grace = setTimeout(() => running() && mine() === 'in' && gctl?.setMine('away'), 4000);
    }),
    bus.on('tab:back', () => {
      clearTimeout(grace);
      const m = mine();
      if (running() && (m === 'away' || m === 'left')) gctl?.setMine('in');
    }),
    bus.on('session:early', () => {
      const m = mine();
      if (running() && m && m !== 'out') {
        gctl?.setMine('out');
        toast({ emoji: '💛', title: 'You stepped out of the group', body: 'No worries. Your friends can still finish; the plant will rest.' });
      }
    }),
    () => clearTimeout(grace),
  );
  // time is up: the first client to notice settles the result for everybody (retried every few seconds)
  const tick = setInterval(() => {
    const g = get().group;
    if (!g || g.st !== 'running' || !g.at || document.hidden) return;
    if (serverNow() >= g.at + g.dur * 60_000) gctl?.finish(g.members.some((m) => m.m === 'out' || m.m === 'left') ? 'rest' : 'bloom');
  }, 3000);
  watch.push(() => clearInterval(tick));
}
function stopGroupWatch() {
  watch.forEach((o) => o());
  watch = [];
}

export const createGroup = async (plant: Plant, dur: number) => {
  if (get().code) await leaveGroup();
  return attachGroup(randomCode(), { plant, dur });
};
export async function joinGroup(code: string) {
  if (get().code === code) return true;
  if (get().code) await leaveGroup();
  return attachGroup(code, null);
}
export async function startGroup() {
  const ok = await gctl?.start();
  if (!ok) set({ groupErr: 'Could not start. Is the group still in the lobby?' });
}
export const againGroup = () => gctl?.again();
export const planGroup = (p: { plant?: Plant; dur?: number }) => gctl?.plan(p);

export async function leaveGroup() {
  const c = gctl;
  const running = get().group?.st === 'running';
  gctl = null;
  stopGroupWatch();
  set({ code: '', group: null, groupErr: null, groupClosed: false, groupBusy: false });
  sync();
  await c?.leave(running);
  maybeClose();
}

let lastChat = 0;
export async function sendChat(text: string): Promise<'ok' | 'slow' | 'fail' | 'empty'> {
  const s = get();
  const g = s.group;
  const me = g?.members.find((m) => m.uid === s.uid);
  const x = mask(text.replace(/\s+/g, ' ').trim()).slice(0, CHAT_MAX);
  if (!x || !g || !me || !gctl) return 'empty';
  if (Date.now() - lastChat < CHAT_GAP + 100) return 'slow';
  lastChat = Date.now();
  return (await gctl.chat(x, me.n, g.nextSlot)) ? 'ok' : 'fail';
}

/* ------------------------------------------------------------------ */
/* opening views                                                       */
/* ------------------------------------------------------------------ */
export function showGroup() {
  if (useUI.getState().mode === 'together') set({ focus: 'group' });
  else set({ tray: true, trayTab: 'group' });
}
export function openView(focus: 'hall' | 'group') {
  set({ focus, tray: false });
  useUI.getState().set({ mode: 'together' });
}

/* ------------------------------------------------------------------ */
/* rejoin after a reload of this tab                                   */
/* ------------------------------------------------------------------ */
let restoring: Promise<void> | null = null;
export function restore() {
  return (restoring ??= (async () => {
    const f = readFlag();
    if (!f) return void sync();
    for (let i = 0; i < 3; i++) {
      if (f.hall && get().hall === 'off') await enterHall({ prefer: f.room, quiet: true });
      if (f.group && !get().code && !get().groupClosed) {
        const ok = await attachGroup(f.group, null);
        if (!ok && get().groupErr && !/reach/.test(get().groupErr!)) break; // the group has ended
      }
      const hallOk = !f.hall || get().hall === 'in' || get().err?.kind === 'signin';
      const groupOk = !f.group || !!get().code || !!get().groupErr && !/reach/.test(get().groupErr!);
      if (hallOk && groupOk) break;
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
    sync();
  })());
}
