/**
 * A drawn garden (SVG, 16:9) that sits under the painting: it shows while the painting loads (or if it can't),
 * and its stepping stones mark the same spots the plants stand on.
 */
import { memo } from 'react';

const INK = '#5b3f2c';

function Tuft({ x, y, s = 1, c = '#f49ab4' }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-26 0 Q-18 -30 -6 -6 Q0 -34 8 -6 Q20 -28 26 0 Z" fill="#7fae66" stroke={INK} strokeOpacity=".35" strokeWidth="1.5" />
      {[-16, -4, 9, 18].map((dx, i) => (
        <circle key={i} cx={dx} cy={-14 - (i % 2) * 8} r="5" fill={c} stroke={INK} strokeOpacity=".35" strokeWidth="1" />
      ))}
    </g>
  );
}

/** Round stepping stones the pots stand on (drawn over the painting too, so they always match the spots). */
export const Stones = memo(function Stones({ spots, faintLast }: { spots: { x: number; y: number; s: number }[]; faintLast?: boolean }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      <defs>
        <radialGradient id="gd-stone" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#f6eee3" />
          <stop offset="1" stopColor="#cdbba6" />
        </radialGradient>
      </defs>
      {spots.map((p, i) => (
        <g key={i} opacity={faintLast && i === spots.length - 1 ? 0.45 : 1}>
          <ellipse cx={p.x * 16} cy={p.y * 9 + 3 * p.s} rx={84 * p.s} ry={23 * p.s} fill="#3c5a2a" opacity=".18" />
          <ellipse cx={p.x * 16} cy={p.y * 9 - 3 * p.s} rx={80 * p.s} ry={21 * p.s} fill="url(#gd-stone)" stroke={INK} strokeOpacity=".4" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
});

export const Backdrop = memo(function Backdrop() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <linearGradient id="gd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9def0" />
          <stop offset=".75" stopColor="#f6efe0" />
          <stop offset="1" stopColor="#ffe9d2" />
        </linearGradient>
        <linearGradient id="gd-lawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b5d58f" />
          <stop offset="1" stopColor="#7fae66" />
        </linearGradient>
        <radialGradient id="gd-sun" cx="18%" cy="8%" r="45%">
          <stop offset="0" stopColor="#fff6d8" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
        </radialGradient>
        <pattern id="gd-picket" width="34" height="80" patternUnits="userSpaceOnUse">
          <path d="M6 80 V12 L15 2 L24 12 V80 Z" fill="#fbf4e8" stroke={INK} strokeOpacity=".45" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#gd-sky)" />
      <rect width="1600" height="900" fill="url(#gd-sun)" />
      {/* clouds */}
      <g fill="#fff" opacity=".8">
        <ellipse cx="420" cy="120" rx="90" ry="28" />
        <ellipse cx="480" cy="100" rx="60" ry="34" />
        <ellipse cx="1120" cy="80" rx="110" ry="30" />
        <ellipse cx="1060" cy="64" rx="56" ry="30" />
      </g>
      {/* hills */}
      <path d="M0 360 Q260 280 560 340 T1100 320 T1600 330 V520 H0 Z" fill="#c9dcae" />
      <path d="M0 400 Q300 340 640 392 T1250 372 T1600 390 V520 H0 Z" fill="#aecb92" />
      {/* shed */}
      <g transform="translate(120 250)" stroke={INK} strokeOpacity=".7" strokeWidth="2.2" strokeLinejoin="round">
        <rect x="0" y="80" width="190" height="140" fill="#f4e6d0" />
        <path d="M-18 86 L95 10 L208 86 Z" fill="#d9825b" />
        <rect x="74" y="140" width="44" height="80" fill="#a8744f" />
        <rect x="20" y="118" width="40" height="34" fill="#ffe7a8" />
        <rect x="134" y="118" width="40" height="34" fill="#ffe7a8" />
      </g>
      {/* tree */}
      <g transform="translate(1430 180)">
        <path d="M-14 300 Q-6 180 -22 110 L14 110 Q4 190 18 300 Z" fill="#9b6b48" stroke={INK} strokeOpacity=".7" strokeWidth="2" />
        <g stroke={INK} strokeOpacity=".4" strokeWidth="2">
          <circle cx="-60" cy="90" r="70" fill="#9cc47f" />
          <circle cx="40" cy="60" r="86" fill="#a9cf8a" />
          <circle cx="-10" cy="10" r="74" fill="#b3d494" />
          <circle cx="90" cy="120" r="60" fill="#94bd77" />
        </g>
        <g fill="#f7b8c8">
          {[[-80, 70], [-30, 30], [10, -20], [60, 40], [100, 100], [-50, 120], [30, 100], [-10, 70], [80, 10]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9" />
          ))}
        </g>
      </g>
      {/* fence + hedge */}
      <rect x="0" y="392" width="1600" height="80" fill="url(#gd-picket)" />
      <path d="M0 470 Q40 430 80 462 Q120 428 165 462 Q210 430 255 464 Q300 432 345 462 Q390 430 435 462 Q480 430 525 462 Q570 432 615 462 Q660 430 705 462 Q750 432 795 462 Q840 430 885 462 Q930 432 975 462 Q1020 430 1065 462 Q1110 432 1155 462 Q1200 430 1245 462 Q1290 432 1335 462 Q1380 430 1425 462 Q1470 432 1515 462 Q1560 430 1600 460 V500 H0 Z" fill="#86b06b" stroke={INK} strokeOpacity=".35" strokeWidth="2" />
      {/* lawn */}
      <path d="M0 482 Q800 455 1600 482 V900 H0 Z" fill="url(#gd-lawn)" />
      <g fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth="38">
        <path d="M0 560 Q800 520 1600 560" />
        <path d="M0 680 Q800 640 1600 680" />
        <path d="M0 810 Q800 770 1600 810" />
      </g>
      {/* flowers along the edges */}
      <Tuft x={40} y={520} s={1.2} />
      <Tuft x={330} y={500} c="#ffe08a" />
      <Tuft x={780} y={492} s={0.9} c="#c9b5ff" />
      <Tuft x={1180} y={500} c="#ffb58a" />
      <Tuft x={1560} y={540} s={1.3} c="#f7b8c8" />
      <Tuft x={70} y={880} s={1.8} c="#ffe08a" />
      <Tuft x={1530} y={880} s={1.8} c="#c9b5ff" />
    </svg>
  );
});
