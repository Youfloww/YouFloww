/** The stamp book: one page per railway, every station a stamp to collect, plus the journey log. */
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadRoute, type RouteGeo } from './geo';
import { ROUTES, routeOf } from './routes';
import { EmptyStamp, Stamp } from './Stamp';
import { PAPER } from './Frame';
import { stampId, type TrainSave } from './journey';

export function StampBook({ save, initial, onClose }: { save: TrainSave; initial?: string; onClose: () => void }) {
  const [tab, setTab] = useState(initial ?? ROUTES[0].id);
  const [geo, setGeo] = useState<RouteGeo | null>(null);
  const [failed, setFailed] = useState(false);
  const r = routeOf(tab)!;
  useEffect(() => {
    let on = true;
    setGeo(null);
    setFailed(false);
    loadRoute(tab).then(
      (g) => on && setGeo(g),
      () => on && setFailed(true),
    );
    return () => {
      on = false;
    };
  }, [tab]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    addEventListener('keydown', k, true);
    return () => removeEventListener('keydown', k, true);
  }, [onClose]);

  const total = Object.keys(save.stamps).length;
  const count = (id: string) => Object.keys(save.stamps).filter((k) => k.startsWith(`${id}:`)).length;
  const log = [...save.log].reverse().slice(0, 8);

  return (
    <motion.div className="absolute inset-0 z-20 grid place-items-center bg-black/35 p-3 backdrop-blur-[3px] sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Stamp book"
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className={cn('flex max-h-[calc(100dvh-24px)] w-full max-w-[880px] flex-col overflow-hidden rounded-[26px]', PAPER)}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Stamp book</h2>
            <p className="text-sm font-bold text-[var(--tr-soft)]">
              {total} {total === 1 ? 'stamp' : 'stamps'} · {Math.round(save.km).toLocaleString()} km by train · {save.log.length} {save.log.length === 1 ? 'journey' : 'journeys'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close stamp book" className="pressable grid size-10 place-items-center rounded-full border-2 border-[var(--tr-line)] hover:bg-[var(--tr-paper2)]">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:thin]" role="tablist" aria-label="Railways">
          {ROUTES.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={cn('pressable shrink-0 rounded-full border-2 px-3 py-1.5 text-sm font-extrabold whitespace-nowrap', tab === x.id ? 'border-transparent text-white' : 'border-[var(--tr-line)] hover:bg-[var(--tr-paper2)]')}
              style={tab === x.id ? { background: x.color } : undefined}
            >
              {x.flag} {x.name} <span className="opacity-75">{count(x.id) || ''}</span>
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t-2 border-dashed border-[var(--tr-line)] bg-[var(--tr-paper2)]/50 p-4 sm:p-5">
          <p className="mb-3 text-sm font-extrabold" style={{ color: r.color }}>
            {r.from} ⇄ {r.to} · {r.blurb}
          </p>
          {!geo && <p className="py-10 text-center text-sm font-bold text-[var(--tr-soft)]">{failed ? 'Could not load this railway. Check your connection.' : 'Opening the page…'}</p>}
          {geo && (
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 min-[520px]:grid-cols-4 md:grid-cols-6">
              {geo.stations.map((s) => {
                const at = save.stamps[stampId(r.id, s.name)];
                return (
                  <div key={s.name} className="flex flex-col items-center text-center" title={s.note}>
                    {at ? <Stamp route={r.id} routeName={r.name} station={s.name} motif={s.motif} color={r.color} at={at} className="size-[86px] sm:size-[96px]" /> : <EmptyStamp station={s.name} className="size-[86px] text-[var(--tr-soft)] sm:size-[96px]" />}
                    <span className={cn('mt-1 text-xs leading-tight font-extrabold', !at && 'opacity-55')}>{s.name}</span>
                  </div>
                );
              })}
            </div>
          )}
          {log.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-black tracking-[0.2em] text-[var(--tr-soft)] uppercase">Recent journeys</p>
              <ul className="mt-2 space-y-1.5">
                {log.map((t) => {
                  const ro = routeOf(t.route);
                  if (!ro) return null;
                  const from = t.rev ? ro.to : ro.from;
                  return (
                    <li key={t.at} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--tr-paper)] px-3 py-2 text-sm font-bold">
                      <span className="min-w-0 truncate">
                        {ro.flag} {from} → {t.to} {t.done ? '🎉' : '🌿'}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--tr-soft)]">
                        {Math.round(t.km)} km · {t.min} min · {new Date(t.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
