import { initializeApp } from 'firebase/app';
import * as fs from 'firebase/firestore';
import { normalizeUserData, recordFocusSession } from '@/data/model';
import type { UserData } from '@/data/types';
import { buildWrites, clean, derive, mergeGuest, replayMissing, snapshotAction, toWire } from '../syncDiff';

let failed = 0;
const ok = (c: unknown, m: string) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
  if (!c) failed++;
};
const client = (name: string) => {
  const app = initializeApp({ projectId: 'demo-sync' }, name);
  const db = fs.initializeFirestore(app, {});
  fs.connectFirestoreEmulator(db, '127.0.0.1', 8189);
  return db;
};
const load = async (db: fs.Firestore, id: string) => derive(normalizeUserData((await fs.getDoc(fs.doc(db, 'users', id))).data()));
const send = (db: fs.Firestore, id: string, base: UserData, cur: UserData) => {
  const w = buildWrites(fs, base, cur);
  if (!w.args.length) return Promise.resolve();
  return (fs.updateDoc as (r: unknown, ...a: unknown[]) => Promise<void>)(fs.doc(db, 'users', id), ...w.args);
};
const session = (d: UserData, sec: number, at: number) => recordFocusSession(d, { seconds: sec, completed: true, startedAt: at });

async function main() {
  const A = client('a');
  const B = client('b');
  const now = Date.now() - 3600_000;

  // 1. two devices record sessions concurrently from the same starting copy -> both counted
  const seed = normalizeUserData({});
  seed.wallet = { coins: 10, earned: 10, items: {} };
  await fs.setDoc(fs.doc(A, 'users', 'u1'), toWire(seed));
  const baseA = await load(A, 'u1');
  const baseB = await load(B, 'u1');
  const a = clean(baseA);
  const b = clean(baseB);
  session(a, 1500, now);
  session(b, 900, now + 2000_000);
  (a.wallet as { coins: number }).coins += 5; // A earns
  (b.wallet as { coins: number }).coins -= 3; // B spends
  await Promise.all([send(A, 'u1', baseA, a), send(B, 'u1', baseB, b)]);
  const r1 = await load(A, 'u1');
  ok(r1.totalFocusSeconds === 2400 && r1.totalSessions === 2, 'concurrent sessions: totals add up (2400s, 2 sessions)');
  ok(r1.sessionLog!.length === 2, 'concurrent sessions: both in the log');
  ok(Object.values(r1.dailyFocusSeconds!).reduce((x, y) => x + y, 0) === 2400, 'concurrent sessions: daily buckets add up');
  ok(r1.hourlyFocusSeconds!.reduce((x, y) => x + y, 0) === 2400, 'hourly buckets (map form) add up');
  ok((r1.wallet as { coins: number }).coins === 12, 'concurrent wallet: +5 and -3 both applied (12)');

  // 2. offline cached "empty" snapshot never seeds or overwrites
  const C = client('c');
  const acct = normalizeUserData({});
  session(acct, 600, now);
  await fs.setDoc(fs.doc(C, 'users', 'u2'), toWire(acct));
  const D = client('d'); // fresh device, cache empty
  await fs.disableNetwork(D);
  const metas: Array<{ fromCache: boolean; exists: boolean; hasPendingWrites: boolean }> = [];
  const unsub = fs.onSnapshot(fs.doc(D, 'users', 'u2'), { includeMetadataChanges: true }, (s) => metas.push({ fromCache: s.metadata.fromCache, exists: s.exists(), hasPendingWrites: s.metadata.hasPendingWrites }));
  await new Promise((r) => setTimeout(r, 800));
  ok(metas.length > 0 && metas.every((m) => m.fromCache && !m.exists), 'offline device sees a cached, non-existent doc');
  ok(metas.every((m) => snapshotAction(false, m, m.exists) === 'cache'), 'that snapshot is display-only (never "seed")');
  await fs.enableNetwork(D);
  await new Promise((r) => setTimeout(r, 1200));
  const real = metas.filter((m) => !m.fromCache)[0];
  ok(real && real.exists && snapshotAction(false, real, real.exists) === 'load', 'first server snapshot loads the real account');
  unsub();
  const r2 = await load(C, 'u2');
  ok(r2.totalFocusSeconds === 600 && r2.totalSessions === 1, 'real account untouched');
  ok(snapshotAction(false, { fromCache: false, hasPendingWrites: false }, false) === 'seed', 'only a server-confirmed missing doc is seeded');

  // 3. guest sessions replay into an existing account exactly once
  const guest = normalizeUserData({});
  session(guest, 300, now - 7200_000);
  session(guest, 420, now - 5400_000);
  for (let round = 1; round <= 2; round++) {
    const baseE = await load(A, 'u2');
    const e = clean(baseE);
    const n = replayMissing(e, guest.sessionLog);
    await send(A, 'u2', baseE, e);
    const r3 = await load(A, 'u2');
    ok(round === 1 ? n === 2 && r3.totalFocusSeconds === 600 + 720 && r3.totalSessions === 3 : n === 0 && r3.totalFocusSeconds === 1320, `guest replay round ${round}: ${round === 1 ? 'added once' : 'nothing added again'}`);
  }

  // 4. midnight split + streak
  const m = normalizeUserData({});
  const last = new Date();
  last.setHours(0, 0, 0, 0);
  const start = last.getTime() - 25 * 60_000; // 23:35 yesterday -> 00:00 today +0 (30 min session crosses)
  const yesterday = new Date(start);
  const dayBefore = new Date(start - 86400_000);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  m.lastStreakDate = key(dayBefore);
  m.streakCount = 5;
  m.bestStreak = 5;
  session(m, 1800, start);
  ok(m.dailyFocusSeconds![key(yesterday)] === 1500 && m.dailyFocusSeconds![key(last)] === 300, 'midnight session split 1500s / 300s');
  ok(m.streakCount === 7, 'midnight session keeps and extends the streak (5 -> 7)');

  // 5. a guest's other work (coins, tasks, categories, journal, planner) joins an existing account, once
  {
    const acct = await load(A, 'u2');
    acct.regularTasks = [{ id: 'm1', name: 'Math' }];
    acct.todos = [{ id: 't1', text: 'account task', completed: false, subtasks: [], canonicalId: 'm1' }];
    acct.journalEntries = { '2026-11-01': { text: 'account wrote this', date: '2026-11-01' } };
    (acct as Record<string, unknown>).wallet = { coins: 40, earned: 100, items: { fish: 1 } };
    (acct as Record<string, unknown>).garden = { plots: ['account'] };
    await fs.setDoc(fs.doc(A, 'users', 'u2'), toWire(acct));
    const g = normalizeUserData({});
    session(g, 600, now - 3600_000);
    g.regularTasks = [{ id: 'gm', name: 'math' }, { id: 'gb', name: 'Biology' }];
    g.todos = [
      { id: 'g1', text: 'guest math', completed: false, subtasks: [], canonicalId: 'gm' },
      { id: 'g2', text: 'guest bio', completed: true, subtasks: [], canonicalId: 'gb' },
      { id: 't1', text: 'same id as the account task', completed: false, subtasks: [] },
    ];
    g.journalEntries = { '2026-11-01': { text: 'guest wrote this', date: '2026-11-01', mood: 4 }, '2026-11-02': { text: 'only the guest', date: '2026-11-02' } };
    g.timetable = { s1: { day: 'monday', start: '09:00', end: '10:00', activity: 'Read', completed: false } };
    (g as Record<string, unknown>).wallet = { coins: 7, earned: 10, items: { fish: 2, seed: 1 } };
    (g as Record<string, unknown>).garden = { plots: ['guest'] };
    (g as Record<string, unknown>).flights = { trips: 1 };
    (g as Record<string, unknown>).cat = { name: 'guest cat' };
    g.settings.workDuration = 999;
    const blob = JSON.parse(JSON.stringify({ ...g, isGuestData: true, lastSaved: 1 }));
    const results: ReturnType<typeof mergeGuest>[] = [];
    for (let round = 1; round <= 2; round++) {
      const baseM = await load(A, 'u2');
      const t = clean(baseM);
      results.push(mergeGuest(t, normalizeUserData(blob)));
      await send(A, 'u2', baseM, t);
    }
    const r = await load(A, 'u2');
    const w = r.wallet as { coins: number; earned: number; items: Record<string, number> };
    ok(results[0].sessions === 1 && results[0].moved && r.totalSessions === acct.totalSessions + 1, `guest merge: the session counted (${r.totalSessions})`);
    ok(w.coins === 47 && w.earned === 110 && w.items.fish === 3 && w.items.seed === 1, `guest merge: coins and items added (${JSON.stringify(w)})`);
    const ids = r.todos.map((x) => x.id).join(',');
    ok(ids === 't1,g1,g2' && r.todos[0].text === 'account task', `guest merge: tasks added, the account's own kept (${ids})`);
    ok(r.todos[1].canonicalId === 'm1' && r.regularTasks.map((c) => c.name).join(',') === 'Math,Biology' && r.todos[2].canonicalId === 'gb', 'guest merge: same-named category reused, new one added');
    const j = r.journalEntries['2026-11-01'];
    ok(j.text === 'account wrote this\n\nguest wrote this' && j.mood === 4 && r.journalEntries['2026-11-02']?.text === 'only the guest', 'guest merge: journal day both wrote keeps both texts');
    ok(r.timetable.s1?.activity === 'Read', 'guest merge: planner block added');
    ok(JSON.stringify(r.garden) === JSON.stringify({ plots: ['account'] }) && JSON.stringify(r.flights) === JSON.stringify({ trips: 1 }) && !('cat' in r) && !('isGuestData' in r), "guest merge: the account's garden kept, flights added, cat left to its own merge");
    ok(r.settings.workDuration !== 999, "guest merge: the account's settings kept");
    ok(results[1].sessions === 0 && !results[1].moved && !results[1].changed, `a second tab merging the same guest data adds nothing (${JSON.stringify(results[1])})`);
  }

  console.log(failed ? `\n${failed} FAILED` : '\nall sync tests passed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
