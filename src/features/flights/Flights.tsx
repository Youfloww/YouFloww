/**
 * Focus Flights: a focus session is a real flight. Pick a route (or a session length and see where it gets
 * you), get a boarding pass, take off, and watch the plane cross the globe in sync with the real timer.
 */
import './flights.css';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Cloud, Crosshair, DoorOpen, Globe2, Map as MapIcon, Pause, Play, Square, Volume2, VolumeX } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { useData } from '@/store/data';
import { remainingAt, useTimer } from '@/store/timer';
import { cn } from '@/lib/utils';
import { earn } from '../economy/wallet';
import { useTimerView } from '../timer/TimerOrb';
import { requestEnd, requestFocusFor, toggle } from '../timer/engine';
import { Arrival, type ArrivalInfo } from './Arrival';
import { BoardingPass, defaultGate, defaultSeat } from './BoardingPass';
import { Departures } from './Departures';
import { along, bearing, countryName, distanceKm, flag, flightAt, flightMinutes, flightNo, fmtKm, loadAirports, localTime, nearestAirport, PHASE_LABEL, releaseData, skyAt, type Airport, type Phase } from './geo';
import { Passport } from './Passport';
import { Planner } from './Planner';
import { postPublicFlight } from './publicBoard';
import { PaintFilters, Takeoff, WindowSeat } from './Scenes';
import { scanBeep, seatbeltChime } from './sounds';
import { getFlights, recordLanding, sessionOutcome, updateFlights, useFlights, type CurrentFlight } from './store';
import { countryAt, cropAround, useCountries, WorldMap } from './WorldMap';
import type { CamView } from './FlightMap';

const FlightMap = lazy(() => import('./FlightMap'));

type Screen = 'plan' | 'pass' | 'flight' | 'arrived';
type SheetId = 'passport' | 'board' | null;

/** The flight is tied to the timer session that started with it. */
const isLive = (c: CurrentFlight | null) => {
  if (!c) return false;
  const t = useTimer.getState();
  return t.mode === 'focus' && t.status !== 'idle' && t.sessionStartedAt === c.startedAt;
};
const progressOf = () => {
  const t = useTimer.getState();
  return Math.min(1, Math.max(0, 1 - remainingAt(t, Date.now()) / Math.max(1, t.durationMs)));
};
const displayName = (n: string) => (n && n !== 'Floww User' ? n : 'Floww Flyer');

const TOP = 'absolute inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-20 flex items-center justify-between gap-2 px-3 sm:px-4';
const CHIP = 'glass-strong pressable inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-extrabold text-ink';
const ROUND = 'glass-strong pressable grid size-11 shrink-0 place-items-center rounded-full text-ink';

/* ------------------------------------------------------------------ */
/* In-flight card                                                      */
/* ------------------------------------------------------------------ */
const ANNOUNCE: Partial<Record<Phase, (to: Airport) => string>> = {
  climb: () => 'Wheels up. Seatbelts on while we climb.',
  cruise: () => 'We’ve reached cruising altitude. Settle in and focus.',
  descent: (to) => `We’ve started our descent into ${to.city}. Seatbelts on.`,
};

function InFlightCard({ c, from, to, paths }: { c: CurrentFlight; from: Airport; to: Airport; paths: Record<string, string> | null }) {
  const t = useTimerView();
  const st = flightAt(t.progress, c.km, c.min);
  const prev = useRef<Phase | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = st.phase;
    if (!p || p === st.phase) return;
    const say = ANNOUNCE[st.phase];
    if (say) {
      setBanner(say(to));
      const id = setTimeout(() => setBanner(null), 6000);
      if (st.phase === 'climb' || st.phase === 'descent') seatbeltChime();
      return () => clearTimeout(id);
    }
  }, [st.phase, to]);
  const fKey = Math.round(st.f * 400);
  const over = useMemo(() => {
    if (!paths || st.altM < 50) return null;
    const cc = countryAt(paths, along(from, to, fKey / 400));
    return cc ? `${flag(cc)} Over ${countryName(cc)}` : '🌊 Over open water';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, fKey, from, to, st.altM < 50]);
  const paused = t.status === 'paused';
  const stats: [string, string][] = [
    ['Altitude', st.altM ? `${st.altM.toLocaleString()} m` : 'Ground'],
    ['Ground speed', paused ? 'Holding' : `${st.kmh.toLocaleString()} km/h`],
    ['Distance left', fmtKm(st.kmLeft)],
    [`Time in ${to.city}`, localTime(to.tz)],
  ];
  return (
    <>
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="glass-strong absolute top-[calc(max(12px,env(safe-area-inset-top))+56px)] left-1/2 z-20 flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold text-ink"
            role="status"
          >
            <span aria-hidden>🔔</span> {banner}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong absolute inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-10 rounded-[26px] p-3.5 text-ink sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[400px] sm:p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-display text-lg font-semibold">
            {c.no} · {from.iata} → {to.iata}
          </p>
          <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black', st.seatbelt ? 'ff-belt-on' : 'bg-line text-muted')} title={st.seatbelt ? 'Seatbelt sign on' : 'Seatbelt sign off'}>
            <span aria-hidden>💺</span> {paused ? 'Paused' : PHASE_LABEL[st.phase]}
          </span>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <p className="tabular font-display text-4xl leading-none font-semibold sm:text-5xl">{t.clock}</p>
            <p className="mt-1 text-xs font-bold text-muted">to landing in {to.city}</p>
          </div>
          <div className="flex gap-2 pb-0.5">
            <button onClick={toggle} aria-label={paused ? 'Resume flight' : 'Pause flight'} title={paused ? 'Resume' : 'Pause'} className="pressable grid size-11 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_10px_24px_-10px_var(--accent)]">
              {paused ? <Play size={19} className="translate-x-px" /> : <Pause size={19} />}
            </button>
            <button onClick={requestEnd} aria-label="End flight early" title="End flight early (gentle diverted landing)" className="pressable grid size-11 place-items-center rounded-full bg-line text-ink hover:bg-accent-soft">
              <Square size={16} />
            </button>
          </div>
        </div>
        {/* route progress */}
        <div className="mt-3 flex items-center gap-2 text-[11px] font-black">
          <span>{from.iata}</span>
          <div className="relative h-1.5 flex-1 rounded-full bg-line">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${st.f * 100}%` }} />
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-base leading-none" style={{ left: `${st.f * 100}%` }} aria-hidden>
              ✈️
            </span>
          </div>
          <span>{to.iata}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {stats.map(([l, v]) => (
            <div key={l} className="min-w-0">
              <p className="truncate text-[10px] font-black tracking-[0.12em] text-muted uppercase">{l}</p>
              <p className="tabular truncate font-display text-base leading-tight font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 truncate text-xs font-extrabold text-muted">{over ?? (st.altM < 50 ? (st.f < 0.5 ? `At ${from.name}` : `At ${to.name}`) : ' ')}</p>
        <p className="mt-1 truncate text-[9.5px] font-bold text-faint">
          Imagery: <a href="https://s2maps.eu" target="_blank" rel="noreferrer" className="underline">Sentinel-2 cloudless 2016</a> by EOX (modified Copernicus data), CC BY 4.0 · MapLibre
        </p>
      </motion.div>
    </>
  );
}

/* ------------------------------------------------------------------ */
export default function Flights() {
  const setUI = useUI((s) => s.set);
  const data = useFlights();
  const profileName = useData((s) => s.data.profileName);
  const [airports, setAirports] = useState<Airport[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [retry, setRetry] = useState(0);
  const byIata = useMemo(() => new Map((airports ?? []).map((a) => [a.iata, a])), [airports]);

  const [screen, setScreen] = useState<Screen>(() => (isLive(getFlights().current) ? 'flight' : 'plan'));
  const [fromIata, setFromIata] = useState<string | null>(() => getFlights().here ?? getFlights().home);
  const [toIata, setToIata] = useState<string | null>(null);
  const [seat, setSeat] = useState('');
  const [sheet, setSheet] = useState<SheetId>(null);
  const [arrival, setArrival] = useState<ArrivalInfo | null>(null);
  const [takeoff, setTakeoff] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [windowView, setWindowView] = useState(false);
  const [cam, setCam] = useState<CamView>('follow');
  const [camNonce, setCamNonce] = useState(0);
  const [userMoved, setUserMoved] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const from = fromIata ? byIata.get(fromIata) ?? null : null;
  const to = toIata ? byIata.get(toIata) ?? null : null;
  const current = data.current;
  const cFrom = current ? byIata.get(current.from) : undefined;
  const cTo = current ? byIata.get(current.to) : undefined;
  // country outlines are only needed in the air ("over India") and for the no-WebGL map
  const { paths } = useCountries(screen === 'flight');

  // airports: fetched when the mode opens, forgotten when it closes
  useEffect(() => {
    let live = true;
    setLoadErr(false);
    loadAirports()
      .then((a) => live && setAirports(a))
      .catch(() => live && setLoadErr(true));
    return () => {
      live = false;
    };
  }, [retry]);
  useEffect(
    () => () => {
      releaseData();
      pending.current?.();
    },
    [],
  );

  /* ---------------- a flight ended: landed, diverted or cancelled ---------------- */
  const resolve = useCallback(
    (away: boolean) => {
      const c = getFlights().current;
      if (!c || !airports || isLive(c)) return;
      const A = byIata.get(c.from);
      const B = byIata.get(c.to);
      const out = sessionOutcome(c.startedAt);
      if (!A || !B) {
        updateFlights((d) => void (d.current = null));
        return;
      }
      const base = { from: A, to: B, no: c.no, coins: 0, newCountry: null as string | null, away };
      // real logged time must cover the booked flight (the countdown can be shortened with adjust)
      const arrived = !!out && out.done && out.sec >= c.min * 60 - 60;
      const p = out ? (arrived ? 1 : Math.min(1, out.sec / (c.min * 60))) : 0;
      const st = flightAt(p, c.km, c.min);
      if (!out || (!arrived && st.f < 0.01)) {
        updateFlights((d) => void (d.current = null));
        setArrival({ ...base, kind: 'cancelled', at: A, km: 0, minutes: out ? Math.round(out.sec / 60) : 0 });
      } else if (arrived) {
        const already = getFlights().log.some((e) => e.at === c.startedAt);
        const l = recordLanding(c, B, c.km, out.sec / 60, true);
        const coins = already ? 0 : Math.max(2, Math.round(c.min / 15)) + (l.newCountry ? 5 : 0);
        if (coins) earn(coins, 'flights:landed');
        setArrival({ ...base, kind: 'landed', at: B, km: c.km, minutes: Math.round(out.sec / 60), newCountry: l.newCountry, coins });
      } else {
        const at = nearestAirport(airports, along(A, B, st.f)) ?? A;
        const flown = c.km * st.f;
        const l = recordLanding(c, at, flown, out.sec / 60, false);
        setArrival({ ...base, kind: 'diverted', at, km: Math.round(flown), minutes: Math.round(out.sec / 60), newCountry: l.newCountry });
      }
      setFromIata(null);
      setTakeoff(false);
      setWindowView(false);
      setScreen('arrived');
    },
    [airports, byIata],
  );

  // on open: a flight that ended while we were away
  useEffect(() => {
    if (airports && getFlights().current && !isLive(getFlights().current)) resolve(true);
  }, [airports, resolve]);

  // while open: watch the real timer
  useEffect(
    () =>
      useTimer.subscribe(() => {
        const c = getFlights().current;
        if (c && !isLive(c)) setTimeout(() => resolve(false), 0);
      }),
    [resolve],
  );

  // keep the planner's departure in sync with saved data on first load
  useEffect(() => {
    if (!fromIata && (data.here || data.home) && screen === 'plan') setFromIata(data.here ?? data.home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.here, data.home]);

  // keyboard: v = window seat, Esc closes our sheets before the app closes the mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (sheet || windowView)) {
        e.stopImmediatePropagation();
        if (sheet) setSheet(null);
        else setWindowView(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key.toLowerCase() === 'v' && screen === 'flight' && !e.metaKey && !e.ctrlKey) setWindowView((v) => !v);
    };
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKeyUp);
    return () => {
      removeEventListener('keydown', onKey, true);
      removeEventListener('keyup', onKeyUp);
    };
  }, [sheet, windowView, screen]);

  /* ---------------- actions ---------------- */
  const leave = () => {
    if (isLive(getFlights().current)) toast({ emoji: '✈️', title: 'Your flight keeps flying', body: 'The timer keeps going. Come back any time to watch.' });
    setUI({ mode: null });
  };

  const choose = (a: Airport) => {
    if (!from) return;
    const no = flightNo(from.iata, a.iata);
    setToIata(a.iata);
    setSeat(defaultSeat(no));
    setScreen('pass');
  };

  const setHome = (a: Airport) =>
    updateFlights((d) => {
      d.home = a.iata;
      // your own country counts as visited from the start
      if (!d.countries[a.cc]) d.countries[a.cc] = Date.now();
    });

  const plan = useMemo(() => {
    if (!from || !to) return null;
    const km = distanceKm(from, to);
    const no = flightNo(from.iata, to.iata);
    return { km, min: flightMinutes(km), no, gate: defaultGate(no) };
  }, [from, to]);

  const board = () => {
    if (!from || !to || !plan) return;
    pending.current?.();
    const req = Date.now();
    let done = false;
    const f = { from: from.iata, to: to.iata, km: Math.round(plan.km), min: plan.min, no: plan.no, seat, gate: plan.gate };
    const commit = () => {
      const t = useTimer.getState();
      if (done || t.mode !== 'focus' || t.status !== 'running' || !t.sessionStartedAt || t.sessionStartedAt < req - 2000) return false;
      done = true;
      updateFlights((d) => {
        d.current = { ...f, startedAt: t.sessionStartedAt! };
      });
      void postPublicFlight(f.from, f.to, f.min);
      scanBeep();
      setScanned(true);
      setTimeout(() => {
        setScanned(false);
        setCam('follow');
        setUserMoved(false);
        setScreen('flight');
        setTakeoff(true);
      }, 1100);
      return true;
    };
    requestFocusFor(plan.min, `${f.from}→${f.to}`, undefined, '✈️');
    if (commit()) return;
    // a session was already running: the app asks first, and we wait for the answer
    const offT = useTimer.subscribe(() => commit() && cleanup());
    const offU = useUI.subscribe((s) => {
      if (!s.confirm) setTimeout(() => (commit(), cleanup()), 400);
    });
    const cleanup = () => {
      offT();
      offU();
      if (pending.current === cleanup) pending.current = null;
    };
    pending.current = cleanup;
  };

  const flyFrom = (iata: string | null) => {
    setArrival(null);
    setToIata(null);
    setFromIata(iata);
    setScreen('plan');
  };

  const getP = useCallback(() => (isLive(getFlights().current) ? progressOf() : 1), []);
  const name = displayName(profileName);
  const sky = cTo ? skyAt(cTo.tz) : 'day';

  /* ---------------- render ---------------- */
  return (
    <div className="ff-root fixed inset-0 z-[45] overflow-hidden bg-bg text-ink" role="dialog" aria-modal="true" aria-label="Focus Flights">
      <PaintFilters />

      {/* the flight */}
      {screen === 'flight' && current && cFrom && cTo && (
        <div className="absolute inset-0">
          {!mapFailed ? (
            <Suspense fallback={<div className="ff-space absolute inset-0" />}>
              <FlightMap
                from={cFrom}
                to={cTo}
                km={current.km}
                min={current.min}
                getP={getP}
                view={cam}
                nonce={camNonce}
                parked={takeoff}
                onUserMove={() => setUserMoved(true)}
                onFail={() => setMapFailed(true)}
              />
            </Suspense>
          ) : (
            <FlatFlight c={current} from={cFrom} to={cTo} paths={paths} />
          )}
          <AnimatePresence>{windowView && <WindowSeat key="win" sky={sky} seat={current.seat} line={`${PHASE_LABEL[flightAt(getP(), current.km, current.min).phase]} to ${cTo.city}`} onClose={() => setWindowView(false)} />}</AnimatePresence>
          <div className={TOP}>
            <button onClick={leave} className={CHIP} title="Leave (your flight keeps flying)">
              <DoorOpen size={16} /> <span className="hidden sm:inline">Leave</span>
            </button>
            <div className="flex gap-2">
              <button onClick={() => setWindowView((v) => !v)} className={CHIP} aria-pressed={windowView} title="Window seat view (V)">
                {windowView ? <MapIcon size={16} /> : <Cloud size={16} />} <span className="hidden sm:inline">{windowView ? 'Map' : 'Window seat'}</span>
              </button>
              {!windowView && !mapFailed && (
                <button
                  onClick={() => {
                    if (userMoved) {
                      setUserMoved(false);
                      setCam('follow');
                      setCamNonce((n) => n + 1);
                    } else setCam((v) => (v === 'follow' ? 'overview' : 'follow'));
                  }}
                  className={CHIP}
                  title={userMoved ? 'Follow the plane again' : cam === 'follow' ? 'See the whole route' : 'Follow the plane'}
                >
                  {userMoved ? <Crosshair size={16} /> : cam === 'follow' ? <Globe2 size={16} /> : <Crosshair size={16} />}
                  <span className="hidden sm:inline">{userMoved ? 'Re-centre' : cam === 'follow' ? 'Whole route' : 'Follow plane'}</span>
                </button>
              )}
              <button
                onClick={() => updateFlights((d) => void (d.muted = !d.muted))}
                className={ROUND}
                aria-label={data.muted ? 'Turn cabin chimes on' : 'Mute cabin chimes'}
                title={data.muted ? 'Cabin chimes off' : 'Cabin chimes on'}
              >
                {data.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>
          <InFlightCard c={current} from={cFrom} to={cTo} paths={paths} />
          <AnimatePresence>{takeoff && <Takeoff key="takeoff" sky={skyAt(cFrom.tz)} from={cFrom.iata} to={cTo.iata} onDone={() => setTakeoff(false)} />}</AnimatePresence>
        </div>
      )}

      {/* landing */}
      {screen === 'arrived' && arrival && (
        <Arrival
          info={arrival}
          home={data.home}
          onOnward={() => flyFrom(arrival.at.iata)}
          onHome={() => flyFrom(data.home)}
          onPassport={() => setSheet('passport')}
          onLeave={() => setUI({ mode: null })}
        />
      )}

      {/* planning + boarding pass */}
      {(screen === 'plan' || screen === 'pass' || (screen === 'flight' && (!current || !cFrom || !cTo))) && (
        <div className="ff-sky absolute inset-0 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 backdrop-blur-md sm:px-4">
            <button onClick={screen === 'pass' ? () => setScreen('plan') : leave} className={CHIP}>
              {screen === 'pass' ? <ArrowLeft size={16} /> : <DoorOpen size={16} />}
              <span className="hidden sm:inline">{screen === 'pass' ? 'Change flight' : 'Back to YouFloww'}</span>
            </button>
            <p className="font-display text-xl font-semibold sm:text-2xl">✈️ Focus Flights</p>
            <div className="flex gap-2">
              <button onClick={() => setSheet('board')} className={CHIP} title="Departures board">
                <span aria-hidden>🛫</span> <span className="hidden sm:inline">Departures</span>
              </button>
              <button onClick={() => setSheet('passport')} className={CHIP} title="Passport and logbook">
                <BookOpen size={16} /> <span className="hidden sm:inline">Passport</span>
              </button>
            </div>
          </div>
          <div className="px-3 pt-2 sm:px-4">
            {!airports ? (
              <div className="grid min-h-[60dvh] place-items-center text-center">
                {loadErr ? (
                  <div className="glass-strong rounded-[24px] p-6">
                    <p className="text-3xl">📡</p>
                    <p className="mt-2 font-display text-xl font-semibold">The airport list didn’t arrive</p>
                    <p className="text-sm font-bold text-muted">Check your connection and try again.</p>
                    <button onClick={() => setRetry((n) => n + 1)} className="pressable mt-4 h-11 rounded-2xl bg-accent px-5 font-extrabold text-accent-ink">
                      Try again
                    </button>
                  </div>
                ) : (
                  <motion.p className="text-5xl" animate={{ x: [-30, 30, -30], rotate: [8, -8, 8] }} transition={{ duration: 2.4, repeat: Infinity }} aria-label="Loading airports">
                    ✈️
                  </motion.p>
                )}
              </div>
            ) : screen === 'pass' && from && to && plan ? (
              <div className="mx-auto flex max-w-[780px] flex-col items-center pt-2 pb-10">
                <p className="mb-3 text-center text-sm font-bold text-muted">Check your boarding pass. The flight starts your {plan.min}-minute focus session.</p>
                <BoardingPass info={{ from, to, km: plan.km, min: plan.min, no: plan.no, gate: plan.gate, seat, name }} onSeat={setSeat} scanned={scanned} />
                <button onClick={board} disabled={scanned} className="pressable mt-5 h-14 w-full max-w-[360px] rounded-2xl bg-accent font-display text-xl font-semibold text-accent-ink shadow-[0_14px_36px_-12px_var(--accent)]">
                  {scanned ? 'Boarding…' : 'Board now ✈️'}
                </button>
                <p className="mt-2 text-xs font-bold text-muted">Pause or end any time: ending early is a gentle diverted landing.</p>
              </div>
            ) : (
              <Planner airports={airports} from={from} homeIata={data.home} onFrom={(a) => setFromIata(a.iata)} onSetHome={setHome} onPick={choose} />
            )}
          </div>
        </div>
      )}

      {/* sheets */}
      <AnimatePresence>
        {sheet && (
          <motion.div key="sheet" className="ff-sky absolute inset-0 z-30 overflow-y-auto" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 backdrop-blur-md sm:px-4">
              <button onClick={() => setSheet(null)} className={CHIP}>
                <ArrowLeft size={16} /> Back
              </button>
              <p className="font-display text-xl font-semibold sm:text-2xl">{sheet === 'passport' ? 'Passport' : 'Departures'}</p>
              <span className="w-[76px]" />
            </div>
            <div className="px-3 pt-2 pb-8 sm:px-4">
              {!airports ? (
                <p className="py-20 text-center font-bold text-muted">Loading…</p>
              ) : sheet === 'passport' ? (
                <Passport data={data} airports={airports} name={name} />
              ) : (
                <div className="mx-auto max-w-[860px]">
                  <Departures airports={airports} mine={data.log} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** No WebGL: the same flight on the flat painted world. */
function FlatFlight({ c, from, to, paths }: { c: CurrentFlight; from: Airport; to: Airport; paths: Record<string, string> | null }) {
  const t = useTimerView();
  const st = flightAt(t.progress, c.km, c.min);
  const at = along(from, to, st.f);
  const heading = bearing(at, along(from, to, Math.min(1, st.f + 0.01)));
  return (
    <div className="ff-space absolute inset-0 grid place-items-center p-4 pb-[300px] sm:pb-4">
      <div className="w-full max-w-[900px] rounded-3xl bg-[#13284a] p-2 [--ff-border:#13284a] [--ff-land:#3c5a7d] [--ff-route:#ffb38a] [--ff-visited:#3c5a7d]">
        <WorldMap paths={paths} routes={[{ from, to, f: st.f }]} dots={[from, to]} plane={{ at, heading }} viewBox={cropAround(from, to)} />
      </div>
    </div>
  );
}
