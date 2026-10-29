/** Pick where you fly from and to, or how long you want to focus and see where that gets you. */
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { Home, MapPin, Search, Star, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countryName, distanceKm, flag, flightMinutes, fmtKm, fmtMin, kmForMinutes, localTime, MAX_MIN, reachable, searchAirports, type Airport } from './geo';

const PRESETS = [15, 25, 45, 60, 90, 120, 180];
const HUBS = ['DEL', 'BOM', 'BLR', 'LHR', 'JFK', 'DXB', 'SIN', 'HND', 'CDG', 'SYD'];

function AirportRow({ a, right, onClick, disabled }: { a: Airport; right?: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="pressable flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-accent-soft disabled:opacity-45">
      <span className="text-2xl leading-none">{flag(a.cc)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[17px] font-semibold">
          {a.city} <span className="text-muted">({a.iata})</span>
        </span>
        <span className="block truncate text-xs font-bold text-muted">
          {a.name} · {countryName(a.cc)}
        </span>
      </span>
      {right}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder, autoFocus, label }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; label: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="h-12 w-full rounded-2xl border border-line bg-surface-strong pr-10 pl-10 text-base font-bold text-ink outline-none placeholder:text-faint focus:border-accent"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear" className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-muted hover:bg-line">
          <X size={16} />
        </button>
      )}
    </label>
  );
}

function TimeChip({ min, km }: { min: number; km: number }) {
  const over = min > MAX_MIN;
  return (
    <span className="shrink-0 text-right">
      <span className={cn('block rounded-full px-2.5 py-0.5 font-display text-sm font-semibold', over ? 'bg-line text-muted' : 'bg-accent-soft text-ink')}>{fmtMin(min)}</span>
      <span className="mt-0.5 block text-[11px] font-bold text-muted">{over ? 'over 3 h' : fmtKm(km)}</span>
    </span>
  );
}

export function Planner({
  airports,
  from,
  homeIata,
  onFrom,
  onSetHome,
  onPick,
}: {
  airports: Airport[];
  from: Airport | null;
  homeIata: string | null;
  onFrom: (a: Airport) => void;
  onSetHome: (a: Airport) => void;
  onPick: (to: Airport) => void;
}) {
  const [changing, setChanging] = useState(!from);
  const [fq, setFq] = useState('');
  const [tab, setTab] = useState<'where' | 'time'>('time');
  const [q, setQ] = useState('');
  const [minutes, setMinutes] = useState(45);
  const [to, setTo] = useState<Airport | null>(null);

  const fromResults = useMemo(() => searchAirports(airports, fq, 8), [airports, fq]);
  const nearMe = useMemo(() => {
    if (fq) return [];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const local = airports.filter((a) => a.tz === tz && a.big).slice(0, 8);
    if (local.length) return local;
    return HUBS.map((i) => airports.find((a) => a.iata === i)).filter((a): a is Airport => !!a);
  }, [airports, fq]);
  const results = useMemo(() => (from ? searchAirports(airports, q, 10).filter((a) => a.iata !== from.iata) : []), [airports, q, from]);
  const reach = useMemo(() => (from ? reachable(airports, from, minutes, 24) : []), [airports, from, minutes]);
  const ideas = useMemo(() => {
    if (!from) return [];
    const out: { a: Airport; min: number; km: number }[] = [];
    for (const m of [25, 45, 75, 120, 180]) {
      const r = reachable(airports, from, m, 6).find((x) => x.a.big && !out.some((o) => o.a.iata === x.a.iata)) ?? reachable(airports, from, m, 6)[0];
      if (r) out.push(r);
    }
    return out;
  }, [airports, from]);

  const pickTo = (a: Airport) => setTo(a);
  const toKm = from && to ? distanceKm(from, to) : 0;
  const toMin = flightMinutes(toKm);

  return (
    <div className="mx-auto w-full max-w-[760px] pb-36">
      {!from && (
        <div className="mb-4 flex flex-col items-center px-4 pt-2 text-center">
          <svg viewBox="0 0 260 90" className="w-[min(78vw,320px)]" aria-hidden>
            <path d="M14 74 Q130 -6 246 52" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
            <circle cx="14" cy="74" r="7" fill="var(--surface-strong)" stroke="var(--ink)" strokeWidth="2.5" />
            <circle cx="246" cy="52" r="7" fill="var(--primary)" stroke="var(--ink)" strokeWidth="2.5" />
            <g transform="translate(150 24) rotate(18) scale(0.62)">
              <path d="M0 -30 C4 -30 5 -24 5 -18 L5 -6 L30 6 L30 11 L5 5 L4 20 L12 26 L12 30 L0 27 L-12 30 L-12 26 L-4 20 L-5 5 L-30 11 L-30 6 L-5 -6 L-5 -18 C-5 -24 -4 -30 0 -30 Z" fill="#fffaf1" stroke="#5b3f2c" strokeWidth="2.6" strokeLinejoin="round" transform="rotate(90)" />
            </g>
          </svg>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Every focus session is a real flight</h1>
          <p className="mt-1 max-w-[460px] text-sm font-bold text-muted">Pick a city, board, and watch your plane cross the globe while you work. Land, get a passport stamp, fly on.</p>
        </div>
      )}
      {/* from */}
      <section className="glass-strong rounded-[28px] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-black tracking-[0.14em] text-muted uppercase">
            <MapPin size={14} /> Flying from
          </p>
          {from && homeIata !== from.iata && (
            <button onClick={() => onSetHome(from)} className="pressable flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold text-muted hover:bg-line hover:text-ink">
              <Star size={13} /> Make this my home airport
            </button>
          )}
          {from && homeIata === from.iata && (
            <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-extrabold">
              <Home size={13} /> Home
            </span>
          )}
        </div>
        {from && !changing ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-4xl leading-none">{flag(from.cc)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-2xl font-semibold">
                {from.city} <span className="text-muted">{from.iata}</span>
              </p>
              <p className="truncate text-sm font-bold text-muted">
                {from.name} · {localTime(from.tz)} there
              </p>
            </div>
            <button onClick={() => setChanging(true)} className="pressable h-10 shrink-0 rounded-2xl bg-accent-soft px-4 text-sm font-extrabold">
              Change
            </button>
          </div>
        ) : (
          <div className="mt-3">
            {!from && <p className="mb-2 font-display text-xl font-semibold">Where’s your home airport?</p>}
            <SearchBox value={fq} onChange={setFq} placeholder="City or airport code" autoFocus label="Search departure airport" />
            <div className="mt-2 max-h-[300px] overflow-y-auto">
              {(fq ? fromResults : nearMe).map((a) => (
                <AirportRow
                  key={a.iata}
                  a={a}
                  onClick={() => {
                    onFrom(a);
                    if (!homeIata) onSetHome(a);
                    setChanging(false);
                    setFq('');
                    setTo(null);
                  }}
                />
              ))}
              {fq && !fromResults.length && <p className="px-3 py-4 text-sm font-bold text-muted">No airport found. Try a city name or a 3-letter code.</p>}
              {!fq && nearMe.length > 0 && <p className="px-3 pt-1 text-[11px] font-bold text-faint">Suggestions: search for any city or code</p>}
            </div>
            {from && (
              <button onClick={() => setChanging(false)} className="pressable mt-1 w-full rounded-xl py-2 text-sm font-extrabold text-muted hover:text-ink">
                Keep {from.city}
              </button>
            )}
          </div>
        )}
      </section>

      {from && (
        <section className="glass-strong mt-3 rounded-[28px] p-4 sm:p-5">
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-line p-1">
            {(
              [
                ['time', 'How long?', Timer],
                ['where', 'Where to?', Search],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn('pressable flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-colors', tab === id ? 'bg-surface-strong text-ink shadow-sm' : 'text-muted hover:text-ink')}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {tab === 'time' ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-xl font-semibold">Focus for {fmtMin(minutes)}</p>
                <p className="text-xs font-bold text-muted">≈ {fmtKm(kmForMinutes(minutes))} away</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.map((m) => (
                  <button key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className={cn('pressable h-9 rounded-full px-3.5 text-sm font-extrabold', minutes === m ? 'bg-accent text-accent-ink' : 'bg-line hover:bg-accent-soft')}>
                    {fmtMin(m)}
                  </button>
                ))}
              </div>
              <input type="range" min={15} max={180} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Session length in minutes" className="mt-3 w-full accent-[var(--accent)]" />
              {reach.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {reach.map((r) => {
                    const on = to?.iata === r.a.iata;
                    return (
                      <button
                        key={r.a.iata}
                        onClick={() => pickTo(r.a)}
                        aria-pressed={on}
                        className={cn('pressable flex flex-col rounded-2xl border p-3 text-left transition-colors', on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-strong')}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-2xl leading-none">{flag(r.a.cc)}</span>
                          <span className="font-display text-sm font-semibold text-muted">{r.a.iata}</span>
                        </span>
                        <span className="mt-1.5 truncate font-display text-lg leading-tight font-semibold">{r.a.city}</span>
                        <span className="truncate text-xs font-bold text-muted">{countryName(r.a.cc)}</span>
                        <span className="mt-2 flex items-center justify-between gap-1 text-xs font-extrabold">
                          <span>{fmtMin(r.min)}</span>
                          <span className="text-muted">{fmtKm(r.km)}</span>
                        </span>
                        <span className="text-[11px] font-bold text-faint">{localTime(r.a.tz)} local</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-line px-4 py-6 text-center text-sm font-bold text-muted">
                  No airports about {fmtMin(minutes)} from {from.city}. {minutes < 30 ? 'Try a little longer, or search a nearby city.' : 'Try another length.'}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <SearchBox value={q} onChange={setQ} placeholder="Search a city, airport or code" label="Search destination" />
              <div className="mt-2">
                {(q ? results.map((a) => ({ a, km: distanceKm(from, a) })) : ideas.map((x) => ({ a: x.a, km: x.km }))).map(({ a, km }) => {
                  const min = flightMinutes(km);
                  return <AirportRow key={a.iata} a={a} onClick={() => pickTo(a)} disabled={min > MAX_MIN} right={<TimeChip min={min} km={km} />} />;
                })}
                {!q && <p className="px-3 pt-1 text-[11px] font-bold text-faint">Ideas from {from.city}: short hop to long haul</p>}
                {q && !results.length && <p className="px-3 py-4 text-sm font-bold text-muted">Nothing found. Try a city name or a 3-letter code.</p>}
              </div>
            </div>
          )}
        </section>
      )}

      {/* chosen flight */}
      <AnimatePresence>
        {from && to && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-10 flex justify-center px-3"
          >
            <div className="glass-strong flex w-full max-w-[760px] items-center gap-3 rounded-[24px] p-3 pl-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-semibold">
                  {from.iata} → {to.iata} <span className="text-base">{flag(to.cc)}</span>
                </p>
                <p className="truncate text-xs font-bold text-muted">
                  {to.city} · {fmtMin(toMin)} · {fmtKm(toKm)}
                  {toMin > MAX_MIN && ' · too long for one session (max 3 h)'}
                </p>
              </div>
              <button onClick={() => onPick(to)} disabled={toMin > MAX_MIN} className="pressable h-12 shrink-0 rounded-2xl bg-accent px-5 font-extrabold text-accent-ink shadow-[0_10px_30px_-10px_var(--accent)] disabled:opacity-50">
                Get boarding pass
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
