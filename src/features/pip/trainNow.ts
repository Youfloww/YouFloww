/**
 * The train ride that belongs to the running focus session, for the progress strip and the tab title.
 * A ride is "live" while the session it was booked with (ride.at === sessionStartedAt) is on the clock.
 */
import { useEffect, useState } from 'react';
import { useData } from '@/store/data';
import { remainingAt, useTimer } from '@/store/timer';
import { getFeatureData } from '@/lib/featureData';
import { KEY, type Ride } from '../train/journey';
import { loadRoute, passedIndex, reverse, type RouteGeo, type Station } from '../train/geo';
import { routeOf } from '../train/routes';

export interface TrainNow {
  ride: Ride;
  name: string;
  color: string;
  /** the route in the direction of travel */
  geo: RouteGeo;
}

/** routes in their travel direction, by `${route}:${rev}` (each fetched once a visit) */
const geos = new Map<string, RouteGeo>();
const asked = new Set<string>();
const listeners = new Set<() => void>();

/** The live ride, or null when this session isn't a train ride (or its route is still loading). */
export function trainNow(): TrainNow | null {
  const s = useTimer.getState();
  if (s.mode !== 'focus' || s.status === 'idle' || !s.sessionStartedAt) return null;
  const ride = getFeatureData<{ ride?: Ride | null }>(KEY, {}).ride;
  if (!ride || ride.at !== s.sessionStartedAt) return null;
  const info = routeOf(ride.route);
  if (!info) return null;
  const k = `${ride.route}:${ride.rev ? 1 : 0}`;
  const geo = geos.get(k);
  if (geo) return { ride, name: info.name, color: info.color, geo };
  if (!asked.has(k)) {
    asked.add(k);
    loadRoute(ride.route).then(
      (g) => {
        geos.set(k, ride.rev ? reverse(g) : g);
        listeners.forEach((f) => f());
      },
      () => {},
    );
  }
  return null;
}

/** Where the ride is now: the fraction done, km travelled, the next station and how long until it. */
export function rideNow(t: TrainNow, now = Date.now()) {
  const s = useTimer.getState();
  const p = Math.min(1, Math.max(0, 1 - remainingAt(s, now) / Math.max(1, s.durationMs)));
  const km = p * t.geo.km;
  const next: Station | undefined = t.geo.stations[passedIndex(t.geo, km) + 1];
  const etaMs = next ? ((next.km - km) / t.geo.km) * s.durationMs : 0;
  return { p, km, next, etaMs };
}

/** React: the live ride, re-rendering when the session, the ride or its route changes. */
export function useTrainNow() {
  useTimer((s) => (s.mode === 'focus' && s.status !== 'idle' ? s.sessionStartedAt : null));
  useData((s) => s.data[KEY]);
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return trainNow();
}
