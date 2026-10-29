/** A paper railway map of the whole trip: the real track, the stations, and how far the train has come. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { pointAt, type RouteGeo } from './geo';

interface Props {
  geo: RouteGeo;
  km: number;
  color: string;
  className?: string;
  /** small preview on the ticket: fewer labels */
  compact?: boolean;
  dark?: boolean;
}

const W = 1000;

export function RouteMap({ geo, km, color, className, compact, dark }: Props) {
  const proj = useMemo(() => {
    const lats = geo.coords.map((c) => c[1]);
    const lons = geo.coords.map((c) => c[0]);
    const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
    const kx = Math.cos((lat0 * Math.PI) / 180);
    const x0 = Math.min(...lons) * kx;
    const x1 = Math.max(...lons) * kx;
    const y0 = -Math.max(...lats);
    const y1 = -Math.min(...lats);
    const span = Math.max(x1 - x0, (y1 - y0) * 1.25, 1e-6);
    const s = (W * 0.78) / span;
    const width = W;
    const height = Math.max(420, Math.min(1100, (y1 - y0) * s + W * 0.22));
    const ox = (width - (x1 - x0) * s) / 2;
    const oy = (height - (y1 - y0) * s) / 2;
    const f = (c: [number, number]): [number, number] => [ox + (c[0] * kx - x0) * s, oy + (-c[1] - y0) * s];
    return { f, width, height, cx: width / 2 };
  }, [geo]);

  // keep labels readable when the map is drawn small (phones): grow text and dots as the drawing shrinks
  const ref = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = box.w ? Math.min(box.w / proj.width, box.h / proj.height) : 1;
  const u = compact ? 1 : Math.min(2.6, Math.max(1, 0.5 / scale));

  const d = useMemo(() => geo.coords.map((c, i) => `${i ? 'L' : 'M'}${proj.f(c).map((v) => v.toFixed(1)).join(' ')}`).join(''), [geo, proj]);
  const done = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < geo.coords.length && geo.cum[i] <= km; i++) out.push(`${out.length ? 'L' : 'M'}${proj.f(geo.coords[i]).map((v) => v.toFixed(1)).join(' ')}`);
    const p = proj.f(pointAt(geo, km));
    out.push(`${out.length ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`);
    return out.join('');
  }, [geo, proj, km]);

  // labels: try right, left, above, below each dot; skip a label rather than overlap another one
  const fs0 = compact ? 30 : 22 * u;
  const labels = useMemo(() => {
    type Box = [number, number, number, number];
    const placed: Box[] = [];
    const dots: Box[] = geo.stations.map((s) => {
      const [x, y] = proj.f([s.lon, s.lat]);
      return [x - 12 * u, y - 12 * u, x + 12 * u, y + 12 * u];
    });
    const hit = (b: Box) => [...placed, ...dots].some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const out: { name: string; x: number; y: number; anchor: 'start' | 'end' | 'middle'; size: number; end: boolean }[] = [];
    const order = geo.stations.map((s, i) => ({ s, i, end: i === 0 || i === geo.stations.length - 1 })).sort((a, b) => Number(b.end) - Number(a.end));
    for (const { s, end } of order) {
      if (compact && !end) continue;
      const size = end ? fs0 * 1.15 : fs0;
      const w = s.name.length * size * 0.56;
      const [x, y] = proj.f([s.lon, s.lat]);
      const tries: [number, number, 'start' | 'end' | 'middle', Box][] = [
        [x + 20 * u, y + size * 0.32, 'start', [x + 18 * u, y - size * 0.7, x + 22 * u + w, y + size * 0.4]],
        [x - 20 * u, y + size * 0.32, 'end', [x - 22 * u - w, y - size * 0.7, x - 18 * u, y + size * 0.4]],
        [x, y - 22 * u, 'middle', [x - w / 2, y - 22 * u - size * 0.8, x + w / 2, y - 18 * u]],
        [x, y + 22 * u + size * 0.7, 'middle', [x - w / 2, y + 18 * u, x + w / 2, y + 24 * u + size * 0.7]],
      ];
      const ok = tries.find((t) => t[3][0] > 4 && t[3][2] < proj.width - 4 && !hit(t[3])) ?? (end ? tries[x < proj.cx ? 0 : 1] : undefined);
      if (!ok) continue;
      placed.push(ok[3]);
      out.push({ name: s.name, x: ok[0], y: ok[1], anchor: ok[2], size, end });
    }
    return out;
  }, [geo, proj, compact, fs0, u]);

  const train = proj.f(pointAt(geo, km));
  const ink = dark ? '#f3e6d4' : '#4a3426';
  const paper = dark ? '#2b2130' : '#fbf3e4';
  const grid = dark ? 'rgb(255 255 255 / 0.05)' : 'rgb(90 60 30 / 0.07)';

  return (
    <svg ref={ref} viewBox={`0 0 ${proj.width} ${proj.height}`} className={cn('h-full w-full', className)} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Route map, ${Math.round(km)} of ${Math.round(geo.km)} km`}>
      <defs>
        <pattern id="tr-grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke={grid} strokeWidth="2" />
        </pattern>
      </defs>
      <rect width={proj.width} height={proj.height} rx="28" fill={paper} />
      <rect width={proj.width} height={proj.height} rx="28" fill="url(#tr-grid)" />
      {/* compass */}
      {!compact && (
        <g transform={`translate(${proj.width - 70} 72)`} stroke={ink} fill="none" strokeWidth="2.5" opacity="0.55">
          <circle r="30" />
          <path d="M0-24L7 0 0 24-7 0Z" fill={ink} fillOpacity="0.15" />
          <text y="-38" textAnchor="middle" fontSize="20" fontWeight="800" fill={ink} stroke="none" fontFamily="Nunito Variable, Nunito, sans-serif">
            N
          </text>
        </g>
      )}
      {/* the railway: dark casing, cream dashes (classic map style), then the part already travelled */}
      <path d={d} fill="none" stroke={ink} strokeWidth={compact ? 14 : 10 * u} strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d={d} fill="none" stroke={paper} strokeWidth={compact ? 6 : 4.5 * u} strokeDasharray={compact ? '16 16' : `${12 * u} ${12 * u}`} strokeLinecap="butt" strokeLinejoin="round" />
      <path d={done} fill="none" stroke={color} strokeWidth={compact ? 14 : 10 * u} strokeLinecap="round" strokeLinejoin="round" />
      {geo.stations.map((s, i) => {
        const [x, y] = proj.f([s.lon, s.lat]);
        const passed = s.km <= km + 0.05;
        const end = i === 0 || i === geo.stations.length - 1;
        return <circle key={s.name + i} cx={x} cy={y} r={(end ? 13 : 9) * u} fill={passed ? color : paper} stroke={ink} strokeWidth={3.5 * u} />;
      })}
      {labels.map((l) => (
        <text
          key={l.name}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          fontSize={l.size}
          fontWeight={l.end ? 800 : 700}
          fill={ink}
          stroke={paper}
          strokeWidth={7 * u}
          paintOrder="stroke"
          fontFamily="Nunito Variable, Nunito, sans-serif"
        >
          {l.name}
        </text>
      ))}
      <g transform={`translate(${train[0]} ${train[1]}) scale(${u})`}>
        <circle r={compact ? 26 : 22} fill={color} stroke="#fffaf1" strokeWidth="5" />
        <text y={compact ? 10 : 8} textAnchor="middle" fontSize={compact ? 28 : 22}>
          🚆
        </text>
      </g>
    </svg>
  );
}
