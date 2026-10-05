import { motion, useMotionValue, useSpring, AnimatePresence, type Transition } from 'motion/react';
import { useEffect, useId, useRef } from 'react';

export type FlowyMood = 'idle' | 'focus' | 'break' | 'happy' | 'wow' | 'sad' | 'sleepy' | 'love' | 'paused';

interface Props {
  mood?: FlowyMood;
  size?: number;
  track?: boolean;
  className?: string;
  onClick?: () => void;
  label?: string;
}

const INK = '#2A1B3D';

/** Body bounce per mood: a squishy mochi. */
const bounce: Record<FlowyMood, { y: number[]; scaleY: number[]; scaleX: number[]; rotate?: number[]; transition: Transition }> = {
  idle: { y: [0, -4, 0], scaleY: [1, 1.03, 1], scaleX: [1, 0.98, 1], transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } },
  paused: { y: [0, -2, 0], scaleY: [1, 1.015, 1], scaleX: [1, 0.99, 1], transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } },
  focus: { y: [0, -2, 0], scaleY: [1, 1.02, 1], scaleX: [1, 0.99, 1], rotate: [-1.5, 1.5, -1.5], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' } },
  break: { y: [0, -1, 0], scaleY: [1, 0.97, 1], scaleX: [1, 1.02, 1], transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } },
  sleepy: { y: [0, 1, 0], scaleY: [1, 0.96, 1], scaleX: [1, 1.03, 1], transition: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' } },
  happy: { y: [0, -14, 0, -8, 0], scaleY: [1, 1.08, 0.9, 1.04, 1], scaleX: [1, 0.94, 1.08, 0.97, 1], transition: { duration: 0.9, repeat: Infinity, repeatDelay: 0.4 } },
  wow: { y: [0, -10, 0], scaleY: [1, 1.1, 1], scaleX: [1, 0.92, 1], transition: { duration: 0.6, repeat: 2 } },
  love: { y: [0, -6, 0], scaleY: [1, 1.05, 1], scaleX: [1, 0.96, 1], rotate: [0, -4, 4, 0], transition: { duration: 1.2, repeat: Infinity } },
  sad: { y: [0, 2, 0], scaleY: [1, 0.95, 1], scaleX: [1, 1.04, 1], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
};

function Eyes({ mood }: { mood: FlowyMood }) {
  const common = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mood) {
    case 'focus':
      // calm, content: soft downward arcs
      return (
        <g>
          <path d="M41 76q6 5 12 0" {...common} />
          <path d="M67 76q6 5 12 0" {...common} />
        </g>
      );
    case 'happy':
      return (
        <g>
          <path d="M41 78q6-8 12 0" {...common} />
          <path d="M67 78q6-8 12 0" {...common} />
        </g>
      );
    case 'sleepy':
    case 'break':
      return (
        <g>
          <path d="M41 77h12" {...common} />
          <path d="M67 77h12" {...common} />
        </g>
      );
    case 'love':
      return (
        <g fill="#FF4F7B">
          <path d="M47 82l-6.5-6.2a4 4 0 0 1 6.5-4.6a4 4 0 0 1 6.5 4.6Z" />
          <path d="M73 82l-6.5-6.2a4 4 0 0 1 6.5-4.6a4 4 0 0 1 6.5 4.6Z" />
        </g>
      );
    case 'wow':
      return (
        <g>
          <circle cx="47" cy="75" r="8" fill={INK} />
          <circle cx="73" cy="75" r="8" fill={INK} />
          <path d="M50 70l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1Z" fill="#fff" />
          <path d="M76 70l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1Z" fill="#fff" />
          <circle cx="44" cy="78" r="1.4" fill="#fff" />
          <circle cx="70" cy="78" r="1.4" fill="#fff" />
        </g>
      );
    case 'sad':
      return (
        <g>
          <ellipse cx="47" cy="77" rx="5" ry="6.5" fill={INK} />
          <ellipse cx="73" cy="77" rx="5" ry="6.5" fill={INK} />
          <circle cx="48.5" cy="74.5" r="1.8" fill="#fff" />
          <circle cx="74.5" cy="74.5" r="1.8" fill="#fff" />
          <path d="M40 67l9 3M80 67l-9 3" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <motion.path
            d="M80 84q2.5 4 0 6q-2.5-2 0-6Z"
            fill="#7cc8ff"
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [0, 8], opacity: [0, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
          />
        </g>
      );
    default:
      // idle / paused: classic shiny eyes with a blink
      return (
        <motion.g
          style={{ transformOrigin: '60px 76px', transformBox: 'view-box' }}
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 4.2, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity }}
        >
          <ellipse cx="47" cy="76" rx="5.5" ry="7.5" fill={INK} />
          <ellipse cx="73" cy="76" rx="5.5" ry="7.5" fill={INK} />
          <circle cx="49" cy="72.5" r="2.1" fill="#fff" />
          <circle cx="75" cy="72.5" r="2.1" fill="#fff" />
          <circle cx="45.5" cy="79.5" r="1" fill="#fff" opacity=".8" />
          <circle cx="71.5" cy="79.5" r="1" fill="#fff" opacity=".8" />
        </motion.g>
      );
  }
}

function Mouth({ mood }: { mood: FlowyMood }) {
  const s = { stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (mood) {
    case 'happy':
    case 'love':
      return (
        <g>
          <path d="M53 87q7 10 14 0Z" fill={INK} />
          <path d="M56 90.5q4 3 8 0" fill="#FF7B9C" />
        </g>
      );
    case 'wow':
      return <ellipse cx="60" cy="90" rx="3.6" ry="4.4" fill={INK} />;
    case 'sad':
      return <path d="M54 92q6-5 12 0" {...s} />;
    case 'sleepy':
    case 'break':
      return <ellipse cx="60" cy="89" rx="2.4" ry="2" fill={INK} />;
    case 'focus':
      return <path d="M56 88q4 3 8 0" {...s} />;
    default:
      return <path d="M54 87q3 4 6 0q3 4 6 0" {...s} />;
  }
}

export function Flowy({ mood = 'idle', size = 96, track = true, className, onClick, label = 'Flowy, your focus buddy' }: Props) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement>(null);
  const lx = useMotionValue(0);
  const ly = useMotionValue(0);
  const sx = useSpring(lx, { stiffness: 140, damping: 16 });
  const sy = useSpring(ly, { stiffness: 140, damping: 16 });

  // Eyes follow the pointer — the tiniest bit of life.
  useEffect(() => {
    if (!track) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.62);
        const dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / 400);
        lx.set((dx / dist) * 3.2 * k);
        ly.set((dy / dist) * 2.6 * k);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [track, lx, ly]);

  const b = bounce[mood];
  const blush = mood === 'happy' || mood === 'love' ? 0.7 : mood === 'sad' ? 0.2 : 0.45;

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={onClick ? 'button' : 'img'}
      aria-label={label}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      whileHover={onClick ? { scale: 1.06, rotate: -3 } : undefined}
      whileTap={onClick ? { scale: 0.9, scaleY: 0.82 } : undefined}
      style={{ overflow: 'visible', cursor: onClick ? 'pointer' : undefined, WebkitTapHighlightColor: 'transparent' }}
    >
      <defs>
        <linearGradient id={`b${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--flowy-1)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--flowy-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--flowy-3)' }} />
        </linearGradient>
        <radialGradient id={`s${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity=".22" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx="60"
        cy="114"
        rx="34"
        ry="5"
        fill={`url(#s${id})`}
        animate={{ scaleX: b.y.map((y) => 1 + y / 60), opacity: b.y.map((y) => 1 + y / 40) }}
        transition={b.transition}
        style={{ transformOrigin: '60px 114px', transformBox: 'view-box' }}
      />

      <motion.g
        key={mood}
        animate={{ y: b.y, scaleY: b.scaleY, scaleX: b.scaleX, rotate: b.rotate ?? 0 }}
        transition={b.transition}
        style={{ transformOrigin: '60px 112px', transformBox: 'view-box' }}
      >
        {/* headphones while focusing */}
        <AnimatePresence>
          {mood === 'focus' && (
            <motion.g initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <path d="M24 70a36 36 0 0 1 72 0" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" opacity=".85" />
              <rect x="15" y="64" width="13" height="22" rx="6" fill={INK} />
              <rect x="92" y="64" width="13" height="22" rx="6" fill={INK} />
              <rect x="18" y="68" width="6" height="14" rx="3" style={{ fill: 'var(--secondary)' }} />
              <rect x="96" y="68" width="6" height="14" rx="3" style={{ fill: 'var(--secondary)' }} />
            </motion.g>
          )}
        </AnimatePresence>

        <path d="M60 10C73 29 102 45 102 74c0 23-19 38-42 38S18 97 18 74c0-29 29-45 42-64Z" fill={`url(#b${id})`} />
        {/* rim light + gloss */}
        <path d="M60 10C73 29 102 45 102 74c0 23-19 38-42 38S18 97 18 74c0-29 29-45 42-64Z" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
        <ellipse cx="41" cy="50" rx="8" ry="13" fill="#fff" opacity=".5" transform="rotate(28 41 50)" />
        <circle cx="52" cy="35" r="3" fill="#fff" opacity=".55" />

        <motion.g style={{ x: sx, y: sy }}>
          <Eyes mood={mood} />
          <ellipse cx="35" cy="89" rx="7.5" ry="4.2" fill="#FF5C8A" opacity={blush} />
          <ellipse cx="85" cy="89" rx="7.5" ry="4.2" fill="#FF5C8A" opacity={blush} />
          <Mouth mood={mood} />
        </motion.g>
      </motion.g>

      {/* zzz on breaks */}
      <AnimatePresence>
        {(mood === 'sleepy' || mood === 'break') && (
          <motion.g key="z" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[0, 1, 2].map((i) => (
              <motion.text
                key={i}
                x={92 + i * 7}
                y={36 - i * 9}
                fontFamily="'Fredoka Variable', Fredoka, sans-serif"
                fontWeight={700}
                fontSize={10 + i * 3}
                fill={INK}
                opacity={0.7}
                animate={{ y: [0, -8, 0], opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 2.4, delay: i * 0.4, repeat: Infinity }}
              >
                z
              </motion.text>
            ))}
          </motion.g>
        )}
        {(mood === 'happy' || mood === 'wow' || mood === 'love') && (
          <motion.g key="sparkle" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ transformOrigin: '60px 60px', transformBox: 'view-box' }}>
            {[
              [14, 30, 1],
              [104, 24, 0.8],
              [108, 64, 0.6],
              [8, 66, 0.7],
            ].map(([x, y, s], i) => (
              <motion.path
                key={i}
                d={`M${x} ${y - 7 * s}l${2 * s} ${5 * s} ${5 * s} ${2 * s}-${5 * s} ${2 * s}-${2 * s} ${5 * s}-${2 * s}-${5 * s}-${5 * s}-${2 * s} ${5 * s}-${2 * s}Z`}
                fill="#FFD25E"
                animate={{ scale: [0.6, 1.2, 0.6], rotate: [0, 45, 0] }}
                transition={{ duration: 1.4, delay: i * 0.2, repeat: Infinity }}
                style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}
              />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </motion.svg>
  );
}
