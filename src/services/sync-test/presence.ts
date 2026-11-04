/**
 * The live count under the real firestore.rules: signed-in people check in, anyone (guests too) can run the two
 * count queries presence.ts uses, and stale docs drop out of the count.
 * Run: sh src/services/sync-test/presence.sh
 */
import { initializeApp } from 'firebase/app';
import * as fs from 'firebase/firestore';

const PORT = 8190;
const ACTIVE_MS = 150_000; // keep in step with presence.ts
let failed = 0;
const ok = (c: unknown, m: string) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
  if (!c) failed++;
};
const client = (name: string, sub?: string, provider: 'google.com' | 'anonymous' = 'google.com') => {
  const app = initializeApp({ projectId: 'demo-presence' }, name);
  const db = fs.initializeFirestore(app, {});
  fs.connectFirestoreEmulator(db, '127.0.0.1', PORT, sub ? { mockUserToken: { sub, firebase: { sign_in_provider: provider } } } : undefined);
  return db;
};
const docFor = (uid: string, ms: number, focusing: boolean) => ({
  uid,
  createdAt: fs.serverTimestamp(),
  lastActive: fs.serverTimestamp(),
  lastActiveMs: ms,
  isFocusing: focusing,
});
const can = (p: Promise<unknown>) => p.then(() => true, () => false);

async function counts(db: fs.Firestore) {
  const col = fs.collection(db, 'presence');
  const fresh = fs.where('lastActiveMs', '>', Date.now() - ACTIVE_MS);
  const [all, foc] = await Promise.all([
    fs.getCountFromServer(fs.query(col, fresh)),
    fs.getCountFromServer(fs.query(col, fs.where('isFocusing', '==', true), fresh)),
  ]);
  return { online: all.data().count, focusing: foc.data().count };
}

async function main() {
  const now = Date.now();
  const u1 = client('u1', 'u1');
  const u2 = client('u2', 'u2');
  const u3 = client('u3', 'u3');
  const anon = client('anon', 'anon1', 'anonymous');
  const guest = client('guest');

  ok(await can(fs.setDoc(fs.doc(u1, 'presence', 'u1'), docFor('u1', now, true))), 'signed-in person checks in (focusing)');
  ok(await can(fs.setDoc(fs.doc(u2, 'presence', 'u2'), docFor('u2', now, false))), 'second person checks in (idle)');
  ok(await can(fs.setDoc(fs.doc(u3, 'presence', 'u3'), docFor('u3', now - 300_000, true))), 'a 5-minute-old check-in is still a valid write');
  ok(!(await can(fs.setDoc(fs.doc(anon, 'presence', 'anon1'), docFor('anon1', now, true)))), 'anonymous login cannot check in');
  ok(!(await can(fs.setDoc(fs.doc(u1, 'presence', 'u2'), docFor('u2', now, true)))), "nobody can write someone else's doc");

  const g = await counts(guest).catch((e) => (console.log(e), null));
  ok(g, 'a guest can run both count queries');
  ok(g?.online === 2, `online counts only fresh docs (got ${g?.online}, want 2)`);
  ok(g?.focusing === 1, `focusing counts fresh focusing docs only (got ${g?.focusing}, want 1)`);

  // a beat refreshes the doc (update path), then leaving deletes it
  ok(await can(fs.setDoc(fs.doc(u2, 'presence', 'u2'), docFor('u2', Date.now(), true))), 'a heartbeat update is allowed');
  ok((await counts(u1)).focusing === 2, 'the update shows up in the focusing count');
  ok(await can(fs.deleteDoc(fs.doc(u2, 'presence', 'u2'))), 'leaving removes the doc');
  ok((await counts(u1)).online === 1, 'and the count drops');

  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
