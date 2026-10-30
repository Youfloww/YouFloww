/**
 * The Garden (a full-screen mode): every plant you grew to full bloom lives here, in spots on a painted garden.
 * The potting bench at the bottom holds the plant that is growing now; the seed shop sells new seeds for fish
 * coins; the watering can waters anything you tap. Day / dusk / night follow your local time.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, Droplets, Lock, Move, Sprout, X } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { bus } from '@/lib/bus';
import { cn, haptic, hashString } from '@/lib/utils';
import { dateKey } from '@/lib/time';
import { useWallet } from '../economy/wallet';
import { useTimerView } from '../timer/TimerOrb';
import { PLANT_RATIO, PlantView, STAGE_NAMES, plantTop, plantTopAt, stageOf, type PlantSpeciesId } from './PlantView';
import { SPECIES, speciesOf } from './species';
import {
  MAX_SPOTS,
  buySeed,
  firstFreeSpot,
  hasFreeSeed,
  movePlant,
  liveFocusSec,
  moveToGarden,
  needSec,
  plantSeed,
  seedsOwned,
  spotPrice,
  unlockSpot,
  useGardenSync,
  usePot,
  waterPlant,
  waterPot,
  type GardenPlant,
} from './model';
import { Backdrop, Stones } from './Backdrop';
import { Bee as BeeSvg, Butterfly as ButterflySvg, WateringCan } from './sprites';
import './garden.css';

/* ------------------------------------------------------------------ */
/* The painting and where things stand on it                           */
/* ------------------------------------------------------------------ */
const ART = { day: '/img/garden/garden-day.webp', ratio: 16 / 9 };
/** Spots in % of the painting (x, y = where the pot stands, on a painted stepping stone) and a depth scale. Order = unlock order. */
const SPOTS: { x: number; y: number; s: number }[] = [
  { x: 50.5, y: 80.5, s: 1 },
  { x: 42.6, y: 64, s: 0.84 },
  { x: 60.6, y: 66, s: 0.84 },
  { x: 37, y: 80.5, s: 1 },
  { x: 66.8, y: 80.5, s: 1 },
  { x: 73.1, y: 63.4, s: 0.84 },
  { x: 28.2, y: 63.5, s: 0.84 },
  { x: 81, y: 80, s: 1 },
  { x: 22, y: 79, s: 1 },
  { x: 88, y: 63, s: 0.84 },
  { x: 48.6, y: 54.5, s: 0.7 },
  { x: 62.3, y: 54.5, s: 0.7 },
];
/** a front-row plant box is this share of the painting height */
const PLANT_H = 0.3;

const INK = 'text-[#3b2a20]';
const PAPER = 'bg-[#fffaf1]/95 border-2 border-[#5b3f2c]/60 shadow-[0_24px_60px_-24px_rgb(60_30_10/0.55)]';
const BTN = 'pressable inline-flex items-center justify-center gap-1.5 rounded-2xl font-extrabold whitespace-nowrap disabled:opacity-45';
const DARK = cn(BTN, 'h-11 bg-[#3b2a20] px-4 text-[#fff6ea] hover:bg-[#4a3529]');
const LIGHT = cn(BTN, 'h-11 border-2 border-[#5b3f2c]/50 bg-[#fffaf1] px-3.5 text-[#3b2a20] hover:bg-[#fff1e0]');
const WATER = cn(BTN, 'h-11 bg-[#4aa3d8] px-4 text-white hover:bg-[#3d95cb]');

type Phase = 'dawn' | 'day' | 'dusk' | 'night';
const phaseOf = (h: number): Phase => (h >= 20 || h < 6 ? 'night' : h < 8 ? 'dawn' : h >= 17 ? 'dusk' : 'day');

function usePhase() {
  const [phase, setPhase] = useState(() => phaseOf(new Date().getHours()));
  useEffect(() => {
    const t = setInterval(() => setPhase(phaseOf(new Date().getHours())), 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  return phase;
}

function useViewport() {
  const [v, setV] = useState(() => ({ w: innerWidth, h: innerHeight }));
  useEffect(() => {
    const on = () => setV({ w: innerWidth, h: innerHeight });
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return v;
}

function useHidden() {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date(t).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });

/* ------------------------------------------------------------------ */
/* Little living things                                                */
/* ------------------------------------------------------------------ */
function Butterflies({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn('gd-wander pointer-events-none', i % 2 ? 'gd-wander-b' : 'gd-wander-a')} style={{ animationDelay: `${-i * 17}s` }}>
          <ButterflySvg hue={i % 2 ? 'blue' : 'peach'} className="gd-flutter block w-[clamp(24px,2.6vw,36px)]" style={{ animationDelay: `${i * 0.11}s` }} />
        </div>
      ))}
    </>
  );
}

/** Moonlight over the day painting: a deep blue wash, a moon and a few twinkling stars. */
function Night() {
  const stars = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 18 }, () => ({ x: r() * 100, y: r() * 30, s: 1.5 + r() * 2, d: r() * 3 }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0d1640_0%,#1b2a66_35%,#2a2f6a_70%,#2c2350_100%)] opacity-[.66] mix-blend-multiply" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_12%,#fff6d655,transparent_45%)]" />
      <div className="absolute top-[8%] left-[58%] size-[4.2%] rounded-full bg-[#fff8dc] shadow-[0_0_40px_14px_#fff3c255]" style={{ aspectRatio: 1, height: 'auto' }} />
      {stars.map((st, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animation: `gd-twinkle ${2.4 + st.d}s ease-in-out ${-st.d}s infinite` }}
        />
      ))}
    </div>
  );
}

/** small seeded random numbers (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Fireflies({ seed }: { seed: number }) {
  const flies = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const r = rng(seed * 97 + i * 7919);
        return { x: 4 + r() * 92, y: 40 + r() * 48, d: r() * 8, g: r() * 2.6 };
      }),
    [seed],
  );
  return (
    <>
      {flies.map((f, i) => (
        <span key={i} className="gd-firefly pointer-events-none" style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `-${f.d}s` }}>
          <i style={{ animationDelay: `-${f.g}s` }} />
        </span>
      ))}
    </>
  );
}

function Bee({ size }: { size: number }) {
  return (
    <span className="gd-orbit pointer-events-none absolute left-1/2 -ml-2.5" style={{ top: 0, ['--r' as string]: `${size * 0.16}px`, ['--t' as string]: `${4 + (size % 3)}s` } as CSSProperties}>
      <BeeSvg className="gd-buzz block w-6" />
    </span>
  );
}

/** The can pours over a plant, then a sparkle. */
function Pour({ size, top }: { size: number; top: number }) {
  const y = Math.max(-size * 0.25, top * size - size * 0.3);
  return (
    <span className="pointer-events-none absolute inset-0 z-10">
      <WateringCan className="gd-can absolute" style={{ width: size * 0.5, left: '34%', top: y }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <i
          key={i}
          className="gd-drop absolute block h-2.5 w-[3px] rounded-full bg-sky-400/85"
          style={{ left: `${30 + i * 6}%`, top: y + size * 0.16, animationDelay: `${0.4 + i * 0.12}s`, ['--fall' as string]: `${size * 0.16}px` } as CSSProperties}
        />
      ))}
      <span className="gd-sparkle absolute left-1/2 text-xl" style={{ top: top * size, animationDelay: '1.5s' }}>
        ✨
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */
function Panel({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div role="dialog" aria-label={label} className={cn('gd-plant-in rounded-[26px] p-4', PAPER, INK, className)} style={{ animationDuration: '.35s' }}>
      {children}
    </div>
  );
}

function PlantCard({ plant, onMove, onClose }: { plant: GardenPlant; onMove: () => void; onClose: () => void }) {
  const sp = speciesOf(plant.species);
  const watered = plant.watered === dateKey();
  return (
    <Panel label={sp.name} className="w-[min(92vw,360px)]">
      <div className="flex gap-3">
        <div className="grid shrink-0 place-items-end rounded-2xl bg-[#f3ead8]" style={{ width: 84, height: 124 }}>
          <PlantView species={plant.species} growth={1} size={120} sway={false} seed={plant.id} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-xl leading-tight font-semibold">
              {sp.emoji} {sp.name}
            </p>
            <button onClick={onClose} aria-label="Close" className="pressable -mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full hover:bg-[#5b3f2c]/10">
              <X size={17} />
            </button>
          </div>
          <dl className="mt-2 space-y-1 text-[13px] font-bold">
            <div className="flex gap-1.5">
              <dt className="opacity-60">Planted</dt>
              <dd>{fmtDate(plant.planted)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="opacity-60">Full bloom</dt>
              <dd>{fmtDate(plant.bloomed)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="opacity-60">It took</dt>
              <dd>
                {plant.minutes} focused minute{plant.minutes === 1 ? '' : 's'}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs font-bold opacity-70">{watered ? '💧 Watered today. It looks very happy.' : 'Pick up the watering can and give it a drink.'}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onMove} className={cn(LIGHT, 'flex-1')}>
          <Move size={16} /> Move
        </button>
        <button onClick={onClose} className={cn(DARK, 'flex-1')}>
          Lovely
        </button>
      </div>
    </Panel>
  );
}

function SeedShop({ onClose, hasPot }: { onClose: () => void; hasPot: boolean }) {
  const coins = useWallet().coins; // (the whole wallet re-renders this, so owned seeds stay fresh)
  const free = hasFreeSeed() && !hasPot;
  const live = useLive();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    addEventListener('keydown', k, true);
    return () => removeEventListener('keydown', k, true);
  }, [onClose]);

  const act = (id: PlantSpeciesId) => {
    const sp = speciesOf(id);
    if (!hasPot) {
      if (!free && seedsOwned(id) < 1 && !buySeed(id)) return toast({ emoji: '🐟', title: 'Not enough fish coins yet', body: `A ${sp.name.toLowerCase()} seed costs ${sp.price}. Every focused minute earns one.` });
      if (plantSeed(id, live)) {
        haptic([8, 40, 8]);
        toast({ emoji: '🌱', title: `${sp.name} planted!`, body: 'It grows while you focus. Water it once a day.' });
        onClose();
      }
      return;
    }
    if (buySeed(id)) toast({ emoji: '🌱', title: `Bought a ${sp.name.toLowerCase()} seed`, body: 'Plant it when your pot is free.' });
    else toast({ emoji: '🐟', title: 'Not enough fish coins yet', body: `It costs ${sp.price}. Every focused minute earns one.` });
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[#2b1a10]/35 p-3 backdrop-blur-[3px]" onClick={onClose}>
      <div role="dialog" aria-modal aria-label="Seed shop" onClick={(e) => e.stopPropagation()} className={cn('gd-plant-in w-full max-w-[760px] rounded-[30px] p-4 sm:p-6', PAPER, INK)} style={{ animationDuration: '.35s' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Seed shop</h2>
            <p className="text-sm font-bold opacity-70">{free ? 'Your first seed is a gift. Pick any one you like 🎁' : hasPot ? 'Your pot is busy: seeds you buy wait for the next planting.' : 'Pick a seed. It grows while you focus.'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-[#3b2a20] px-3 py-1.5 text-sm font-black text-[#fff6ea]">🐟 {coins}</span>
            <button onClick={onClose} aria-label="Close seed shop" className="pressable grid size-9 place-items-center rounded-full hover:bg-[#5b3f2c]/10">
              <X size={19} />
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {SPECIES.map((s) => {
            const owned = seedsOwned(s.id);
            const label = !hasPot ? (free ? 'Plant free 🎁' : owned ? `Plant (${owned} owned)` : `Plant · 🐟 ${s.price}`) : `Buy · 🐟 ${s.price}`;
            const can = free || (!hasPot && owned > 0) || coins >= s.price;
            return (
              <div key={s.id} className="flex flex-col items-center rounded-2xl bg-[#fff1e0]/70 p-2.5 text-center">
                <div className="relative grid h-[132px] w-full place-items-center overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 50% 40%, ${s.tint}33, transparent 70%)` }}>
                  <PlantView species={s.id} growth={1} size={130} sway={false} />
                </div>
                <p className="mt-1.5 font-display text-[17px] leading-tight font-semibold">
                  {s.emoji} {s.name}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug font-bold opacity-65">{s.blurb}</p>
                <p className="mt-1 text-[11px] font-black opacity-75">⏱ {s.minutes} focus min{hasPot && owned ? ` · ${owned} owned` : ''}</p>
                <button onClick={() => act(s.id)} disabled={!can} className={cn(BTN, 'mt-2 h-9 w-full text-[13px]', can ? 'bg-[#3b2a20] text-[#fff6ea]' : 'bg-[#5b3f2c]/15')}>
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Seconds of the running focus session (planting mid-session only counts the rest of it). */
function useLive() {
  const v = useTimerView();
  return liveFocusSec(v);
}

/* ------------------------------------------------------------------ */
/* The potting bench (bottom left)                                     */
/* ------------------------------------------------------------------ */
function Bench({ compact, onShop, onPlace, onWater, pouring }: { compact: boolean; onShop: () => void; onPlace: () => void; onWater: () => void; pouring: number }) {
  const { pot, growth, thirst, running } = usePot();
  const size = compact ? 96 : 150;
  if (!pot) {
    return (
      <div className={cn('flex items-center gap-3 rounded-[24px] p-3 pr-4', PAPER, INK)}>
        <div className="relative shrink-0" style={{ width: size * PLANT_RATIO, height: size }}>
          <PlantView species="sunflower" growth={-1} size={size} sway={false} alt="An empty pot" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight font-semibold">Your pot is empty</p>
          <p className="text-xs font-bold opacity-65">{hasFreeSeed() ? 'Your first seed is a gift 🎁' : 'Plant a seed and grow it with focus.'}</p>
          <button onClick={onShop} className={cn(DARK, 'mt-2 h-10')}>
            <Sprout size={17} /> Plant a seed
          </button>
        </div>
      </div>
    );
  }
  const sp = speciesOf(pot.species);
  const { stage } = stageOf(growth);
  const done = growth >= 1;
  const left = Math.max(1, Math.ceil(((1 - growth) * needSec(pot)) / 60 / thirst.mult));
  return (
    <div className={cn('flex items-end gap-3 rounded-[24px] p-3 pr-4', PAPER, INK)}>
      <button onClick={onWater} aria-label={`Water your ${sp.name.toLowerCase()}`} className="relative shrink-0 cursor-pointer" style={{ width: size * PLANT_RATIO, height: size }}>
        <div key={`hop${pouring}`} className={cn('absolute inset-0', pouring > 0 && 'gd-hop')}>
          <PlantView species={pot.species} growth={growth} wilt={thirst.wilt} size={size} seed={pot.id} />
        </div>
        {pouring > 0 && <Pour key={`can${pouring}`} size={size} top={plantTopAt(pot.species, growth)} />}
      </button>
      <div className="min-w-0 pb-0.5">
        <p className="font-display text-lg leading-tight font-semibold">
          {sp.emoji} {sp.name} <span className="text-sm opacity-60">· {STAGE_NAMES[stage]}</span>
        </p>
        <div className="mt-1.5 h-2 w-[min(46vw,200px)] overflow-hidden rounded-full bg-[#5b3f2c]/15">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#8fc47a,#f2b45c)] transition-[width] duration-700" style={{ width: `${Math.max(3, growth * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs font-bold opacity-70">
          {done ? 'In full bloom! 🌼' : `${Math.floor(growth * 100)}% · ~${left} focus min to go${running ? ' · growing now ✨' : ''}`}
        </p>
        {!compact && !done && <p className={cn('text-xs font-extrabold', thirst.days ? 'text-[#b8691d]' : 'text-[#3f8a4e]')}>💧 {thirst.label}</p>}
        <div className="mt-2 flex gap-2">
          {done ? (
            <button onClick={onPlace} className={cn(DARK, 'h-10', compact && 'px-3 text-sm')}>
              🌸 {compact ? 'Plant it' : 'Plant in garden'}
            </button>
          ) : (
            <button onClick={onWater} disabled={!thirst.days} className={cn(thirst.days ? WATER : LIGHT, 'h-10')}>
              <Droplets size={16} /> {thirst.days ? 'Water' : 'Watered'}
            </button>
          )}
          <button onClick={onShop} className={cn(LIGHT, 'h-10')} aria-label="Seed shop">
            <Sprout size={16} /> {compact ? '' : 'Seeds'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function Garden() {
  const setUI = useUI((s) => s.set);
  useGardenSync(() => bus.emit('confetti', { big: false }));
  const { garden, pot, growth } = usePot();
  const live = useLive();
  const coins = useWallet().coins;
  const phase = usePhase();
  const hidden = useHidden();
  const { w: vw, h: vh } = useViewport();
  const compact = vw < 640;

  // painting size: covers the screen; wider than a phone, so it scrolls sideways there
  const W = Math.max(vw, ART.ratio * vh);
  const H = W / ART.ratio;
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [W]);

  const [card, setCard] = useState<string | null>(null);
  const [shop, setShop] = useState(false);
  const [placing, setPlacing] = useState<null | { kind: 'pot' } | { kind: 'move'; id: string }>(null);
  const [can, setCan] = useState(false);
  const [pours, setPours] = useState<Record<string, number>>({});
  const [benchPour, setBenchPour] = useState(0);
  const [fresh, setFresh] = useState<string | null>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const [bg, setBg] = useState<'loading' | 'ok' | 'none'>('loading');

  const bySpot = useMemo(() => new Map(garden.plants.map((p) => [p.spot, p])), [garden.plants]);
  const night = phase === 'night';

  // Escape: close the top-most thing, then leave
  useEffect(() => {
    // capture phase: the app's own Escape (leave the mode) only runs when nothing here is open
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || shop || !(card || placing || can)) return;
      e.stopPropagation();
      if (card) setCard(null);
      else if (placing) setPlacing(null);
      else setCan(false);
    };
    addEventListener('keydown', k, true);
    return () => removeEventListener('keydown', k, true);
  }, [card, placing, can, shop]);

  // the watering can follows the pointer (mouse only)
  useEffect(() => {
    if (!can) return;
    const move = (e: PointerEvent) => {
      if (cursor.current && e.pointerType === 'mouse') cursor.current.style.transform = `translate(${e.clientX - 18}px, ${e.clientY - 52}px)`;
    };
    addEventListener('pointermove', move);
    return () => removeEventListener('pointermove', move);
  }, [can]);

  const water = (id: string) => {
    if (waterPlant(id)) {
      haptic([6, 30, 6]);
      setPours((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
    } else toast({ emoji: '💚', title: 'Already watered today', body: 'It’s happy. Garden plants never wilt.' });
  };
  const waterBench = () => {
    if (waterPot()) {
      haptic([6, 30, 6]);
      setBenchPour((n) => n + 1);
    } else if (pot) toast({ emoji: '💚', title: 'Watered already today', body: 'Come back tomorrow for its next drink.' });
  };

  const tapPlant = (p: GardenPlant) => {
    if (placing?.kind === 'move') {
      if (placing.id !== p.id) movePlant(placing.id, p.spot);
      setPlacing(null);
      return;
    }
    if (can) return water(p.id);
    setCard(p.id);
  };

  const tapSpot = (i: number) => {
    if (!placing) return;
    if (placing.kind === 'pot') {
      const plant = moveToGarden(i, live);
      if (plant) {
        setFresh(plant.id);
        bus.emit('confetti', { big: true });
        bus.emit('mascot:say', { text: `${speciesOf(plant.species).emoji} Welcome to the garden!`, mood: 'love' });
        toast({ emoji: '🌸', title: `${speciesOf(plant.species).name} planted in your garden`, body: 'Your pot is free for a new seed.', action: { label: 'Seed shop', run: () => setShop(true) } });
      }
    } else movePlant(placing.id, i);
    setPlacing(null);
  };

  const startPlacing = () => {
    if (firstFreeSpot(garden) < 0) {
      if (garden.spots >= MAX_SPOTS) return toast({ emoji: '🌼', title: 'Your garden is full!', body: 'Move a plant to make room... or simply admire it.' });
      return toast({ emoji: '🔒', title: 'No free spot', body: `Open a new spot for 🐟 ${spotPrice(garden.spots)} first (the lock on the lawn).` });
    }
    setCan(false);
    setCard(null);
    setPlacing({ kind: 'pot' });
  };

  const unlock = () => {
    if (unlockSpot()) {
      haptic([8, 40, 8]);
      toast({ emoji: '🌱', title: 'A new spot in your garden', body: 'Grow something lovely for it.' });
    } else toast({ emoji: '🐟', title: 'Not enough fish coins yet', body: `A new spot costs ${spotPrice(garden.spots)}. Every focused minute earns one.` });
  };

  const butterflies = night ? 0 : Math.min(3, 1 + Math.floor(garden.plants.length / 3));
  const cardPlant = card ? garden.plants.find((p) => p.id === card) : undefined;
  const placingName = placing?.kind === 'pot' && pot ? speciesOf(pot.species).name.toLowerCase() : 'plant';

  return (
    <div className={cn('fixed inset-0 z-[45] overflow-hidden bg-[#2f3b2a] select-none', INK, hidden && 'gd-paused pv-paused', can && 'cursor-none')} role="dialog" aria-modal="true" aria-label="Your garden">
      {/* the painted garden */}
      <div ref={scroller} className="no-scrollbar absolute inset-0 z-0 overflow-x-auto overflow-y-hidden overscroll-contain">
        <div className="relative" style={{ width: W, height: H, marginTop: vh - H, ['--W' as string]: `${W}px`, ['--H' as string]: `${H}px` } as CSSProperties}>
          {bg !== 'ok' && <Backdrop />}
          {bg !== 'none' && (
            <img
              src={ART.day}
              alt=""
              decoding="async"
              draggable={false}
              onLoad={() => setBg('ok')}
              onError={() => setBg('none')}
              className={cn('absolute inset-0 size-full object-cover transition-opacity duration-700', bg === 'ok' ? 'opacity-100' : 'opacity-0')}
            />
          )}
          {phase === 'dusk' && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#ff9b6a55,#ffcf9a22_60%,#7a5cff22)] mix-blend-multiply" />}
          {phase === 'dawn' && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#ffc4d655,#fff1d022_60%,transparent)] mix-blend-soft-light" />}

          {bg !== 'ok' && <Stones spots={SPOTS.slice(0, Math.min(MAX_SPOTS, garden.spots + 1))} faintLast={garden.spots < MAX_SPOTS} />}
          {/* spots and plants, back to front */}
          {SPOTS.map((sp, i) => {
            const plant = bySpot.get(i);
            const size = Math.round(H * PLANT_H * sp.s);
            const pw = Math.round(size * PLANT_RATIO);
            const style: CSSProperties = { left: `${sp.x}%`, top: `${sp.y}%`, zIndex: Math.round(sp.y) };
            if (plant) {
              const moving = placing?.kind === 'move';
              return (
                <div key={i} className="absolute" style={{ ...style, width: pw, height: size, marginLeft: -pw / 2, marginTop: -size }}>
                  <div className="pointer-events-none absolute -bottom-[3%] left-1/2 h-[7%] w-[80%] -translate-x-1/2 rounded-[50%] bg-[#2b3a1c]/35 blur-[3px]" />
                  <button
                    onClick={() => tapPlant(plant)}
                    aria-label={`${speciesOf(plant.species).name}${moving ? ': swap here' : ''}`}
                    className={cn('absolute inset-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-white/70', moving && placing.id !== plant.id && 'ring-2 ring-white/70 ring-offset-0', can && 'cursor-none')}
                  >
                    <div key={`${pours[plant.id] ?? 0}`} className={cn('absolute inset-0', fresh === plant.id ? 'gd-plant-in' : pours[plant.id] && 'gd-hop')}>
                      <PlantView species={plant.species} growth={1} size={size} sway={!night} seed={plant.id} />
                    </div>
                  </button>
                  {!night && hashString(plant.id) % 3 === 0 && (
                    <div className="pointer-events-none absolute left-0 w-full" style={{ top: plantTop(plant.species, 6) * size + size * 0.05 }}>
                      <Bee size={size} />
                    </div>
                  )}
                  {(pours[plant.id] ?? 0) > 0 && <Pour key={pours[plant.id]} size={size} top={plantTop(plant.species, 6)} />}
                </div>
              );
            }
            if (i < garden.spots) {
              const glow = !!placing;
              if (!glow) return null;
              return (
                <button
                  key={i}
                  onClick={() => tapSpot(i)}
                  aria-label={`Plant in spot ${i + 1}`}
                  className={cn('absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[50%] border-[3px] border-dashed transition-colors', 'gd-breathe cursor-pointer border-white bg-white/35 text-white')}
                  style={{ ...style, width: pw * 1.2, height: pw * 0.5, top: `calc(${sp.y}% - ${pw * 0.06}px)` }}
                >
                  <span className="text-xl font-black drop-shadow">+</span>
                </button>
              );
            }
            if (i === garden.spots) {
              return (
                <button
                  key={i}
                  onClick={unlock}
                  className={cn('pressable absolute flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black whitespace-nowrap', PAPER)}
                  style={style}
                  aria-label={`Open a new spot for ${spotPrice(garden.spots)} fish coins`}
                >
                  <Lock size={13} /> New spot · 🐟 {spotPrice(garden.spots)}
                </button>
              );
            }
            return null;
          })}

          {/* above the plants (they sit at z = their depth) */}
          <div className="pointer-events-none absolute inset-0 z-[100]">
            {night && <Night />}
            <Butterflies n={butterflies} />
            {night && <Fireflies seed={garden.plants.length} />}
          </div>
        </div>
      </div>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-[max(14px,env(safe-area-inset-top))] flex items-start justify-between gap-2 px-3 sm:px-4">
        <button onClick={() => setUI({ mode: null })} className={cn(LIGHT, 'pointer-events-auto h-10 px-3 text-sm')}>
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Back to YouFloww</span>
        </button>
        <div className={cn('rounded-2xl px-4 py-1.5 text-center', PAPER)}>
          <p className="font-display text-lg leading-tight font-semibold">🌸 Your garden</p>
          <p className="text-[11px] font-extrabold opacity-60">
            {garden.plants.length ? `${garden.plants.length} plant${garden.plants.length === 1 ? '' : 's'} · ${garden.spots} spots` : 'Grow your first flower'}
          </p>
        </div>
        <span className={cn('rounded-2xl px-3 py-2 text-sm font-black', PAPER)}>🐟 {coins}</span>
      </div>

      {/* placing banner */}
      {placing && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+64px)] flex justify-center px-3">
          <div className={cn('pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 text-sm font-extrabold', PAPER)}>
            {placing.kind === 'pot' ? `Tap a glowing spot for your ${placingName}` : 'Tap a spot (or a plant to swap)'}
            <button onClick={() => setPlacing(null)} className={cn(LIGHT, 'h-8 px-3 text-xs')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* bottom: bench + tools */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] flex items-end justify-between gap-2 px-3 sm:px-4">
        <div className="pointer-events-auto min-w-0">
          <Bench compact={compact} onShop={() => setShop(true)} onPlace={startPlacing} onWater={waterBench} pouring={benchPour} />
        </div>
        <button
          onClick={() => {
            setCan((c) => !c);
            setPlacing(null);
          }}
          aria-pressed={can}
          aria-label={can ? 'Put the watering can down' : 'Pick up the watering can'}
          title={can ? 'Put the watering can down (Esc)' : 'Watering can: tap plants to water them'}
          className={cn('pressable pointer-events-auto grid size-[68px] shrink-0 place-items-center rounded-[22px]', PAPER, can && 'ring-4 ring-[#4aa3d8]/70')}
        >
          <WateringCan className={cn('w-12 transition-transform', can && '-rotate-12')} />
        </button>
      </div>

      {/* watering can cursor */}
      {can && matchMedia('(pointer: fine)').matches && (
        <div ref={cursor} className="gd-cursor" style={{ transform: 'translate(-200px,-200px)' }}>
          <WateringCan className="w-16 -rotate-12 drop-shadow-lg" />
        </div>
      )}
      {can && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+64px)] flex justify-center px-3">
          <span className={cn('rounded-full px-4 py-1.5 text-sm font-extrabold', PAPER)}>💧 Tap a plant to water it</span>
        </div>
      )}

      {/* plant info */}
      {cardPlant && (
        <div className="absolute inset-x-0 bottom-[calc(max(12px,env(safe-area-inset-bottom))+8px)] z-[5] flex justify-center px-3" onClick={() => setCard(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <PlantCard
              plant={cardPlant}
              onClose={() => setCard(null)}
              onMove={() => {
                setPlacing({ kind: 'move', id: cardPlant.id });
                setCard(null);
              }}
            />
          </div>
        </div>
      )}

      {shop && <SeedShop hasPot={!!pot} onClose={() => setShop(false)} />}
      <span className="sr-only" aria-live="polite">
        {pot ? `${speciesOf(pot.species).name} ${Math.floor(growth * 100)} percent grown` : ''}
      </span>
    </div>
  );
}
