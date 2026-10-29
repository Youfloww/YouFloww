import { useState } from 'react';
import { roomImg, type RoomId } from './catalog';

/**
 * A drawn version of each room (same outlined cartoon look as the furniture): it shows instantly while
 * the painting loads, and stays as the room if a painting is missing. 1600×900, like the paintings.
 */
const INK = '#5a3a28';

interface Pal {
  wall: string;
  wall2: string;
  dado: string;
  floor: string;
  floor2: string;
  pattern: 'dots' | 'stars' | 'leaves' | 'plaster';
}
const PAL: Record<RoomId, Pal> = {
  living: { wall: '#f9d9c4', wall2: '#fbe6d6', dado: '#fff3e6', floor: '#d99a5f', floor2: '#c98a52', pattern: 'dots' },
  bedroom: { wall: '#e3cde6', wall2: '#ecdcee', dado: '#fbf6ff', floor: '#e2b98a', floor2: '#d4a877', pattern: 'stars' },
  sunroom: { wall: '#cfe3c9', wall2: '#ddecd8', dado: '#f6fbf2', floor: '#dc8f6c', floor2: '#cd7f5d', pattern: 'leaves' },
  attic: { wall: '#f6e7cf', wall2: '#fbf0de', dado: '#f0d9b6', floor: '#b97a45', floor2: '#a86b3a', pattern: 'plaster' },
};

export function RoomArt({ room, className }: { room: RoomId; className?: string }) {
  const p = PAL[room];
  const base = 630; // 0.7 of 900: where wall meets floor
  return (
    <svg viewBox="0 0 1600 900" className={className} aria-hidden>
      <defs>
        <pattern id={`wp-${room}`} width="80" height="80" patternUnits="userSpaceOnUse">
          <rect width="80" height="80" fill={p.wall} />
          {p.pattern === 'dots' && (
            <g fill={p.wall2}>
              <circle cx="20" cy="20" r="6" />
              <circle cx="60" cy="60" r="6" />
            </g>
          )}
          {p.pattern === 'stars' && (
            <g fill="#f8f0ff" opacity=".9">
              <path d="M20 12 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" />
              <path d="M62 54 a8 8 0 1 0 6 12 a6 6 0 1 1 -6 -12z" />
            </g>
          )}
          {p.pattern === 'leaves' && (
            <g fill={p.wall2}>
              <ellipse cx="20" cy="22" rx="5" ry="10" transform="rotate(-30 20 22)" />
              <ellipse cx="60" cy="62" rx="5" ry="10" transform="rotate(30 60 62)" />
            </g>
          )}
          {p.pattern === 'plaster' && <circle cx="40" cy="40" r="2" fill={p.wall2} />}
        </pattern>
        <linearGradient id={`fl-${room}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.floor2} />
          <stop offset="1" stopColor={p.floor} />
        </linearGradient>
        <radialGradient id={`lt-${room}`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff6e0" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff6e0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height={base} fill={`url(#wp-${room})`} />
      {room === 'sunroom' &&
        [260, 800, 1340].map((x) => (
          <g key={x}>
            <path d={`M${x - 150} 470 V210 a150 150 0 0 1 300 0 V470 Z`} fill="#bfe3f5" stroke={INK} strokeWidth="8" />
            <path d={`M${x - 150} 470 V380 q80 -60 150 -30 q80 30 150 -20 V470 Z`} fill="#a8d38f" />
            <path d={`M${x} 60 V470 M${x - 150} 300 H${x + 150}`} stroke="#fffaf2" strokeWidth="12" />
            <path d={`M${x - 150} 470 V210 a150 150 0 0 1 300 0 V470 Z`} fill="none" stroke={INK} strokeWidth="8" />
            <rect x={x - 170} y="466" width="340" height="22" rx="8" fill="#fffaf2" stroke={INK} strokeWidth="6" />
          </g>
        ))}
      {room === 'attic' && (
        <>
          <path d="M0 0 H330 L0 330 Z M1600 0 H1270 L1600 330 Z" fill="#c98f58" stroke={INK} strokeWidth="8" />
          <path d="M0 330 L330 0 M1600 330 L1270 0" stroke="#a8713f" strokeWidth="26" />
          <circle cx="800" cy="200" r="92" fill="#3d3a6b" stroke={INK} strokeWidth="10" />
          <g fill="#fff6c8">
            <circle cx="770" cy="170" r="5" />
            <circle cx="830" cy="230" r="4" />
            <circle cx="845" cy="160" r="3" />
            <circle cx="760" cy="240" r="3" />
          </g>
          <path d="M708 200 H892 M800 108 V292" stroke="#c98f58" strokeWidth="12" />
          <circle cx="800" cy="200" r="92" fill="none" stroke={INK} strokeWidth="10" />
        </>
      )}
      {/* wainscoting and skirting */}
      <rect y={base - 150} width="1600" height="150" fill={p.dado} />
      <path d={`M0 ${base - 150} H1600`} stroke={INK} strokeOpacity=".55" strokeWidth="6" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={30 + i * 160} y={base - 125} width="120" height="100" rx="10" fill="none" stroke={INK} strokeOpacity=".18" strokeWidth="4" />
      ))}
      <rect y={base - 18} width="1600" height="22" fill={p.floor2} stroke={INK} strokeWidth="5" />
      {/* plank floor */}
      <rect y={base + 4} width="1600" height={900 - base} fill={`url(#fl-${room})`} />
      {Array.from({ length: 6 }, (_, r) => {
        const y = base + 4 + r * 46 + (r * r * 2);
        return (
          <g key={r} stroke={INK} strokeOpacity=".22" strokeWidth="3">
            <path d={`M0 ${y} H1600`} />
            {Array.from({ length: 7 }, (_, k) => (
              <path key={k} d={`M${(k * 260 + (r % 2) * 130) % 1600} ${y} v${46 + r * 4}`} />
            ))}
          </g>
        );
      })}
      <rect width="1600" height="900" fill={`url(#lt-${room})`} />
    </svg>
  );
}

/** The room's painting, falling back to the drawn room while it loads or if it's missing */
export function RoomPic({ room, className }: { room: RoomId; className?: string }) {
  const [state, setState] = useState<'load' | 'ok' | 'bad'>('load');
  return (
    <div className={className}>
      {state !== 'ok' && <RoomArt room={room} className="absolute inset-0 size-full" />}
      {state !== 'bad' && (
        <img
          src={roomImg(room)}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('bad')}
          className="absolute inset-0 size-full object-cover select-none"
          style={{ opacity: state === 'ok' ? 1 : 0, transition: 'opacity .4s' }}
        />
      )}
    </div>
  );
}
