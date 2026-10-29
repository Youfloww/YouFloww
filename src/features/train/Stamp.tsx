/** Rubber-stamp station stamps, drawn in SVG: a little picture per station type, the name around the rim. */
import { useId, type ReactNode } from 'react';
import { hashString } from '@/lib/utils';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 48×48 line pictures */
const MOTIFS: Record<string, ReactNode> = {
  city: (
    <g {...S}>
      <path d="M4 41h40M7 41V24h8v17M15 41V13h10v28M25 41V20h8v21M33 41V27h9v14" />
      <path d="M19 18h2M19 23h2M19 28h2M19 33h2M10 29h1M10 34h1M29 25h1M29 30h1M37 32h1" />
    </g>
  ),
  river: (
    <g {...S}>
      <path d="M4 17c5-4 9 4 14 0s9-4 14 0 8 3 12 0M4 26c5-4 9 4 14 0s9-4 14 0 8 3 12 0M4 35c5-4 9 4 14 0s9-4 14 0 8 3 12 0" />
    </g>
  ),
  palm: (
    <g {...S}>
      <path d="M8 42h32M23 42c0-9 2-17 5-23" />
      <path d="M28 19c-4-6-12-7-17-3M28 19c2-7 9-10 15-7M28 19c-6 0-11 4-13 10M28 19c6 0 11 4 12 10" />
    </g>
  ),
  hills: (
    <g {...S}>
      <path d="M2 40c7-11 13-13 21-2M15 40c9-17 19-20 31-2M4 40h40" />
      <path d="M30 16l2-3 2 3M36 12l2-3 2 3" />
    </g>
  ),
  mango: (
    <g {...S}>
      <path d="M29 13c8 4 10 17 3 25-6 6-18 5-20-3-2-8 5-10 9-14 3-3 3-6 8-8z" />
      <path d="M29 13c2-4 6-7 11-7-1 4-5 7-11 7" />
    </g>
  ),
  bridge: (
    <g {...S}>
      <path d="M3 15h42M3 21h42" />
      <path d="M6 41V31a6 6 0 0 1 12 0v10M18 41V31a6 6 0 0 1 12 0v10M30 41V31a6 6 0 0 1 12 0v10" />
      <path d="M8 15v-3M16 15v-3M24 15v-3M32 15v-3M40 15v-3" />
    </g>
  ),
  beach: (
    <g {...S}>
      <circle cx="34" cy="13" r="5" />
      <path d="M4 31c4-3 8-3 12 0s8 3 12 0 8-3 12 0 4 2 6 0M4 38c4-3 8-3 12 0s8 3 12 0 8-3 12 0" />
      <path d="M14 28l6-13v13z" />
    </g>
  ),
  temple: (
    <g {...S}>
      <path d="M24 5l-13 10h26zM14 15v4h20v-4M10 19h28l-4 6H14zM16 25v15M32 25v15M21 40v-8h6v8M7 41h34" />
    </g>
  ),
  forest: (
    <g {...S}>
      <path d="M12 41v-6M12 9l-8 14h4l-5 12h18l-5-12h4zM34 41v-6M34 6l-9 16h5l-6 13h20l-6-13h5z" />
    </g>
  ),
  loop: (
    <g {...S}>
      <path d="M6 41c0-14 9-23 20-23s15 7 15 13-6 10-12 10-11-5-11-11 4-9 9-9" />
      <path d="M8 34l-3-1M10 27l-3-2M15 21l-2-3M22 18l-1-3" />
      <rect x="29" y="18" width="9" height="6" rx="2" fill="currentColor" />
    </g>
  ),
  tea: (
    <g {...S}>
      <path d="M9 21h24v8a10 10 0 0 1-10 10h-4A10 10 0 0 1 9 29zM33 23h3a4 4 0 0 1 0 8h-4M5 43h34" />
      <path d="M17 15c-2-3 2-5 0-8M24 15c-2-3 2-5 0-8" />
    </g>
  ),
  cloud: (
    <g {...S}>
      <path d="M13 30a7 7 0 0 1 0-14 10 10 0 0 1 19-2 7 7 0 0 1 2 14z" />
      <path d="M3 41c6-6 11-6 16-1 6-7 13-8 19-2l7 3" />
    </g>
  ),
  peak: (
    <g {...S}>
      <path d="M2 41l13-21 7 9 9-17 15 29z" />
      <path d="M27 20l4-8 4 8-4-2zM12 25l3-5 3 4" />
    </g>
  ),
  tunnel: (
    <g {...S}>
      <path d="M5 41V24a19 19 0 0 1 38 0v17M13 41V26a11 11 0 0 1 22 0v15" />
      <path d="M8 15l4 3M24 5v5M40 15l-4 3M19 41l2-9M29 41l-2-9" />
    </g>
  ),
  pine: (
    <g {...S}>
      <path d="M24 4l-8 11h5l-9 12h7l-9 12h28l-9-12h7l-9-12h5zM24 39v6" />
    </g>
  ),
  mushroom: (
    <g {...S}>
      <path d="M7 25a17 15 0 0 1 34 0zM18 25v11a6 6 0 0 0 12 0V25" />
      <circle cx="17" cy="17" r="2" />
      <circle cx="28" cy="14" r="2.4" />
      <circle cx="33" cy="20" r="1.6" />
    </g>
  ),
  lake: (
    <g {...S}>
      <path d="M3 28l10-14 7 8 7-7 18 13zM6 34h36M11 40h26" />
    </g>
  ),
  glacier: (
    <g {...S}>
      <path d="M2 39l15-26 10 13 6-6 13 19z" />
      <path d="M17 13l-3 12 5-3 4 6 4-6M33 20l-2 7 4-2" />
    </g>
  ),
  waterfall: (
    <g {...S}>
      <path d="M4 10h14l2 3h8l2-3h14M19 13v21M24 13v25M29 13v21M10 40c4-4 7-4 10 0s8-4 10-1 7-3 10 1" />
    </g>
  ),
  village: (
    <g {...S}>
      <path d="M5 41V27l8-8 8 8v14zM21 41V23l11-10 11 10v18M3 41h42" />
      <path d="M11 41v-6h4v6M29 29h6v5h-6zM36 15V9h3v6" />
    </g>
  ),
  castle: (
    <g {...S}>
      <path d="M7 41V16h5v4h4v-4h5v25M21 41V24h6v17M27 41V16h5v4h4v-4h5v25M4 41h40M21 41v-6a3 3 0 0 1 6 0v6" />
      <path d="M13 26h2M33 26h2" />
    </g>
  ),
  snow: (
    <g {...S}>
      <path d="M24 5v38M8 14l32 20M8 34l32-20" />
      <path d="M20 8l4 4 4-4M20 40l4-4 4 4M7 19l6-1-2-5M41 29l-6 1 2 5M7 29l6 1-2 5M41 19l-6-1 2-5" />
    </g>
  ),
  fjord: (
    <g {...S}>
      <path d="M2 9c6 9 9 20 11 31M46 9c-6 9-9 20-11 31M13 34h22M15 40h18" />
      <path d="M20 30h8l-2 3h-4zM24 30v-6l3 4" />
    </g>
  ),
  harbour: (
    <g {...S}>
      <path d="M8 31h32l-5 7H13zM24 31V8l12 19H24M21 13l-8 14h8" />
      <path d="M4 43c4-3 8-3 12 0s8 3 12 0 8-3 12 0" />
    </g>
  ),
  onsen: (
    <g {...S}>
      <path d="M7 29a17 11 0 0 0 34 0" />
      <path d="M16 25c-3-4 3-6 0-10s2-6 0-9M24 25c-3-4 3-6 0-10s2-6 0-9M32 25c-3-4 3-6 0-10s2-6 0-9" />
    </g>
  ),
  fuji: (
    <g {...S}>
      <path d="M2 41l15-24h14l15 24z" />
      <path d="M17 17l-4 7 5-2 3 3 3-3 3 3 3-3 4 2-3-7" />
      <circle cx="38" cy="9" r="4" />
    </g>
  ),
  moor: (
    <g {...S}>
      <path d="M3 33c8-7 16-7 23-1s13-4 19-2" />
      <path d="M10 42l-2-6M10 42l2-6M10 42v-7M24 42l-2-5M24 42l2-5M24 42v-6M38 42l-2-6M38 42l2-6M38 42v-7" />
      <path d="M30 17l2-6M34 17l-2-6M30 17h4l1 5h-6z" />
    </g>
  ),
  spike: (
    <g {...S}>
      <path d="M4 33h40M4 39h40M9 30v12M17 30v12M25 30v12M33 30v12M41 30v12" />
      <path d="M21 5h6v3h-2v16l-1 4-1-4V8h-2z" fill="currentColor" />
    </g>
  ),
};

export const motifOf = (m: string) => MOTIFS[m] ?? MOTIFS.peak;

export interface StampProps {
  route: string;
  routeName: string;
  station: string;
  motif: string;
  color: string;
  /** when it was stamped (shows the date) */
  at?: number;
  className?: string;
}

/** A collected stamp. Shape and tilt come from the station name, so a stamp always looks the same. */
export function Stamp({ route, routeName, station, motif, color, at, className }: StampProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = hashString(`${route}:${station}`);
  const shape = h % 3;
  const tilt = ((h >> 3) % 17) - 8;
  const seed = h % 97;
  const date = at ? new Date(at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase() : '';
  const name = station.toUpperCase();
  const small = name.length > 14;
  return (
    <svg viewBox="0 0 120 120" className={className} style={{ color, transform: `rotate(${tilt}deg)` }} role="img" aria-label={`${station} stamp`}>
      <defs>
        <filter id={`ink${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.45" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
        <path id={`top${uid}`} d="M 18 60 A 42 42 0 0 1 102 60" />
        <path id={`bot${uid}`} d="M 22 64 A 38 38 0 0 0 98 64" />
      </defs>
      <g filter={`url(#ink${uid})`} fill="currentColor">
        {shape === 0 && (
          <>
            <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" strokeWidth="3.5" />
            <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="60" cy="60" r="31" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" />
            <text fontFamily="Fredoka Variable, Fredoka, sans-serif" fontWeight="600" fontSize={small ? 9 : 11} letterSpacing="1.2">
              <textPath href={`#top${uid}`} startOffset="50%" textAnchor="middle">
                {name}
              </textPath>
            </text>
            <text fontFamily="Nunito Variable, Nunito, sans-serif" fontWeight="800" fontSize="7.5" letterSpacing="1.4">
              <textPath href={`#bot${uid}`} startOffset="50%" textAnchor="middle">
                {routeName.toUpperCase()}
              </textPath>
            </text>
            <g transform="translate(43 40) scale(0.72)">{motifOf(motif)}</g>
            {date && (
              <text x="60" y="84" textAnchor="middle" fontFamily="Nunito Variable, Nunito, sans-serif" fontWeight="800" fontSize="6.5" letterSpacing="0.8">
                {date}
              </text>
            )}
          </>
        )}
        {shape === 1 && (
          <>
            <rect x="8" y="14" width="104" height="92" rx="12" fill="none" stroke="currentColor" strokeWidth="3.5" />
            <rect x="14" y="20" width="92" height="80" rx="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <text x="60" y="34" textAnchor="middle" fontFamily="Nunito Variable, Nunito, sans-serif" fontWeight="800" fontSize="7" letterSpacing="1.2">
              {routeName.toUpperCase()}
            </text>
            <g transform="translate(41 37) scale(0.8)">{motifOf(motif)}</g>
            <rect x="14" y="78" width="92" height="22" fill="currentColor" />
            <text x="60" y="93.5" textAnchor="middle" fill="#fffaf1" fontFamily="Fredoka Variable, Fredoka, sans-serif" fontWeight="600" fontSize={small ? 9 : 11.5} letterSpacing="1">
              {name}
            </text>
            {date && (
              <text x="60" y="113" textAnchor="middle" fontFamily="Nunito Variable, Nunito, sans-serif" fontWeight="800" fontSize="6.5" letterSpacing="0.8">
                {date}
              </text>
            )}
          </>
        )}
        {shape === 2 && (
          <>
            <path
              d={Array.from({ length: 36 }, (_, i) => {
                const a = (i / 36) * Math.PI * 2;
                const r = i % 2 ? 51 : 56;
                return `${i ? 'L' : 'M'}${(60 + Math.cos(a) * r).toFixed(1)} ${(60 + Math.sin(a) * r * 0.86).toFixed(1)}`;
              }).join(' ') + 'Z'}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <ellipse cx="60" cy="60" rx="43" ry="37" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <text x="60" y="38" textAnchor="middle" fontFamily="Nunito Variable, Nunito, sans-serif" fontWeight="800" fontSize="6.5" letterSpacing="1.2">
              {routeName.toUpperCase()}
            </text>
            <g transform="translate(46 40) scale(0.58)">{motifOf(motif)}</g>
            <text x="60" y="80" textAnchor="middle" fontFamily="Fredoka Variable, Fredoka, sans-serif" fontWeight="600" fontSize={small ? 8.5 : 10.5} letterSpacing="0.8">
              {name}
            </text>
            {date && (
              <text x="60" y="89" textAnchor="middle" fontFamily="Nunito Variable, Nunito, sans-serif" fontWeight="800" fontSize="5.5" letterSpacing="0.8">
                {date}
              </text>
            )}
          </>
        )}
      </g>
    </svg>
  );
}

/** A stamp you haven't collected yet: a faint dashed outline. */
export function EmptyStamp({ station, className }: { station: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={`${station}: not stamped yet`}>
      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" opacity="0.35" />
      <text x="60" y="66" textAnchor="middle" fontFamily="Fredoka Variable, Fredoka, sans-serif" fontWeight="600" fontSize="22" fill="currentColor" opacity="0.3">
        ?
      </text>
    </svg>
  );
}
