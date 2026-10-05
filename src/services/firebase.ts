/**
 * Firebase is loaded lazily (after first paint) so the timer is interactive
 * instantly. Same project + collections as YouFloww v2, so accounts carry over.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyBCi5Ea0r2c9tdgk_6RnpSuqDV5CE3nGbo',
  authDomain: 'youfloww2.firebaseapp.com',
  projectId: 'youfloww2',
  storageBucket: 'youfloww2.firbasestorage.app',
  messagingSenderId: '816836186464',
  appId: '1:816836186464:web:e1f816020e6798f9b3ce05',
  measurementId: 'G-TBY81E0BC4',
};

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
  return { app, auth, db, authMod, fsMod };
}

export type FB = Awaited<ReturnType<typeof load>>;

let promise: Promise<FB> | null = null;
export const firebase = () => (promise ??= load());
