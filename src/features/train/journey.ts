/** What the Scenic Train remembers (saved under the 'train' feature key, synced when signed in). */
import { getFeatureData, updateFeatureData } from '@/lib/featureData';
import { useData } from '@/store/data';

export const KEY = 'train';

export interface Ride {
  route: string;
  /** travelling to → from */
  rev: boolean;
  /** the focus session's start time (useTimer.sessionStartedAt) */
  at: number;
  min: number;
  /** stations stamped so far on this ride */
  got: number;
}

export interface Trip {
  route: string;
  rev: boolean;
  at: number;
  min: number;
  done: boolean;
  /** last station reached */
  to: string;
  km: number;
}

export interface TrainSave {
  ride: Ride | null;
  /** `${route}:${station}` → first time it was stamped */
  stamps: Record<string, number>;
  /** newest last, kept short */
  log: Trip[];
  km: number;
  side: 'L' | 'R';
}

export const EMPTY: TrainSave = { ride: null, stamps: {}, log: [], km: 0, side: 'R' };

export const stampId = (route: string, station: string) => `${route}:${station}`;

export const getSave = () => ({ ...EMPTY, ...getFeatureData<Partial<TrainSave>>(KEY, EMPTY) }) as TrainSave;

export function update(fn: (d: TrainSave) => void) {
  updateFeatureData<TrainSave>(KEY, EMPTY, (d) => {
    d.stamps ??= {};
    d.log ??= [];
    d.km ??= 0;
    d.side ??= 'R';
    d.ride ??= null;
    fn(d);
  });
}

/** Stamp these stations (idempotent). Returns the ones that are new to the book. */
export function stamp(route: string, names: string[]) {
  const now = Date.now();
  const fresh: string[] = [];
  update((d) => {
    for (const n of names) {
      const id = stampId(route, n);
      if (!d.stamps[id]) {
        d.stamps[id] = now;
        fresh.push(n);
      }
    }
  });
  return fresh;
}

/** How a ride whose session is no longer on the clock ended (looked up in the session log). */
export function settledOutcome(ride: Ride): { done: boolean; fraction: number } | null {
  const log = useData.getState().data.sessionLog ?? [];
  const entry = [...log].reverse().find((e) => Math.abs(e.at - ride.at) < 1500);
  if (!entry) return null;
  // real logged time must cover the booked ride (the countdown can be shortened with adjust)
  const arrived = entry.done && entry.sec >= ride.min * 60 - 60;
  return { done: arrived, fraction: arrived ? 1 : Math.min(1, entry.sec / (ride.min * 60)) };
}
