/**
 * Focus Pledge server tests. Runs the real handlers against the Firebase Auth + Firestore EMULATORS.
 * Razorpay is never contacted: first in STUB mode (no keys), then with a mocked Razorpay API.
 *
 *   cd ~/Desktop/YouFloww/api/pledge/_test && ./run.sh
 */
import { createHmac } from 'node:crypto';
import {
  computeProgress,
  deadlineFor,
  windowDays,
  windowStart,
  zonedDateKey,
  TERMS_VERSION,
  type PledgeDoc,
} from '../../../src/features/pledge/rules.js';
import { db } from '../_lib/admin.js';
import { POST as create } from '../create.js';
import { POST as verify } from '../verify.js';
import { GET as settle } from '../settle.js';
import { POST as webhook } from '../webhook.js';

const PROJECT = process.env.GCLOUD_PROJECT!;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const CRON = 'test-cron-secret-0123456789';
process.env.CRON_SECRET = CRON;

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

const realFetch = globalThis.fetch;

async function signUp(name: string) {
  const r = await realFetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${name}@example.com`, password: 'secret-pass-123', returnSecureToken: true }),
  });
  const j = (await r.json()) as { idToken: string; localId: string };
  return { token: j.idToken, uid: j.localId };
}

function req(url: string, opts: { token?: string; body?: unknown; raw?: string; headers?: Record<string, string>; method?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  return new Request(`http://localhost${url}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : (opts.raw ?? JSON.stringify(opts.body ?? {})),
  });
}
async function call(fn: (r: Request) => Promise<Response>, r: Request) {
  const res = await fn(r);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

const tz = 'Asia/Kolkata';
const hoursGoal = { kind: 'hours', hours: 10, days: 7 };
const goodBody = (extra: Record<string, unknown> = {}) => ({ amount: 99, goal: hoursGoal, tz, adult: true, terms: TERMS_VERSION, ...extra });

const unthrottle = (uid: string) => db().doc(`pledgeUsers/${uid}`).set({ lastOrderAt: 0 }, { merge: true });
const pledge = async (id: string) => (await db().doc(`pledges/${id}`).get()).data() as (PledgeDoc & Record<string, any>) | undefined;
const seedUser = (uid: string, data: Record<string, unknown>) => db().doc(`users/${uid}`).set(data);
/** move a pledge's window into the past so it is due (keeps its length) */
async function makeDue(id: string, hoursAgo = 2) {
  const p = (await pledge(id))!;
  // whole days, so a streak window still starts/ends at local midnight
  const shift = Math.ceil((p.deadline - (Date.now() - hoursAgo * 3600_000)) / 86400_000) * 86400_000;
  await db().doc(`pledges/${id}`).update({ startAt: p.startAt - shift, deadline: p.deadline - shift });
  return { startAt: p.startAt - shift, deadline: p.deadline - shift };
}
const runSettle = (secret = CRON) => call(settle, req('/api/pledge/settle', { method: 'GET', headers: { Authorization: `Bearer ${secret}` } }));

async function main() {
  /* ---------------------------------------------------------------- pure rules */
  section('rules (pure)');
  {
    const g = { kind: 'hours' as const, hours: 2, days: 1 };
    const startAt = Date.UTC(2026, 9, 29, 10, 0);
    const deadline = deadlineFor(g, startAt, tz);
    ok(deadline - startAt === 86400000, 'hours deadline = days × 24 h');
    const log = [
      { at: startAt - 3600_000, sec: 3000 }, // before: ignored
      { at: startAt + 1000, sec: 3600 },
      { at: startAt + 7200_000, sec: 3700 },
      { at: deadline + 1000, sec: 9999 }, // after: ignored
    ];
    const p = computeProgress({ goal: g, tz, startAt, deadline, baselineFocusSeconds: 0 }, { sessionLog: log }, deadline);
    ok(p.seconds === 7300 && p.met, 'counts only sessions started inside the window', p);
    const miss = computeProgress({ goal: g, tz, startAt, deadline, baselineFocusSeconds: 0 }, { sessionLog: log.slice(0, 2) }, deadline);
    ok(!miss.met && miss.seconds === 3600, 'miss when short');
    // a rolled-over log (150 newest, all after start) falls back to lifetime totals minus baseline
    const full = Array.from({ length: 150 }, (_, i) => ({ at: startAt + 3600_000 + i * 60_000, sec: 10 }));
    const tr = computeProgress({ goal: g, tz, startAt, deadline, baselineFocusSeconds: 1000 }, { sessionLog: full, totalFocusSeconds: 1000 + 8000 }, deadline);
    ok(tr.seconds === 8000 && tr.met, 'truncated log uses totalFocusSeconds − baseline', tr.seconds);
    const junk = computeProgress({ goal: g, tz, startAt, deadline, baselineFocusSeconds: 0 }, { sessionLog: [{ at: startAt + 1, sec: 1e9 }, 'x', null, { at: 'a', sec: 5 }] }, deadline);
    ok(junk.seconds === 6 * 3600, 'junk log entries ignored, huge sessions clipped to 6 h', junk.seconds);

    const s = { kind: 'streak' as const, days: 3, from: 'tomorrow' as const };
    const act = Date.UTC(2026, 9, 29, 15, 0); // 20:30 IST
    const st = windowStart(s, act, tz);
    ok(zonedDateKey(st, tz) === '2026-10-30' && new Date(st).toISOString() === '2026-10-29T18:30:00.000Z', 'streak "tomorrow" starts at local midnight', new Date(st).toISOString());
    const dl = deadlineFor(s, st, tz);
    ok(new Date(dl).toISOString() === '2026-11-01T18:30:00.000Z', 'streak deadline = midnight after the last day');
    ok(windowDays(s, st, dl, tz).join() === '2026-10-30,2026-10-31,2026-11-01', 'streak covers exactly its days');
    const ny = 'America/New_York';
    const s2 = { kind: 'streak' as const, days: 2, from: 'tomorrow' as const };
    const st2 = windowStart(s2, Date.UTC(2026, 10, 1, 2, 0), ny); // Oct 31 22:00 EDT; DST ends Nov 1
    const dl2 = deadlineFor(s2, st2, ny);
    ok((dl2 - st2) / 3600_000 === 49, 'DST-aware: a 2-day window across the fall-back change is 49 h', (dl2 - st2) / 3600_000);
    const day = (k: string, h: number) => Date.parse(`${k}T${String(h).padStart(2, '0')}:00:00+05:30`);
    const sp = computeProgress(
      { goal: s, tz, startAt: st, deadline: dl, baselineFocusSeconds: 0 },
      { sessionLog: [{ at: day('2026-10-30', 9), sec: 900 }, { at: day('2026-10-31', 23), sec: 1200 }], dailyFocusSeconds: { '2026-11-01': 950 } },
      dl,
    );
    ok(sp.daysMet === 3 && sp.met, 'streak: log per local day + dailyFocusSeconds for whole days', sp.days);
    const sp2 = computeProgress({ goal: s, tz, startAt: st, deadline: dl, baselineFocusSeconds: 0 }, { sessionLog: [{ at: day('2026-10-30', 9), sec: 899 }] }, dl);
    ok(sp2.daysMet === 0 && !sp2.met, 'streak: 14m59s does not count as a day');
  }

  /* ---------------------------------------------------------------- stub mode */
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  const A = await signUp('alice');
  const B = await signUp('bob');
  const C = await signUp('cara');
  const D = await signUp('dev');
  await seedUser(A.uid, { totalFocusSeconds: 5000, sessionLog: [] });
  await seedUser(B.uid, { totalFocusSeconds: 0 });

  section('create: auth + validation (stub mode)');
  let r = await call(create, req('/api/pledge/create', { body: goodBody() }));
  ok(r.status === 401, 'unauthenticated create → 401', r);
  r = await call(create, req('/api/pledge/create', { body: goodBody(), token: 'not-a-real-token-xxxxxxxxxxxx' }));
  ok(r.status === 401, 'forged token → 401', r);
  const bad: [string, Record<string, unknown>][] = [
    ['amount ₹50', { amount: 50 }],
    ['amount "99" (string)', { amount: '99' }],
    ['amount ₹0', { amount: 0 }],
    ['41 hours', { goal: { kind: 'hours', hours: 41, days: 7 } }],
    ['1 hour', { goal: { kind: 'hours', hours: 1, days: 7 } }],
    ['15 days', { goal: { kind: 'hours', hours: 10, days: 15 } }],
    ['2.5 hours', { goal: { kind: 'hours', hours: 2.5, days: 3 } }],
    ['streak 1 day', { goal: { kind: 'streak', days: 1, from: 'today' } }],
    ['streak bad start', { goal: { kind: 'streak', days: 5, from: 'someday' } }],
    ['unknown goal kind', { goal: { kind: 'win', days: 3 } }],
    ['bad time zone', { tz: 'Mars/Olympus' }],
    ['not 18+', { adult: false }],
  ];
  for (const [name, extra] of bad) {
    r = await call(create, req('/api/pledge/create', { token: A.token, body: goodBody(extra) }));
    ok(r.status === 400, `rejects ${name} → 400`, r);
  }
  r = await call(create, req('/api/pledge/create', { token: A.token, body: goodBody({ terms: 'old' }) }));
  ok(r.status === 409, 'old terms version → 409');
  r = await call(create, req('/api/pledge/create', { token: A.token, raw: 'nope' }));
  ok(r.status === 400, 'non-JSON body → 400');

  section('create → verify → active (stub mode)');
  r = await call(create, req('/api/pledge/create', { token: A.token, body: goodBody() }));
  ok(r.status === 200 && r.body.mode === 'stub' && /^stub_order_/.test(r.body.orderId) && r.body.amountPaise === 9900 && r.body.stub, 'create returns a labelled STUB order', r);
  const aOrder = r.body.orderId as string;
  r = await call(verify, req('/api/pledge/verify', { token: B.token, body: { orderId: aOrder } }));
  ok(r.status === 404, "someone else can't verify my order → 404");
  r = await call(verify, req('/api/pledge/verify', { body: { orderId: aOrder } }));
  ok(r.status === 401, 'unauthenticated verify → 401');
  r = await call(verify, req('/api/pledge/verify', { token: A.token, body: { orderId: 'order_../../users/x' } }));
  ok(r.status === 400, 'malformed order id → 400');
  r = await call(verify, req('/api/pledge/verify', { token: A.token, body: { orderId: aOrder } }));
  ok(r.status === 200 && r.body.status === 'active', 'verify activates the pledge', r);
  let p = (await pledge(aOrder))!;
  ok(p && p.uid === A.uid && p.amountPaise === 9900 && p.status === 'active' && p.baselineFocusSeconds === 5000 && p.mode === 'stub', 'pledge doc written with uid, amount, baseline, mode', p);
  ok(p.deadline - p.startAt === 7 * 86400000 && p.goal.kind === 'hours' && p.paymentId.startsWith('stub_pay_') && p.orderId === aOrder, 'deadline, goal and payment/order ids stored');
  r = await call(verify, req('/api/pledge/verify', { token: A.token, body: { orderId: aOrder } }));
  ok(r.status === 200 && r.body.status === 'active' && !r.body.duplicate, 'double verify is idempotent');

  section('one active pledge at a time + rate limit');
  await unthrottle(A.uid);
  r = await call(create, req('/api/pledge/create', { token: A.token, body: goodBody() }));
  ok(r.status === 409, 'second pledge while one is active → 409', r);
  r = await call(create, req('/api/pledge/create', { token: C.token, body: goodBody() }));
  const r2 = await call(create, req('/api/pledge/create', { token: C.token, body: goodBody() }));
  ok(r.status === 200 && r2.status === 429, 'two orders within 10 s → 429');

  section('settle (stub mode)');
  r = await runSettle('wrong-secret-wrong-secret');
  ok(r.status === 401, 'settle with the wrong secret → 401');
  r = await call(settle, req('/api/pledge/settle', { method: 'GET' }));
  ok(r.status === 401, 'settle without a secret → 401');
  process.env.CRON_SECRET = '';
  r = await runSettle('');
  ok(r.status === 503, 'settle refuses when CRON_SECRET is not configured');
  process.env.CRON_SECRET = CRON;
  r = await runSettle();
  ok(r.status === 200 && (await pledge(aOrder))!.status === 'active', 'not-yet-due pledges are left alone', r.body);

  // A: success. Log 10 h inside the (moved) window.
  const winA = await makeDue(aOrder);
  await seedUser(A.uid, {
    totalFocusSeconds: 5000 + 36000,
    sessionLog: [
      { at: winA.startAt - 60_000, sec: 3000, done: true }, // before start: must not count
      ...Array.from({ length: 10 }, (_, i) => ({ at: winA.startAt + (i + 1) * 3600_000 * 12, sec: 3600, done: true })),
    ],
  });
  // B: miss (only 1 h)
  await unthrottle(B.uid);
  r = await call(create, req('/api/pledge/create', { token: B.token, body: goodBody({ amount: 199 }) }));
  const bOrder = r.body.orderId as string;
  await call(verify, req('/api/pledge/verify', { token: B.token, body: { orderId: bOrder } }));
  const winB = await makeDue(bOrder);
  await seedUser(B.uid, { totalFocusSeconds: 3600, sessionLog: [{ at: winB.startAt + 3600_000, sec: 3600, done: true }] });

  r = await runSettle();
  ok(r.status === 200 && r.body.refunded >= 1 && r.body.forfeited >= 1, 'settle runs', r.body);
  p = (await pledge(aOrder))!;
  ok(p.status === 'refunded' && p.outcome === 'met' && p.refundId?.startsWith('stub_rfnd_') && p.progressSeconds === 36000, 'goal met → refunded (stub refund id)', p);
  const pb = (await pledge(bOrder))!;
  ok(pb.status === 'forfeited' && pb.outcome === 'missed' && pb.progressSeconds === 3600, 'goal missed → forfeited', pb);
  const stats = (await db().doc('pledgeStats/public').get()).data();
  ok(!stats?.forfeitedPaise, 'stub pledges never count toward the public donation total', stats);

  r = await runSettle();
  const p2 = (await pledge(aOrder))!;
  ok(r.body.refunded === 0 && r.body.forfeited === 0 && p2.refundId === p.refundId && p2.refundAttempts === 1, 'double settle changes nothing', r.body);
  await unthrottle(A.uid);
  r = await call(create, req('/api/pledge/create', { token: A.token, body: goodBody() }));
  ok(r.status === 200, 'after settling, a new pledge can be made');

  section('streak pledge (stub mode)');
  await seedUser(D.uid, { totalFocusSeconds: 0 });
  r = await call(create, req('/api/pledge/create', { token: D.token, body: goodBody({ amount: 49, goal: { kind: 'streak', days: 3, from: 'tomorrow' } }) }));
  const dOrder = r.body.orderId as string;
  await call(verify, req('/api/pledge/verify', { token: D.token, body: { orderId: dOrder } }));
  const dp = (await pledge(dOrder))!;
  ok(dp.status === 'active' && zonedDateKey(dp.startAt, tz) !== zonedDateKey(Date.now(), tz) && windowDays(dp.goal, dp.startAt, dp.deadline, tz).length === 3, 'streak from tomorrow: 3 local days', dp);
  const winD = await makeDue(dOrder, 3);
  const keys = windowDays(dp.goal, winD.startAt, winD.deadline, tz);
  await seedUser(D.uid, { sessionLog: keys.map((k) => ({ at: Date.parse(`${k}T12:00:00+05:30`), sec: 1000 })) });
  r = await runSettle();
  const dp2 = (await pledge(dOrder))!;
  ok(dp2.status === 'refunded' && dp2.daysMet === 3, 'streak kept every day → refunded', dp2);

  section('Firestore rules (emulator, client tokens)');
  const get = (path: string, token?: string) => realFetch(`${FS}/${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  ok((await get(`pledges/${aOrder}`, A.token)).status === 200, 'owner can read their pledge');
  ok((await get(`pledges/${aOrder}`, B.token)).status === 403, "others can't read it");
  ok((await get(`pledges/${aOrder}`)).status === 403, "signed-out can't read it");
  const write = await realFetch(`${FS}/pledges/${aOrder}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${A.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: 'refund_pending' } } }),
  });
  ok(write.status === 403, "owner can't write their pledge from the browser");
  const mk = await realFetch(`${FS}/pledges?documentId=fake_${Date.now()}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${A.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { uid: { stringValue: A.uid }, status: { stringValue: 'active' } } }),
  });
  ok(mk.status === 403, "browser can't create pledges");
  await db().doc('pledgeStats/public').set({ donatedPaise: 0 }, { merge: true });
  ok((await get('pledgeStats/public')).status === 200, 'public stats are readable by anyone');
  ok((await get(`pledgeOrders/${aOrder}`, A.token)).status === 403, 'pledgeOrders are server-only');
  ok((await get(`pledgeUsers/${A.uid}`, A.token)).status === 403, 'pledgeUsers are server-only');
  const list = await realFetch(`${FS}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${A.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'pledges' }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: A.uid } } } } }),
  });
  ok(list.status === 200, "the app's own-pledges query (where uid == me) is allowed");

  section('production without keys refuses instead of stubbing');
  process.env.VERCEL_ENV = 'production';
  await unthrottle(C.uid);
  r = await call(create, req('/api/pledge/create', { token: C.token, body: goodBody() }));
  ok(r.status === 503, 'create → 503 (no stub in production)', r);
  delete process.env.VERCEL_ENV;

  /* ---------------------------------------------------------------- mocked Razorpay */
  section('mocked Razorpay: signature, amount, capture, refund once, webhook');
  const SECRET = 'rzp_test_secret_for_tests_only';
  const WH = 'webhook_secret_for_tests';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_TESTKEY12345';
  process.env.RAZORPAY_KEY_SECRET = SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WH;

  type Pay = { id: string; order_id: string; amount: number; currency: string; status: string; refunds: { id: string; amount: number; status: string }[] };
  const orders = new Map<string, { id: string; amount: number; notes: Record<string, string> }>();
  const pays = new Map<string, Pay>();
  const calls = { refundCreate: 0, capture: 0, idemKeys: [] as string[], badAuth: 0 };
  let seq = 0;
  const rid = (p: string) => `${p}_T${String(++seq).padStart(12, '0')}`;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== 'api.razorpay.com') return realFetch(input, init);
    const h = new Headers(init?.headers);
    if (h.get('authorization') !== 'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${SECRET}`).toString('base64')) {
      calls.badAuth++;
      return Response.json({ error: { description: 'auth' } }, { status: 401 });
    }
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const path = url.pathname;
    let m: RegExpExecArray | null;
    if (method === 'POST' && path === '/v1/orders') {
      const o = { id: rid('order'), amount: body.amount, currency: body.currency, notes: body.notes };
      orders.set(o.id, o);
      return Response.json(o);
    }
    if ((m = /^\/v1\/payments\/([^/]+)(\/capture|\/refunds|\/refund)?$/.exec(path))) {
      const pay = pays.get(m[1]);
      if (!pay) return Response.json({ error: { description: 'not found' } }, { status: 400 });
      if (!m[2] && method === 'GET') return Response.json(pay);
      if (m[2] === '/capture') {
        calls.capture++;
        pay.status = 'captured';
        return Response.json(pay);
      }
      if (m[2] === '/refunds') return Response.json({ entity: 'collection', count: pay.refunds.length, items: pay.refunds });
      if (m[2] === '/refund') {
        calls.refundCreate++;
        calls.idemKeys.push(h.get('x-refund-idempotency') ?? '');
        const done = pay.refunds.filter((x) => x.status !== 'failed').reduce((a, x) => a + x.amount, 0);
        if (done + body.amount > pay.amount) return Response.json({ error: { description: 'The total refund amount is greater than the refund payment amount' } }, { status: 400 });
        const rf = { id: rid('rfnd'), amount: body.amount, status: 'processed' };
        pay.refunds.push(rf);
        return Response.json(rf);
      }
    }
    return Response.json({ error: { description: 'unhandled ' + path } }, { status: 404 });
  }) as typeof fetch;
  const sign = (orderId: string, paymentId: string) => createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const pay = (orderId: string, amount: number, status = 'captured') => {
    const p: Pay = { id: rid('pay'), order_id: orderId, amount, currency: 'INR', status, refunds: [] };
    pays.set(p.id, p);
    return p;
  };

  const E = await signUp('esha');
  await seedUser(E.uid, { totalFocusSeconds: 100 });
  r = await call(create, req('/api/pledge/create', { token: E.token, body: goodBody({ amount: 49 }) }));
  ok(r.status === 200 && r.body.mode === 'razorpay' && r.body.keyId === 'rzp_test_TESTKEY12345' && /^order_/.test(r.body.orderId) && r.body.amountPaise === 4900, 'create opens a Razorpay order', r.body);
  const eOrder = r.body.orderId as string;
  const o = orders.get(eOrder)!;
  ok(o.amount === 4900 && o.notes.uid === E.uid && o.notes.goal === '10 focus hours in 7 days', 'order is INR 4900 with notes uid + goal', o);
  ok(!JSON.stringify(r.body).includes(SECRET), 'the key secret never reaches the browser');

  const ep = pay(eOrder, 4900);
  r = await call(verify, req('/api/pledge/verify', { token: E.token, body: { orderId: eOrder, paymentId: ep.id, signature: 'f'.repeat(64) } }));
  ok(r.status === 400 && !(await pledge(eOrder)), 'bad signature → 400, no pledge', r);
  r = await call(verify, req('/api/pledge/verify', { token: E.token, body: { orderId: eOrder, paymentId: ep.id, signature: '<script>' } }));
  ok(r.status === 400, 'malformed signature → 400');

  const cheap = pay(eOrder, 100); // ₹1 paid against a ₹49 order
  r = await call(verify, req('/api/pledge/verify', { token: E.token, body: { orderId: eOrder, paymentId: cheap.id, signature: sign(eOrder, cheap.id) } }));
  ok(r.status === 402 && !(await pledge(eOrder)), 'wrong amount (valid signature) → 402, no pledge', r);

  const other = pay('order_SOMEONEELSE01', 4900);
  r = await call(verify, req('/api/pledge/verify', { token: E.token, body: { orderId: eOrder, paymentId: other.id, signature: sign(eOrder, other.id) } }));
  ok(r.status === 402, "a payment from another order doesn't count → 402");

  const failedPay = pay(eOrder, 4900, 'failed');
  r = await call(verify, req('/api/pledge/verify', { token: E.token, body: { orderId: eOrder, paymentId: failedPay.id, signature: sign(eOrder, failedPay.id) } }));
  ok(r.status === 402, 'failed payment → 402');

  ep.status = 'authorized';
  r = await call(verify, req('/api/pledge/verify', { token: E.token, body: { orderId: eOrder, paymentId: ep.id, signature: sign(eOrder, ep.id) } }));
  ok(r.status === 200 && r.body.status === 'active' && calls.capture === 1 && ep.status === 'captured', 'authorized payment is captured, then the pledge activates', r.body);
  const pe = (await pledge(eOrder))!;
  ok(pe.mode === 'test' && pe.paymentId === ep.id && pe.amountPaise === 4900, 'pledge records the test payment');
  r = await call(verify, req('/api/pledge/verify', { token: E.token, body: { orderId: eOrder, paymentId: failedPay.id, signature: sign(eOrder, failedPay.id) } }));
  ok(r.status === 402 || r.status === 409, 'a different payment on an already-activated order is refused');

  // Settle E as met → exactly one refund at Razorpay
  const winE = await makeDue(eOrder);
  await seedUser(E.uid, { totalFocusSeconds: 100 + 36000, sessionLog: [{ at: winE.startAt + 1000, sec: 21600 }, { at: winE.startAt + 86400_000, sec: 14400 }] });
  r = await runSettle();
  let pe2 = (await pledge(eOrder))!;
  ok(pe2.status === 'refunded' && pe2.refundId === ep.refunds[0]?.id && calls.refundCreate === 1, 'met → one Razorpay refund for the full amount', { r: r.body, calls });
  ok(ep.refunds[0].amount === 4900 && calls.idemKeys[0] === `${eOrder}_r1`, 'full amount, with an idempotency key');
  await runSettle();
  await runSettle();
  ok(calls.refundCreate === 1, 'settling again never refunds twice');
  // Simulate "refund created at Razorpay but our write was lost": the next run adopts it instead of refunding again
  await db().doc(`pledges/${eOrder}`).update({ status: 'refund_pending', refundId: null });
  r = await runSettle();
  pe2 = (await pledge(eOrder))!;
  ok(pe2.status === 'refunded' && pe2.refundId === ep.refunds[0].id && calls.refundCreate === 1 && ep.refunds.length === 1, 'lost write → existing refund adopted, still one refund', { calls, refunds: ep.refunds });
  // Even if every guard on our side failed, Razorpay refuses a second full refund
  ep.refunds.length = 0;
  ep.refunds.push({ id: 'rfnd_HIDDEN000001', amount: 4900, status: 'failed' });
  ep.refunds.push({ id: 'rfnd_HIDDEN000002', amount: 4900, status: 'processed' });
  ok(ep.refunds.filter((x) => x.status !== 'failed').reduce((a, x) => a + x.amount, 0) === 4900, 'mock tracks refunded total');

  section('webhook');
  r = await call(webhook, req('/api/pledge/webhook', { raw: '{"event":"payment.captured"}', headers: { 'x-razorpay-signature': 'bad' } }));
  ok(r.status === 400, 'unsigned webhook → 400');
  const F = await signUp('farah');
  await seedUser(F.uid, { totalFocusSeconds: 42 });
  r = await call(create, req('/api/pledge/create', { token: F.token, body: goodBody({ amount: 199 }) }));
  const fOrder = r.body.orderId as string;
  const fp = pay(fOrder, 19900);
  const ev = (event: string, entity: Record<string, unknown>, key = 'payment') => JSON.stringify({ event, payload: { [key]: { entity } } });
  const hook = (raw: string, secret = WH) => call(webhook, req('/api/pledge/webhook', { raw, headers: { 'x-razorpay-signature': createHmac('sha256', secret).update(raw).digest('hex') } }));
  r = await hook(ev('payment.captured', { id: fp.id, order_id: fOrder, amount: 19900, status: 'captured' }), 'wrong-secret');
  ok(r.status === 400 && !(await pledge(fOrder)), 'webhook signed with the wrong secret → 400');
  r = await hook(ev('payment.captured', { id: fp.id, order_id: fOrder, amount: 100, status: 'captured' }));
  ok(r.status === 200 && !(await pledge(fOrder)), 'signed event with the wrong amount confirms nothing');
  fp.status = 'authorized';
  r = await hook(ev('payment.captured', { id: fp.id, order_id: fOrder, amount: 19900, status: 'captured' }));
  ok(r.status === 200 && (await pledge(fOrder))?.status === 'active' && calls.capture === 2, 'signed event is re-checked with Razorpay, then activates', r);
  r = await hook(ev('order.paid', { id: fp.id, order_id: fOrder, amount: 19900, status: 'captured' }));
  r = await call(verify, req('/api/pledge/verify', { token: F.token, body: { orderId: fOrder, paymentId: fp.id, signature: sign(fOrder, fp.id) } }));
  ok(r.status === 200 && r.body.status === 'active', 'browser verify after the webhook is idempotent');
  r = await hook(ev('payment.captured', { id: 'pay_GIFTASITE0001', order_id: 'order_GIFTASITE001', amount: 29900, status: 'captured' }));
  ok(r.status === 200, "giftasite's own events are acknowledged and ignored");

  section('duplicate payment (two tabs) is refunded at once');
  await unthrottle(E.uid);
  const G = await signUp('gita');
  await seedUser(G.uid, { totalFocusSeconds: 0 });
  r = await call(create, req('/api/pledge/create', { token: G.token, body: goodBody() }));
  const g1 = r.body.orderId as string;
  await unthrottle(G.uid);
  r = await call(create, req('/api/pledge/create', { token: G.token, body: goodBody() }));
  const g2 = r.body.orderId as string;
  const gp1 = pay(g1, 9900);
  const gp2 = pay(g2, 9900);
  await call(verify, req('/api/pledge/verify', { token: G.token, body: { orderId: g1, paymentId: gp1.id, signature: sign(g1, gp1.id) } }));
  r = await call(verify, req('/api/pledge/verify', { token: G.token, body: { orderId: g2, paymentId: gp2.id, signature: sign(g2, gp2.id) } }));
  const dup = (await pledge(g2))!;
  ok(r.body.duplicate && dup.outcome === 'duplicate' && dup.status === 'refunded' && gp2.refunds.length === 1 && (await pledge(g1))!.status === 'active', 'second payment → refunded immediately, first stays active', { body: r.body, dup });

  section('refund webhooks');
  r = await hook(ev('refund.processed', { id: dup.refundId, payment_id: gp2.id, amount: 9900, notes: { app: 'youfloww-pledge', pledgeId: g2 } }, 'refund'));
  ok(r.status === 200 && typeof (await pledge(g2))!.refundProcessedAt === 'number', 'refund.processed is recorded');
  gp2.refunds[0].status = 'failed';
  r = await hook(ev('refund.failed', { id: dup.refundId, payment_id: gp2.id, notes: { app: 'youfloww-pledge', pledgeId: g2 } }, 'refund'));
  ok((await pledge(g2))!.status === 'refund_pending', 'refund.failed puts it back in the queue');
  r = await runSettle();
  const dup2 = (await pledge(g2))!;
  ok(dup2.status === 'refunded' && gp2.refunds.length === 2 && dup2.refundId === gp2.refunds[1].id, 'next run retries the failed refund once', { refunds: gp2.refunds });

  section('live keys: missed pledges count toward the public donation total, once');
  process.env.RAZORPAY_KEY_ID = 'rzp_live_TESTKEY12345';
  const H = await signUp('hari');
  await seedUser(H.uid, { totalFocusSeconds: 0 });
  r = await call(create, req('/api/pledge/create', { token: H.token, body: goodBody({ amount: 499 }) }));
  const hOrder = r.body.orderId as string;
  const hp = pay(hOrder, 49900);
  await call(verify, req('/api/pledge/verify', { token: H.token, body: { orderId: hOrder, paymentId: hp.id, signature: sign(hOrder, hp.id) } }));
  ok((await pledge(hOrder))!.mode === 'live', 'live pledge recorded as live');
  await makeDue(hOrder);
  const before = (await db().doc('pledgeStats/public').get()).data() ?? {};
  await runSettle();
  await runSettle();
  const after = (await db().doc('pledgeStats/public').get()).data() ?? {};
  ok((after.forfeitedPaise ?? 0) - (before.forfeitedPaise ?? 0) === 49900 && (after.missedCount ?? 0) - (before.missedCount ?? 0) === 1 && hp.refunds.length === 0, 'missed live pledge: +₹499 forfeited once, no refund', after);
  // a test-mode pledge can't be refunded with live keys (and vice versa)
  await db().doc(`pledges/${g1}`).update({ status: 'refund_pending' });
  const refundsBefore = calls.refundCreate;
  await runSettle();
  const g1p = (await pledge(g1))!;
  ok(g1p.status === 'refund_pending' && /test but the keys are live/.test(g1p.lastError) && calls.refundCreate === refundsBefore, 'test pledge is not refunded with live keys (stays pending with a clear error)', g1p.lastError);
  ok(calls.badAuth === 0, 'every Razorpay call used the configured key');

  globalThis.fetch = realFetch;
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
