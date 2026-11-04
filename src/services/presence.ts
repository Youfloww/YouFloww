import { create } from 'zustand';
import { useTimer } from '@/store/timer';
import type { FB } from './firebase';

/**
 * Live "flowing now" presence: one doc per signed-in person (id = their uid), exactly the fields the strict
 * Firestore rules accept.
 * The count is two count queries (about 2 reads however many are online), not a read of every doc:
 * "online" uses the single-field index on lastActiveMs, "focusing" the composite (isFocusing, lastActiveMs).
 * Docs beat every minute while the tab is visible or a focus session runs; a hidden idle tab goes quiet and its
 * doc ages out of the count.
 */
export const usePresence = create<{ online: number | null; focusing: number | null }>(() => ({ online: null, focusing: null }));

const ACTIVE_MS = 150_000; // a doc counts while touched in the last 2.5 min (beats are 60 s apart)
const BEAT_MS = 60_000;
const COUNT_MS = 60_000;
let fbRef: FB | null = null;
let docId: string | null = null;
let myUid: string | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let counter: ReturnType<typeof setInterval> | null = null;
let unsubTimer: (() => void) | null = null;

const isFocusing = () => {
  const t = useTimer.getState();
  return t.status === 'running' && t.mode === 'focus';
};

/** The whole check-in doc (the rules accept exactly these fields; no device details, it is world-readable). */
function presenceDoc(fb: FB, userId: string) {
  const { fsMod } = fb;
  return { uid: userId, createdAt: fsMod.serverTimestamp(), lastActive: fsMod.serverTimestamp(), lastActiveMs: Date.now(), isFocusing: isFocusing() };
}

async function beat() {
  if (!fbRef || !docId || !myUid) return;
  // someone focusing in another tab still counts; a hidden idle tab stays quiet (saves writes)
  if (document.visibilityState !== 'visible' && !isFocusing()) return;
  const { fsMod, db } = fbRef;
  await fsMod.setDoc(fsMod.doc(db, 'presence', docId), presenceDoc(fbRef, myUid)).catch(() => {});
}

export async function refreshCount(fb: FB | null = fbRef) {
  if (!fb || document.visibilityState !== 'visible') return;
  const { fsMod, db } = fb;
  const col = fsMod.collection(db, 'presence');
  const fresh = () => fsMod.where('lastActiveMs', '>', Date.now() - ACTIVE_MS);
  try {
    const [all, foc] = await Promise.all([
      fsMod.getCountFromServer(fsMod.query(col, fresh())),
      // needs the composite index; without it keep the last value instead of failing the whole count
      fsMod.getCountFromServer(fsMod.query(col, fsMod.where('isFocusing', '==', true), fresh())).catch(() => null),
    ]);
    const online = Math.max(all.data().count + (myUid ? 0 : 1), 1); // a guest has no doc: count them here
    let focusing = foc ? foc.data().count : usePresence.getState().focusing;
    if (myUid && isFocusing()) focusing = Math.max(focusing ?? 0, 1);
    usePresence.setState({ online, focusing: focusing == null ? null : Math.min(focusing, online) });
  } catch {
    /* offline or denied: keep the last value */
  }
}

/** Guests can still see the live count (read-only). */
export function watchCount(fb: FB) {
  fbRef ??= fb;
  if (counter) return;
  void refreshCount(fb);
  counter = setInterval(() => refreshCount(), COUNT_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshCount());
}

export async function startPresence(fb: FB, userId: string) {
  await stopPresence();
  fbRef = fb;
  myUid = userId;
  docId = userId; // one doc per person: every tab of theirs shares it
  const { fsMod, db } = fb;
  try {
    await fsMod.setDoc(fsMod.doc(db, 'presence', docId), presenceDoc(fb, userId));
  } catch {
    /* presence is a nice-to-have */
  }
  void clearOldDocs(fb, userId);
  heartbeat = setInterval(beat, BEAT_MS);
  document.addEventListener('visibilitychange', beatOnShow);
  // Push focus state changes immediately
  let was = isFocusing();
  unsubTimer = useTimer.subscribe(() => {
    const now = isFocusing();
    if (now !== was) {
      was = now;
      void beat();
    }
  });
  addEventListener('pagehide', removeDoc);
  watchCount(fb);
}

/** Older versions kept one doc per tab (with the browser's name in it): remove this person's leftovers. */
async function clearOldDocs(fb: FB, userId: string) {
  const { fsMod, db } = fb;
  try {
    const snap = await fsMod.getDocs(fsMod.query(fsMod.collection(db, 'presence'), fsMod.where('uid', '==', userId), fsMod.limit(50)));
    await Promise.all(snap.docs.filter((d) => d.id !== userId).map((d) => fsMod.deleteDoc(d.ref).catch(() => {})));
  } catch {
    /* best effort */
  }
}

/** Coming back to the tab: check in at once (a hidden idle tab may have aged out of the count). */
function beatOnShow() {
  if (document.visibilityState === 'visible') void beat();
}

function removeDoc() {
  if (!fbRef || !docId) return Promise.resolve();
  const { fsMod, db } = fbRef;
  return fsMod.deleteDoc(fsMod.doc(db, 'presence', docId)).catch(() => {});
}

export async function stopPresence() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  unsubTimer?.();
  unsubTimer = null;
  removeEventListener('pagehide', removeDoc);
  document.removeEventListener('visibilitychange', beatOnShow);
  const gone = removeDoc();
  docId = null;
  myUid = null;
  await gone;
}
