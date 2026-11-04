/**
 * Focus ledger tests: the pure rules (src/features/pledge/ledger.ts) and POST /api/focus/log against the Firebase
 * Auth + Firestore emulators. Run: sh api/focus/_test/run.sh
 */
import { POST as log } from '../log.js';
import { logFocus } from '../_lib/focus.js';
import { db } from '../../pledge/_lib/admin.js';
import { applyBatch, cleanProfileName, parseFocusBatch, publicEntryFor, LEDGER_FIRST_LOOKBACK_MS, type FocusLedgerDoc } from '../../../src/features/pledge/ledger.js';
import { addDaysKey, zonedDateKey } from '../../../src/features/pledge/rules.js';

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const tz = 'Asia/Kolkata';
let passed = 0;
let failed = 0;
function ok(cond: unknown, name: string, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}
const section = (s: string) => console.log(`\n${s}`);

async function signUp(name: string | null) {
  const body = name ? { email: `${name}@example.com`, password: 'secret-pass-123', returnSecureToken: true } : { returnSecureToken: true };
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { idToken: string; localId: string };
  return { token: j.idToken, uid: j.localId };
}
function req(opts: { token?: string; body?: unknown; raw?: string; type?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': opts.type ?? 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  return new Request('http://localhost/api/focus/log', { method: 'POST', headers, body: opts.raw ?? JSON.stringify(opts.body ?? {}) });
}
async function call(r: Request) {
  const res = await log(r);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}
const S = (...secs: number[]) => secs.map((sec) => ({ sec, done: true }));
const body = (sessions: { sec: number; done: boolean }[], extra: Record<string, unknown> = {}) => ({ sessions, tz, name: 'Asha', ...extra });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ledgerOf = async (uid: string) => (await db().doc(`focusLedger/${uid}`).get()).data() as FocusLedgerDoc | undefined;
const pubOf = async (uid: string) => (await db().doc(`publicUsers/${uid}`).get()).data() as Record<string, any> | undefined;

async function main() {
  section('request checks (pure)');
  ok(parseFocusBatch(body(S(1500))), 'a normal 25-min session is accepted');
  ok(!parseFocusBatch(null) && !parseFocusBatch([]) && !parseFocusBatch('x'), 'non-objects refused');
  ok(!parseFocusBatch(body([])), 'no sessions refused');
  ok(!parseFocusBatch(body(S(...Array(21).fill(60)))), 'more than 20 sessions refused');
  ok(!parseFocusBatch(body(S(29))), 'under 30 s refused');
  ok(!parseFocusBatch(body(S(21601))), 'over 6 h refused');
  ok(!parseFocusBatch(body(S(60.5))), 'fractional seconds refused');
  ok(!parseFocusBatch(body([{ sec: 60, done: 'yes' as never }])), 'non-boolean done refused');
  ok(!parseFocusBatch(body([{ sec: '60' as never, done: true }])), 'string seconds refused');
  ok(!parseFocusBatch(body(S(60), { tz: 'Mars/Olympus' })), 'unknown time zone refused');
  ok(!parseFocusBatch(body(S(60), { name: 42 })), 'non-string name refused');
  ok(parseFocusBatch(body(S(60), { name: undefined }))?.name === 'Floww User', 'missing name gets the default');
  ok(cleanProfileName('A‮sha​\u0000  Rao') === 'Asha Rao', 'bidi overrides, zero-width and control chars removed', cleanProfileName('A‮sha​\u0000  Rao'));
  ok(cleanProfileName('x'.repeat(500)).length === 40, 'names cut to 40');
  ok(cleanProfileName('   ') === 'Floww User', 'blank name gets the default');

  section('crediting rules (pure)');
  const T = Date.parse('2026-11-03T12:00:00+05:30');
  const created = T - 3600_000; // account made an hour ago
  let r = applyBatch(null, S(36000 / 2, 36000 / 2), tz, T, { createdAt: created });
  ok(r.credited === 3600, 'first report: never more than the account has existed (claims 10 h, gets 1 h)', r.credited);
  r = applyBatch(null, S(21600, 21600, 21600), tz, T, { createdAt: T - 30 * 86400_000 });
  ok(r.credited === LEDGER_FIRST_LOOKBACK_MS / 1000, 'first report of an old account: at most 12 h back', r.credited);
  const first = applyBatch(null, S(1500), tz, T, { createdAt: T - 86400_000 });
  ok(first.credited === 1500 && first.added[0].at === T - 1500_000, 'a session is laid to end at the server time it arrives', first.added);
  const again = applyBatch(first.ledger, S(1500), tz, T + 10_000);
  ok(again.credited === 10, 'replaying a session 10 s later credits only those 10 s', again.credited);
  const later = applyBatch(first.ledger, S(1500), tz, T + 1500_000);
  ok(later.credited === 1500 && later.ledger.totalSec === 3000, 'the next real session (25 min later) counts in full', later.ledger.totalSec);
  const trimmed = applyBatch(first.ledger, S(600, 600, 600), tz, T + 1000_000);
  ok(trimmed.credited === 1000 && trimmed.added.length === 2 && trimmed.added[0].sec === 400, 'too much in one batch: the oldest sessions are trimmed', trimmed.added);
  const back = applyBatch(first.ledger, S(1500), tz, T - 3600_000);
  ok(back.credited === 0 && back.ledger.lastEnd === first.ledger.lastEnd, 'a clock behind the last report credits nothing and never moves lastEnd back', back.ledger.lastEnd);
  // streak: focus on three days in a row, then a gap
  let l: FocusLedgerDoc | null = null;
  for (const d of [0, 1, 2]) l = applyBatch(l, S(1500), tz, T + d * 86400_000, { createdAt: T - 86400_000 }).ledger;
  const today = zonedDateKey(T + 2 * 86400_000, tz);
  ok(l!.streak === 3 && l!.streakDay === today, 'streak counts consecutive days', l);
  ok(publicEntryFor(l!, 'Asha', T + 3 * 86400_000, tz).currentStreak === 3, 'streak still shown the next day');
  ok(publicEntryFor(l!, 'Asha', T + 4 * 86400_000, tz).currentStreak === 0, 'a missed day shows streak 0');
  l = applyBatch(l, S(1500), tz, T + 5 * 86400_000).ledger;
  ok(l.streak === 1, 'focus after a gap restarts the streak at 1', l.streak);
  // grandfathering the old browser-written entry
  const g = applyBatch(null, S(60), tz, T, { createdAt: T - 5 * 86400_000, publicUser: { currentStreak: 10000, lastStreakUpdate: zonedDateKey(T, tz), date: zonedDateKey(T, tz), todayFocusMinutes: 1440 } });
  ok(g.ledger.streak <= 6, 'a faked old streak (10000) is cut to the account age in days', g.ledger.streak);
  ok(publicEntryFor(g.ledger, 'x', T, tz).todayFocusMinutes <= 12 * 60 + 1, "a faked old 'today' (1440 min) is cut to the time since local midnight", publicEntryFor(g.ledger, 'x', T, tz));
  ok(g.ledger.totalSec === 60, 'grandfathered minutes never reach the lifetime total (so never a pledge)', g.ledger.totalSec);
  const dead = applyBatch(null, S(60), tz, T, { createdAt: T - 50 * 86400_000, publicUser: { currentStreak: 20, lastStreakUpdate: addDaysKey(zonedDateKey(T, tz), -3) } });
  ok(dead.ledger.streak === 1, 'an old streak that had already lapsed is not carried over', dead.ledger.streak);

  section('POST /api/focus/log (emulator)');
  const A = await signUp('asha');
  const B = await signUp('bilal');
  const anon = await signUp(null);
  const C = await signUp('chen');
  const cBorn = Date.now();
  ok((await call(req({ body: body(S(60)) }))).status === 401, 'no token → 401');
  ok((await call(req({ token: 'not-a-real-token-at-all-xxxxx', body: body(S(60)) }))).status === 401, 'bad token → 401');
  ok((await call(req({ token: anon.token, body: body(S(60)) }))).status === 401, 'anonymous (Study Together guest) account → 401');
  ok((await call(req({ token: A.token, raw: '{"sessions":', type: 'application/json' }))).status === 400, 'broken JSON → 400');
  ok((await call(req({ token: A.token, body: body(S(60)), type: 'text/plain' }))).status === 400, 'wrong content type → 400');
  ok((await call(req({ token: A.token, raw: JSON.stringify(body(S(60), { pad: 'x'.repeat(5000) })) }))).status === 400, 'oversized body → 400');
  ok((await call(req({ token: A.token, body: body(S(99999)) }))).status === 400, 'impossible session → 400');
  ok(!(await ledgerOf(A.uid)), 'nothing written for refused reports');

  // A brand-new account claims 2 h right away: it has existed for seconds, so that's all it gets
  let res = await call(req({ token: A.token, body: body(S(3600, 3600)) }));
  ok(res.status === 200 && res.body.credited < 120, 'new account claiming 2 h gets only the seconds it has existed', res.body);
  res = await call(req({ token: A.token, body: body(S(1500)) }));
  ok(res.status === 429, 'a second report within 3 s → 429', res);
  await wait(3200);
  res = await call(req({ token: A.token, body: body(S(1500)) }));
  ok(res.status === 200 && res.body.credited <= 4, 'replay 3 s later credits about 3 s, not 25 min', res.body);
  const la = (await ledgerOf(A.uid))!;
  ok(la && la.totalSec === la.sessions.reduce((a, s) => a + s.sec, 0) && la.lastEnd <= Date.now(), 'ledger totals match its sessions; lastEnd is not in the future', la);
  const pa = (await pubOf(A.uid))!;
  ok(pa && pa.profileName === 'Asha' && pa.todayFocusMinutes * 60 <= la.totalSec + 1 && pa.isGuest === false, 'leaderboard entry written by the server from the ledger', pa);

  // Real use: 25 min after the last report, a 25-min session counts in full (server clock moved forward for the test)
  const t0 = Date.now();
  const r2 = await logFocus(A.uid, parseFocusBatch(body(S(1500)))!, () => t0 + 1500_000);
  ok(r2.ok && r2.credited === 1500, 'a real 25-min session 25 min later counts in full', r2);

  // Grandfathering through the endpoint: B had a (faked) browser-written entry before the ledger existed
  const todayB = zonedDateKey(Date.now(), tz);
  await db().doc(`publicUsers/${B.uid}`).set({ profileName: 'Bilal', currentStreak: 9999, lastStreakUpdate: todayB, date: todayB, todayFocusMinutes: 1440, isGuest: false, hacked: true });
  res = await call(req({ token: B.token, body: body(S(60), { name: 'Bilal‮' }) }));
  const pb = (await pubOf(B.uid))!;
  ok(res.status === 200 && pb.currentStreak === 1 && !('hacked' in pb) && pb.profileName === 'Bilal', 'old faked entry replaced: streak cut to account age, stray fields gone, name cleaned', pb);
  ok(pb.todayFocusMinutes <= (Date.now() - Date.parse(`${todayB}T00:00:00+05:30`)) / 60000 + 1, "today's minutes never exceed the time since midnight", pb);

  // Two devices race on C's first report: both claim 25 min; together they never get more than C's account age
  const [x, y] = await Promise.all([call(req({ token: C.token, body: body(S(1500)) })), call(req({ token: C.token, body: body(S(1500)) }))]);
  const okOnes = [x, y].filter((q) => q.status === 200);
  const credited = okOnes.reduce((a, q) => a + (q.body.credited as number), 0);
  const lc = (await ledgerOf(C.uid))!;
  ok(okOnes.length >= 1 && credited <= (Date.now() - cBorn) / 1000 + 2 && lc.totalSec === credited, 'two devices sending at once never double-count time', { x, y, total: lc?.totalSec });

  // A's clock-shifted report above put lastCall ahead: real reports are now refused, never credited
  res = await call(req({ token: A.token, body: body(S(1500)) }));
  ok(res.status === 429 && (await ledgerOf(A.uid))!.totalSec === (r2.ok ? r2.totalSec : -1), 'reports are never credited before the last credited moment', res);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
