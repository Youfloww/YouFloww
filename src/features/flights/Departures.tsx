/** A split-flap departures board: everyone's recent flights (anonymous) and your own. */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { flightNo, type Airport } from './geo';
import { fetchPublicFlights, type PublicFlight } from './publicBoard';
import type { LogEntry } from './store';

interface Row {
  key: string;
  time: string;
  no: string;
  from: string;
  to: string;
  status: string;
  tone: 'air' | 'ok' | 'div' | 'dim';
}

const clean = (s: string, n: number) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .-]/g, '')
    .slice(0, n)
    .padEnd(n, ' ');

function Flaps({ text, delay, className }: { text: string; delay: number; className?: string }) {
  return (
    <span className={cn('inline-flex', className)} aria-label={text.trim()}>
      {[...text].map((ch, i) => (
        <span key={`${i}${ch}`} className="ff-flap" style={{ animationDelay: `${delay + i * 0.035}s` }} aria-hidden>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function Departures({ airports, mine }: { airports: Airport[]; mine: LogEntry[] }) {
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [pub, setPub] = useState<PublicFlight[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const byIata = useMemo(() => new Map(airports.map((a) => [a.iata, a])), [airports]);
  const city = (iata: string) => byIata.get(iata)?.city ?? iata;

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      fetchPublicFlights(14)
        .then((r) => {
          if (!live) return;
          setPub(r);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    };
    load();
    const id = setInterval(() => {
      setNow(Date.now());
      load();
    }, 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  const mineRows: Row[] = useMemo(
    () =>
      [...mine]
        .reverse()
        .slice(0, 10)
        .map((e) => ({ key: `m${e.at}`, time: hhmm(e.at), no: e.no, from: e.f, to: city(e.t), status: e.ok ? 'LANDED' : `DIV ${e.l}`, tone: e.ok ? 'ok' : 'div' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mine, byIata],
  );
  const pubRows: Row[] = useMemo(
    () =>
      (pub ?? []).slice(0, 12).map((p) => {
        // the board can't know whether it landed, was diverted or cancelled: only say it left
        const fresh = now < p.createdAt + p.minutes * 60_000;
        return { key: p.id, time: hhmm(p.createdAt), no: flightNo(p.from, p.to), from: p.from, to: city(p.to), status: fresh ? 'BOARDED' : 'DEPARTED', tone: fresh ? 'air' : 'dim' };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pub, now, byIata],
  );
  const showAll = tab === 'all' && !failed && pubRows.length > 0;
  const rows = tab === 'mine' || !showAll ? mineRows : pubRows;

  return (
    <div className="ff-board overflow-hidden rounded-[22px] p-3 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/10 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-2xl font-semibold text-[#ffd66b]">
          <span aria-hidden>🛫</span> Departures
        </p>
        <div className="flex gap-1 rounded-xl bg-white/8 p-1 text-xs font-extrabold" role="tablist">
          {(
            [
              ['all', 'Everyone'],
              ['mine', 'My flights'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('pressable rounded-lg px-3 py-1.5', tab === id ? 'bg-[#ffd66b] text-[#1d1d24]' : 'text-white/70 hover:text-white')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto [perspective:600px]">
        <div className="grid w-max min-w-full grid-cols-[auto_auto_auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-[12px] sm:gap-x-4 sm:text-[15px]">
          {['Time', 'Flight', 'From', 'To', 'Status'].map((h) => (
            <span key={h} className="text-[10px] font-black tracking-[0.2em] text-white/45 uppercase">
              {h}
            </span>
          ))}
          {rows.map((r, i) => (
            <div key={r.key + tab} className="contents">
              <Flaps text={r.time} delay={i * 0.07} />
              <Flaps text={clean(r.no, 6)} delay={i * 0.07 + 0.1} />
              <Flaps text={r.from} delay={i * 0.07 + 0.15} />
              <Flaps text={clean(r.to, 11)} delay={i * 0.07 + 0.2} className="text-white" />
              <Flaps text={clean(r.status, 8)} delay={i * 0.07 + 0.3} className={cn(r.tone === 'air' && 'ff-blink text-[#7cf2b1]', r.tone === 'ok' && 'text-[#7cf2b1]', r.tone === 'div' && 'text-[#ffb38a]', r.tone === 'dim' && 'text-white/60')} />
            </div>
          ))}
        </div>
        {!rows.length && <p className="py-8 text-center text-sm font-bold text-white/60">{tab === 'mine' ? 'No flights yet. Your first one will show up here.' : 'The board is quiet right now.'}</p>}
      </div>
      <p className="mt-3 text-[11px] font-bold text-white/45">
        {tab === 'all'
          ? failed || (pub && !pub.length)
            ? 'The public board is resting right now, so you’re seeing your own flights.'
            : pub
              ? 'Everyone’s recent flights. Anonymous: just the route and the length.'
              : 'Fetching the board…'
          : 'Your latest flights, newest first.'}
      </p>
    </div>
  );
}
