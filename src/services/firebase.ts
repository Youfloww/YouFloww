/**
 * Firebase is loaded lazily (after first paint) so the timer is interactive
 * instantly. Same project + collections as YouFloww v2, so accounts carry over.
 */
/**
 * On the live site Google sign-in runs on our own domain (vercel.json passes /__/ through to Firebase).
 * Safari, and Chrome with third-party storage blocked, break a sign-in hosted on firebaseapp.com,
 * which is the fallback whenever the pop-up is blocked (iPhone home-screen app, in-app browsers).
 */
const OWN_AUTH_HOSTS = ['youfloww.vercel.app'];

const firebaseConfig = {
  apiKey: 'AIzaSyBCi5Ea0r2c9tdgk_6RnpSuqDV5CE3nGbo',
  authDomain: OWN_AUTH_HOSTS.includes(location.hostname) ? location.hostname : 'youfloww2.firebaseapp.com',
  projectId: 'youfloww2',
  storageBucket: 'youfloww2.firbasestorage.app',
  messagingSenderId: '816836186464',
  appId: '1:816836186464:web:e1f816020e6798f9b3ce05',
  measurementId: 'G-TBY81E0BC4',
};

/**
 * Dev only (stripped from production builds): `?emu` points this tab at local Auth + Firestore emulators, never the
 * live project. Read at module load, before the app tidies the address bar, and kept for the tab's later reloads.
 */
const EMU =
  import.meta.env.DEV &&
  (() => {
    try {
      if (new URLSearchParams(location.search).has('emu')) sessionStorage.setItem('floww:emu', '1');
      return sessionStorage.getItem('floww:emu') === '1';
    } catch {
      return false;
    }
  })();

/**
 * Dev + `?emu` only: other emulator ports for this tab, for test suites that run their own emulators next to the
 * default ones (src/services/rules-test uses 9299/8288). Set `sessionStorage['floww:emuPorts'] = '<auth>,<firestore>'`
 * (or open with `?emu&emuPorts=9299,8288`). Missing or malformed: the defaults below (Auth 9199, Firestore 8188).
 */
const EMU_PORTS = (() => {
  const ports = { auth: 9199, firestore: 8188 };
  if (!EMU) return ports;
  try {
    const q = new URLSearchParams(location.search).get('emuPorts');
    if (q) sessionStorage.setItem('floww:emuPorts', q);
    const [a, f] = (sessionStorage.getItem('floww:emuPorts') ?? '').split(',').map(Number);
    const ok = (n: number) => Number.isInteger(n) && n >= 1024 && n <= 65535;
    if (ok(a) && ok(f)) return { auth: a, firestore: f };
  } catch {
    /* defaults */
  }
  return ports;
})();

async function load() {
  const [appMod, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  let db: import('firebase/firestore').Firestore;
  try {
    db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
  } catch {
    db = fsMod.getFirestore(app);
  }
  if (EMU) {
    authMod.connectAuthEmulator(auth, `http://127.0.0.1:${EMU_PORTS.auth}`, { disableWarnings: true });
    fsMod.connectFirestoreEmulator(db, '127.0.0.1', EMU_PORTS.firestore);
  }
  return { app, auth, db, authMod, fsMod };
}

export type FB = Awaited<ReturnType<typeof load>>;

let promise: Promise<FB> | null = null;
export const firebase = () => (promise ??= load());
