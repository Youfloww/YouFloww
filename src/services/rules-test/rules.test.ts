/**
 * Firestore rules tests for firestore.rules (repo root). Run: `sh src/services/rules-test/run.sh`
 * (emulators on Auth 9299 + Firestore 8288, project demo-youfloww-rules). Each client is the real web SDK
 * signed in through an emulator mock token, so serverTimestamp() and batches behave exactly as in the app.
 */
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import * as fs from 'firebase/firestore';

const PROJECT = 'demo-youfloww-rules';
const PORT = Number(process.env.RULES_FS_PORT || 8288);

let failed = 0;
let passed = 0;
const ok = (c: unknown, m: string) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
  if (c) passed++;
  else failed++;
};

const apps: FirebaseApp[] = [];
/** a client signed in as `uid` (null = signed out, 'owner' = rules bypass for seeding) */
function client(uid: string | null) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `c${apps.length}`);
  apps.push(app);
  const db = fs.initializeFirestore(app, {});
  if (uid === 'owner') fs.connectFirestoreEmulator(db, '127.0.0.1', PORT, { mockUserToken: 'owner' });
  else if (uid) fs.connectFirestoreEmulator(db, '127.0.0.1', PORT, { mockUserToken: { sub: uid, user_id: uid } });
  else fs.connectFirestoreEmulator(db, '127.0.0.1', PORT);
  return db;
}

/** a Study Together guest: signed in anonymously */
function guestClient(uid: string) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `g${apps.length}`);
  apps.push(app);
  const db = fs.initializeFirestore(app, {});
  fs.connectFirestoreEmulator(db, '127.0.0.1', PORT, { mockUserToken: { sub: uid, user_id: uid, firebase: { sign_in_provider: 'anonymous', identities: {} } } });
  return db;
}

const code = (e: unknown) => (e as { code?: string }).code ?? String(e);
async function allowed(p: Promise<unknown>, m: string) {
  try {
    await p;
    ok(true, m);
  } catch (e) {
    ok(false, `${m}  [${code(e)}]`);
  }
}
async function denied(p: Promise<unknown>, m: string) {
  try {
    await p;
    ok(false, `${m}  [was allowed]`);
  } catch (e) {
    ok(code(e) === 'permission-denied', `${m}${code(e) === 'permission-denied' ? '' : `  [${code(e)}]`}`);
  }
}

const sT = () => fs.serverTimestamp();
const presence = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid,
  createdAt: sT(),
  lastActive: sT(),
  lastActiveMs: Date.now(),
  isFocusing: false,
  ...extra,
});

/** one Departures post, as src/features/flights/publicBoard.ts writes it */
function postFlight(db: fs.Firestore, uid: string, opt: { flight?: Record<string, unknown>; rate?: Record<string, unknown>; rateId?: string } = {}) {
  const ref = fs.doc(fs.collection(db, 'flights'));
  const b = fs.writeBatch(db);
  b.set(ref, { from: 'DEL', to: 'BOM', minutes: 25, createdAt: sT(), ...opt.flight });
  b.set(fs.doc(db, 'flightRate', uid), { last: sT(), id: opt.rateId ?? ref.id, ...opt.rate });
  return b.commit().then(() => ref.id);
}

async function main() {
  fs.setLogLevel('silent');
  // start from an empty database
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });

  const A = client('alice');
  const B = client('bob');
  const anon = client(null);
  const admin = client('owner');

  /* ---------------------------------------------------------------- presence */
  const pA = fs.doc(A, 'presence', 'alice');
  await allowed(fs.setDoc(pA, presence('alice')), 'presence: owner creates presence/{uid} with the five fields');
  await allowed(
    fs.setDoc(pA, { uid: 'alice', lastActive: sT(), lastActiveMs: Date.now(), isFocusing: true }, { merge: true }),
    'presence: heartbeat merge (createdAt kept) allowed',
  );
  await allowed(fs.setDoc(pA, presence('alice', { isFocusing: true })), 'presence: full re-write with createdAt = server time allowed');
  await denied(
    fs.setDoc(pA, { createdAt: fs.Timestamp.fromMillis(Date.now() - 3600_000), lastActive: sT(), lastActiveMs: Date.now() }, { merge: true }),
    'presence: back-dating createdAt denied',
  );
  await denied(fs.setDoc(fs.doc(A, 'presence', 'bob'), presence('bob')), "presence: writing another person's doc denied");
  await denied(fs.setDoc(fs.doc(A, 'presence', 'bob'), presence('alice')), "presence: own uid under another person's doc id denied");
  await denied(fs.setDoc(fs.doc(A, 'presence', 'alice_k3j9x2'), presence('alice')), 'presence: a random (per-tab) doc id denied');
  await denied(fs.setDoc(pA, presence('alice', { userAgent: 'Mozilla/5.0' })), 'presence: a userAgent field denied');
  await denied(fs.setDoc(pA, presence('alice', { lastActiveMs: Date.now() - 20 * 60_000 })), 'presence: stale lastActiveMs (-20 min) denied');
  await denied(fs.setDoc(pA, presence('alice', { lastActiveMs: Date.now() + 20 * 60_000 })), 'presence: future lastActiveMs (+20 min) denied');
  await denied(fs.setDoc(pA, presence('alice', { lastActiveMs: Date.now() + 0.5 })), 'presence: non-integer lastActiveMs denied');
  await denied(fs.setDoc(pA, presence('alice', { lastActive: fs.Timestamp.now() })), 'presence: client-made lastActive (not server time) denied');
  await denied(fs.setDoc(pA, presence('alice', { isFocusing: 'yes' })), 'presence: non-bool isFocusing denied');
  const noFocus = presence('alice') as Record<string, unknown>;
  delete noFocus.isFocusing;
  await denied(fs.setDoc(pA, noFocus), 'presence: missing isFocusing denied');
  await denied(fs.setDoc(fs.doc(anon, 'presence', 'alice'), presence('alice')), 'presence: signed-out write denied');
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(anon, 'presence'), fs.where('lastActiveMs', '>', Date.now() - 90_000), fs.limit(500)));
    ok(snap.docs.some((d) => d.id === 'alice' && d.data().userAgent === undefined), 'presence: signed-out live-count query works (sees alice, no userAgent)');
  } catch (e) {
    ok(false, `presence: signed-out live-count query works  [${code(e)}]`);
  }
  await denied(fs.deleteDoc(fs.doc(B, 'presence', 'alice')), "presence: deleting another person's doc denied");
  await allowed(fs.deleteDoc(pA), 'presence: owner deletes their doc');
  await denied(
    fs.setDoc(pA, { uid: 'alice', lastActive: sT(), lastActiveMs: Date.now(), isFocusing: false }, { merge: true }),
    'presence: re-creating without createdAt denied (the client then re-creates with it)',
  );
  await allowed(fs.setDoc(pA, presence('alice')), 'presence: re-create after another tab removed it allowed');
  await fs.setDoc(fs.doc(admin, 'presence', 'alice_legacy1'), presence('alice', { userAgent: 'old', lastActive: fs.Timestamp.now() }));
  await denied(fs.deleteDoc(fs.doc(B, 'presence', 'alice_legacy1')), "presence: deleting someone's old per-tab doc denied");
  await allowed(fs.deleteDoc(fs.doc(A, 'presence', 'alice_legacy1')), 'presence: owner can still delete their old per-tab doc');

  /* ------------------------------------------------------------- publicUsers */
  const entry = { profileName: 'Alice', todayFocusMinutes: 30, currentStreak: 2, date: '2026-11-01', lastStreakUpdate: '2026-11-01' };
  await fs.setDoc(fs.doc(admin, 'publicUsers', 'alice'), entry);
  await allowed(fs.getDoc(fs.doc(anon, 'publicUsers', 'alice')), 'publicUsers: anyone reads an entry');
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(anon, 'publicUsers'), fs.where('date', '==', '2026-11-01'), fs.limit(50)));
    ok(snap.size === 1 && snap.docs[0].data().todayFocusMinutes === 30, 'publicUsers: leaderboard query works with the same fields');
  } catch (e) {
    ok(false, `publicUsers: leaderboard query works  [${code(e)}]`);
  }
  await denied(fs.setDoc(fs.doc(A, 'publicUsers', 'alice'), { ...entry, todayFocusMinutes: 1440 }), 'publicUsers: owner overwrite denied');
  await denied(fs.updateDoc(fs.doc(A, 'publicUsers', 'alice'), { currentStreak: 999 }), 'publicUsers: owner update denied');
  await denied(fs.setDoc(fs.doc(B, 'publicUsers', 'bob'), { ...entry, profileName: 'Bob' }), 'publicUsers: creating your own entry denied');
  await denied(fs.deleteDoc(fs.doc(A, 'publicUsers', 'alice')), 'publicUsers: owner delete denied');

  /* ------------------------------------------------------------- focusLedger */
  const ledger = { v: 1, lastEnd: Date.now(), totalSec: 1500, tz: 'Asia/Kolkata', days: { '2026-11-01': 1500 }, streak: 1, streakDay: '2026-11-01', sessions: [{ at: Date.now() - 1500_000, sec: 1500 }] };
  await fs.setDoc(fs.doc(admin, 'focusLedger', 'alice'), ledger);
  try {
    const s = await fs.getDoc(fs.doc(A, 'focusLedger', 'alice'));
    ok(s.data()?.totalSec === 1500, 'focusLedger: owner reads their ledger');
  } catch (e) {
    ok(false, `focusLedger: owner reads their ledger  [${code(e)}]`);
  }
  await denied(fs.getDoc(fs.doc(B, 'focusLedger', 'alice')), "focusLedger: another person's read denied");
  await denied(fs.getDoc(fs.doc(anon, 'focusLedger', 'alice')), 'focusLedger: signed-out read denied');
  await denied(fs.getDocs(fs.collection(A, 'focusLedger')), 'focusLedger: listing the collection denied');
  await denied(fs.setDoc(fs.doc(A, 'focusLedger', 'alice'), { ...ledger, totalSec: 999_999 }), 'focusLedger: owner overwrite denied');
  await denied(fs.updateDoc(fs.doc(A, 'focusLedger', 'alice'), { totalSec: 999_999 }), 'focusLedger: owner update denied');
  await denied(fs.deleteDoc(fs.doc(A, 'focusLedger', 'alice')), 'focusLedger: owner delete denied');
  await denied(fs.setDoc(fs.doc(B, 'focusLedger', 'bob'), ledger), 'focusLedger: creating your own ledger denied');

  /* ----------------------------------------------------------------- flights */
  let f1 = '';
  try {
    f1 = await postFlight(A, 'alice');
    ok(true, 'flights: post + flightRate stamp in one batch allowed');
  } catch (e) {
    ok(false, `flights: post + flightRate stamp in one batch allowed  [${code(e)}]`);
  }
  await denied(postFlight(A, 'alice'), 'flights: a second post within 10 minutes denied');
  await denied(fs.addDoc(fs.collection(B, 'flights'), { from: 'DEL', to: 'BOM', minutes: 25, createdAt: sT() }), 'flights: post without the flightRate stamp denied');
  await denied(postFlight(B, 'bob', { rateId: 'someOtherId123' }), "flights: stamp naming a different flight id denied");
  await denied(postFlight(B, 'bob', { flight: { uid: 'bob' } }), 'flights: a uid in the public flight doc denied');
  await denied(postFlight(B, 'bob', { flight: { minutes: 999 } }), 'flights: minutes over 360 denied');
  await denied(postFlight(B, 'bob', { flight: { from: 'del' } }), 'flights: bad airport code denied');
  await denied(postFlight(B, 'bob', { rate: { last: fs.Timestamp.fromMillis(Date.now() - 3600_000) } }), 'flights: back-dated stamp denied');
  await denied(postFlight(B, 'bob', { rate: { note: 'x' } }), 'flights: extra field in the stamp denied');
  await denied(fs.setDoc(fs.doc(B, 'flightRate', 'bob'), { last: sT(), id: f1 || 'x' }), 'flightRate: stamp alone (naming an existing flight) denied');
  await denied(fs.setDoc(fs.doc(B, 'flightRate', 'bob'), { last: sT(), id: 'neverCreated1' }), 'flightRate: stamp alone (naming no flight) denied');
  await denied(fs.setDoc(fs.doc(B, 'flightRate', 'alice'), { last: sT(), id: 'x' }), "flightRate: writing another person's stamp denied");
  await allowed(postFlight(B, 'bob'), "flights: another person's first post allowed");
  await fs.setDoc(fs.doc(admin, 'flightRate', 'carol'), { last: fs.Timestamp.fromMillis(Date.now() - 11 * 60_000), id: 'old' });
  await fs.setDoc(fs.doc(admin, 'flightRate', 'dave'), { last: fs.Timestamp.fromMillis(Date.now() - 9 * 60_000), id: 'old' });
  await allowed(postFlight(client('carol'), 'carol'), 'flights: post 11 minutes after the last one allowed');
  await denied(postFlight(client('dave'), 'dave'), 'flights: post 9 minutes after the last one denied');
  try {
    const s = await fs.getDoc(fs.doc(anon, 'flights', f1));
    const keys = Object.keys(s.data() ?? {}).sort().join(',');
    ok(keys === 'createdAt,from,minutes,to', `flights: anyone reads a post, and it holds only route + minutes + time (${keys})`);
    const list = await fs.getDocs(fs.query(fs.collection(anon, 'flights'), fs.orderBy('createdAt', 'desc'), fs.limit(30)));
    ok(list.size === 3, `flights: the departures query lists the 3 accepted posts (${list.size})`);
  } catch (e) {
    ok(false, `flights: public read  [${code(e)}]`);
  }
  await denied(fs.getDoc(fs.doc(B, 'flightRate', 'alice')), "flightRate: another person's stamp unreadable");
  await denied(fs.getDoc(fs.doc(anon, 'flightRate', 'alice')), 'flightRate: unreadable signed out');
  await denied(fs.getDocs(fs.collection(A, 'flightRate')), 'flightRate: listing denied');
  await allowed(fs.getDoc(fs.doc(A, 'flightRate', 'alice')), 'flightRate: owner reads their own stamp');
  await denied(fs.deleteDoc(fs.doc(A, 'flightRate', 'alice')), 'flightRate: deleting the stamp (to reset the limit) denied');
  if (f1) {
    await denied(fs.updateDoc(fs.doc(A, 'flights', f1), { minutes: 300 }), 'flights: update denied');
    await denied(fs.deleteDoc(fs.doc(A, 'flights', f1)), 'flights: delete denied');
  }

  /* ------------------------------------------------------------------- users */
  await allowed(fs.setDoc(fs.doc(A, 'users', 'alice'), { totalFocusSeconds: 60 }), 'users: owner writes their doc');
  await allowed(fs.getDoc(fs.doc(A, 'users', 'alice')), 'users: owner reads their doc');
  await allowed(fs.setDoc(fs.doc(A, 'users', 'alice', 'live', 'session'), { t: 1 }), 'users: owner writes live/session');
  await denied(fs.setDoc(fs.doc(A, 'users', 'alice', 'notes', 'n1'), { t: 1 }), 'users: any other subcollection denied');
  await denied(fs.setDoc(fs.doc(A, 'users', 'alice', 'live', 'other'), { t: 1 }), 'users: another doc under live/ denied');
  await denied(fs.setDoc(fs.doc(B, 'users', 'alice', 'live', 'session'), { t: 1 }), "users: another person's live/session denied");
  await denied(fs.getDoc(fs.doc(B, 'users', 'alice')), "users: another person's read denied");
  await denied(fs.setDoc(fs.doc(B, 'users', 'alice'), { totalFocusSeconds: 1 }), "users: another person's write denied");
  await denied(fs.getDoc(fs.doc(anon, 'users', 'alice')), 'users: signed-out read denied');

  /* ----------------------------------- anonymous (Study Together guest) accounts */
  const G = guestClient('ghost');
  await denied(fs.setDoc(fs.doc(G, 'presence', 'ghost'), presence('ghost')), 'anonymous: presence denied (no count stuffing)');
  await denied(postFlight(G, 'ghost'), 'anonymous: flight post denied');
  await denied(fs.setDoc(fs.doc(G, 'users', 'ghost'), { totalFocusSeconds: 1 }), 'anonymous: users doc denied');
  await denied(fs.setDoc(fs.doc(G, 'users', 'ghost', 'live', 'session'), { t: 1 }), 'anonymous: live/session denied');
  await allowed(fs.getDoc(fs.doc(G, 'publicUsers', 'alice')), 'anonymous: can still read the leaderboard');

  /* ------------------------------------------- unchanged: pledges, stats, fallback */
  await fs.setDoc(fs.doc(admin, 'pledges', 'p1'), { uid: 'alice' });
  await allowed(fs.getDoc(fs.doc(A, 'pledges', 'p1')), 'pledges: owner reads their pledge');
  await denied(fs.getDoc(fs.doc(B, 'pledges', 'p1')), "pledges: another person's read denied");
  await denied(fs.setDoc(fs.doc(A, 'pledges', 'p1'), { uid: 'alice', status: 'won' }), 'pledges: browser write denied');
  await allowed(fs.getDoc(fs.doc(anon, 'pledgeStats', 'public')), 'pledgeStats: anyone reads');
  await denied(fs.setDoc(fs.doc(A, 'pledgeStats', 'public'), { raised: 1 }), 'pledgeStats: browser write denied');
  await denied(fs.setDoc(fs.doc(A, 'somethingElse', 'x'), { a: 1 }), 'fallback: other collections denied');

  console.log(`\n${passed} passed, ${failed} failed`);
  await Promise.all(apps.map((a) => deleteApp(a).catch(() => {})));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
