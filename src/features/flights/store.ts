/**
 * Focus Flights saved state (data.flights, synced when signed in). Kept small: the logbook keeps the
 * latest 120 flights; totals, countries and stamps are running tallies so nothing is lost when it trims.
 */
import { getFeatureData, updateFeatureData, useFeatureData } from '@/lib/featureData';
import { useData } from '@/store/data';

export interface LogEntry {
  /** origin / planned destination / where we actually landed (IATA) */
  f: string;
  t: string;
  l: string;
  km: number;
  /** planned minutes, minutes actually flown */
  m: number;
  fm: number;
  at: number;
  ok: boolean;
  no: string;
  seat: string;
}

export interface CurrentFlight {
  from: string;
  to: string;
  km: number;
  min: number;
  no: string;
  seat: string;
  gate: string;
  /** the timer's sessionStartedAt, ties the flight to the real session */
  startedAt: number;
}

export interface Stamp {
  /** landings here, first landing, country, diverted only */
  n: number;
  at: number;
  cc: string;
  div?: boolean;
}

export interface FlightsData {
  home: string | null;
  /** where the last flight landed (the next one leaves from here) */
  here: string | null;
  log: LogEntry[];
  totals: { flights: number; landed: number; km: number; minutes: number };
  /** country code -> first visit */
  countries: Record<string, number>;
  stamps: Record<string, Stamp>;
  current: CurrentFlight | null;
  muted?: boolean;
}

export const KEY = 'flights';
export const EMPTY: FlightsData = { home: null, here: null, log: [], totals: { flights: 0, landed: 0, km: 0, minutes: 0 }, countries: {}, stamps: {}, current: null };

export const useFlights = () => useFeatureData<FlightsData>(KEY, EMPTY);
export const getFlights = () => getFeatureData<FlightsData>(KEY, EMPTY);
export const updateFlights = (fn: (d: FlightsData) => void) =>
  updateFeatureData<FlightsData>(KEY, EMPTY, (d) => {
    // older/partial saves
    d.log ??= [];
    d.totals ??= { flights: 0, landed: 0, km: 0, minutes: 0 };
    d.countries ??= {};
    d.stamps ??= {};
    fn(d);
  });

export interface Landing {
  entry: LogEntry;
  /** first time in this country */
  newCountry: string | null;
  /** first time at this airport */
  newStamp: boolean;
}

/** Write a finished (or diverted) flight into the logbook. */
export function recordLanding(c: CurrentFlight, landedAt: { iata: string; cc: string }, flownKm: number, flownMin: number, ok: boolean): Landing {
  const entry: LogEntry = { f: c.from, t: c.to, l: landedAt.iata, km: Math.round(flownKm), m: c.min, fm: Math.round(flownMin), at: c.startedAt, ok, no: c.no, seat: c.seat };
  let newCountry: string | null = null;
  let newStamp = false;
  updateFlights((d) => {
    d.current = null;
    if (d.log.some((e) => e.at === entry.at)) return;
    d.log.push(entry);
    if (d.log.length > 120) d.log.splice(0, d.log.length - 120);
    d.totals.flights += 1;
    if (ok) d.totals.landed += 1;
    d.totals.km += entry.km;
    d.totals.minutes += entry.fm;
    d.here = landedAt.iata;
    if (landedAt.iata !== c.from) {
      if (!d.countries[landedAt.cc]) {
        d.countries[landedAt.cc] = Date.now();
        newCountry = landedAt.cc;
      }
      const s = d.stamps[landedAt.iata];
      if (!s) {
        d.stamps[landedAt.iata] = { n: 1, at: Date.now(), cc: landedAt.cc, ...(ok ? {} : { div: true }) };
        newStamp = true;
      } else {
        s.n += 1;
        if (ok && s.div) delete s.div;
      }
    }
  });
  return { entry, newCountry, newStamp };
}

/** How the session tied to a flight ended, from the app's own session log. */
export function sessionOutcome(startedAt: number): { done: boolean; sec: number } | null {
  const log = useData.getState().data.sessionLog ?? [];
  for (let i = log.length - 1; i >= 0; i--) if (log[i].at === startedAt) return { done: log[i].done, sec: log[i].sec };
  return null;
}
