import { initializeApp } from 'firebase/app';
import * as fs from 'firebase/firestore';
import { normalizeUserData, recordFocusSession } from '@/data/model';
import type { UserData } from '@/data/types';
import { buildWrites, clean, derive, replayMissing, snapshotAction, toWire } from '../syncDiff';

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

  console.log(failed ? `\n${failed} FAILED` : '\nall sync tests passed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
