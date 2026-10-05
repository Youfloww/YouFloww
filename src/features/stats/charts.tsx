import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Small hover tooltip anchored above a point within a relative container. */
function Tip({ x, y, children }: { x: number | string; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-2.5 py-1.5 text-center text-[11px] leading-tight font-extrabold whitespace-nowrap text-bg shadow-lg"
      style={{ left: x, top: y - 6 }}
    >
      {children}
    </div>
  );
}

/** Vertical bars, one series. Optional dashed reference line (e.g. daily goal). */
export function BarChart({
  data,
  height = 150,
  goal,
  format,
  highlightLast = true,
}: {
  data: { label: string; value: number; sub?: string }[];
  height?: number;
  goal?: number;
  format: (v: number) => string;
  highlightLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.value)) * 1.1;
  const n = data.length;
  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {goal !== undefined && goal > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-faint" style={{ bottom: `${(goal / max) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] font-black text-muted">goal</span>
          </div>
        )}
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          const strong = hover === i || (hover === null && highlightLast && i === n - 1);
          return (
            <button
              key={d.label + i}
              className="relative flex h-full flex-1 items-end justify-center outline-none"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${d.sub ?? d.label}: ${format(d.value)}`}
            >
              <motion.span
                className={cn('w-full max-w-7 rounded-t-[4px] transition-colors', strong ? 'bg-accent' : 'bg-[color-mix(in_oklab,var(--accent)_45%,transparent)]')}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(d.value > 0 ? 2 : 0, h)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 18, delay: i * 0.025 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-line pt-1.5">
        {data.map((d, i) => (
          <span key={i} className={cn('flex-1 text-center text-[10px] font-extrabold', hover === i ? 'text-ink' : 'text-muted')}>
            {d.label}
          </span>
        ))}
      </div>
      {hover !== null && (
        <Tip x={`${((hover + 0.5) / n) * 100}%`} y={height * (1 - data[hover].value / max)}>
          {data[hover].sub ?? data[hover].label}
          <br />
          <span className="text-[13px]">{format(data[hover].value)}</span>
        </Tip>
      )}
    </div>
  );
}

/** Calendar heatmap — one hue, light→dark by magnitude (sequential). */
export function Heatmap({ days, format }: { days: { key: string; date: Date; value: number }[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const max = Math.max(1, ...days.map((d) => d.value));
  const level = (v: number) => (v <= 0 ? 0 : v < max * 0.25 ? 1 : v < max * 0.5 ? 2 : v < max * 0.75 ? 3 : 4);
  const fills = ['var(--line)', 'color-mix(in oklab, var(--accent) 28%, transparent)', 'color-mix(in oklab, var(--accent) 50%, transparent)', 'color-mix(in oklab, var(--accent) 75%, transparent)', 'var(--accent)'];

  // columns = weeks, rows = weekday (Mon first)
  const first = days[0]?.date ?? new Date();
  const offset = (first.getDay() + 6) % 7;
  const cells: ({ i: number } | null)[] = [...Array(offset).fill(null), ...days.map((_, i) => ({ i }))];
  const weeks = Math.ceil(cells.length / 7);
  const months: { col: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const c = cells[w * 7] ?? cells[w * 7 + 6];
    if (!c) continue;
    const d = days[c.i].date;
    if (d.getDate() <= 7) months.push({ col: w, label: d.toLocaleDateString(undefined, { month: 'short' }) });
  }

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="mb-1 grid text-[10px] font-extrabold text-muted" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {Array.from({ length: weeks }, (_, w) => (
          <span key={w}>{months.find((m) => m.col === w)?.label ?? ''}</span>
        ))}
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)`, gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column' }}>
        {cells.map((c, idx) =>
          c ? (
            <motion.button
              key={idx}
              aria-label={`${days[c.i].date.toDateString()}: ${format(days[c.i].value)}`}
              className="aspect-square w-full rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ink"
              style={{ background: fills[level(days[c.i].value)] }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: Math.min(0.6, idx * 0.004) }}
              onMouseEnter={(e) => {
                const r = (e.currentTarget.parentElement!.parentElement as HTMLElement).getBoundingClientRect();
                const b = e.currentTarget.getBoundingClientRect();
                setHover({ i: c.i, x: b.left - r.left + b.width / 2, y: b.top - r.top });
              }}
            />
          ) : (
            <span key={idx} />
          ),
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-extrabold text-muted">
        Less
        {fills.map((f, i) => (
          <span key={i} className="size-2.5 rounded-[3px]" style={{ background: f }} />
        ))}
        More
      </div>
      {hover && (
        <Tip x={hover.x} y={hover.y}>
          {days[hover.i].date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          <br />
          <span className="text-[13px]">{format(days[hover.i].value)}</span>
        </Tip>
      )}
    </div>
  );
}

/** Labeled horizontal bars (share of a total). Single hue, labels in ink. */
export function HBars({ rows, format }: { rows: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)} (${Math.round((r.value / total) * 100)}%)`}>
          <div className="mb-1 flex justify-between gap-2 text-[13px] font-extrabold">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 text-muted">
              {format(r.value)} · {Math.round((r.value / total) * 100)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 18, delay: i * 0.05 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Ring({ value, size = 92, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }}
          transition={{ type: 'spring', stiffness: 50, damping: 16 }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
