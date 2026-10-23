import { AnimatePresence, motion, useAnimationControls, useMotionValue, useSpring, useTransform } from 'motion/react';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { bus } from '@/lib/bus';
import { Minus, Plus } from 'lucide-react';
import { useClock, useTimer, remainingAt, MODE_META } from '@/store/timer';
import { usePrefs } from '@/store/prefs';
import { formatClock } from '@/lib/time';
import { cn, prefersReducedMotion } from '@/lib/utils';
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

/** The orb leans towards the pointer (desktop only). */
function useTilt(max = 9) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-1, 1], [max, -max]), { stiffness: 110, damping: 14 });
  const rotateY = useSpring(useTransform(x, [-1, 1], [-max, max]), { stiffness: 110, damping: 14 });
  useEffect(() => {
    if (prefersReducedMotion() || matchMedia('(pointer: coarse)').matches) return;
    const move = (e: PointerEvent) => {
      x.set((e.clientX / innerWidth) * 2 - 1);
      y.set((e.clientY / innerHeight) * 2 - 1);
    };
    addEventListener('pointermove', move);
    return () => removeEventListener('pointermove', move);
  }, [x, y]);
  return { rotateX, rotateY };
}

const BURST_EMOJI = { go: ['✨', '🔥', '⚡', '💫', '🎯', '⭐'], win: ['🎉', '🏆', '💯', '🥳', '⭐', '💖'] };

/** Shockwave rings + emoji shrapnel when a session starts or finishes. */
function Burst({ kind }: { kind: keyof typeof BURST_EMOJI }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        a: (i / 16) * Math.PI * 2 + Math.random() * 0.35,
        d: 150 + Math.random() * 110,
        e: BURST_EMOJI[kind][i % BURST_EMOJI[kind].length],
        s: 0.8 + Math.random() * 0.9,
        r: (Math.random() - 0.5) * 240,
      })),
    [kind],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {[0, 0.12, 0.26].map((delay) => (
        <motion.span
          key={delay}
          className="absolute inset-[6%] rounded-full border-[3px] border-accent"
          initial={{ scale: 0.8, opacity: 0.9 }}
          animate={{ scale: 1.85, opacity: 0 }}
          transition={{ duration: 1.1, delay, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-[calc(50%-14px)] left-[calc(50%-14px)] size-7 text-center text-[22px] leading-7"
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d, scale: b.s, opacity: 0, rotate: b.r }}
          transition={{ duration: 1.2, ease: [0.15, 0.8, 0.3, 1] }}
        >
          {b.e}
        </motion.span>
      ))}
    </div>
  );
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
  const paused = v.status === 'paused';
  const final = running && v.rem > 0 && v.rem <= 10_000;
  const sec = Math.ceil(v.rem / 1000);
  const tilt = useTilt();
  const beat = useAnimationControls();

  // Heartbeat on each of the last 10 seconds
  useEffect(() => {
    if (final) void beat.start({ scale: [1, 1.06, 1], transition: { duration: 0.42, ease: 'easeOut' } });
  }, [final, sec, beat]);

  // Burst when a run starts (not on page load) and when a focus session completes
  const [burst, setBurst] = useState<{ n: number; kind: keyof typeof BURST_EMOJI } | null>(null);
  const prevStatus = useRef(v.status);
  useEffect(() => {
    if (v.status === 'running' && prevStatus.current !== 'running') setBurst((b) => ({ n: (b?.n ?? 0) + 1, kind: 'go' }));
    prevStatus.current = v.status;
  }, [v.status]);
  useEffect(() => {
    const off = bus.on('session:complete', () => setBurst((b) => ({ n: (b?.n ?? 0) + 1, kind: 'win' })));
    return () => void off();
  }, []);

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
    <motion.div style={{ ...tilt, transformPerspective: 900 }}>
      <motion.div
        animate={{ y: idle ? [0, -8, 0] : 0, filter: paused ? 'saturate(0.45) brightness(1.03)' : 'saturate(1) brightness(1)' }}
        transition={{ y: idle ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 200, damping: 20 }, filter: { duration: 0.6 } }}
      >
        <motion.div
          animate={beat}
          className={cn('relative aspect-square w-[clamp(250px,min(62vmin,72vw),400px)]', !running && 'paused-anim')}
          role="timer"
          data-cat-orb
          aria-label={`${MODE_META[v.mode].label}: ${v.clock} remaining, ${label}`}
        >
          <AnimatePresence>{burst && <Burst key={burst.n} kind={burst.kind} />}</AnimatePresence>
          {/* soft accent glow that breathes while running */}
          <motion.div
            className="absolute inset-[8%] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }}
            animate={{ opacity: final ? [0.6, 1, 0.6] : running ? [0.35, 0.6, 0.35] : 0.25, scale: final ? [1, 1.18, 1] : running ? [0.95, 1.05, 0.95] : 1 }}
            transition={{ duration: final ? 1 : 4, repeat: running ? Infinity : 0, ease: 'easeInOut' }}
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
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
