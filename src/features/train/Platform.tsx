/** Platform: pick a railway from the departures board, then fill in the ticket. */
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, BookOpen, DoorOpen } from 'lucide-react';
import { cn, haptic } from '@/lib/utils';
import { useData } from '@/store/data';
import { loadRoute, reverse, type RouteGeo } from './geo';
import { LENGTHS, ROUTES, type RouteInfo } from './routes';
import { RouteMap } from './RouteMap';
import { DARK_BTN, LIGHT_BTN, PAPER } from './Frame';
import type { TrainSave } from './journey';

export interface Booking {
  route: string;
  rev: boolean;
  min: number;
  side: 'L' | 'R';
}

/** A little painted-ish landscape for routes without vignette art: hills in the route's colour and a tiny train. */
export function Vignette({ r, className }: { r: RouteInfo; className?: string }) {
  if (r.art) return <img src={r.art} alt="" loading="lazy" decoding="async" className={cn('object-cover', className)} />;
  return (
    <svg viewBox="0 0 200 110" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`sky-${r.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6cf" />
          <stop offset="1" stopColor="#fff6ea" />
        </linearGradient>
      </defs>
      <rect width="200" height="110" fill={`url(#sky-${r.id})`} />
      <circle cx="158" cy="30" r="13" fill="#ffd28a" opacity="0.9" />
      <path d="M0 70L30 38 52 58 84 22 120 64 146 40 200 74V110H0Z" fill={r.color} opacity="0.35" />
      <path d="M78 30l6-8 6 8-6-2z" fill="#fff" opacity="0.8" />
      <path d="M0 84C40 66 70 70 104 80S170 72 200 64V110H0Z" fill={r.color} opacity="0.6" />
      <path d="M0 96C50 84 120 92 200 86V110H0Z" fill={r.color} />
      <path d="M18 90C60 80 120 86 182 80" fill="none" stroke="#3b2a20" strokeWidth="1.6" strokeDasharray="3 2" opacity="0.6" />
      <g transform="translate(96 74) rotate(-4)">
        <rect x="0" y="0" width="22" height="10" rx="3" fill="#fffaf1" stroke="#3b2a20" strokeWidth="1.4" />
        <rect x="24" y="0" width="18" height="10" rx="3" fill="#fffaf1" stroke="#3b2a20" strokeWidth="1.4" />
        <rect x="3" y="2.5" width="4" height="3.5" rx="1" fill={r.color} />
        <rect x="10" y="2.5" width="4" height="3.5" rx="1" fill={r.color} />
        <rect x="28" y="2.5" width="4" height="3.5" rx="1" fill={r.color} />
        <rect x="35" y="2.5" width="4" height="3.5" rx="1" fill={r.color} />
      </g>
    </svg>
  );
}

export function Board({ save, onPick, onBook, onLeave }: { save: TrainSave; onPick: (id: string) => void; onBook: () => void; onLeave: () => void }) {
  const got = (id: string) => Object.keys(save.stamps).filter((k) => k.startsWith(`${id}:`)).length;
  const total = Object.keys(save.stamps).length;
  return (
    <motion.div className="absolute inset-0 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="mx-auto max-w-[1060px] px-4 pt-[max(16px,env(safe-area-inset-top))] pb-10">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onLeave} className={cn(LIGHT_BTN, 'h-10 px-3 text-sm')}>
            <DoorOpen size={16} /> <span className="hidden sm:inline">Back to YouFloww</span>
          </button>
          <button onClick={onBook} className={cn(LIGHT_BTN, 'h-10 px-3 text-sm')}>
            <BookOpen size={16} /> Stamp book{total ? ` · ${total}` : ''}
          </button>
        </div>
        <div className="mt-6 text-center text-[#fff6ea]">
          <p className="text-[13px] font-black tracking-[0.25em] uppercase opacity-80">Platform 1 · Scenic departures</p>
          <h1 className="mt-1 font-display text-4xl font-semibold [text-shadow:0_2px_16px_rgb(40_20_10/0.4)] sm:text-5xl">Where are we riding today?</h1>
          <p className="mx-auto mt-2 max-w-[520px] text-sm font-bold opacity-85">Real railways, real landscapes. Your focus session is the ride: the train covers the whole line while you work.</p>
        </div>
        <div className="mt-7 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {ROUTES.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, type: 'spring', stiffness: 260, damping: 26 }}
              onClick={() => {
                haptic(6);
                onPick(r.id);
              }}
              className={cn('pressable group overflow-hidden rounded-[22px] text-left', PAPER)}
            >
              <div className="relative h-[108px] overflow-hidden">
                <Vignette r={r} className="size-full transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute top-2 left-2 rounded-full bg-[var(--tr-paper)]/90 px-2 py-0.5 text-xs font-black">
                  {r.flag} {r.country}
                </span>
              </div>
              <div className="p-3.5">
                <p className="font-display text-xl leading-tight font-semibold">{r.name}</p>
                <p className="mt-0.5 text-sm font-extrabold" style={{ color: r.color }}>
                  {r.from} → {r.to}
                </p>
                <p className="mt-1 text-xs font-bold text-[var(--tr-soft)]">{r.blurb}</p>
                <p className="mt-2 text-[11px] font-black tracking-wide text-[var(--tr-soft)] uppercase">
                  {r.km} km · {got(r.id)}/{r.stops} stamps
                </p>
              </div>
            </motion.button>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] font-bold text-[#fff6ea] opacity-70">Track and stations © OpenStreetMap contributors · Imagery: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · Terrain: Mapzen/AWS Terrain Tiles</p>
      </div>
    </motion.div>
  );
}

export function TicketCard({ booking, setBooking, onBoard, onBack, waiting, dark }: { booking: Booking; setBooking: (b: Partial<Booking>) => void; onBoard: () => void; onBack: () => void; waiting: boolean; dark: boolean }) {
  const r = ROUTES.find((x) => x.id === booking.route)!;
  const [geo, setGeo] = useState<RouteGeo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let on = true;
    loadRoute(r.id).then(
      (g) => on && setGeo(g),
      () => on && setFailed(true),
    );
    return () => {
      on = false;
    };
  }, [r.id]);
  const dir = useMemo(() => (geo ? (booking.rev ? reverse(geo) : geo) : null), [geo, booking.rev]);
  const from = booking.rev ? r.to : r.from;
  const to = booking.rev ? r.from : r.to;
  const no = useData((s) => s.data.totalSessions) + 1;
  const now = new Date();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      className={cn('relative w-full max-w-[760px] overflow-hidden rounded-[22px] sm:flex', PAPER)}
    >
      {/* stub */}
      <div className="relative shrink-0 p-5 text-white sm:w-[230px]" style={{ background: r.color }}>
        <p className="text-[11px] font-black tracking-[0.25em] uppercase opacity-80">Scenic Train · {r.flag}</p>
        <p className="mt-1 font-display text-2xl leading-tight font-semibold">{r.name}</p>
        <div className="mt-3 hidden h-[190px] overflow-hidden rounded-2xl bg-white/15 sm:block">{dir ? <RouteMap geo={dir} km={0} color={r.color} compact dark={dark} /> : null}</div>
        <p className="mt-3 font-mono text-[11px] font-bold opacity-85">
          No. {String(no).padStart(5, '0')} · {now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div className="flex-1 border-dashed border-[var(--tr-line)] p-5 sm:border-l-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-[0.2em] text-[var(--tr-soft)] uppercase">From</p>
            <p className="truncate font-display text-2xl font-semibold">{from}</p>
          </div>
          <button
            onClick={() => setBooking({ rev: !booking.rev })}
            aria-label="Swap direction"
            title="Ride the other way"
            className="pressable grid size-10 shrink-0 place-items-center rounded-full border-2 border-[var(--tr-line)] hover:bg-[var(--tr-paper2)]"
          >
            <ArrowLeftRight size={17} />
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[11px] font-black tracking-[0.2em] text-[var(--tr-soft)] uppercase">To</p>
            <p className="truncate font-display text-2xl font-semibold">{to}</p>
          </div>
        </div>
        <p className="mt-1 text-center text-xs font-bold text-[var(--tr-soft)]">
          {dir ? `${Math.round(dir.km)} km · ${dir.stations.length} stations to stamp` : failed ? 'Could not load this line. Check your connection.' : 'Loading the line…'}
        </p>

        <p className="mt-4 text-[11px] font-black tracking-[0.2em] text-[var(--tr-soft)] uppercase">Ride length</p>
        <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Ride length">
          {LENGTHS.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={booking.min === m}
              onClick={() => setBooking({ min: m })}
              className={cn('pressable h-10 min-w-[58px] rounded-xl border-2 px-3 text-sm font-black', booking.min === m ? 'border-transparent text-white' : 'border-[var(--tr-line)] hover:bg-[var(--tr-paper2)]')}
              style={booking.min === m ? { background: r.color } : undefined}
            >
              {m} min
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-black tracking-[0.2em] text-[var(--tr-soft)] uppercase">Window seat</p>
        <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Window side">
          {(['L', 'R'] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={booking.side === s}
              onClick={() => setBooking({ side: s })}
              className={cn('pressable h-10 flex-1 rounded-xl border-2 px-3 text-sm font-black', booking.side === s ? 'border-transparent text-white' : 'border-[var(--tr-line)] hover:bg-[var(--tr-paper2)]')}
              style={booking.side === s ? { background: r.color } : undefined}
            >
              {s === 'L' ? '◧ Left side' : 'Right side ◨'}
            </button>
          ))}
        </div>

        <button onClick={onBoard} disabled={!dir || waiting} className={cn(DARK_BTN, 'mt-5 w-full')}>
          {waiting ? 'Waiting for the timer…' : 'Board the train 🚆'}
        </button>
        <button onClick={onBack} className="pressable mt-2 w-full rounded-xl py-2 text-sm font-extrabold opacity-60 hover:opacity-100">
          ← other routes
        </button>
      </div>
    </motion.div>
  );
}
