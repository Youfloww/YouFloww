/**
 * Tiny inline SVG critters and tools for the garden and the strip (no image downloads, ~1 KB each).
 * Drawn in the house style: soft fills with warm-brown ink outlines.
 */
import { useId, type CSSProperties } from 'react';

const INK = '#5b3f2c';

interface P {
  className?: string;
  style?: CSSProperties;
}

/** A butterfly seen from above (flap it with a scaleX animation). */
export function Butterfly({ className, style, hue = 'peach' }: P & { hue?: 'peach' | 'blue' }) {
  const id = useId();
  const [a, b, c] = hue === 'peach' ? ['#ffb58a', '#ffe2c4', '#f08a5d'] : ['#a9c4ff', '#e4ecff', '#8a9be8'];
  return (
    <svg viewBox="0 0 40 32" className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id={`${id}w`} cx="50%" cy="50%" r="65%">
          <stop offset="0" stopColor={b} />
          <stop offset=".65" stopColor={a} />
          <stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      <g stroke={INK} strokeWidth="1.1" strokeLinejoin="round" fill={`url(#${id}w)`}>
        <path d="M19 14 C14 3, 3 1, 2.5 8 C2 14, 10 16, 19 16 Z" />
        <path d="M21 14 C26 3, 37 1, 37.5 8 C38 14, 30 16, 21 16 Z" />
        <path d="M19 17 C12 17, 6 21, 8.5 26.5 C11 30, 17 25, 19.5 19 Z" />
        <path d="M21 17 C28 17, 34 21, 31.5 26.5 C29 30, 23 25, 20.5 19 Z" />
      </g>
      <g fill={INK} opacity=".55">
        <circle cx="7" cy="7.5" r="1.3" />
        <circle cx="33" cy="7.5" r="1.3" />
      </g>
      <ellipse cx="20" cy="17" rx="1.6" ry="7.5" fill="#4a3426" />
      <path d="M19.4 10 Q16.5 5 15 4 M20.6 10 Q23.5 5 25 4" stroke="#4a3426" strokeWidth=".9" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** A round fuzzy bee, side view. */
export function Bee({ className, style }: P) {
  return (
    <svg viewBox="0 0 30 24" className={className} style={style} aria-hidden>
      <ellipse cx="13" cy="6.5" rx="5" ry="4" fill="#eaf6ff" fillOpacity=".75" stroke={INK} strokeWidth=".8" transform="rotate(-25 13 6.5)" />
      <ellipse cx="17.5" cy="6" rx="4" ry="3.2" fill="#eaf6ff" fillOpacity=".7" stroke={INK} strokeWidth=".8" transform="rotate(20 17.5 6)" />
      <ellipse cx="15" cy="14.5" rx="9.5" ry="7" fill="#ffcf4a" stroke={INK} strokeWidth="1.1" />
      <path d="M12 8.2 Q10.4 14.5 12 20.8 M17 7.8 Q15.4 14.5 17 21.2" stroke="#4a3426" strokeWidth="2.6" fill="none" />
      <circle cx="22" cy="12.5" r="1.3" fill="#2b1d14" />
      <circle cx="22.4" cy="12.1" r=".4" fill="#fff" />
      <path d="M5.6 14.5 L3.2 15.2" stroke="#4a3426" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="20.5" cy="16.2" rx="1.4" ry=".8" fill="#ff9aa2" opacity=".7" />
    </svg>
  );
}

/** A vintage watering can (spout to the right). */
export function WateringCan({ className, style }: P) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 48" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" x2="1">
          <stop offset="0" stopColor="#9cc2a3" />
          <stop offset=".55" stopColor="#b9d6bb" />
          <stop offset="1" stopColor="#7fa98a" />
        </linearGradient>
      </defs>
      <path d="M16 13 C10 4, 31 2, 30 13" fill="none" stroke="#b5703f" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M38 27 L56 12 L59.5 15 L43 33 Z" fill="#9cc2a3" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <ellipse cx="58.5" cy="12.6" rx="3.6" ry="2" transform="rotate(40 58.5 12.6)" fill="#c98a52" stroke={INK} strokeWidth="1.1" />
      <path d="M9 16 Q8 15 10 14 L38 14 Q40 15 39.5 16 L41 41 Q41 44 37 44 L12 44 Q8 44 8 41 Z" fill={`url(#${id}b)`} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.6 23 L40.3 23" stroke="#c98a52" strokeWidth="2.6" />
      <path d="M8.9 38 L40.8 38" stroke="#c98a52" strokeWidth="2.6" />
      <path d="M8 16 Q2 18 4 27 Q5 31 9 31" fill="none" stroke="#b5703f" strokeWidth="3" strokeLinecap="round" />
      <path d="M15 26 Q16 33 14 36" stroke="#fff" strokeOpacity=".55" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
