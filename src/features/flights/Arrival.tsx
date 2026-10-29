/** Touchdown: welcome card, a fresh passport stamp, distance flown, new-country badge. */
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { BookOpen, Home, PlaneTakeoff } from 'lucide-react';
import { cn, haptic } from '@/lib/utils';
import { countryName, flag, fmtKm, localTime, skyAt, type Airport } from './geo';
import { StampArt } from './Passport';
import { SkyScene } from './Scenes';
import { stampThunk } from './sounds';

export interface ArrivalInfo {
  kind: 'landed' | 'diverted' | 'cancelled';
  from: Airport;
  to: Airport;
  at: Airport;
  km: number;
  minutes: number;
  no: string;
  newCountry: string | null;
  coins: number;
  /** finished while the mode was closed */
  away?: boolean;
}

const BTN = 'pressable inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold';

export function Arrival({ info, home, onOnward, onHome, onPassport, onLeave }: { info: ArrivalInfo; home: string | null; onOnward: () => void; onHome: () => void; onPassport: () => void; onLeave: () => void }) {
  const { kind, at } = info;
  useEffect(() => {
    if (kind === 'cancelled') return;
    const id = setTimeout(() => {
      stampThunk();
      haptic([12, 30, 18]);
    }, 650);
    return () => clearTimeout(id);
  }, [kind]);

  const title = kind === 'landed' ? `Welcome to ${at.city}!` : kind === 'diverted' ? `Diverted to ${at.city}` : 'Back at the gate';
  const sub =
    kind === 'landed'
      ? info.away
        ? 'You landed while you were away. Smooth touchdown.'
        : 'Smooth touchdown. Seatbelt sign is off.'
      : kind === 'diverted'
        ? 'A gentle early landing. Every kilometre still counts.'
        : 'This flight didn’t take off, and that’s okay. Ready when you are.';

  return (
    <motion.div className="absolute inset-0 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <SkyScene sky={skyAt(at.tz)} className="fixed" />
      <div className="relative grid min-h-full place-items-center px-4 py-[max(72px,calc(env(safe-area-inset-top)+64px))]">
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="w-full max-w-[460px] rounded-[30px] bg-[#fffaf1] p-5 text-center text-[#3b2a20] shadow-[0_30px_80px_-30px_rgb(60_30_10/0.7)] ring-2 ring-[#5b3f2c]/60 sm:p-7"
        >
          <p className="text-4xl">{kind === 'landed' ? '🛬' : kind === 'diverted' ? '🌤️' : '🧳'}</p>
          <h2 className="mt-1 font-display text-3xl leading-tight font-semibold">{title}</h2>
          <p className="mt-1 text-sm font-bold opacity-70">{sub}</p>
          {kind !== 'cancelled' && (
            <p className="mt-2 text-sm font-extrabold">
              {flag(at.cc)} It’s {localTime(at.tz)} in {at.city}
            </p>
          )}

          {kind !== 'cancelled' && (
            <div className="relative mx-auto mt-3 grid h-[150px] place-items-center">
              <motion.div initial={{ scale: 2.4, opacity: 0, y: -30 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay: 0.45, type: 'spring', stiffness: 420, damping: 18 }}>
                <StampArt iata={at.iata} city={at.city} at={Date.now()} diverted={kind === 'diverted'} size={150} />
              </motion.div>
            </div>
          )}

          {kind !== 'cancelled' && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ['Flown', fmtKm(info.km)],
                ['Focused', `${info.minutes} min`],
                ['Flight', info.no],
              ].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-[#fff1e0] px-2 py-2">
                  <p className="text-[10px] font-black tracking-[0.14em] uppercase opacity-55">{l}</p>
                  <p className="font-display text-lg leading-tight font-semibold">{v}</p>
                </div>
              ))}
            </div>
          )}

          {(info.newCountry || info.coins > 0) && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {info.newCountry && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={{ delay: 1, duration: 0.5 }} className="rounded-full bg-[#e07a5f] px-3 py-1.5 text-sm font-extrabold text-white shadow-md">
                  New country! {flag(info.newCountry)} {countryName(info.newCountry)}
                </motion.span>
              )}
              {info.coins > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={{ delay: 1.2, duration: 0.5 }} className="rounded-full bg-[#ffe6a8] px-3 py-1.5 text-sm font-extrabold shadow-sm">
                  +{info.coins} 🐟 flight bonus
                </motion.span>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button onClick={onOnward} className={cn(BTN, 'h-12 bg-[#3b2a20] text-[#fff6ea] hover:bg-[#4a3529]')}>
              <PlaneTakeoff size={18} /> {kind === 'cancelled' ? 'Plan another flight' : `Fly onward from ${at.iata}`}
            </button>
            <div className="flex flex-wrap justify-center gap-2">
              {home && home !== at.iata && (
                <button onClick={onHome} className={cn(BTN, 'border-2 border-[#5b3f2c]/40 bg-white hover:bg-[#fff1e0]')}>
                  <Home size={16} /> Fly home
                </button>
              )}
              <button onClick={onPassport} className={cn(BTN, 'border-2 border-[#5b3f2c]/40 bg-white hover:bg-[#fff1e0]')}>
                <BookOpen size={16} /> Passport
              </button>
              <button onClick={onLeave} className={cn(BTN, 'opacity-70 hover:opacity-100')}>
                Back to YouFloww
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
