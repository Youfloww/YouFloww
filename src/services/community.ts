import { dateKey, diffDays } from '@/lib/time';
import { firebase } from './firebase';

export interface LeaderRow {
  uid: string;
  name: string;
  value: number;
}

/**
 * Today's focus leaders. Tries the indexed query first (date ==, orderBy minutes);
 * falls back to the v2 approach (filter by date, sort client-side) if the
 * composite index isn't deployed yet. See firestore.indexes.json.
 */
export async function fetchFocusLeaders(max = 25): Promise<LeaderRow[]> {
  const { fsMod, db } = await firebase();
  const today = dateKey();
  const col = fsMod.collection(db, 'publicUsers');
  let docs: { id: string; data: Record<string, unknown> }[] = [];
  try {
    const snap = await fsMod.getDocs(fsMod.query(col, fsMod.where('date', '==', today), fsMod.orderBy('todayFocusMinutes', 'desc'), fsMod.limit(max)));
    docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch {
    const snap = await fsMod.getDocs(fsMod.query(col, fsMod.where('date', '==', today)));
    docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  }
  return docs
    .map((d) => ({ uid: d.id, name: String(d.data.profileName || 'Floww User').slice(0, 40), value: Math.max(0, Number(d.data.todayFocusMinutes) || 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
}

/** Longest *alive* streaks (last session today or yesterday). */
export async function fetchStreakLeaders(max = 25): Promise<LeaderRow[]> {
  const { fsMod, db } = await firebase();
  const today = dateKey();
  const col = fsMod.collection(db, 'publicUsers');
  const snap = await fsMod.getDocs(fsMod.query(col, fsMod.where('currentStreak', '>', 0), fsMod.orderBy('currentStreak', 'desc'), fsMod.limit(max * 3)));
  return snap.docs
    .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    .filter((d) => {
      const last = String(d.data.lastStreakUpdate || d.data.date || '');
      return /^\d{4}-\d{2}-\d{2}$/.test(last) && diffDays(last, today) <= 1;
    })
    .map((d) => ({ uid: d.id, name: String(d.data.profileName || 'Floww User').slice(0, 40), value: Number(d.data.currentStreak) || 0 }))
    .slice(0, max);
}
