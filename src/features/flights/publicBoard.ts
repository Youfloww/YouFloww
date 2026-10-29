/**
 * The public departures board: anonymous rows in the Firestore collection `flights`
 * ({ from, to, minutes, createdAt } and nothing else). Writes and reads fail quietly until the rule in
 * INTEGRATION.md is deployed; the board then shows only this person's own flights.
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
  if (!IATA.test(from) || !IATA.test(to)) return;
  try {
    const { fsMod, db } = await firebase();
    await fsMod.addDoc(fsMod.collection(db, 'flights'), { from, to, minutes: Math.round(minutes), createdAt: fsMod.serverTimestamp() });
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
