import { normalizeUserData } from '@/data/model';
import type { UserData } from '@/data/types';
import { debounce } from '@/lib/utils';
import { dateKey } from '@/lib/time';
import { GUEST_KEY, loadGuestData, useData } from '@/store/data';
import { toast } from '@/store/ui';
import { firebase, type FB } from './firebase';
import { startPresence, stopPresence, watchCount } from './presence';

const clean = (d: UserData) => JSON.parse(JSON.stringify(d)) as UserData; // Firestore rejects `undefined`

/* ---------------- Guest persistence (localStorage, instant) ---------------- */
const saveGuest = debounce(() => {
  const { data, user } = useData.getState();
  if (user) return;
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ ...data, isGuestData: true, lastSaved: Date.now() }));
  } catch {
    /* quota */
  }
}, 300);

/* ---------------- Cloud persistence ---------------- */
let fbRef: FB | null = null;
let unsubDoc: (() => void) | null = null;
let lastPublic = '';

const saveCloud = debounce(async () => {
  const { data, user } = useData.getState();
  if (!user || !fbRef) return;
  const { fsMod, db } = fbRef;
  useData.setState({ sync: 'saving' });
  try {
    await fsMod.setDoc(fsMod.doc(db, 'users', user.uid), clean(data));
    useData.setState({ sync: navigator.onLine ? 'saved' : 'offline' });
    void publishPublic();
  } catch (e) {
    console.warn('[floww] save failed', e);
    useData.setState({ sync: navigator.onLine ? 'error' : 'offline' });
  }
}, 1200);

/** Leaderboard projection (publicUsers/{uid}) — same shape as v2. */
async function publishPublic() {
  const { data, user } = useData.getState();
  if (!user || !fbRef) return;
  const today = dateKey();
  const sec = data.dailyFocusSeconds?.[today] ?? data.weeklyFocusSeconds[today] ?? 0;
  const payload = {
    profileName: data.profileName || 'Floww User',
    todayFocusMinutes: parseFloat((sec / 60).toFixed(2)),
    currentStreak: data.streakCount || 0,
    lastStreakUpdate: data.lastStreakDate || today,
    date: today,
    isGuest: false,
  };
  const sig = JSON.stringify(payload);
  if (sig === lastPublic) return;
  lastPublic = sig;
  const { fsMod, db } = fbRef;
  await fsMod.setDoc(fsMod.doc(db, 'publicUsers', user.uid), payload, { merge: true }).catch(() => (lastPublic = ''));
}

const hasProgress = (d: UserData) => d.totalSessions > 0 || d.todos.length > 0 || Object.keys(d.journalEntries).length > 0;

async function attachUser(fb: FB, u: import('firebase/auth').User) {
  const { fsMod, db } = fb;
  useData.setState({
    user: { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL },
    sync: 'saving',
  });
  const ref = fsMod.doc(db, 'users', u.uid);
  let first = true;
  unsubDoc?.();
  unsubDoc = fsMod.onSnapshot(
    ref,
    { includeMetadataChanges: false },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (first) {
        first = false;
        if (snap.exists()) {
          useData.getState().replace(normalizeUserData(snap.data()), true);
          useData.setState({ sync: 'saved' });
          void publishPublic();
        } else {
          // Brand new account: bring the guest's progress along so nothing is lost
          const guest = loadGuestData();
          const seed = hasProgress(guest) ? guest : normalizeUserData({});
          if (u.displayName && seed.profileName === 'Floww User') seed.profileName = u.displayName.slice(0, 40);
          seed.createdAt = Date.now();
          useData.getState().replace(seed); // bumps rev -> saveCloud
          if (hasProgress(guest)) toast({ emoji: '☁️', title: 'Progress synced', body: 'Your guest sessions moved into your account.' });
        }
        return;
      }
      const remote = normalizeUserData(snap.data());
      const local = useData.getState().data;
      if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) useData.getState().replace(remote, true);
    },
    (err) => {
      console.warn('[floww] snapshot error', err);
      useData.setState({ sync: 'error' });
    },
  );
  void startPresence(fb, u.uid);
}

function detachUser() {
  saveCloud.cancel();
  unsubDoc?.();
  unsubDoc = null;
  lastPublic = '';
  void stopPresence();
  useData.setState({ user: null, sync: 'local' });
  useData.getState().replace(loadGuestData(), true);
}

let started = false;
export function initSync() {
  if (started) return;
  started = true;

  // Persist on every local change
  let rev = useData.getState().rev;
  useData.subscribe((s) => {
    if (s.rev === rev) return;
    rev = s.rev;
    if (s.user) saveCloud();
    else saveGuest();
  });

  const flush = () => {
    saveGuest.flush();
    if (useData.getState().user) void saveCloud.flush();
  };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  addEventListener('online', () => useData.getState().user && saveCloud());
  addEventListener('offline', () => useData.getState().user && useData.setState({ sync: 'offline' }));

  // Boot Firebase when the browser is idle, never blocking first paint.
  const boot = async () => {
    try {
      const fb = await firebase();
      fbRef = fb;
      watchCount(fb);
      fb.authMod.onAuthStateChanged(fb.auth, (u) => {
        if (u) void attachUser(fb, u);
        else if (useData.getState().user) detachUser();
        useData.setState({ authReady: true });
      });
      // Finish a redirect-based Google sign-in if one is pending
      fb.authMod.getRedirectResult(fb.auth).catch(() => {});
    } catch (e) {
      console.warn('[floww] firebase unavailable — running fully offline', e);
      useData.setState({ authReady: true });
    }
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(boot, { timeout: 1500 });
  else setTimeout(boot, 600);
}

/* ---------------- Auth actions ---------------- */
export async function signInWithGoogle() {
  const fb = await firebase();
  const provider = new fb.authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await fb.authMod.signInWithPopup(fb.auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.includes('popup-blocked') || code.includes('operation-not-supported')) await fb.authMod.signInWithRedirect(fb.auth, provider);
    else throw e;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const fb = await firebase();
  await fb.authMod.signInWithEmailAndPassword(fb.auth, email, password);
}

export async function signUpWithEmail(email: string, password: string, name?: string) {
  const fb = await firebase();
  const cred = await fb.authMod.createUserWithEmailAndPassword(fb.auth, email, password);
  if (name) {
    await fb.authMod.updateProfile(cred.user, { displayName: name }).catch(() => {});
    useData.getState().setProfileName(name);
  }
}

export async function resetPassword(email: string) {
  const fb = await firebase();
  await fb.authMod.sendPasswordResetEmail(fb.auth, email);
}

export async function signOut() {
  saveCloud.flush();
  // only the owner may delete their "flowing now" doc, so do it while still signed in
  await Promise.race([stopPresence(), new Promise((r) => setTimeout(r, 1500))]);
  const fb = await firebase();
  await fb.authMod.signOut(fb.auth);
}

export function authErrorMessage(e: unknown) {
  const code = (e as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'That email & password combo didn’t work.',
    'auth/wrong-password': 'Wrong password — try again?',
    'auth/user-not-found': 'No account with that email yet.',
    'auth/email-already-in-use': 'That email already has an account. Try logging in!',
    'auth/weak-password': 'Password needs at least 6 characters.',
    'auth/invalid-email': 'That email looks a little off.',
    'auth/popup-closed-by-user': 'Sign-in window closed.',
    'auth/network-request-failed': 'You seem to be offline.',
    'auth/too-many-requests': 'Too many tries. Take a breath and try again soon.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export const getFb = () => fbRef;
