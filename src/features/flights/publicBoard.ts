/**
 * The public departures board: anonymous rows in the Firestore collection `flights`
 * ({ from, to, minutes, createdAt } and nothing else). Signed-in (not anonymous) people post at most once per
 * 10 minutes (firestore.rules, via their private flightRate/{uid} stamp); a refused write fails quietly.
 */
import { firebase } from '@/services/firebase';

export interface PublicFlight {
  id: string;
  from: string;
  to: string;
  minutes: number;
  createdAt: number;
}

const IATA = /^[A-Z]{3}$/;

export async function postPublicFlight(from: string, to: string, minutes: number) {
  const mins = Math.round(minutes);
  if (!IATA.test(from) || !IATA.test(to) || !(mins >= 1 && mins <= 360)) return;
  try {
    const { fsMod, db, auth } = await firebase();
    const me = auth.currentUser;
    if (!me || me.isAnonymous) return;
    // one batch: the flight + this person's private "last posted" stamp naming it (the rules allow one post per 10 min)
    const flight = fsMod.doc(fsMod.collection(db, 'flights'));
    const batch = fsMod.writeBatch(db);
    batch.set(flight, { from, to, minutes: mins, createdAt: fsMod.serverTimestamp() });
    batch.set(fsMod.doc(db, 'flightRate', me.uid), { last: fsMod.serverTimestamp(), id: flight.id });
    await batch.commit();
  } catch (e) {
    console.info('[flights] public board write skipped:', (e as Error)?.message ?? e);
  }
}

export async function fetchPublicFlights(max = 14): Promise<PublicFlight[]> {
  const { fsMod, db } = await firebase();
  const q = fsMod.query(fsMod.collection(db, 'flights'), fsMod.orderBy('createdAt', 'desc'), fsMod.limit(max));
  const snap = await fsMod.getDocs(q);
  return snap.docs
    .map((d) => {
      const x = d.data() as Record<string, unknown>;
      const ts = x.createdAt as { toMillis?: () => number } | null;
      return { id: d.id, from: String(x.from ?? ''), to: String(x.to ?? ''), minutes: Number(x.minutes) || 0, createdAt: ts?.toMillis?.() ?? 0 };
    })
    .filter((r) => IATA.test(r.from) && IATA.test(r.to) && r.minutes > 0 && r.minutes <= 360 && r.createdAt > 0);
}
