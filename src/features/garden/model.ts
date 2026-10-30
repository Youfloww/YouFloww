/**
 * Garden state (saved under data.garden): the plant growing in its pot, the plants living in the garden,
 * and how many garden spots are unlocked.
 *
 * Growth follows the app's own focus counter (data.totalFocusSeconds), so focus done while the garden is not on
 * screen (café, other worlds) still counts. A pot remembers the counter value it last "banked" (`mark`); focus
 * since then is added on the next bank, scaled by how thirsty the plant was (never-watered plants grow slower,
 * they never die).
 */
import { useEffect } from 'react';
import { bus } from '@/lib/bus';
import { getFeatureData, updateFeatureData, useFeatureData } from '@/lib/featureData';
import { dateKey, diffDays } from '@/lib/time';
import { uid } from '@/lib/utils';
import { useData } from '@/store/data';
import { buy, itemCount, spend, takeItem } from '../economy/wallet';
import { elapsedAt, useTimer } from '@/store/timer';
import { useTimerView } from '../timer/TimerOrb';
import type { PlantSpeciesId } from './PlantView';
import { speciesOf } from './species';

export interface Pot {
  id: string;
  species: PlantSpeciesId;
  planted: number;
  /** growth seconds banked (focus × water multiplier) */
  sec: number;
  /** real focused seconds banked (for "minutes it took") */
  raw: number;
  /** data.totalFocusSeconds when last banked */
  mark: number;
  /** date key of the last watering */
  watered: string;
  bloomed?: number;
  /** planted mid-session: that session's `sessionStartedAt` and the seconds already focused when planting */
  skipAt?: number;
  skip?: number;
}

export interface GardenPlant {
  id: string;
  species: PlantSpeciesId;
  planted: number;
  bloomed: number;
  /** focused minutes from seed to full bloom */
  minutes: number;
  spot: number;
  watered?: string;
}

export interface GardenData {
  pot: Pot | null;
  plants: GardenPlant[];
  spots: number;
  /** the first seed is a gift */
  freeUsed: boolean;
}

const KEY = 'garden';
const EMPTY: GardenData = { pot: null, plants: [], spots: 4, freeUsed: false };
export const START_SPOTS = 4;
export const MAX_SPOTS = 12;
/** price of the next spot when `spots` are open */
export const spotPrice = (spots: number) => 40 + (spots - START_SPOTS) * 20;
export const seedItem = (s: PlantSpeciesId) => `seed:${s}`;

export const useGarden = () => useFeatureData<GardenData>(KEY, EMPTY);
export const getGarden = () => getFeatureData<GardenData>(KEY, EMPTY);
const update = (fn: (g: GardenData) => void) => updateFeatureData<GardenData>(KEY, EMPTY, fn);
const totalFocus = () => useData.getState().data.totalFocusSeconds ?? 0;

/* ------------------------------------------------------------------ */
/* Water                                                               */
/* ------------------------------------------------------------------ */
export interface Thirst {
  days: number;
  /** 0 healthy … 1 very droopy */
  wilt: number;
  /** growth speed */
  mult: number;
  label: string;
}
export function thirstOf(watered: string | undefined, today = dateKey()): Thirst {
  const days = watered ? Math.max(0, diffDays(watered, today)) : 1;
  if (days <= 0) return { days: 0, wilt: 0, mult: 1, label: 'Happy and watered' };
  if (days === 1) return { days, wilt: 0.3, mult: 0.7, label: 'A little thirsty' };
  if (days === 2) return { days, wilt: 0.6, mult: 0.5, label: 'Thirsty, drooping' };
  return { days, wilt: 0.85, mult: 0.4, label: 'Very thirsty (but hanging on)' };
}

/* ------------------------------------------------------------------ */
/* Growth                                                              */
/* ------------------------------------------------------------------ */
export const needSec = (p: Pick<Pot, 'species'>) => speciesOf(p.species).minutes * 60;

/** Growth 0..1 right now: banked + not-yet-banked focus + the running session's seconds. */
export function growthOf(p: Pot, total: number, liveSec = 0) {
  if (p.bloomed) return 1;
  const { recorded, live } = skipOf(p);
  const pending = Math.max(0, total - p.mark - recorded) + Math.max(0, liveSec - live);
  return Math.min(1, (p.sec + pending * thirstOf(p.watered).mult) / needSec(p));
}

/**
 * Focus done before planting in the same session must not count. It is skipped while that session is still live,
 * and once it is in the session log; if the session was never logged (reset) nothing is skipped.
 */
function skipOf(p: Pot) {
  if (!p.skipAt || !p.skip) return { recorded: 0, live: 0 };
  if ((useData.getState().data.sessionLog ?? []).some((e) => e.at === p.skipAt)) return { recorded: p.skip, live: 0 };
  const t = useTimer.getState();
  return { recorded: 0, live: t.mode === 'focus' && t.status !== 'idle' && t.sessionStartedAt === p.skipAt ? p.skip : 0 };
}

/** Move finished focus into the pot. Returns true when this made it bloom. */
export function bank(): boolean {
  const g = getGarden();
  const total = totalFocus();
  const p = g.pot;
  if (!p || p.bloomed) return false;
  if (total <= p.mark) {
    // data replaced from another device with a smaller counter: just follow it
    if (total < p.mark - 6 * 3600) update((d) => d.pot && (d.pot.mark = total));
    return false;
  }
  let bloomed = false;
  update((d) => {
    const q = d.pot;
    if (!q) return;
    const pending = Math.max(0, total - q.mark - skipOf(q).recorded);
    if (skipOf(q).recorded) {
      q.skip = 0;
      q.skipAt = undefined;
    }
    q.sec += pending * thirstOf(q.watered).mult;
    q.raw += pending;
    q.mark = total;
    if (q.sec >= needSec(q)) {
      q.sec = needSec(q);
      q.bloomed = Date.now();
      bloomed = true;
    }
  });
  return bloomed;
}

/**
 * Real focused seconds of the session running right now: only time the timer actually ran (a paused session, a
 * break or an idle timer give 0 more). Read-only from the timer store.
 */
export function liveFocusSec(v: { mode: string; status: 'idle' | 'running' | 'paused'; focusedMs: number; runStartedAt: number | null }) {
  if (v.mode !== 'focus' || v.status === 'idle') return 0;
  return Math.max(0, elapsedAt(v, Date.now())) / 1000;
}

/** Live view of the pot for components (re-renders with the timer while focusing). */
export function usePot() {
  const g = useGarden();
  const total = useData((s) => s.data.totalFocusSeconds ?? 0);
  const v = useTimerView();
  const focusing = v.mode === 'focus' && v.status !== 'idle';
  const liveSec = liveFocusSec(v);
  const p = g.pot;
  if (!p) return { garden: g, pot: null, growth: 0, thirst: thirstOf(dateKey()), focusing, running: false };
  return { garden: g, pot: p, growth: growthOf(p, total, liveSec), thirst: thirstOf(p.watered), focusing, running: focusing && v.status === 'running' };
}

/** Bank on mount and after every session (mount this wherever the garden is visible). */
export function useGardenSync(onBloom?: () => void) {
  useEffect(() => {
    const run = () => {
      if (bank()) onBloom?.();
    };
    run();
    const later = () => setTimeout(run, 0);
    const offs = [bus.on('session:complete', later), bus.on('session:early', later)];
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
/** Water the pot. Returns false when it was already watered today. */
export function waterPot(): boolean {
  const g = getGarden();
  if (!g.pot) return false;
  const today = dateKey();
  if (g.pot.watered === today) return false;
  bank(); // focus so far grows at the old (thirsty) speed
  update((d) => d.pot && (d.pot.watered = today));
  return true;
}

export function waterPlant(id: string): boolean {
  const today = dateKey();
  const p = getGarden().plants.find((x) => x.id === id);
  if (!p || p.watered === today) return false;
  update((d) => {
    const q = d.plants.find((x) => x.id === id);
    if (q) q.watered = today;
  });
  return true;
}

export const hasFreeSeed = () => !getGarden().freeUsed;

export function buySeed(s: PlantSpeciesId): boolean {
  return buy(seedItem(s), speciesOf(s).price);
}

/** Put a seed in the empty pot: the free one first, then owned seeds. */
export function plantSeed(s: PlantSpeciesId, liveSec = 0): boolean {
  const g = getGarden();
  if (g.pot) return false;
  const free = !g.freeUsed;
  if (!free && !takeItem(seedItem(s))) return false;
  const total = totalFocus();
  update((d) => {
    d.freeUsed = true;
    // a seed planted mid-session only counts the rest of that session
    const at = useTimer.getState().sessionStartedAt;
    const skip = at && liveSec > 0 ? Math.round(liveSec) : 0;
    d.pot = { id: uid(), species: s, planted: Date.now(), sec: 0, raw: 0, mark: total, watered: dateKey(), ...(skip ? { skipAt: at!, skip } : {}) };
  });
  return true;
}

export const seedsOwned = (s: PlantSpeciesId) => itemCount(seedItem(s));

export const takenSpots = (g: GardenData) => new Set(g.plants.map((p) => p.spot));
export const firstFreeSpot = (g: GardenData) => {
  const taken = takenSpots(g);
  for (let i = 0; i < g.spots; i++) if (!taken.has(i)) return i;
  return -1;
};

/** Move the full-bloom pot into a garden spot. */
export function moveToGarden(spot: number, liveSec = 0): GardenPlant | null {
  bank();
  const g = getGarden();
  const p = g.pot;
  if (!p || spot < 0 || spot >= g.spots || takenSpots(g).has(spot)) return null;
  // it can reach full bloom mid-session (the running session isn't banked yet)
  const total = totalFocus();
  const live = p.bloomed ? 0 : Math.max(0, total + liveSec - p.mark);
  if (!p.bloomed && growthOf(p, total, liveSec) < 1) return null;
  const plant: GardenPlant = { id: p.id, species: p.species, planted: p.planted, bloomed: p.bloomed ?? Date.now(), minutes: Math.max(1, Math.round((p.raw + live) / 60)), spot, watered: dateKey() };
  update((d) => {
    d.plants.push(plant);
    d.pot = null;
  });
  return plant;
}

/** Move a garden plant to another free spot (or swap with the plant there). */
export function movePlant(id: string, spot: number) {
  update((d) => {
    const p = d.plants.find((x) => x.id === id);
    if (!p || spot < 0 || spot >= d.spots) return;
    const other = d.plants.find((x) => x.spot === spot);
    if (other) other.spot = p.spot;
    p.spot = spot;
  });
}

export function unlockSpot(): boolean {
  const g = getGarden();
  if (g.spots >= MAX_SPOTS) return false;
  if (!spend(spotPrice(g.spots), 'garden-spot')) return false;
  update((d) => void (d.spots = Math.min(MAX_SPOTS, d.spots + 1)));
  return true;
}

/* Dev only: fast-forward the pot for screenshots (window.__garden.set('rose', 0.5)). Not in production builds. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__garden = {
    /** plant `species` (free) and set its growth 0..1 */
    set(species: PlantSpeciesId, g: number) {
      update((d) => {
        const total = totalFocus();
        if (!d.pot || d.pot.species !== species) d.pot = { id: uid(), species, planted: Date.now(), sec: 0, raw: 0, mark: total, watered: dateKey() };
        d.pot.sec = g * needSec(d.pot);
        d.pot.raw = d.pot.sec;
        d.pot.mark = total;
        d.pot.watered = dateKey();
        d.pot.bloomed = g >= 1 ? Date.now() : undefined;
        d.freeUsed = true;
      });
    },
    get: () => getGarden().pot,
    growth: () => { const p = getGarden().pot; return p ? growthOf(p, totalFocus(), liveFocusSec(useTimer.getState())) : 0; },
  };
}
