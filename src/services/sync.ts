import { normalizeUserData } from '@/data/model';
import { setCloudReady } from './cloudReady';
import type { SessionLogEntry, UserData } from '@/data/types';
import { debounce } from '@/lib/utils';
import { dateKey } from '@/lib/time';
import { GUEST_KEY, loadGuestData, useData } from '@/store/data';
import { toast } from '@/store/ui';
import { firebase, type FB } from './firebase';
import { snapshotAction, betterStreak, buildWrites, clean, derive, replayMissing, toWire } from './syncDiff';
import { startPresence, stopPresence, watchCount } from './presence';
import { startLive, stopLive } from './liveSession';

/* ---------------- Guest persistence (localStorage, instant) ---------------- */
let guestDirty = false;
let guestStamp = 0;
const readStamp = () => {
  try {
    return Number(JSON.parse(localStorage.getItem(GUEST_KEY) || 'null')?.lastSaved) || 0;
  } catch {
    return 0;
  }
};

/** Another tab wrote the guest blob: take its sessions in (and its other changes, unless we have unsaved ones). */
function pullGuest() {
  guestStamp = readStamp();
  const stored = loadGuestData();
  const { data } = useData.getState();
  if (!guestDirty) return void useData.getState().replace(stored, true);
  const mine = structuredClone(data);
  replayMissing(mine, stored.sessionLog);
  useData.getState().replace(mine, true);
}

const saveGuest = debounce(() => {
  const { user } = useData.getState();
  // signed in: guest storage is left alone once the account's data is on screen
  if (user && (serverReady || showingCache)) return;
  if (readStamp() > guestStamp) pullGuest(); // a stale tab must not overwrite another tab's sessions
  try {
    guestStamp = Date.now();
    localStorage.setItem(GUEST_KEY, JSON.stringify({ ...useData.getState().data, isGuestData: true, lastSaved: guestStamp }));
    guestDirty = false;
  } catch {
    /* quota */
  }
}, 300);

/* ---------------- Cloud persistence ---------------- */
let fbRef: FB | null = null;
let unsubDoc: (() => void) | null = null;
let lastPublic = '';
/** true after the first snapshot that really came from the server; nothing is seeded or saved before that */
let serverReady = false;
/** the account's cached copy is on screen (we haven't heard from the server yet) */
let showingCache = false;
/** the last server-known copy this device's data builds on; saves send only what changed against it */
let base: UserData | null = null;
/** local changes not sent yet */
let dirty = false;
/** a remote snapshot that arrived while we had unsent changes */
let deferred: unknown = null;
let attachSeq = 0;

const saveCloud = debounce(async () => {
  const { data, user } = useData.getState();
  if (!user || !fbRef || !serverReady || !base) return;
  const { fsMod, db } = fbRef;
  const ref = fsMod.doc(db, 'users', user.uid);
  const w = buildWrites(fsMod, base, data);
  dirty = false;
  if (!w.args.length && !w.edited.length) {
    if (deferred) applyRemote(deferred);
    return;
  }
  deferred = null;
  const prev = base;
  const mine = (base = clean(data));
  useData.setState({ sync: 'saving' });
  const finish = (e?: unknown) => {
    if (!e) {
      useData.setState({ sync: navigator.onLine ? 'saved' : 'offline' });
      void publishPublic();
      return;
    }
    console.warn('[floww] save failed', e);
    if ((e as { code?: string }).code === 'not-found') {
      // the document was removed under us: write it whole
      void fsMod.setDoc(ref, toWire(data)).catch(() => {});
      return;
    }
    if (base === mine) base = prev; // nothing newer was sent: resend this next time
    dirty = true;
    useData.setState({ sync: navigator.onLine ? 'error' : 'offline' });
  };
  if (w.args.length) {
    const p = (fsMod.updateDoc as (r: unknown, ...a: unknown[]) => Promise<void>)(ref, ...w.args).then(() => finish(), finish);
    if (navigator.onLine) await p; // offline: the write waits in Firestore's queue
    else useData.setState({ sync: 'offline' });
  }
  // ratings added after a session was sent: best effort (needs a connection)
  for (const r of w.edited) {
    void fsMod
      .runTransaction(db, async (tx) => {
        const log = ((await tx.get(ref)).get('sessionLog') ?? []) as SessionLogEntry[];
        tx.update(ref, { sessionLog: log.map((x) => (x.at === r.at ? { ...x, ...r } : x)) });
      })
      .catch(() => {});
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

/** Show the server's copy (nothing unsent is lost: those wait in `deferred`). */
function applyRemote(raw: unknown) {
  deferred = null;
  const remote = derive(normalizeUserData(raw));
  if (base && JSON.stringify(remote) === JSON.stringify(base)) return;
  const local = useData.getState().data;
  base = clean(remote);
  // streaks aren't counters: keep whichever device is further along, and send it if it is ours
  const best = betterStreak(local, remote);
  let resend = false;
  if (best !== remote && (best.streakCount !== remote.streakCount || best.lastStreakDate !== remote.lastStreakDate)) {
    remote.streakCount = best.streakCount;
    remote.lastStreakDate = best.lastStreakDate;
    remote.bestStreak = Math.max(remote.bestStreak, best.bestStreak);
    resend = true;
  }
  useData.getState().replace(remote, true);
  if (resend) {
    dirty = true;
    saveCloud();
  }
}

async function attachUser(fb: FB, u: import('firebase/auth').User) {
  const { fsMod, db } = fb;
  const seq = ++attachSeq;
  serverReady = false;
  setCloudReady(false);
  showingCache = false;
  base = null;
  dirty = false;
  deferred = null;
  useData.setState({
    user: { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL },
    sync: 'saving',
  });
  const ref = fsMod.doc(db, 'users', u.uid);
  unsubDoc?.();
  unsubDoc = fsMod.onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      if (seq !== attachSeq) return;

      const act = snapshotAction(serverReady, snap.metadata, snap.exists());
      if (act === 'cache' || act === 'seed' || act === 'load') {
        if (act === 'cache') {
          // Offline / slow start: only DISPLAY what we have. Never seed, never save.
          if (snap.exists() && !dirty) {
            const cached = derive(normalizeUserData(snap.data()));
            showingCache = true;
            base = clean(cached);
            useData.getState().replace(cached, true);
          }
          return;
        }
        // First answer from the server
        saveGuest.flush();
        serverReady = true;
        setCloudReady(true);
        const guest = loadGuestData();
        const hadGuest = guest.sessionLog && guest.sessionLog.length > 0;
        if (act === 'seed') {
          // Brand new account: bring the guest's progress along so nothing is lost
          const seed = hasProgress(guest) ? guest : normalizeUserData({});
          if (u.displayName && seed.profileName === 'Floww User') seed.profileName = u.displayName.slice(0, 40);
          seed.createdAt = Date.now();
          base = clean(seed);
          useData.getState().replace(seed, true);
          void fsMod.setDoc(ref, toWire(seed)).then(
            () => {
              if (hadGuest) localStorage.removeItem(GUEST_KEY);
              useData.setState({ sync: 'saved' });
              void publishPublic();
            },
            (e) => {
              console.warn('[floww] first save failed', e);
              useData.setState({ sync: 'error' });
            },
          );
          if (hasProgress(guest)) toast({ emoji: '☁️', title: 'Progress synced', body: 'Your guest sessions moved into your account.' });
          return;
        }
        const raw = snap.data() as Record<string, unknown>;
        // one-time shape upgrades of the stored document (queued before any increments)
        if (Array.isArray(raw.hourlyFocusSeconds)) {
          const hours = Object.fromEntries((raw.hourlyFocusSeconds as number[]).map((v, i) => [String(i), v]));
          void fsMod.updateDoc(ref, { hourlyFocusSeconds: hours }).catch(() => {});
        }
        if (Array.isArray(raw.sessionLog) && raw.sessionLog.length > 300) void fsMod.updateDoc(ref, { sessionLog: raw.sessionLog.slice(-150) }).catch(() => {});

        // Changes made on top of the cached copy before the server answered stay ours; otherwise take the server's copy.
        const keepLocal = showingCache && dirty && base;
        const target = keepLocal ? structuredClone(useData.getState().data) : derive(normalizeUserData(raw));
        if (!keepLocal) base = clean(target);
        const replayed = hadGuest ? replayMissing(target, guest.sessionLog) : 0;
        if (hadGuest) localStorage.removeItem(GUEST_KEY); // never copy these sessions into a second account
        if (replayed) toast({ emoji: '☁️', title: 'Progress synced', body: `${replayed} guest session${replayed === 1 ? '' : 's'} added to your account.` });
        showingCache = false;
        useData.getState().replace(target, !(keepLocal || replayed));
        useData.setState({ sync: 'saved' });
        void publishPublic();
        if (keepLocal || replayed) {
          dirty = true;
          saveCloud();
        }
        return;
      }

      if (act === 'skip') return;
      if (dirty) deferred = snap.data(); // unsent changes first; the next save catches up
      else applyRemote(snap.data());
    },
    (err) => {
      console.warn('[floww] snapshot error', err);
      useData.setState({ sync: 'error' });
    },
  );
  void startPresence(fb, u.uid);
  startLive(fb, u.uid);
}

function detachUser() {
  saveCloud.cancel();
  attachSeq++;
  serverReady = false;
  setCloudReady(false);
  showingCache = false;
  base = null;
  dirty = false;
  deferred = null;
  unsubDoc?.();
  unsubDoc = null;
  lastPublic = '';
  void stopPresence();
  stopLive();
  useData.setState({ user: null, sync: 'local' });
  useData.getState().replace(loadGuestData(), true);
  guestStamp = readStamp();
  guestDirty = false;
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
    if (s.user) {
      dirty = true;
      saveCloud();
      if (!serverReady && !showingCache) {
        guestDirty = true;
        saveGuest(); // not heard from the server yet: keep the work safe on this device
      }
    } else {
      guestDirty = true;
      saveGuest();
    }
  });
  guestStamp = readStamp();
  // another tab changed the guest data: pick it up instead of overwriting it later
  addEventListener('storage', (e: StorageEvent) => {
    if (e.key === GUEST_KEY && !useData.getState().user) pullGuest();
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
