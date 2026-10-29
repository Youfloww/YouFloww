import { BOOKS, JOURNALS, SCARVES, type CraftKind } from './study';

/** Outline colour shared with the cat's own sprite art */
export const INK = '#3a2418';

/** A finished piece, drawn in the same outlined cartoon style as the cat (scarf, book or journal) */
export function CraftIcon({ k, p, size = 48, className }: { k: CraftKind; p: number; size?: number; className?: string }) {
  if (k === 'scarf') {
    const [main, stripe] = SCARVES[p % SCARVES.length];
    const id = `sc${p}`;
    return (
      <svg viewBox="0 0 40 64" width={size * 0.625} height={size} className={className} aria-hidden>
        <defs>
          <pattern id={id} width="40" height="8" patternUnits="userSpaceOnUse">
            <rect width="40" height="8" fill={main} />
            <rect y="5" width="40" height="3" fill={stripe} />
          </pattern>
        </defs>
        {/* hung over a peg: a loop with a long and a short tail */}
        <path d="M11 10 Q20 1 29 10 L29 47 L20 47 L20 14 Q20 12 18 12 L18 12 Q14 12 14 16 L14 57 L5 57 L5 16 Q5 10 11 10 Z" fill={`url(#${id})`} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 21 v30 M24 18 v24" stroke={INK} strokeOpacity=".18" strokeWidth="1.2" strokeDasharray="2 2.5" />
        {[6, 9, 12].map((x) => (
          <path key={x} d={`M${x} 57 v5`} stroke={stripe} strokeWidth="1.8" strokeLinecap="round" />
        ))}
        {[21, 24, 27].map((x) => (
          <path key={x} d={`M${x} 47 v5`} stroke={stripe} strokeWidth="1.8" strokeLinecap="round" />
        ))}
        <path d="M8 13 Q11 10 15 11" stroke="#fff" strokeOpacity=".6" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (k === 'book') {
    const [, color] = BOOKS[p % BOOKS.length];
    return (
      <svg viewBox="0 0 40 52" width={size * 0.77} height={size} className={className} aria-hidden>
        <rect x="9" y="5" width="27" height="43" rx="2.5" fill="#fff6e6" stroke={INK} strokeWidth="1.8" />
        <path d="M33 8 v37" stroke={INK} strokeOpacity=".25" strokeWidth="1" />
        <rect x="4" y="3" width="28" height="45" rx="3.5" fill={color} stroke={INK} strokeWidth="1.8" />
        <rect x="4" y="3" width="6" height="45" rx="3" fill={INK} fillOpacity=".16" />
        <rect x="13" y="12" width="15" height="11" rx="2" fill="#fff6e6" stroke={INK} strokeWidth="1.2" />
        <path d="M16 16 h9 M17 19 h7" stroke={INK} strokeOpacity=".5" strokeWidth="1.1" strokeLinecap="round" />
        {/* a little paw on the cover */}
        <g fill="#fff6e6" opacity=".9">
          <ellipse cx="20.5" cy="36" rx="3.4" ry="2.8" />
          <circle cx="16.6" cy="31.6" r="1.3" />
          <circle cx="19.2" cy="30" r="1.3" />
          <circle cx="22" cy="30" r="1.3" />
          <circle cx="24.5" cy="31.6" r="1.3" />
        </g>
        <path d="M7 7 q0 -2 3 -2" stroke="#fff" strokeOpacity=".55" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  const [, color] = JOURNALS[p % JOURNALS.length];
  return (
    <svg viewBox="0 0 40 52" width={size * 0.77} height={size} className={className} aria-hidden>
      <rect x="5" y="6" width="30" height="42" rx="3.5" fill={color} stroke={INK} strokeWidth="1.8" />
      <rect x="7.5" y="9" width="25" height="36" rx="2" fill="#fff" fillOpacity=".18" />
      {[10, 16, 22, 28].map((x) => (
        <path key={x} d={`M${x} 9 v-5.5 a2 2 0 0 1 4 0 v5.5`} fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      ))}
      <rect x="29" y="6" width="3" height="42" fill={INK} fillOpacity=".22" />
      <path d="M20 23 c-3 -4 -8 -1 -5 3 l5 5 l5 -5 c3 -4 -2 -7 -5 -3 z" fill="#fff6e6" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M13 37 h14 M15 41 h10" stroke={INK} strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
