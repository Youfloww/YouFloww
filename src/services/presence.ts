import { create } from 'zustand';
import { useTimer } from '@/store/timer';
import { uid } from '@/lib/utils';
import type { FB } from './firebase';

/**
 * Live "flowing now" presence. Document fields match the v2 presence shape
 * exactly so they pass the existing (strict) Firestore rules.
 * Counting reads only recently-active docs (single-field index on lastActiveMs).
 */
export const usePresence = create<{ online: number | null; focusing: number | null }>(() => ({ online: null, focusing: null }));

const ACTIVE_MS = 90_000;
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

async function beat() {
  if (!fbRef || !docId || !myUid) return;
  const { fsMod, db } = fbRef;
  await fsMod
    .setDoc(
      fsMod.doc(db, 'presence', docId),
      { uid: myUid, lastActive: fsMod.serverTimestamp(), lastActiveMs: Date.now(), isFocusing: isFocusing(), userAgent: navigator.userAgent.slice(0, 180) },
      { merge: true },
    )
    .catch(() => {});
}

export async function refreshCount(fb: FB | null = fbRef) {
  if (!fb || document.visibilityState !== 'visible') return;
  const { fsMod, db } = fb;
  try {
    const snap = await fsMod.getDocs(fsMod.query(fsMod.collection(db, 'presence'), fsMod.where('lastActiveMs', '>', Date.now() - ACTIVE_MS), fsMod.limit(500)));
    const users = new Map<string, boolean>();
    snap.forEach((d) => {
      const x = d.data() as { uid?: string; isFocusing?: boolean };
      const key = x.uid || d.id;
      users.set(key, (users.get(key) ?? false) || !!x.isFocusing);
    });
    if (myUid) users.set(myUid, (users.get(myUid) ?? false) || isFocusing());
    usePresence.setState({ online: Math.max(users.size, 1), focusing: [...users.values()].filter(Boolean).length });
  } catch {
    /* rules may deny reads for guests: keep last value */
  }
}

/** Guests can still see the live count (read-only). */
export function watchCount(fb: FB) {
  fbRef ??= fb;
  if (counter) return;
  void refreshCount(fb);
  counter = setInterval(() => refreshCount(), 45_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshCount());
}

export async function startPresence(fb: FB, userId: string) {
  await stopPresence();
  fbRef = fb;
  myUid = userId;
  docId = `${userId.slice(0, 10)}_${uid()}`;
  const { fsMod, db } = fb;
  try {
    await fsMod.setDoc(fsMod.doc(db, 'presence', docId), {
      uid: userId,
      createdAt: fsMod.serverTimestamp(),
      lastActive: fsMod.serverTimestamp(),
      lastActiveMs: Date.now(),
      isFocusing: isFocusing(),
      userAgent: navigator.userAgent.slice(0, 180),
    });
  } catch {
    /* presence is a nice-to-have */
  }
  heartbeat = setInterval(beat, 25_000);
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
  const gone = removeDoc();
  docId = null;
  myUid = null;
  await gone;
}
