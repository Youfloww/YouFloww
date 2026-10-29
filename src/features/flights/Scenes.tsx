/** Hand-drawn SVG scenes: the little plane, the takeoff, and the view from the window seat. */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { cn, prefersReducedMotion } from '@/lib/utils';
import { CatSprite } from '../cat/CatSprite';
import type { Sky } from './geo';

const INKC = '#5b3f2c';

/* ------------------------------------------------------------------ */
export function PlaneSide({ gear = true, className }: { gear?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 240 100" className={className} aria-hidden>
      <g stroke={INKC} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
        {gear && (
          <g fill="#3b2a20">
            <path d="M72 70 L72 80" />
            <path d="M188 70 L188 80" />
            <circle cx={72} cy={84} r={5} />
            <circle cx={188} cy={84} r={5} />
          </g>
        )}
        <path d="M24 50 L10 14 Q9 9 15 9 L32 9 Q36 9 40 15 L66 46 Z" fill="#e07a5f" />
        <path d="M20 50 Q12 51 13 59 Q15 71 32 72 L196 72 Q226 70 233 58 Q228 45 204 40 L46 40 Q30 40 20 50 Z" fill="#fffaf1" />
        <path d="M18 62 L230 62" stroke="#e07a5f" strokeWidth={4} />
        <path d="M207 44 Q220 46 226 53 L209 53 Z" fill="#9fcbe8" strokeWidth={1.6} />
        <rect x={180} y={44} width={12} height={22} rx={5} fill="none" strokeWidth={1.4} />
        <path d="M100 64 L152 64 L120 90 Q115 94 108 91 L96 68 Z" fill="#f3e6d4" />
        <rect x={114} y={70} width={32} height={12} rx={6} fill="#e07a5f" />
        <path d="M14 46 L4 46 Q2 50 6 52 L30 52" fill="#f3e6d4" strokeWidth={1.8} />
      </g>
      <g fill="#9fcbe8" stroke={INKC} strokeWidth={1.2}>
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={64 + i * 13} cy={51} r={3.3} />
        ))}
      </g>
      <text x={18} y={33} fill="#fffaf1" fontFamily="var(--font-display)" fontWeight={600} fontSize={13}>
        YF
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sky colours for the window and the takeoff                          */
/* ------------------------------------------------------------------ */
const SKIES: Record<Sky, { stops: string[]; cloud: string; shade: string; light: string }> = {
  day: { stops: ['#7fb6e3', '#b9dcf2', '#fbefe0'], cloud: '#ffffff', shade: '#cbbfe6', light: '#fffdf8' },
  sunset: { stops: ['#5f5d9e', '#e49aa6', '#ffc98f'], cloud: '#ffe1cc', shade: '#b48bb5', light: '#fff1dc' },
  night: { stops: ['#0f1736', '#243063', '#4a4a7c'], cloud: '#8f93c4', shade: '#3c3c6e', light: '#c7c9ee' },
};

/** Deterministic little random generator so the clouds are the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** A strip of puffy clouds, 1600 wide, made of two identical halves (so it loops when moved by -50%). */
function CloudStrip({ seed, y, size, color, shade, light, opacity = 1 }: { seed: number; y: number; size: number; color: string; shade: string; light: string; opacity?: number }) {
  const puffs = useMemo(() => {
    const r = rng(seed);
    const out: { x: number; y: number; r: number }[] = [];
    for (let x = -40; x < 840; x += size * (0.55 + r() * 0.5)) out.push({ x, y: y + (r() - 0.5) * size * 0.7, r: size * (0.55 + r() * 0.6) });
    return out;
  }, [seed, y, size]);
  const half = (dx: number, key: string) => (
    <g key={key} transform={`translate(${dx} 0)`}>
      {puffs.map((p, i) => (
        <circle key={`s${i}`} cx={p.x + p.r * 0.12} cy={p.y + p.r * 0.28} r={p.r} fill={shade} />
      ))}
      {puffs.map((p, i) => (
        <circle key={`c${i}`} cx={p.x} cy={p.y} r={p.r * 0.94} fill={color} />
      ))}
      {puffs.map((p, i) => (
        <circle key={`h${i}`} cx={p.x - p.r * 0.25} cy={p.y - p.r * 0.35} r={p.r * 0.45} fill={light} opacity={0.75} />
      ))}
      <rect x={-60} y={y + size * 0.55} width={920} height={600} fill={color} />
    </g>
  );
  return (
    <svg viewBox="0 0 1600 600" preserveAspectRatio="none" className="h-full w-full" style={{ opacity }}>
      <g filter="url(#ff-paint)">{[half(0, 'a'), half(800, 'b')]}</g>
    </svg>
  );
}

export function PaintFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="ff-paint" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="ff-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="9" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.7 0 0 0 1.55" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
        <filter id="ff-paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0.35 0" />
        </filter>
      </defs>
    </svg>
  );
}

function SkyBack({ sky }: { sky: Sky }) {
  const s = SKIES[sky];
  const stars = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 36 }, () => ({ x: r() * 400, y: r() * 260, r: 0.6 + r() * 1.5, d: r() * 3 }));
  }, []);
  return (
    <svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`ff-sky-${sky}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.stops[0]} />
          <stop offset="0.5" stopColor={s.stops[1]} />
          <stop offset="0.78" stopColor={s.stops[2]} />
        </linearGradient>
        <radialGradient id="ff-glow">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#ffe3a8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={400} height={560} fill={`url(#ff-sky-${sky})`} />
      {sky === 'day' && (
        <>
          <circle cx={300} cy={120} r={120} fill="url(#ff-glow)" />
          <circle cx={300} cy={120} r={22} fill="#fff8e6" />
        </>
      )}
      {sky === 'sunset' && (
        <>
          <circle cx={170} cy={320} r={170} fill="url(#ff-glow)" />
          <circle cx={170} cy={318} r={34} fill="#ffb067" stroke="#e07a5f" strokeWidth={2} />
        </>
      )}
      {sky === 'night' && (
        <>
          {stars.map((st, i) => (
            <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff8e6" className="ff-twinkle" style={{ animationDelay: `${st.d}s` }} />
          ))}
          <circle cx={290} cy={110} r={26} fill="#fff4cf" />
          <circle cx={302} cy={102} r={24} fill={s.stops[0]} />
        </>
      )}
    </svg>
  );
}

/** The sky + cloud sea, used inside the window and behind the takeoff. */
export function SkyScene({ sky, className }: { sky: Sky; className?: string }) {
  const s = SKIES[sky];
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <SkyBack sky={sky} />
      <div className="absolute inset-x-0 bottom-0 h-[52%] w-[200%] will-change-transform ff-drift-slow">
        <CloudStrip seed={11} y={150} size={60} color={s.cloud} shade={s.shade} light={s.light} opacity={0.75} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[40%] w-[200%] will-change-transform ff-drift">
        <CloudStrip seed={5} y={190} size={110} color={s.cloud} shade={s.shade} light={s.light} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Window seat                                                         */
/* ------------------------------------------------------------------ */
export function WindowSeat({ sky, seat, line, onClose }: { sky: Sky; seat: string; line: string; onClose: () => void }) {
  const right = /[DEF]$/.test(seat);
  const [shade, setShade] = useState(false);
  return (
    <motion.div className="ff-cabin absolute inset-0 grid place-items-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      {/* cabin wall panel lines */}
      <div className="pointer-events-none absolute inset-y-0 left-[8%] w-px bg-black/5" />
      <div className="pointer-events-none absolute inset-y-0 right-[8%] w-px bg-black/5" />
      <div className="relative" style={{ width: 'min(64vw, 46dvh, 420px)', aspectRatio: '0.72' }}>
        <div className="ff-window absolute inset-0 overflow-hidden">
          <SkyScene sky={sky} />
          {/* the wing */}
          <svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" className={cn('absolute inset-0 h-full w-full', right && '-scale-x-100')} aria-hidden>
            <g stroke={INKC} strokeWidth={3} strokeLinejoin="round">
              <path d="M-20 600 L-20 470 L330 392 Q350 389 352 400 L340 416 L60 600 Z" fill={sky === 'night' ? '#6d6a8e' : '#efe6da'} />
              <path d="M330 392 L346 330 Q350 322 356 328 L352 400 Z" fill="#e07a5f" />
              <path d="M40 520 L300 412" stroke={sky === 'night' ? '#4c4970' : '#d8cbb9'} strokeWidth={4} />
            </g>
            {sky === 'night' && <circle cx={348} cy={334} r={5} fill="#ff6b6b" className="ff-twinkle" />}
          </svg>
          {/* paper texture + glass reflection */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-60 mix-blend-multiply" aria-hidden>
            <rect width="100%" height="100%" filter="url(#ff-paper)" />
          </svg>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgb(255_255_255/0.28)_0%,transparent_32%,transparent_70%,rgb(255_255_255/0.12)_100%)]" />
          {/* window shade */}
          <motion.button
            onClick={() => setShade((v) => !v)}
            aria-label={shade ? 'Open the window shade' : 'Close the window shade'}
            className="absolute inset-x-0 top-0 cursor-pointer border-b-4 border-[#5b3f2c]/40 bg-[linear-gradient(180deg,#f4ead9,#e6d7c0)]"
            animate={{ height: shade ? '88%' : '9%' }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          >
            <span className="absolute bottom-1.5 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-[#5b3f2c]/40" />
          </motion.button>
        </div>
        {/* your cat, napping on the sill */}
        <div className="pointer-events-none absolute -right-[22%] -bottom-[6%] hidden sm:block">
          <CatSprite anim="idle" face="blink" height={92} flip />
        </div>
      </div>

      <p className="pointer-events-none absolute top-[max(70px,calc(env(safe-area-inset-top)+64px))] left-1/2 -translate-x-1/2 rounded-full bg-[#fffaf1]/90 px-4 py-1.5 text-center text-sm font-extrabold whitespace-nowrap text-[#3b2a20] shadow-md">
        Seat {seat} · {line}
      </p>
      <button onClick={onClose} className="sr-only">
        Back to the map
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Takeoff                                                             */
/* ------------------------------------------------------------------ */
const CAPTIONS = ['Cabin crew, seats for take-off', 'Full power… rotate', 'Wheels up! Happy focusing ✈️'];

export function Takeoff({ sky, from, to, onDone }: { sky: Sky; from: string; to: string; onDone: () => void }) {
  const reduced = prefersReducedMotion();
  const [cap, setCap] = useState(0);
  useEffect(() => {
    const ids = reduced ? [setTimeout(onDone, 1800)] : [setTimeout(() => setCap(1), 2000), setTimeout(() => setCap(2), 3900), setTimeout(onDone, 6400)];
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const s = SKIES[sky];
  return (
    <motion.div className="absolute inset-0 z-20 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.8 } }} onClick={onDone}>
      <SkyScene sky={sky} className="scale-[1.4]" />
      {/* ground drops away as we climb */}
      <motion.div className="absolute inset-x-0 bottom-0 h-[38%]" initial={{ y: 0 }} animate={reduced ? {} : { y: ['0%', '0%', '115%'] }} transition={{ duration: 5.6, times: [0, 0.48, 1], ease: 'easeIn' }}>
        <svg viewBox="0 0 800 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M0 80 Q120 30 240 70 T480 60 T800 50 L800 300 L0 300 Z" fill={sky === 'night' ? '#2e3a52' : '#b7cfa5'} />
          <path d="M0 120 Q160 90 320 115 T640 105 T800 110 L800 300 L0 300 Z" fill={sky === 'night' ? '#26304a' : '#9fbf8e'} />
          <rect x={60} y={40} width={14} height={70} fill={sky === 'night' ? '#454f6b' : '#efe3cf'} stroke={INKC} strokeWidth={2} />
          <rect x={50} y={30} width={34} height={16} rx={4} fill={sky === 'night' ? '#ffd27a' : '#9fcbe8'} stroke={INKC} strokeWidth={2} />
        </svg>
        <div className="absolute inset-x-0 bottom-[14%] h-[34%] border-y-[3px] border-[#5b3f2c]/60" style={{ background: sky === 'night' ? '#3b3d4a' : '#a39a90' }}>
          <div className={cn('absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2', !reduced && 'ff-runway-lines')} style={reduced ? { background: 'repeating-linear-gradient(90deg,#fffaf1 0 46px,transparent 46px 110px)' } : undefined} />
        </div>
      </motion.div>
      <motion.div
        className="absolute bottom-[17%] left-0 w-[min(46vw,340px)]"
        initial={{ x: '-110%', y: 0, rotate: 0 }}
        animate={reduced ? { x: '40vw' } : { x: ['-110%', '20vw', '42vw', '120vw'], y: ['0dvh', '0dvh', '-6dvh', '-62dvh'], rotate: [0, 0, -9, -13] }}
        transition={{ duration: 5.6, times: [0, 0.38, 0.55, 1], ease: 'easeIn' }}
      >
        <PlaneSide gear={cap < 2} className="w-full drop-shadow-[0_18px_14px_rgb(40_20_10/0.25)]" />
      </motion.div>
      <div className="absolute inset-x-0 top-[max(80px,14dvh)] flex flex-col items-center px-6 text-center" style={{ color: sky === 'night' ? '#fff6ea' : '#3b2a20' }}>
        <p className="font-display text-sm font-semibold tracking-[0.3em] uppercase opacity-80">
          {from} → {to}
        </p>
        <AnimatePresence mode="wait">
          <motion.p key={cap} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-2 font-display text-3xl font-semibold sm:text-4xl" style={{ textShadow: `0 2px 18px ${s.stops[2]}` }}>
            {CAPTIONS[cap]}
          </motion.p>
        </AnimatePresence>
        <p className="mt-3 text-xs font-bold opacity-60">tap to skip</p>
      </div>
    </motion.div>
  );
}
