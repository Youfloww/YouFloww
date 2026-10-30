/**
 * Scenic Train: a focus session is a ride along a real railway. Pick a line on the platform, fill in the
 * ticket, and the train covers the whole route in step with the timer while you look out of the window.
 * Stations passed land as stamps in the stamp book; finishing brings an arrival card, ending early a gentle
 * "you hopped off at …".
 */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { useTimer } from '@/store/timer';
import { useData } from '@/store/data';
import { bus } from '@/lib/bus';
import { useFeatureData } from '@/lib/featureData';
import { cn } from '@/lib/utils';
import { requestFocusFor } from '../timer/engine';
import { loadRoute, passedIndex, reverse, type RouteGeo, type Station } from './geo';
import { LENGTHS, ROUTES, routeOf } from './routes';
import { Board, TicketCard, type Booking } from './Platform';
import { RideView } from './Ride';
import { StampBook } from './StampBook';
import { Stamp } from './Stamp';
import { Carriage, DARK_BTN, LIGHT_BTN, PAPER, palVars, palette } from './Frame';
import { EMPTY, KEY, getSave, settledOutcome, stamp, update, type Ride, type TrainSave } from './journey';
import { todAt } from './tod';

interface Ending {
  ride: Ride;
  done: boolean;
  km: number;
  to: Station;
  /** every station stamped on this trip */
  names: string[];
  fresh: string[];
}

type Stage = 'board' | 'ticket' | 'ride';

export default function Train() {
  const setUI = useUI((s) => s.set);
  const theme = usePrefs((s) => s.theme);
  const dark = theme === 'midnight' || theme === 'nebula';
  const pal = palette(dark);
  const raw = useFeatureData<Partial<TrainSave>>(KEY, EMPTY);
  const save = useMemo(() => ({ ...EMPTY, ...raw }) as TrainSave, [raw]);
  const workMin = useData((s) => Math.round(s.data.settings.workDuration / 60));

  const [stage, setStage] = useState<Stage>(() => (getSave().ride ? 'ride' : 'board'));
  const [booking, setBookingState] = useState<Booking>(() => {
    const last = getSave().log.at(-1);
    return { route: last?.route ?? ROUTES[0].id, rev: false, min: LENGTHS.includes(workMin) ? workMin : 25, side: getSave().side };
  });
  const setBooking = (p: Partial<Booking>) => setBookingState((b) => ({ ...b, ...p }));
  const [pending, setPending] = useState<number | null>(null);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [tod, setTod] = useState(todAt);
  const fracRef = useRef(0);
  const finalizing = useRef<number | null>(null);

  // the ride on screen: the live one, or the one that just ended (frozen behind its card)
  const ride = ending?.ride ?? save.ride;
  const [geo, setGeo] = useState<RouteGeo | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);
  const rideRoute = ride?.route;
  const rideRev = !!ride?.rev;
  // only a different line (or direction) loads new geometry: the window's map lives as long as `geo` does
  useEffect(() => {
    if (!rideRoute) return setGeo(null);
    let on = true;
    setGeoFailed(false);
    loadRoute(rideRoute).then(
      (g) => on && setGeo(rideRev ? reverse(g) : g),
      () => on && setGeoFailed(true),
    );
    return () => {
      on = false;
    };
  }, [rideRoute, rideRev]);

  useEffect(() => {
    const id = setInterval(() => setTod((cur) => (todAt().id === cur.id ? cur : todAt())), 60_000);
    return () => clearInterval(id);
  }, []);

  /** Close the books on a ride: stamp what was reached, log it, show the card. */
  const finalize = useCallback((r: Ride, done: boolean, fraction: number) => {
    if (finalizing.current === r.at) return;
    finalizing.current = r.at;
    loadRoute(r.route)
      .then((g0) => {
        const g = r.rev ? reverse(g0) : g0;
        const km = done ? g.km : Math.min(g.km, Math.max(0, fraction) * g.km);
        const idx = done ? g.stations.length - 1 : Math.max(0, passedIndex(g, km));
        const names = g.stations.slice(0, idx + 1).map((s) => s.name);
        const fresh = stamp(r.route, names);
        update((d) => {
          if (!d.ride || d.ride.at !== r.at) return;
          d.ride = null;
          d.km += km;
          d.log.push({ route: r.route, rev: r.rev, at: r.at, min: r.min, done, to: g.stations[idx].name, km: Math.round(km * 10) / 10 });
          d.log = d.log.slice(-25);
        });
        setEnding({ ride: r, done, km, to: g.stations[idx], names, fresh });
        setStage('ride');
        if (done) bus.emit('confetti', { big: true });
      })
      .catch(() => {
        // offline: still end the ride so the next one can start
        update((d) => {
          if (d.ride && d.ride.at === r.at) d.ride = null;
        });
        finalizing.current = null;
      });
  }, []);

  /** Is the saved ride still on the clock? If not, settle it from the session log. */
  const reconcile = useCallback(() => {
    const r = getSave().ride;
    if (!r || finalizing.current === r.at) return;
    const s = useTimer.getState();
    if (s.mode === 'focus' && s.status !== 'idle' && s.sessionStartedAt === r.at) return;
    const o = settledOutcome(r);
    if (!o) {
      // never logged (reset or under 30 s): nothing was earned, so just drop the ride
      update((d) => {
        if (d.ride && d.ride.at === r.at) d.ride = null;
      });
      return;
    }
    finalize(r, o.done, o.fraction);
  }, [finalize]);

  useEffect(() => {
    reconcile();
    const offTimer = useTimer.subscribe(reconcile);
    const offA = bus.on('session:complete', () => setTimeout(reconcile, 0));
    const offB = bus.on('session:early', () => setTimeout(reconcile, 0));
    return () => {
      offTimer();
      offA();
      offB();
    };
  }, [reconcile]);

  // a ticket was handed in: the ride starts when the timer does (after any "end current session?" question)
  useEffect(() => {
    if (pending === null) return;
    const id = setInterval(() => {
      const s = useTimer.getState();
      if (s.mode === 'focus' && s.status === 'running' && s.sessionStartedAt && s.sessionStartedAt >= pending - 2000) {
        const b = booking;
        update((d) => {
          d.ride = { route: b.route, rev: b.rev, at: s.sessionStartedAt!, min: b.min, got: 0 };
          d.side = b.side;
        });
        fracRef.current = 0;
        finalizing.current = null;
        setEnding(null);
        setPending(null);
        setStage('ride');
      } else if (!useUI.getState().confirm && Date.now() - pending > 1500) setPending(null);
    }, 200);
    return () => clearInterval(id);
  }, [pending, booking]);

  const board = () => {
    const r = routeOf(booking.route)!;
    const from = booking.rev ? r.to : r.from;
    const to = booking.rev ? r.from : r.to;
    setPending(Date.now());
    requestFocusFor(booking.min, `${r.name}: ${from} → ${to}`, undefined, '🚆');
  };

  const leave = () => {
    if (getSave().ride && useTimer.getState().status === 'running') toast({ emoji: '🚆', title: 'Your train keeps rolling', body: 'The timer keeps going. Hop back on any time.' });
    setUI({ mode: null });
  };

  const info = ride ? routeOf(ride.route) : undefined;
  const stampCount = Object.keys(save.stamps).length;

  return (
    <div className="fixed inset-0 z-[45] overflow-hidden text-[var(--tr-ink)]" style={palVars(pal)} role="dialog" aria-modal="true" aria-label="Scenic Train">
      <Carriage pal={pal} lamp={stage === 'ride' ? tod.lamp : dark ? 0.8 : 0.2} />
      <AnimatePresence mode="wait">
        {stage === 'board' && (
          <Board
            key="board"
            save={save}
            onLeave={leave}
            onBook={() => setBook(ROUTES[0].id)}
            onPick={(id) => {
              setBooking({ route: id, rev: false });
              setStage('ticket');
            }}
          />
        )}
        {stage === 'ticket' && (
          <motion.div key="ticket" className="absolute inset-0 grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TicketCard booking={booking} setBooking={setBooking} onBoard={board} onBack={() => setStage('board')} waiting={pending !== null} dark={dark} />
          </motion.div>
        )}
        {stage === 'ride' && ride && info && geo && (
          <RideView
            key={`ride-${ride.at}`}
            ride={ride}
            info={info}
            geo={geo}
            pal={pal}
            dark={dark}
            tod={tod}
            side={save.side}
            frozenKm={ending ? ending.km : null}
            fracRef={fracRef}
            stampCount={stampCount}
            covered={!!book || !!ending}
            onSide={() => update((d) => void (d.side = d.side === 'R' ? 'L' : 'R'))}
            onBook={() => setBook(ride.route)}
            onLeave={leave}
          />
        )}
        {stage === 'ride' && ride && (!geo || !info) && (
          <motion.div key="loading" className="absolute inset-0 grid place-items-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className={cn('rounded-[24px] p-6 text-center', PAPER)}>
              <p className="text-4xl">🚆</p>
              <p className="mt-1 font-display text-xl font-semibold">{geoFailed ? 'The line is not loading' : 'Finding your seat…'}</p>
              {geoFailed && <p className="mt-1 text-sm font-bold text-[var(--tr-soft)]">Check your connection. Your timer keeps going.</p>}
              <button onClick={leave} className={cn(LIGHT_BTN, 'mt-4')}>
                Back to YouFloww
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ending && info && (
          <EndCard
            key="end"
            ending={ending}
            onClose={() => setEnding(null)}
            onBook={() => setBook(ending.ride.route)}
            onAgain={() => {
              setBooking({ route: ending.ride.route, rev: ending.done ? !ending.ride.rev : ending.ride.rev, min: ending.ride.min });
              setEnding(null);
              setStage('ticket');
            }}
            onNew={() => {
              setEnding(null);
              setStage('board');
            }}
          />
        )}
      </AnimatePresence>
      {/* after closing the card the frozen ride stays on screen: offer the way out */}
      {stage === 'ride' && !save.ride && !ending && (
        <div className="absolute inset-x-0 top-[calc(max(12px,env(safe-area-inset-top))+64px)] z-[3] flex justify-center">
          <button onClick={() => setStage('board')} className={cn(DARK_BTN, 'h-11')}>
            Choose a new journey 🚉
          </button>
        </div>
      )}
      <AnimatePresence>{book && <StampBook key="book" save={save} initial={book} onClose={() => setBook(null)} />}</AnimatePresence>
    </div>
  );
}

function EndCard({ ending, onClose, onBook, onAgain, onNew }: { ending: Ending; onClose: () => void; onBook: () => void; onAgain: () => void; onNew: () => void }) {
  const info = routeOf(ending.ride.route)!;
  const stations = ending.names.slice(-6);
  const [geo, setGeo] = useState<RouteGeo | null>(null);
  useEffect(() => {
    loadRoute(info.id).then(setGeo, () => {});
  }, [info.id]);
  const motifOf = (n: string) => geo?.stations.find((s) => s.name === n)?.motif ?? 'peak';
  const stamps = getSave().stamps;
  return (
    <motion.div className="absolute inset-0 z-10 grid place-items-center bg-black/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-label={ending.done ? 'Arrived' : 'Hopped off'}
        initial={{ y: 40, scale: 0.94, rotate: -1.5 }}
        animate={{ y: 0, scale: 1, rotate: 0 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className={cn('relative w-full max-w-[460px] rounded-[26px] p-6 text-center', PAPER)}
      >
        <button onClick={onClose} aria-label="Close" className="pressable absolute top-3 right-3 grid size-9 place-items-center rounded-full hover:bg-[var(--tr-paper2)]">
          <X size={18} />
        </button>
        <p className="text-5xl">{ending.done ? '🎉' : '🌿'}</p>
        <h2 className="mt-1 font-display text-3xl leading-tight font-semibold">{ending.done ? `Welcome to ${ending.to.name}!` : `You hopped off at ${ending.to.name}`}</h2>
        <p className="mt-1 text-sm font-bold text-[var(--tr-soft)]">
          {ending.done
            ? `${Math.round(ending.km)} km on the ${info.name}, all the way. ${ending.to.note}.`
            : `${Math.round(ending.km)} km of the ${info.name}. Every kilometre counts, and your stamps are safe.`}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-1">
          {stations.map((n) => (
            <Stamp key={n} route={info.id} routeName={info.name} station={n} motif={motifOf(n)} color={info.color} at={stamps[`${info.id}:${n}`]} className="size-[64px]" />
          ))}
        </div>
        {ending.fresh.length > 0 && <p className="mt-2 text-xs font-black tracking-wide uppercase" style={{ color: info.color }}>+{ending.fresh.length} new {ending.fresh.length === 1 ? 'stamp' : 'stamps'} in your book</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={onAgain} className={cn(DARK_BTN, 'h-11 px-5')}>
            {ending.done ? 'Ride back ↩' : 'Try this line again'}
          </button>
          <button onClick={onNew} className={LIGHT_BTN}>
            New journey
          </button>
          <button onClick={onBook} className={LIGHT_BTN}>
            <BookOpen size={16} /> Stamps
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
