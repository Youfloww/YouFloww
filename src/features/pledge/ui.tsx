import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/time';
import type { DayProgress, PledgeDoc, PledgeStatus } from './rules';

export const ART = { promise: '/pledge/promise.webp', refund: '/pledge/refund.webp', charity: '/pledge/charity.webp' } as const;

/** Watercolour art always sits on cream paper, so it reads the same in light and dark themes. */
export function Medallion({ src, size = 120, className, alt = '' }: { src: string; size?: number; className?: string; alt?: string }) {
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-full bg-[#fff6ea] shadow-[0_18px_40px_-22px_rgb(var(--shadow-tint)/0.8)] ring-4 ring-[#fff6ea]/50', className)}
      style={{ width: size, height: size }}
    >
      <img src={src} alt={alt} width={size} height={size} decoding="async" draggable={false} className="size-[82%] object-contain select-none" />
    </div>
  );
}

/** "6h 05m", "45m", "0m" */
export const dur = (sec: number) => (sec < 60 ? `${Math.floor(sec / 60)}m` : formatDuration(sec));

export function when(ms: number, tz?: string, withTime = true) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    });
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export function timeLeft(ms: number) {
  if (ms <= 0) return 'time’s up';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d >= 1) return `${d} ${d === 1 ? 'day' : 'days'}${h ? ` ${h} h` : ''} left`;
  if (h >= 1) return `${h} h ${m % 60} min left`;
  return `${Math.max(1, m)} min left`;
}

/** A clock that ticks every `ms` while the tab is visible. */
export function useNow(ms: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => !document.hidden && setNow(Date.now());
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
  return now;
}

export function Ring({ value, size = 220, stroke = 18, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const id = useId();
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--secondary)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export interface StripDay extends Partial<DayProgress> {
  key: string;
}

/**
 * The pledge's days as little calendar tiles. `perDay` = the seconds that make a tile "full" (hours goals:
 * the average needed per day; streaks: 15 min). Without `seconds` it is a preview of the window.
 */
export function DayStrip({ days, today, perDay, kind, last }: { days: StripDay[]; today: string; perDay: number; kind: 'hours' | 'streak'; last?: string }) {
  const label = (key: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined, { timeZone: 'UTC', ...opts });
  };
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Pledge calendar">
      {days.map((d) => {
        const isToday = d.key === today;
        const past = d.key < today;
        const future = d.key > today;
        const preview = d.seconds === undefined;
        const fill = preview ? 0 : Math.min(1, (d.seconds ?? 0) / perDay);
        const missedDay = kind === 'streak' && past && !d.met && !preview;
        return (
          <li
            key={d.key}
            className={cn(
              'relative flex w-[52px] flex-col items-center gap-1 overflow-hidden rounded-2xl px-1 pt-1.5 pb-2 ring-1 transition-colors',
              isToday ? 'bg-accent-soft ring-accent' : 'bg-surface ring-line',
              future && !preview && 'opacity-60',
            )}
            aria-label={`${label(d.key, { weekday: 'long', day: 'numeric', month: 'long' })}${preview ? '' : `: ${dur(d.seconds ?? 0)} focused`}`}
          >
            <span className="text-[10px] font-black tracking-wide text-muted uppercase">{label(d.key, { weekday: 'short' })}</span>
            <span className="font-display text-lg leading-none font-semibold tabular">{label(d.key, { day: 'numeric' })}</span>
            {preview ? (
              <span className={cn('mt-0.5 h-1.5 w-6 rounded-full', d.key === last ? 'bg-accent' : 'bg-[color-mix(in_oklab,var(--accent)_35%,transparent)]')} />
            ) : kind === 'streak' ? (
              <span className={cn('mt-0.5 grid size-5 place-items-center rounded-full text-white', d.met ? 'bg-good' : missedDay ? 'bg-bad' : 'bg-line')}>
                {d.met ? <Check size={12} strokeWidth={3.5} /> : missedDay ? <X size={12} strokeWidth={3.5} /> : null}
              </span>
            ) : (
              <span className="mt-0.5 h-1.5 w-8 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--secondary))]" style={{ width: `${fill * 100}%` }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const STATUS: Record<PledgeStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-accent-soft text-accent' },
  refund_pending: { label: 'Refund on its way', cls: 'bg-[color-mix(in_oklab,var(--color-good)_16%,transparent)] text-good' },
  refunded: { label: 'Refunded', cls: 'bg-[color-mix(in_oklab,var(--color-good)_16%,transparent)] text-good' },
  forfeited: { label: 'Donated', cls: 'bg-[color-mix(in_oklab,var(--color-bad)_14%,transparent)] text-bad' },
};

export function StatusChip({ p }: { p: PledgeDoc }) {
  const s = STATUS[p.status] ?? STATUS.active;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-black whitespace-nowrap', s.cls)}>{s.label}</span>
      {p.mode !== 'live' && <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-black text-muted uppercase">{p.mode === 'stub' ? 'Test · nothing charged' : 'Test'}</span>}
    </span>
  );
}

export function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[13.5px] leading-snug">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}
