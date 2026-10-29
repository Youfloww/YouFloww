import { useEffect, useState } from 'react';
import { INK } from './crafts';
import { skinOf, type SkinId } from './skins';
import { BOOKS, JOURNALS, SCARVES, studyProgress, type Project } from './study';

/**
 * Her little study corner beside the timer: a desk she sits behind (the cat sprite stands right behind
 * it, so only her head and shoulders show), a lamp, a mug, and her project in her paws. Drawn in one
 * SVG in "H units" (1 unit = 1% of her height); the floor is y=100 and she stands at x=C.
 */
const VW = 122.5;
const C = 61.25;
const ART = '/img/cathome/';

const CSS = `
.cw-nook *{transform-box:view-box}
.cw-nook .cw-nl{transform-origin:52.5px 71.5px;animation:cw-nl .62s ease-in-out infinite alternate}
.cw-nook .cw-nr{transform-origin:70px 71.5px;animation:cw-nl .62s ease-in-out infinite alternate-reverse}
@keyframes cw-nl{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
.cw-nook .cw-flip{transform-origin:${C}px 70px;animation:cw-flip 7s ease-in-out infinite;opacity:0}
@keyframes cw-flip{0%,78%{opacity:0;transform:scaleX(1)}80%{opacity:1;transform:scaleX(1) translateY(0)}87%{transform:scaleX(.05) translateY(-2.5px)}94%{opacity:1;transform:scaleX(-1) translateY(0)}97%,100%{opacity:0;transform:scaleX(-1)}}
.cw-nook .cw-pen{animation:cw-pen .5s linear infinite}
@keyframes cw-pen{0%{transform:translate(0,0)}25%{transform:translate(.5px,-.7px)}50%{transform:translate(1px,0)}75%{transform:translate(.5px,.6px)}100%{transform:translate(0,0)}}
.cw-nook .cw-steam{animation:cw-steam 2.8s ease-in-out infinite;opacity:0}
@keyframes cw-steam{0%{opacity:0;transform:translateY(2px)}40%{opacity:.7}100%{opacity:0;transform:translateY(-5px)}}
.cw-nook .cw-bob{transform-origin:${C}px 72px;animation:cw-bob 2.6s ease-in-out infinite}
@keyframes cw-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.5px)}}
.cw-nook.cw-idle *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.cw-nook *{animation:none!important}.cw-nook .cw-flip{opacity:0}}
`;

function Paw({ x, y, fill, r = 0 }: { x: number; y: number; fill: string; r?: number }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={3.5} ry={2.7} fill={fill} stroke={INK} strokeWidth={0.9} />
      <path d={`M${x - 1.1} ${y - 2.1} v1.3 M${x + 1.1} ${y - 2.1} v1.3`} stroke={INK} strokeWidth={0.6} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

function Knitting({ p, pal, paw, seated }: { p: number; pal: number; paw: string; seated: boolean }) {
  const [main, stripe] = SCARVES[pal % SCARVES.length];
  const top = 63;
  const len = 6 + p * 30;
  const w = 10;
  const x = C - w / 2;
  const ball = 1 - p * 0.45;
  return (
    <g>
      <defs>
        <pattern id="cw-knit" x={x} y={top} width={w / 3} height={6} patternUnits="userSpaceOnUse">
          <rect width={w / 3} height={6} fill={main} />
          <rect y={4} width={w / 3} height={2} fill={stripe} />
          <path d={`M.35 .4 L${w / 6} 1.9 L${w / 3 - 0.35} .4 M.35 3.4 L${w / 6} 4.9 L${w / 3 - 0.35} 3.4`} stroke={INK} strokeOpacity={0.22} strokeWidth={0.45} fill="none" />
        </pattern>
      </defs>
      {/* the yarn ball left in the basket, and the strand running up to her needles */}
      <circle cx={104.5} cy={83} r={5.2 * ball} fill={main} stroke={INK} strokeWidth={0.8} />
      <path d={`M${101 - 2 * ball} ${83 - 2 * ball} q4 ${3 * ball} ${7 * ball} 0 M${102} ${86 - 2 * ball} q3 -3 6 -1`} stroke={INK} strokeOpacity={0.3} strokeWidth={0.5} fill="none" />
      <path d={`M${104.5 - 4 * ball} ${81} C 96 66, 80 80, ${C + 3} ${top + 1}`} stroke={main} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      {/* the scarf, growing down over the front of the desk */}
      <path
        d={`M${x} ${top} h${w} v${len - 1.5} q0 1.5 -1.5 1.5 h${-w + 3} q-1.5 0 -1.5 -1.5 z`}
        fill="url(#cw-knit)"
        stroke={INK}
        strokeWidth={0.9}
        strokeLinejoin="round"
        style={{ transition: 'd .8s ease' }}
      />
      {/* stitches on the needle */}
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${x + 0.6 + i * 2.3} ${top + 0.4} a1.15 1.3 0 0 1 2.3 0`} fill={main} stroke={INK} strokeWidth={0.6} />
      ))}
      <g className="cw-nl">
        <path d="M52.5 71.5 L66 57" stroke={INK} strokeWidth={2.1} strokeLinecap="round" />
        <path d="M52.5 71.5 L66 57" stroke="#f3cf93" strokeWidth={1} strokeLinecap="round" />
        <circle cx={52.5} cy={71.5} r={1.5} fill="#f4a3b8" stroke={INK} strokeWidth={0.6} />
      </g>
      <g className="cw-nr">
        <path d="M70 71.5 L56.5 57" stroke={INK} strokeWidth={2.1} strokeLinecap="round" />
        <path d="M70 71.5 L56.5 57" stroke="#f3cf93" strokeWidth={1} strokeLinecap="round" />
        <circle cx={70} cy={71.5} r={1.5} fill="#f4a3b8" stroke={INK} strokeWidth={0.6} />
      </g>
      {seated && (
        <>
          <g className="cw-nl">
            <Paw x={53.5} y={70.2} fill={paw} r={-20} />
          </g>
          <g className="cw-nr">
            <Paw x={69} y={70.2} fill={paw} r={20} />
          </g>
        </>
      )}
    </g>
  );
}

function Reading({ p, pal, paw, seated }: { p: number; pal: number; paw: string; seated: boolean }) {
  const color = BOOKS[pal % BOOKS.length][1];
  const tl = 0.5 + p * 2;
  const tr = 0.5 + (1 - p) * 2;
  const leftPage = `M${C} 70 Q55 67.6 48 68.6 L48.5 61.4 Q55 60.4 ${C} 62.6 Z`;
  const rightPage = `M${C} 70 Q67.5 67.6 74.5 68.6 L74 61.4 Q67.5 60.4 ${C} 62.6 Z`;
  return (
    <g className="cw-bob">
      <rect x={46.5} y={69} width={29.5} height={3.6} rx={1.2} fill={color} stroke={INK} strokeWidth={0.8} />
      {/* page stacks: read pages pile up on the left */}
      <path d={`M48 ${68.6} Q55 67.6 ${C} 70 L${C} ${70 + tl * 0.4} Q55 ${68 + tl} 48 ${68.6 + tl} Z`} fill="#f6ead2" stroke={INK} strokeWidth={0.5} />
      <path d={`M74.5 ${68.6} Q67.5 67.6 ${C} 70 L${C} ${70 + tr * 0.4} Q67.5 ${68 + tr} 74.5 ${68.6 + tr} Z`} fill="#f6ead2" stroke={INK} strokeWidth={0.5} />
      <path d={leftPage} fill="#fffaf0" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={rightPage} fill="#fffaf0" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      {[63.2, 64.8, 66.4].map((y, i) => (
        <g key={y} stroke={INK} strokeOpacity={0.28} strokeWidth={0.55} strokeLinecap="round">
          <path d={`M50 ${y - 0.6 + i * 0.1} Q55 ${y - 1.2} 59.5 ${y + 0.4}`} fill="none" />
          <path d={`M63 ${y + 0.4} Q67.5 ${y - 1.2} ${72.5 - i} ${y - 0.6}`} fill="none" />
        </g>
      ))}
      {/* a little picture on the right page */}
      <circle cx={68.3} cy={67.4} r={1.1} fill={color} opacity={0.7} />
      <path className="cw-flip" d={rightPage} fill="#fff3df" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={`M${C} 70.5 q.6 2.6 -.4 5.2`} stroke="#e06a7a" strokeWidth={0.9} fill="none" strokeLinecap="round" />
      {seated && (
        <>
          <Paw x={49.5} y={69.4} fill={paw} r={-15} />
          <Paw x={73} y={69.4} fill={paw} r={15} />
        </>
      )}
    </g>
  );
}

function Writing({ p, pal, paw, seated }: { p: number; pal: number; paw: string; seated: boolean }) {
  const color = JOURNALS[pal % JOURNALS.length][1];
  const rows = [63.6, 65.4, 67.2, 69];
  const lines = rows.map((y) => ({ x: 50, w: 9.5, y })).concat(rows.map((y) => ({ x: 63, w: 9.5, y })));
  const cur = Math.min(lines.length - 1, Math.floor(p * lines.length));
  const frac = p * lines.length - cur;
  const tip = { x: lines[cur].x + lines[cur].w * frac, y: lines[cur].y - 0.2 };
  const wave = (x: number, y: number, w: number) => `M${x} ${y} ${Array.from({ length: Math.round(w / 1.6) }, () => 'q.4 -.9 .8 0 t.8 0').join(' ')}`;
  return (
    <g>
      <rect x={46.5} y={69.6} width={29.5} height={3} rx={1.2} fill={color} stroke={INK} strokeWidth={0.8} />
      <path d={`M48 70.6 L${C} 70.6 L${C} 61.6 L49 61.6 Z`} fill="#fffdf6" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={`M74.5 70.6 L${C} 70.6 L${C} 61.6 L73.5 61.6 Z`} fill="#fffdf6" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      {rows.map((y) => (
        <path key={y} d={`M49.5 ${y + 0.6} H60.5 M62 ${y + 0.6} H73.5`} stroke="#8fb8e0" strokeWidth={0.35} />
      ))}
      {lines.map((l, i) =>
        i <= cur ? (
          <path key={i} d={wave(l.x, l.y, l.w)} pathLength={1} strokeDasharray={`${i < cur ? 1 : frac} 1`} stroke={INK} strokeOpacity={0.75} strokeWidth={0.5} fill="none" strokeLinecap="round" />
        ) : null,
      )}
      {[62.6, 64.2, 65.8, 67.4, 69].map((y) => (
        <circle key={y} cx={C} cy={y} r={0.75} fill="none" stroke={INK} strokeWidth={0.5} />
      ))}
      {seated && <Paw x={51} y={69.8} fill={paw} r={-12} />}
      <g transform={`translate(${tip.x} ${tip.y})`}>
        <g className="cw-pen">
          <g transform="rotate(-55)">
            <path d="M0 0 L2 -1 L2 1 Z" fill="#f1d3a2" stroke={INK} strokeWidth={0.45} strokeLinejoin="round" />
            <path d="M0 0 L.7 -.35 L.7 .35 Z" fill={INK} />
            <rect x={2} y={-1} width={9} height={2} fill="#f6c453" stroke={INK} strokeWidth={0.45} />
            <rect x={11} y={-1} width={1.6} height={2} fill="#c9c9cf" stroke={INK} strokeWidth={0.45} />
            <rect x={12.6} y={-1} width={1.8} height={2} rx={0.6} fill="#f4a3b8" stroke={INK} strokeWidth={0.45} />
          </g>
          {seated && <Paw x={3.6} y={-3.2} fill={paw} r={25} />}
        </g>
      </g>
    </g>
  );
}

export interface NookProps {
  H: number;
  project: Project | null;
  skin: SkinId;
  /** she is sitting at her desk right now */
  seated: boolean;
  /** her paws are busy (timer running, she's not sad) */
  working: boolean;
  /** the session just finished: show the piece complete */
  done?: boolean;
}

export function StudyNook({ H, project, skin, seated, working, done }: NookProps) {
  const [live, setP] = useState(() => studyProgress());
  const p = done ? 1 : live;
  useEffect(() => {
    setP(studyProgress());
    const id = window.setInterval(() => !document.hidden && setP(studyProgress()), 2000);
    return () => clearInterval(id);
  }, [project?.k, project?.p, project?.at]);
  const s = skinOf(skin);
  const paw = s.ramp ? s.ramp[4] : '#d8d8de';
  const k = project?.k ?? 'scarf';
  const pal = project?.p ?? 0;
  const side = k === 'scarf' ? 'study-yarn' : k === 'book' ? 'study-books' : 'study-plant';
  return (
    <svg viewBox={`0 0 ${VW} 100`} width={H * (VW / 100)} height={H} className={`cw-nook block overflow-visible ${working ? '' : 'cw-idle'}`} aria-hidden>
      <style>{CSS}</style>
      <ellipse cx={C + 4} cy={99.6} rx={56} ry={2.6} fill="#5a3a6a" opacity={0.16} />
      {k === 'scarf' ? (
        <image href={`${ART}study-yarn.webp`} x={92} y={77} width={26} height={23} />
      ) : (
        <image href={`${ART}${side}.webp`} x={93} y={k === 'book' ? 81 : 78} width={k === 'book' ? 24 : 18} height={k === 'book' ? 19 : 22} />
      )}
      {/* her floor cushion, peeking out under the desk */}
      <ellipse cx={C} cy={96.6} rx={21} ry={4.6} fill="#f6a9bd" stroke={INK} strokeWidth={0.9} />
      <path d={`M${C - 15} 95.2 Q${C} 92.6 ${C + 15} 95.2`} stroke="#fff" strokeOpacity={0.55} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <image href={`${ART}study-desk.webp`} x={C - 29} y={65} width={58} height={35} preserveAspectRatio="none" />
      <image href={`${ART}study-lamp.webp`} x={32} y={50} width={15.5} height={21} />
      <image href={`${ART}study-mug.webp`} x={80.5} y={63.5} width={9.5} height={9} />
      <g className="cw-steam" style={{ animationDelay: '.4s' }}>
        <path d="M84 62 q-1 -1.5 0 -3 t0 -3" stroke="#fff" strokeWidth={0.9} fill="none" strokeLinecap="round" />
      </g>
      <g className="cw-steam" style={{ animationDelay: '1.8s' }}>
        <path d="M86.5 62 q-1 -1.5 0 -3 t0 -3" stroke="#fff" strokeWidth={0.9} fill="none" strokeLinecap="round" />
      </g>
      {k === 'scarf' && <Knitting p={p} pal={pal} paw={paw} seated={seated} />}
      {k === 'book' && <Reading p={p} pal={pal} paw={paw} seated={seated} />}
      {k === 'journal' && <Writing p={p} pal={pal} paw={paw} seated={seated} />}
    </svg>
  );
}
