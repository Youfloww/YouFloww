import { AnimatePresence, motion } from 'motion/react';
import { memo, useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useClock, useTimer, remainingAt, MODE_META } from '@/store/timer';
import { usePrefs } from '@/store/prefs';
import { formatClock } from '@/lib/time';
import { cn } from '@/lib/utils';
import { adjust } from './engine';

const Char = memo(function Char({ c }: { c: string }) {
  if (c === ':') return <span className="mx-[0.02em] inline-block -translate-y-[0.06em] opacity-70">:</span>;
  return (
    <span className="relative inline-block w-[0.62em] overflow-hidden text-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={c}
          className="inline-block"
          initial={{ y: '-70%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '70%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.6 }}
        >
          {c}
        </motion.span>
      </AnimatePresence>
    </span>
  );
});

export function Digits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('font-display tabular inline-flex leading-none font-semibold tracking-tight', className)} aria-hidden>
      {text.split('').map((c, i) => (
        <Char key={`${i}-${text.length}`} c={c} />
      ))}
    </span>
  );
}

function wavePath(amp: number, len: number, w = 400, base = 0) {
  let d = `M0 ${base}`;
  for (let x = 0; x < w; x += len) {
    d += ` Q${x + len / 4} ${base - amp} ${x + len / 2} ${base} T${x + len} ${base}`;
  }
  return d + ` V220 H0 Z`;
}
const WAVE_A = wavePath(6, 100);
const WAVE_B = wavePath(4, 50);

export function useTimerView() {
  const now = useClock((s) => s.now);
  const t = useTimer();
  const rem = remainingAt(t, t.status === 'running' ? Math.max(now, Date.now() - 1000) : now);
  const progress = t.status === 'idle' ? 0 : Math.min(1, Math.max(0, 1 - rem / Math.max(1, t.durationMs)));
  return { ...t, rem, progress, clock: formatClock(rem) };
}

export function TimerOrb({ onMedia }: { onMedia: boolean }) {
  const id = useId().replace(/:/g, '');
  const style = usePrefs((s) => s.timerStyle);
  const v = useTimerView();
  const R = 92;
  const C = 2 * Math.PI * R;
  const idle = v.status === 'idle';
  const running = v.status === 'running';
  const label = idle ? `Ready to ${v.mode === 'focus' ? 'focus' : 'rest'}` : v.status === 'paused' ? 'Paused' : v.mode === 'focus' ? 'Focusing' : 'On a break';
  const angle = v.progress * 2 * Math.PI - Math.PI / 2;
  const tip = { x: 100 + R * Math.cos(angle), y: 100 + R * Math.sin(angle) };
  const ink = onMedia ? 'text-white [text-shadow:0_2px_24px_rgb(0_0_0/0.35)]' : 'text-ink';

  const adjusters = (
    <AnimatePresence>
      {!running && (
        <motion.div className="pointer-events-auto flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
          <button
            aria-label="Remove 5 minutes"
            onClick={() => adjust(-5)}
            className={cn('pressable grid size-8 place-items-center rounded-full', onMedia ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-line text-ink hover:bg-accent-soft')}
          >
            <Minus size={16} strokeWidth={3} />
          </button>
          <span className={cn('text-xs font-black tracking-wider uppercase', onMedia ? 'text-white/80' : 'text-muted')}>5 min</span>
          <button
            aria-label="Add 5 minutes"
            onClick={() => adjust(5)}
            className={cn('pressable grid size-8 place-items-center rounded-full', onMedia ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-line text-ink hover:bg-accent-soft')}
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (style === 'minimal') {
    return (
      <div className="flex flex-col items-center gap-3" role="timer" aria-label={`${MODE_META[v.mode].label}: ${v.clock} remaining, ${label}`}>
        <Digits text={v.clock} className={cn('text-[clamp(84px,22vmin,200px)]', ink)} />
        <div className="h-2 w-[min(70vw,360px)] overflow-hidden rounded-full bg-white/30">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${v.progress * 100}%` }} transition={{ type: 'spring', stiffness: 60, damping: 20 }} />
        </div>
        <p className={cn('text-sm font-extrabold', onMedia ? 'text-white/85' : 'text-muted')}>{label}</p>
        {adjusters}
      </div>
    );
  }

  return (
    <div
      className={cn('relative aspect-square w-[clamp(250px,min(62vmin,72vw),400px)]', !running && 'paused-anim')}
      role="timer"
      aria-label={`${MODE_META[v.mode].label}: ${v.clock} remaining, ${label}`}
    >
      {/* soft accent glow that breathes while running */}
      <motion.div
        className="absolute inset-[8%] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }}
        animate={{ opacity: running ? [0.35, 0.6, 0.35] : 0.25, scale: running ? [0.95, 1.05, 0.95] : 1 }}
        transition={{ duration: 4, repeat: running ? Infinity : 0, ease: 'easeInOut' }}
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <clipPath id={`c${id}`}>
            <circle cx="100" cy="100" r="82" />
          </clipPath>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--accent)' }} />
            <stop offset="1" style={{ stopColor: 'var(--secondary)' }} />
          </linearGradient>
          <radialGradient id={`orb${id}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fff" style={{ stopOpacity: onMedia ? 0.22 : 'var(--orb-hi)' }} />
            <stop offset="1" stopColor="#fff" style={{ stopOpacity: onMedia ? 0.06 : 'var(--orb-lo)' }} />
          </radialGradient>
        </defs>

        {/* glassy orb body */}
        <circle cx="100" cy="100" r="82" fill={`url(#orb${id})`} stroke="white" strokeOpacity={onMedia ? 0.25 : 0.5} strokeWidth="1" />

        {/* liquid that rises as you focus */}
        <g clipPath={`url(#c${id})`}>
          <motion.g animate={{ y: 186 - v.progress * 168 }} initial={false} transition={{ type: 'spring', stiffness: 40, damping: 18 }}>
            <g className="wave-slide-slow">
              <path d={WAVE_B} style={{ fill: 'var(--secondary)' }} opacity={0.28} transform="translate(0,-4)" />
            </g>
            <g className="wave-slide">
              <path d={WAVE_A} fill={`url(#g${id})`} opacity={0.42} />
            </g>
          </motion.g>
          {/* bubbles inside liquid */}
          {running &&
            [30, 70, 120, 150].map((x, i) => (
              <motion.circle
                key={x}
                cx={x + 10}
                r={2 + (i % 2)}
                fill="white"
                opacity={0.5}
                initial={{ cy: 190 }}
                animate={{ cy: [190, 186 - v.progress * 168 + 6], opacity: [0, 0.6, 0] }}
                transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
              />
            ))}
        </g>

        {/* progress ring */}
        <circle cx="100" cy="100" r={R} fill="none" stroke={onMedia ? 'rgba(255,255,255,.18)' : 'var(--line)'} strokeWidth="7" />
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C * (1 - v.progress) }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          transform="rotate(-90 100 100)"
          style={{ filter: 'drop-shadow(0 0 6px color-mix(in oklab, var(--accent) 60%, transparent))' }}
        />
        {!idle && v.progress > 0.002 && (
          <circle cx={tip.x} cy={tip.y} r="5.5" fill="white" style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }} />
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('text-[11px] font-black tracking-[0.18em] uppercase', onMedia ? 'text-white/80' : 'text-muted')}
        >
          {label}
        </motion.span>
        <Digits text={v.clock} className={cn(v.clock.length > 5 ? 'text-[clamp(44px,11vmin,72px)]' : 'text-[clamp(60px,14.5vmin,96px)]', ink)} />
        <div className="mt-1 h-8">{adjusters}</div>
      </div>
    </div>
  );
}
