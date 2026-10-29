/** Passport & logbook: totals, a world map of visited countries, stamps, and the latest flights. */
import { useId, useMemo } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { countryName, flag, fmtKm, hash, type Airport } from './geo';
import type { FlightsData } from './store';
import { useCountries, WorldMap, type Route } from './WorldMap';

const INKS = ['#c4583c', '#4f7d5c', '#6b5ba8', '#2f5d8a', '#a0466a', '#b07a2a'];

export function StampArt({ iata, city, at, diverted, size = 120, className }: { iata: string; city: string; at: number; diverted?: boolean; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const h = hash(iata);
  const ink = diverted ? '#8a7f74' : INKS[h % INKS.length];
  const rot = ((h >> 4) % 25) - 12;
  const round = h % 2 === 0;
  const date = new Date(at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();
  const label = diverted ? 'DIVERTED' : 'ARRIVED';
  const name = city.toUpperCase().slice(0, 16);
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} className={className} style={{ transform: `rotate(${rot}deg)` }} role="img" aria-label={`${label} ${city} (${iata}) ${date}`}>
      <g filter="url(#ff-ink)" fill="none" stroke={ink} fontFamily="var(--font-display)">
        {round ? (
          <>
            <path id={`${id}t`} d="M24 70 A46 46 0 0 1 116 70" />
            <path id={`${id}b`} d="M20 70 A50 50 0 0 0 120 70" />
            <circle cx={70} cy={70} r={62} strokeWidth={4} />
            <circle cx={70} cy={70} r={52} strokeWidth={1.6} />
            <text fill={ink} stroke="none" fontSize={13} fontWeight={600} letterSpacing={1.5} textAnchor="middle">
              <textPath href={`#${id}t`} startOffset="50%">
                {name}
              </textPath>
            </text>
            <text x={70} y={82} fill={ink} stroke="none" fontSize={36} fontWeight={600} textAnchor="middle">
              {iata}
            </text>
            <text x={70} y={101} fill={ink} stroke="none" fontSize={10} fontWeight={700} letterSpacing={2} textAnchor="middle">
              {label}
            </text>
            <text fill={ink} stroke="none" fontSize={11} fontWeight={600} letterSpacing={1} textAnchor="middle" dy={12}>
              <textPath href={`#${id}b`} startOffset="50%">
                ✈ {date} ✈
              </textPath>
            </text>
          </>
        ) : (
          <>
            <rect x={8} y={26} width={124} height={88} rx={12} strokeWidth={4} />
            <rect x={16} y={34} width={108} height={72} rx={7} strokeWidth={1.5} />
            <text x={70} y={52} fill={ink} stroke="none" fontSize={10} fontWeight={700} letterSpacing={2} textAnchor="middle">
              {label} ✈
            </text>
            <text x={70} y={84} fill={ink} stroke="none" fontSize={34} fontWeight={600} textAnchor="middle">
              {iata}
            </text>
            <text x={70} y={99} fill={ink} stroke="none" fontSize={9.5} fontWeight={700} letterSpacing={1} textAnchor="middle">
              {name} · {date}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
      <p className="text-[10px] font-black tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="mt-0.5 font-display text-2xl leading-tight font-semibold">{value}</p>
      {sub && <p className="text-[11px] font-bold text-muted">{sub}</p>}
    </div>
  );
}

export function Passport({ data, airports, name }: { data: FlightsData; airports: Airport[]; name: string }) {
  const { paths, failed } = useCountries();
  const byIata = useMemo(() => new Map(airports.map((a) => [a.iata, a])), [airports]);
  const routes: Route[] = useMemo(
    () =>
      data.log
        .slice(-40)
        .map((e) => {
          const from = byIata.get(e.f);
          const to = byIata.get(e.l) ?? byIata.get(e.t);
          return from && to ? ({ from, to, dim: !e.ok } as Route) : null;
        })
        .filter((r): r is Route => r !== null),
    [data.log, byIata],
  );
  const dots = useMemo(() => Object.keys(data.stamps).map((k) => byIata.get(k)).filter((a): a is Airport => !!a), [data.stamps, byIata]);
  const stamps = Object.entries(data.stamps).sort((a, b) => b[1].at - a[1].at);
  const countries = Object.keys(data.countries);
  const t = data.totals;

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-3 pb-10">
      <section className="glass-strong rounded-[28px] p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#3d4f7a] text-3xl text-[#ffd66b] shadow-inner ring-2 ring-[#ffd66b]/40">🌍</div>
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.25em] text-muted uppercase">Passport · YouFloww Air</p>
            <p className="truncate font-display text-3xl font-semibold">{name}</p>
            <p className="text-xs font-bold text-muted">{data.home ? `Home airport ${data.home}` : 'No home airport yet'}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Flights" value={String(t.flights)} sub={t.flights ? `${t.landed} landed as planned` : 'none yet'} />
          <Tile label="Distance" value={fmtKm(t.km)} sub={t.km ? `${(t.km / 40075).toFixed(2)}× around the Earth` : undefined} />
          <Tile label="In the air" value={`${(t.minutes / 60).toFixed(1)} h`} sub="of real focus" />
          <Tile label="Countries" value={String(countries.length)} sub={`${stamps.length} airport stamp${stamps.length === 1 ? '' : 's'}`} />
        </div>
      </section>

      <section className="glass-strong rounded-[28px] p-3 sm:p-5">
        <p className="px-1 font-display text-xl font-semibold">Where you’ve been</p>
        <div className="mt-2 overflow-hidden rounded-2xl bg-[color-mix(in_oklab,var(--secondary)_10%,transparent)] p-1.5">
          {failed ? <p className="py-10 text-center text-sm font-bold text-muted">The map couldn’t load right now.</p> : <WorldMap paths={paths} visited={data.countries} routes={routes} dots={dots} />}
        </div>
        {countries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {countries.map((cc) => (
              <span key={cc} className="rounded-full bg-surface px-2.5 py-1 text-xs font-extrabold ring-1 ring-line">
                {flag(cc)} {countryName(cc)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[28px] bg-[#fffaf1] p-4 text-[#3b2a20] shadow-[0_20px_60px_-30px_rgb(60_30_10/0.5)] ring-2 ring-[#5b3f2c]/40 sm:p-6">
        <p className="font-display text-xl font-semibold">Stamps</p>
        {stamps.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {stamps.map(([iata, s], i) => (
              <motion.div key={iata} initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.04 }} className="grid place-items-center" title={`${byIata.get(iata)?.city ?? iata} · ${s.n} landing${s.n === 1 ? '' : 's'}`}>
                <StampArt iata={iata} city={byIata.get(iata)?.city ?? iata} at={s.at} diverted={s.div} size={104} className="h-auto w-full max-w-[110px]" />
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-2xl border-2 border-dashed border-[#5b3f2c]/25 px-4 py-8 text-center text-sm font-bold opacity-70">Your first stamp is one flight away ✈️</p>
        )}
      </section>

      {data.log.length > 0 && (
        <section className="glass-strong rounded-[28px] p-4 sm:p-5">
          <p className="font-display text-xl font-semibold">Logbook</p>
          <ul className="mt-2 divide-y divide-line">
            {[...data.log]
              .reverse()
              .slice(0, 25)
              .map((e) => (
                <li key={e.at} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-16 shrink-0 text-xs font-bold text-muted">{new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-base font-semibold">
                    {e.f} → {e.ok ? e.t : e.l} <span className="text-xs font-bold text-muted">{e.no}</span>
                  </span>
                  <span className="hidden shrink-0 text-xs font-bold text-muted sm:inline">
                    {fmtKm(e.km)} · {e.fm} min
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black', e.ok ? 'bg-[#2fbf85]/15 text-[#1f8a5f]' : 'bg-[#ffb020]/15 text-[#b07a10]')}>{e.ok ? 'Landed' : `Diverted ${e.l}`}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
