/** On the train: the window (3D satellite view or the paper route map), the clock, the next station and stamps. */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, DoorOpen, Map as MapIcon, Mountain, Pause, Play, Repeat, Square, Volume2, VolumeX } from 'lucide-react';
import { cn, haptic, prefersReducedMotion } from '@/lib/utils';
import { usePrefs } from '@/store/prefs';
import { remainingAt, useTimer } from '@/store/timer';
import { play } from '@/audio/sfx';
import { formatClock } from '@/lib/time';
import { useTimerView } from '../timer/TimerOrb';
import { requestEnd, toggle } from '../timer/engine';
import { inTunnel, passedIndex, type RouteGeo, type Station } from './geo';
import { WindowView, type MapState } from './WindowView';
import { RouteMap } from './RouteMap';
import { Stamp } from './Stamp';
import { LIGHT_BTN, PAPER, ROUND, Sill, WindowFrame, type Pal } from './Frame';
import { getSave, stamp, update, type Ride as RideT } from './journey';
import type { RouteInfo } from './routes';
import type { Tod } from './tod';

interface Props {
  ride: RideT;
  info: RouteInfo;
  geo: RouteGeo;
  pal: Pal;
  dark: boolean;
  tod: Tod;
  side: 'L' | 'R';
  /** the ride is over: the train stands still here (km) */
  frozenKm: number | null;
  /** latest fraction of the trip, for the parent's bookkeeping */
  fracRef: React.MutableRefObject<number>;
  stampCount: number;
  onSide: () => void;
  onBook: () => void;
  onLeave: () => void;
  /** nothing should cover the window (stamp landings pause while a card is open) */
  covered: boolean;
}

function useKm(ride: RideT, geo: RouteGeo, frozenKm: number | null, fracRef: React.MutableRefObject<number>) {
  const last = useRef(fracRef.current * geo.km);
  const kmNow = () => {
    if (frozenKm !== null) return frozenKm;
    const s = useTimer.getState();
    if (s.mode !== 'focus' || s.status === 'idle' || s.sessionStartedAt !== ride.at) return last.current;
    const p = Math.min(1, Math.max(0, 1 - remainingAt(s, Date.now()) / Math.max(1, s.durationMs)));
    fracRef.current = p;
    return (last.current = p * geo.km);
  };
  return kmNow;
}

const etaText = (ms: number) => (ms < 60_000 ? 'in under a minute' : `in ${Math.round(ms / 60_000)} min`);

export function RideView({ ride, info, geo, pal, dark, tod, side, frozenKm, fracRef, stampCount, onSide, onBook, onLeave, covered }: Props) {
  const t = useTimerView();
  const kmNow = useKm(ride, geo, frozenKm, fracRef);
  const km = kmNow();
  const [view, setView] = useState<'window' | 'map'>('window');
  const [mapState, setMapState] = useState<MapState>('loading');
  const [landing, setLanding] = useState<{ s: Station; key: number } | null>(null);
  const rumbleOn = usePrefs((s) => !!s.mixer.on.brown);
  const toggleTrack = usePrefs((s) => s.toggleTrack);
  const speed = geo.km / (ride.min * 60);
  const idx = passedIndex(geo, km);
  const next = geo.stations[idx + 1];
  const tunnel = inTunnel(geo, km) && view === 'window';
  const live = frozenKm === null && t.mode === 'focus' && t.status !== 'idle' && t.sessionStartedAt === ride.at;
  const from = geo.stations[0]?.name ?? info.from;
  const to = geo.stations[geo.stations.length - 1]?.name ?? info.to;

  // a station passed: stamp it (all of them, if several went by while you were away)
  useEffect(() => {
    if (!live) return;
    const r = getSave().ride;
    if (!r || r.at !== ride.at || idx + 1 <= r.got) return;
    const names = geo.stations.slice(r.got, idx + 1).map((s) => s.name);
    stamp(ride.route, names);
    update((d) => {
      if (d.ride && d.ride.at === ride.at) d.ride.got = idx + 1;
    });
    if (!document.hidden) {
      setLanding({ s: geo.stations[idx], key: Date.now() });
      play('pop');
      haptic([10, 30, 18]);
    }
  }, [idx, live, geo, ride.at, ride.route]);

  useEffect(() => {
    if (!landing) return;
    const id = setTimeout(() => setLanding(null), 3400);
    return () => clearTimeout(id);
  }, [landing]);

  const eta = next && live ? ((next.km - km) / geo.km) * t.durationMs : 0;
  const pct = Math.min(100, (km / geo.km) * 100);

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* top bar */}
      <div className="absolute inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[2] flex items-center justify-between gap-2 px-3 sm:px-4">
        <button onClick={onLeave} className={cn(LIGHT_BTN, 'h-10 shrink-0 px-3 text-sm')} title="Leave the train (your timer keeps going)">
          <DoorOpen size={16} /> <span className="hidden sm:inline">Leave train</span>
        </button>
        <div className={cn('min-w-0 truncate rounded-xl px-3 py-1.5 text-center font-display text-[15px] font-semibold sm:px-4 sm:text-base', PAPER)}>
          {info.flag} {from} → {to} <span className="hidden sm:inline">· {tod.emoji}</span>
        </div>
        <button onClick={onBook} className={cn(LIGHT_BTN, 'relative h-10 shrink-0 px-3 text-sm')} aria-label="Stamp book">
          <BookOpen size={16} /> <span className="hidden sm:inline">Stamps</span>
          <motion.span key={stampCount} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="rounded-full px-1.5 text-xs font-black text-white" style={{ background: info.color }}>
            {stampCount}
          </motion.span>
        </button>
      </div>

      {/* window + sill */}
      <div className="absolute inset-x-0 top-[calc(max(12px,env(safe-area-inset-top))+60px)] bottom-[calc(max(10px,env(safe-area-inset-bottom))+150px)] flex flex-col items-center px-3 sm:bottom-[calc(max(10px,env(safe-area-inset-bottom))+124px)]">
        <WindowFrame
          pal={pal}
          className="min-h-0 w-[min(94vw,1120px)] flex-1"
          overlay={
            <>
              {/* time of day over the landscape */}
              {view === 'window' && <div className="pointer-events-none absolute inset-0 mix-blend-multiply transition-colors duration-[3000ms]" style={{ background: tod.tint }} />}
              {view === 'window' && mapState === 'ready' && (
                <p className="pointer-events-none absolute bottom-1.5 left-3 max-w-[70%] truncate text-[9px] font-bold text-white/75 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] sm:text-[10px]">
                  © OpenStreetMap contributors · Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · Terrain: Mapzen/AWS
                </p>
              )}
              <AnimatePresence>
                {tunnel && (
                  <motion.div key="tunnel" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0d0a09]" initial={{ opacity: 0 }} animate={{ opacity: 0.94 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                    {!prefersReducedMotion() && (
                      <motion.div className="absolute top-[38%] h-[3px] w-[30%] rounded-full bg-[#ffcf7a] blur-[2px]" initial={{ x: '-40vw' }} animate={{ x: '140vw' }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} />
                    )}
                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-extrabold text-[#ffe9c7]">In a tunnel… 🌑</span>
                  </motion.div>
                )}
              </AnimatePresence>
              {view === 'window' && mapState === 'loading' && (
                <div className="absolute inset-0 grid place-items-center bg-[#c9d8c4]">
                  <motion.div className={cn('rounded-2xl px-5 py-3 text-center', PAPER)} animate={{ y: [0, -4, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
                    <p className="text-3xl">🚆</p>
                    <p className="font-display text-lg font-semibold">Pulling out of {from}…</p>
                  </motion.div>
                </div>
              )}
              {(view === 'map' || mapState === 'error') && (
                <div className="absolute inset-0 bg-[var(--tr-paper)] p-2 sm:p-3">
                  <RouteMap geo={geo} km={km} color={info.color} dark={dark} />
                  {mapState === 'error' && view === 'window' && (
                    <p className="absolute inset-x-0 bottom-3 text-center text-xs font-bold text-[var(--tr-soft)]">This device can’t draw the 3D window, so here’s your route map.</p>
                  )}
                </div>
              )}
              <AnimatePresence>
                {landing && !covered && (
                  <motion.div key={landing.key} className="pointer-events-none absolute inset-0 grid place-items-center" exit={{ opacity: 0, y: 40, scale: 0.6 }} transition={{ duration: 0.5 }}>
                    <div className="flex flex-col items-center">
                      <motion.div initial={{ scale: 2.4, opacity: 0, rotate: -25 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }} className="rounded-full bg-[#fffaf1]/90 p-2 shadow-xl">
                        <Stamp route={ride.route} routeName={info.name} station={landing.s.name} motif={landing.s.motif} color={info.color} at={Date.now()} className="size-[120px] sm:size-[140px]" />
                      </motion.div>
                      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={cn('mt-2 rounded-full px-4 py-1.5 text-center text-sm font-extrabold', PAPER)}>
                        {landing.s.name} · {landing.s.note}
                      </motion.p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          }
        >
          <WindowView geo={geo} kmNow={kmNow} speed={speed} side={side} tod={tod} active={view === 'window' && mapState !== 'error'} onState={setMapState} />
        </WindowFrame>
        <Sill pal={pal} className="w-[min(98vw,1180px)] shrink-0" />
      </div>

      {/* clock, next station, progress, controls */}
      <div className="absolute inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-[1] flex justify-center px-3">
        <div className="flex w-[min(94vw,1120px)] flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex items-center gap-3 text-[#fff6ea] sm:block sm:w-[190px] sm:shrink-0">
            <p className="tabular font-display text-[44px] leading-none font-semibold [text-shadow:0_2px_14px_rgb(20_10_5/0.45)] sm:text-[52px]">{live ? t.clock : frozenKm !== null ? '✓' : formatClock(0)}</p>
            <p className="text-[13px] leading-tight font-extrabold opacity-90">
              {t.status === 'paused' && live ? 'Stopped at a signal ⏸' : next && live ? `Next: ${next.name} · ${etaText(eta)}` : frozenKm !== null ? `${Math.round(km)} km travelled` : 'All aboard'}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-7">
              <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-black/25" />
              <div className="absolute top-1/2 left-0 h-[6px] -translate-y-1/2 rounded-full" style={{ width: `${pct}%`, background: info.color }} />
              {geo.stations.map((s, i) => (
                <span
                  key={s.name + i}
                  title={s.name}
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fffaf1]"
                  style={{ left: `${(s.km / geo.km) * 100}%`, background: s.km <= km + 0.05 ? info.color : '#5b3f2c' }}
                />
              ))}
              <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg drop-shadow" style={{ left: `${pct}%` }} aria-hidden>
                🚆
              </span>
            </div>
            <div className="flex justify-between text-[11px] font-black text-[#fff6ea] opacity-85">
              <span>{from}</span>
              <span>
                {Math.round(km)} / {Math.round(geo.km)} km
              </span>
              <span>{to}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-center gap-2">
            {live && (
              <>
                <button onClick={toggle} aria-label={t.status === 'running' ? 'Pause' : 'Resume'} title={t.status === 'running' ? 'Pause' : 'Resume'} className={ROUND}>
                  {t.status === 'running' ? <Pause size={20} /> : <Play size={20} className="translate-x-px" />}
                </button>
                <button onClick={requestEnd} aria-label="Hop off (end session)" title="Hop off (end session)" className={ROUND}>
                  <Square size={17} />
                </button>
              </>
            )}
            <button onClick={() => setView((v) => (v === 'window' ? 'map' : 'window'))} aria-label={view === 'window' ? 'Show route map' : 'Look out of the window'} title={view === 'window' ? 'Route map' : 'Window'} className={ROUND}>
              {view === 'window' ? <MapIcon size={19} /> : <Mountain size={19} />}
            </button>
            <button onClick={onSide} aria-label={`Switch to the ${side === 'R' ? 'left' : 'right'} window`} title="Switch sides" className={ROUND}>
              <Repeat size={18} />
            </button>
            <button onClick={() => toggleTrack('brown', !rumbleOn)} aria-label={rumbleOn ? 'Mute train rumble' : 'Play a soft train rumble'} title={rumbleOn ? 'Mute rumble' : 'Soft rumble (brown noise)'} className={ROUND}>
              {rumbleOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
