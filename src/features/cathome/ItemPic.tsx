import { useState } from 'react';
import { itemImg, type Item } from './catalog';

/** A furniture picture; if it can't load, a soft emoji token takes its place (never a broken image) */
export function ItemPic({ item, className, onPointerDown, title, room, style }: { item: Item; className?: string; style?: React.CSSProperties; onPointerDown?: (e: React.PointerEvent) => void; title?: string; room?: boolean }) {
  const [bad, setBad] = useState(false);
  if (bad)
    return (
      <svg
        viewBox="0 0 100 100"
        className={room ? 'absolute left-1/2 size-[clamp(48px,9vh,84px)] -translate-x-1/2' : className}
        style={room ? (item.kind === 'floor' ? { bottom: 0 } : { top: '50%', translate: '-50% -50%' }) : undefined}
        onPointerDown={onPointerDown}
        role="img"
        aria-label={item.name}
      >
        <title>{title ?? item.name}</title>
        <ellipse cx="50" cy="92" rx="34" ry="6" fill="#5a3a6a" opacity=".15" />
        <circle cx="50" cy="50" r="40" fill="#fff8ef" stroke="#5a3a28" strokeWidth="4" />
        <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="48">
          {item.emoji}
        </text>
      </svg>
    );
  return <img src={itemImg(item.id)} alt={item.name} title={title} draggable={false} decoding="async" onError={() => setBad(true)} onPointerDown={onPointerDown} className={className} style={style} />;
}
