/** The boarding pass (paper, same in every theme) with a little seat map. */
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Armchair, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Barcode } from './Barcode';
import { flag, fmtKm, fmtMin, hash, localTime, type Airport } from './geo';

export interface PassInfo {
  from: Airport;
  to: Airport;
  km: number;
  min: number;
  no: string;
  gate: string;
  seat: string;
  name: string;
}

const ROWS = Array.from({ length: 12 }, (_, i) => 10 + i);
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function takenSeats(no: string) {
  const out = new Set<string>();
  for (const r of ROWS) for (const l of LETTERS) if (hash(`${no}${r}${l}`) % 100 < 38) out.add(`${r}${l}`);
  return out;
}
/** A free window seat for this flight. */
export function defaultSeat(no: string) {
  const taken = takenSeats(no);
  const h = hash(no);
  for (let i = 0; i < ROWS.length * 2; i++) {
    const s = `${ROWS[(h + i) % ROWS.length]}${i % 2 ? 'F' : 'A'}`;
    if (!taken.has(s)) return s;
  }
  return '14A';
}
export const defaultGate = (no: string, day = new Date().toDateString()) => `${'ABCDE'[hash(no + day) % 5]}${1 + (hash(day + no) % 38)}`;

function Field({ label, value, big, className }: { label: string; value: string; big?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[10px] font-black tracking-[0.14em] uppercase opacity-55">{label}</p>
      <p className={cn('truncate font-display font-semibold', big ? 'text-2xl' : 'text-lg leading-tight')}>{value}</p>
    </div>
  );
}

function SeatMap({ no, seat, onPick }: { no: string; seat: string; onPick: (s: string) => void }) {
  const taken = useMemo(() => takenSeats(no), [no]);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="mx-auto flex w-max items-center gap-1 rounded-l-[90px] rounded-r-3xl border-2 border-[#5b3f2c]/40 bg-white/70 py-3 pr-4 pl-10">
        <div className="mr-2 flex flex-col items-center gap-1 self-start text-[10px] font-black opacity-50">
          {LETTERS.map((l, i) => (
            <span key={l} className={cn('grid h-6 place-items-center sm:h-7', i === 3 && 'mt-3')}>
              {l}
            </span>
          ))}
        </div>
        {ROWS.map((r) => (
          <div key={r} className="flex flex-col items-center gap-1">
            {LETTERS.map((l, i) => {
              const id = `${r}${l}`;
              const on = id === seat;
              const busy = taken.has(id) && !on;
              const win = l === 'A' || l === 'F';
              return (
                <button
                  key={id}
                  disabled={busy}
                  onClick={() => onPick(id)}
                  aria-label={`Seat ${id}${win ? ', window' : ''}${busy ? ', taken' : ''}`}
                  aria-pressed={on}
                  className={cn(
                    'pressable grid size-6 place-items-center rounded-md border text-[9px] font-black transition-colors sm:size-7',
                    i === 3 && 'mt-3',
                    on ? 'border-[#e07a5f] bg-[#e07a5f] text-white' : busy ? 'cursor-not-allowed border-transparent bg-[#5b3f2c]/15 text-transparent' : win ? 'border-[#5b9bd5]/60 bg-[#e3f1fb] hover:bg-[#cfe7f8]' : 'border-[#5b3f2c]/30 bg-white hover:bg-[#fff1e0]',
                  )}
                >
                  {on ? <Armchair size={13} /> : ''}
                </button>
              );
            })}
            <span className="mt-0.5 text-[9px] font-black opacity-50">{r}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold opacity-60">
        <span className="mr-1 inline-block size-2.5 rounded-sm border border-[#5b9bd5]/60 bg-[#e3f1fb]" /> window seats look out at the clouds
      </p>
    </div>
  );
}

export function BoardingPass({ info, onSeat, scanned }: { info: PassInfo; onSeat: (s: string) => void; scanned?: boolean }) {
  const [seatOpen, setSeatOpen] = useState(false);
  const { from, to } = info;
  const now = Date.now();
  const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: from.tz }).format(now);
  const code = `${info.no} ${from.iata}${to.iata} ${info.seat}`;
  return (
    <div className="w-full max-w-[780px] text-[#3b2a20]">
      <motion.div
        initial={{ y: 40, opacity: 0, rotate: -2 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        className="relative flex flex-col overflow-hidden rounded-[22px] bg-[#fffaf1] shadow-[0_30px_80px_-30px_rgb(60_30_10/0.65)] ring-2 ring-[#5b3f2c]/60 sm:flex-row"
      >
        {/* main part */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 bg-[#e07a5f] px-5 py-2.5 text-[#fffaf1]">
            <span className="flex items-center gap-2 font-display text-lg font-semibold whitespace-nowrap">
              <Plane size={18} className="-rotate-45" /> YouFloww Air
            </span>
            <span className="text-right text-[10px] font-black tracking-[0.18em] uppercase sm:text-[11px]">
              Boarding pass<span className="hidden sm:inline"> · Focus class</span>
            </span>
          </div>
          <div className="px-5 pt-4 pb-5">
            <Field label="Passenger" value={info.name.toUpperCase()} />
            <div className="mt-3 flex items-center gap-3">
              <div className="min-w-0">
                <p className="font-display text-5xl leading-none font-semibold sm:text-6xl">{from.iata}</p>
                <p className="truncate text-sm font-bold opacity-70">
                  {flag(from.cc)} {from.city}
                </p>
              </div>
              <div className="relative mx-1 h-6 min-w-10 flex-1">
                <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-[#5b3f2c]/40" />
                <Plane size={22} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#fffaf1] px-0.5 text-[#e07a5f]" />
              </div>
              <div className="min-w-0 text-right">
                <p className="font-display text-5xl leading-none font-semibold sm:text-6xl">{to.iata}</p>
                <p className="truncate text-sm font-bold opacity-70">
                  {flag(to.cc)} {to.city}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Field label="Flight" value={info.no} />
              <Field label="Date" value={date} />
              <Field label="Gate" value={info.gate} />
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] uppercase opacity-55">Seat</p>
                <button onClick={() => setSeatOpen((v) => !v)} aria-expanded={seatOpen} className="pressable -ml-1 rounded-lg px-1 font-display text-lg leading-tight font-semibold text-[#c4583c] underline decoration-dashed underline-offset-4">
                  {info.seat}
                </button>
              </div>
              <Field label="Boards" value="Now" />
              <Field label={`Departs (${from.iata})`} value={localTime(from.tz, now)} />
              <Field label={`Arrives (${to.iata})`} value={localTime(to.tz, now + info.min * 60_000)} />
              <Field label="Flight time" value={fmtMin(info.min)} />
            </div>
            <p className="mt-3 text-xs font-bold opacity-55">
              {fmtKm(info.km)} great-circle · the flight is your focus session
            </p>
          </div>
        </div>
        {/* perforation */}
        <div className="h-0 border-t-2 border-dashed border-[#5b3f2c]/35 sm:h-auto sm:w-0 sm:border-t-0 sm:border-l-2" />
        {/* stub */}
        <div className="flex flex-col gap-2 bg-[#fff3e2] px-5 py-4 sm:w-[210px]">
          <div className="flex items-baseline justify-between gap-2 font-display font-semibold">
            <span className="text-xl">
              {from.iata} → {to.iata}
            </span>
            <span className="text-sm opacity-70">{info.no}</span>
          </div>
          <div className="flex justify-between gap-2 text-sm font-bold">
            <span>Seat {info.seat}</span>
            <span>Gate {info.gate}</span>
          </div>
          <p className="truncate text-xs font-bold opacity-60">{info.name.toUpperCase()}</p>
          <p className="text-xs font-bold opacity-60">Group 1 · {/[AF]$/.test(info.seat) ? 'Window' : /[CD]$/.test(info.seat) ? 'Aisle' : 'Middle'} seat</p>
          <div className="relative mt-auto">
            <Barcode text={code} className="h-14 w-full" />
            <p className="mt-1 text-center font-mono text-[10px] font-bold tracking-widest opacity-60">{code}</p>
            {scanned && (
              <motion.div
                initial={{ scale: 2, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: -14 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                className="absolute inset-0 grid place-items-center"
              >
                <span className="rounded-lg border-[3px] border-[#2f8f6b] bg-[#fffaf1]/80 px-3 py-1 font-display text-xl font-semibold tracking-widest text-[#2f8f6b] uppercase">Boarded</span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
      {seatOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-[20px] bg-[#fffaf1] p-3 shadow-lg ring-2 ring-[#5b3f2c]/40">
          <p className="mb-2 text-center font-display text-lg font-semibold">Pick your seat</p>
          <SeatMap
            no={info.no}
            seat={info.seat}
            onPick={(s) => {
              onSeat(s);
              setSeatOpen(false);
            }}
          />
        </motion.div>
      )}
    </div>
  );
}
