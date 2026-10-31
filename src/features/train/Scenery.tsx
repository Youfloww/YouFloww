/** The view out of the train window: real looping footage of the landscape, picked by the route and the time of day.
 *  Along a long route the scenery changes (a slow crossfade); at dusk and golden hour the sunset footage takes over;
 *  at night the same footage is dimmed. The video only loads while this is on screen. */
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { LoopVideo } from './LoopVideo';
import type { Tod } from './tod';

export type Clip = 'alpine' | 'lake' | 'plains' | 'snow' | 'steppe' | 'dusk';

/** what the window shows along each route, start to end (the footage is real train-window video, so this is a good-enough match, not the actual place) */
export const SCENES: Record<string, Clip[]> = {
  konkan: ['lake', 'plains', 'lake'],
  darjeeling: ['alpine', 'lake', 'alpine'],
  'kalka-shimla': ['alpine', 'lake'],
  nilgiri: ['alpine', 'plains'],
  'kandy-ella': ['lake', 'alpine', 'lake'],
  bernina: ['alpine', 'snow', 'alpine'],
  glacier: ['alpine', 'snow', 'alpine'],
  bergen: ['snow', 'lake', 'snow'],
  flam: ['alpine', 'lake'],
  'west-highland': ['lake', 'plains', 'alpine'],
  shinkansen: ['plains', 'steppe', 'lake'],
  rockies: ['alpine', 'snow', 'lake'],
};

const clipFor = (route: string, frac: number, tod: Tod): Clip => {
  if (tod.id === 'golden' || tod.id === 'dusk') return 'dusk';
  const seq = SCENES[route] ?? ['alpine'];
  return seq[Math.min(seq.length - 1, Math.max(0, Math.floor(frac * seq.length)))];
};

interface Props {
  route: string;
  kmNow: () => number;
  totalKm: number;
  side: 'L' | 'R';
  tod: Tod;
}

export function Scenery({ route, kmNow, totalKm, side, tod }: Props) {
  const want = clipFor(route, kmNow() / Math.max(1, totalKm), tod);
  // stacked layers keyed by clip, so the outgoing video keeps playing while the new one fades in over it
  const [layers, setLayers] = useState<Clip[]>([want]);
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);

  // re-check now and then (cheap): the train may have rolled into the next kind of scenery
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => !document.hidden && tick((n) => n + 1), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setLayers((l) => (l[l.length - 1] === want ? l : [...l.filter((c) => c !== want), want]));
    const t = setTimeout(() => setLayers((l) => (l.length > 1 && l[l.length - 1] === want ? [want] : l)), 2200);
    return () => clearTimeout(t);
  }, [want]);

  const filter = `brightness(${tod.bright}) saturate(${1 + tod.sat})`;
  const layer = 'absolute inset-0 size-full object-cover';
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#c9d8c4] transition-[filter] duration-[3000ms]" style={{ filter }} aria-hidden>
      <div className="absolute inset-0" style={{ transform: side === 'R' ? 'scaleX(-1)' : undefined }}>
        {layers.map((c) => (
          <motion.div key={c} className="absolute inset-0" initial={{ opacity: first.current ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.8 }}>
            <LoopVideo src={`/video/train/${c}.mp4`} poster={`/video/train/${c}.webp`} className={layer} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
