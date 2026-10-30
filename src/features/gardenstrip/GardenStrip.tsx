/**
 * The little garden strip: your potted plant (and up to two plants from your garden) living along the bottom
 * edge of the screen, beside the dock. It grows in real time while you focus, gets thirsty once a day, sleeps
 * at night, and a butterfly visits after a long session.
 *
 * Kept almost free: a handful of DOM nodes, CSS-only animations (paused while the tab is hidden), no timers
 * except a 10-minute day/night check, art loaded lazily.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { bus } from '@/lib/bus';
import { cn, haptic, prefersReducedMotion } from '@/lib/utils';
import { PLANT_INFO, PLANT_RATIO, PlantView, STAGE_NAMES, plantTopAt, stageOf, type PlantSpeciesId } from '../garden/PlantView';
import { hasFreeSeed, needSec, usePot, useGardenSync, waterPot, type GardenPlant } from '../garden/model';
import { speciesOf } from '../garden/species';
import { Butterfly as ButterflySvg, WateringCan } from '../garden/sprites';
import './strip.css';

type Mode = 'side' | 'perch' | 'corner';
interface Place {
  x: number;
  bottom: number;
  size: number;
  mode: Mode;
  /** how many plants fit (pot + companions) */
  fit: number;
}
/** keep clear of the brain-dump button (fixed bottom-right, just above the dock) */
const RIGHT_CLEAR = 80;

const openGarden = () => useUI.getState().set({ mode: 'garden' });
const isNight = () => {
  const h = new Date().getHours();
  return h >= 21 || h < 6;
};

/** Where the strip sits: beside the dock when there's room, perched on its right end on phones, in the corner in zen. */
function usePlacement(count: number): Place | null {
  const zen = useUI((s) => s.zen);
  const [place, setPlace] = useState<Place | null>(null);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const W = innerWidth;
        const H = innerHeight;
        const big = W >= 768 ? 150 : 84;
        const width = (n: number, s: number) => s * PLANT_RATIO * (1 + 0.82 * (n - 1)) + 12;
        const dock = document.querySelector('[data-cat-perch="dock"]')?.getBoundingClientRect();
        if (dock && dock.height > 0 && !zen) {
          // beside the dock (it magnifies under the pointer, so keep a margin), as many plants as fit
          const room = W - RIGHT_CLEAR - (dock.right + 40);
          for (let n = count; n >= 1; n--) if (width(n, big) <= room) return setPlace({ x: dock.right + 40, bottom: 4, size: big, mode: 'side', fit: n });
          // phones: perch on the dock's right part (the cat's study corner sits on its left, beside the timer)
          const n = Math.min(count, 2);
          const right = Math.min(dock.right - 10, W - RIGHT_CLEAR + 6);
          return setPlace({ x: Math.round(right - width(n, 74)), bottom: Math.round(H - dock.top - 7), size: 74, mode: 'perch', fit: n });
        }
        setPlace({ x: Math.round(W - width(count, big) - RIGHT_CLEAR), bottom: 4, size: big, mode: 'corner', fit: count });
      });
    };
    measure();
    // the dock slides in when the app opens / zen ends
    const t = setTimeout(measure, 900);
    addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      removeEventListener('resize', measure);
    };
  }, [count, zen]);
  return place;
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

function useNight() {
  const [night, setNight] = useState(isNight);
  useEffect(() => {
    const check = () => setNight(isNight());
    const t = setInterval(check, 10 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return night;
}

const minutesLeft = (growth: number, species: PlantSpeciesId, mult: number) => Math.max(1, Math.ceil(((1 - growth) * needSec({ species })) / 60 / mult));

/* ------------------------------------------------------------------ */
export default function GardenStrip() {
  const [pop, setPop] = useState(0);
  useGardenSync(() => setPop((n) => n + 1));
  const { garden, pot, growth, thirst, running } = usePot();
  const companions = useMemo(() => [...garden.plants].sort((a, b) => b.bloomed - a.bloomed).slice(0, 2), [garden.plants]);
  const night = useNight();
  const hidden = useHidden();
  const [card, setCard] = useState<string | null>(null);
  const [visit, setVisit] = useState(0);
  const [watering, setWatering] = useState(0);
  const [awayWilt, setAwayWilt] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const count = 1 + companions.length;
  const place = usePlacement(count);
  const shown = companions.slice(0, Math.max(0, (place?.fit ?? 1) - 1));

  // stage ups sparkle; full bloom gets a cheer from the cat
  const stage = pot ? stageOf(growth).stage : -1;
  const prevStage = useRef(stage);
  useEffect(() => {
    const prev = prevStage.current;
    prevStage.current = stage;
    if (!pot || prev < 0 || stage <= prev) return;
    setPop((n) => n + 1);
    if (stage === STAGE_NAMES.length - 1) {
      const sp = PLANT_INFO[pot.species];
      bus.emit('mascot:say', { text: `${sp.emoji} Your ${sp.name.toLowerCase()} is in full bloom! Plant it in your garden?`, mood: 'love', ms: 6000 });
    }
  }, [stage, pot]);

  // a butterfly visits after a long session; leaving the tab mid-session makes the plant droop for a bit
  useEffect(() => {
    let t = 0;
    const offs = [
      bus.on('session:complete', ({ seconds }) => {
        if (seconds >= 25 * 60 && !prefersReducedMotion()) setVisit((n) => n + 1);
      }),
      bus.on('tab:back', ({ focusing, awayMs }) => {
        if (!focusing || awayMs < 20_000) return;
        setAwayWilt(0.5);
        clearTimeout(t);
        t = window.setTimeout(() => setAwayWilt(0), 9000);
      }),
    ];
    return () => {
      offs.forEach((o) => o());
      clearTimeout(t);
    };
  }, []);

  // close the card on outside tap / Escape
  useEffect(() => {
    if (!card) return;
    const down = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setCard(null);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setCard(null);
    addEventListener('pointerdown', down, true);
    addEventListener('keydown', key);
    return () => {
      removeEventListener('pointerdown', down, true);
      removeEventListener('keydown', key);
    };
  }, [card]);

  if (!place) return null;
  const { size, mode } = place;
  const small = Math.round(size * 0.8);
  const w = Math.round(size * PLANT_RATIO);
  const wilt = Math.max(pot ? thirst.wilt : 0, awayWilt);
  const potTop = pot ? plantTopAt(pot.species, growth) : 0.68;
  const cardLeft = Math.min(0, innerWidth - 12 - place.x - 272);

  const water = () => {
    if (!waterPot()) return;
    haptic([6, 30, 6]);
    setWatering((n) => n + 1);
  };

  return (
    <div
      ref={root}
      className={cn('gs-root pointer-events-none fixed z-[30] select-none', hidden && 'gs-paused pv-paused')}
      style={{ left: place.x, bottom: `calc(${place.bottom}px + ${mode === 'perch' ? '0px' : 'env(safe-area-inset-bottom)'})` }}
      aria-label="Little garden"
    >
      <div className={cn('flex items-end', mode === 'perch' && 'flex-row-reverse')} style={{ filter: night ? 'brightness(.84) saturate(.85)' : undefined }}>
        {/* the pot */}
        <button
          type="button"
          onClick={() => setCard(card === 'pot' ? null : 'pot')}
          aria-label={pot ? `Your ${PLANT_INFO[pot.species].name.toLowerCase()}: ${STAGE_NAMES[stage].toLowerCase()}, ${Math.floor(growth * 100)}% grown${thirst.days ? ', thirsty' : ''}` : 'Your empty pot: plant a seed'}
          aria-expanded={card === 'pot'}
          className="pointer-events-auto relative cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ width: w, height: size }}
        >
          <div key={`hop${watering}`} className={cn('absolute inset-0', watering > 0 && 'gs-hop')}>
            {pot ? (
              <PlantView species={pot.species} growth={growth} wilt={wilt} size={size} sway={!night} seed={pot.id} />
            ) : (
              <PlantView species="sunflower" growth={-1} size={size} sway={false} alt="" />
            )}
          </div>
          {!pot && (
            <span className="gs-bob absolute left-1/2 -ml-3.5 grid size-7 place-items-center rounded-full bg-white/90 text-[15px] shadow-md" style={{ top: `${size * 0.42}px` }}>
              🌱
            </span>
          )}
          {pot && thirst.days > 0 && !watering && (
            <span className="gs-bob absolute left-1/2 -ml-3 grid size-6 place-items-center rounded-full bg-white/90 text-[13px] shadow-md ring-1 ring-sky-200" style={{ top: `${Math.max(0, potTop * size - 30)}px` }}>
              💧
            </span>
          )}
          {/* growing: sparkles rise from the soil */}
          {pot && running && growth < 1 && !night && (
            <>
              <span className="gs-rise pointer-events-none absolute left-1/2 text-[10px]" style={{ top: size * 0.62 }}>
                ✨
              </span>
              <span className="gs-rise pointer-events-none absolute left-[38%] text-[8px]" style={{ top: size * 0.64, animationDelay: '1.6s', ['--dx' as string]: '-8px' }}>
                ✦
              </span>
            </>
          )}
          {pop > 0 && (
            <span key={`pop${pop}`} className="gs-pop pointer-events-none absolute left-1/2 text-2xl" style={{ top: potTop * size + 10 }}>
              ✨
            </span>
          )}
          {watering > 0 && <Watering key={`can${watering}`} size={size} top={potTop} />}
          {night && (
            <span className="gs-z pointer-events-none absolute right-0 font-display text-[11px] font-bold text-[#9fb4ff]" style={{ top: Math.max(0, potTop * size - 8) }}>
              z
            </span>
          )}
          {visit > 0 && pot && <Butterfly key={`fly${visit}`} top={potTop * size} onDone={() => setVisit(0)} />}
        </button>

        {/* plants from the garden keep it company */}
        {shown.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setCard(card === p.id ? null : p.id)}
            aria-label={`${PLANT_INFO[p.species].name} from your garden`}
            aria-expanded={card === p.id}
            className={cn('pointer-events-auto relative cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent', mode === 'perch' ? '-mr-2' : '-ml-2')}
            style={{ width: Math.round(small * PLANT_RATIO), height: small, zIndex: -1 - i }}
          >
            <PlantView species={p.species} growth={1} size={small} sway={!night} seed={p.id} />
          </button>
        ))}
      </div>

      {night && <span className="gs-firefly pointer-events-none absolute left-1/3" style={{ bottom: size * 0.55 }}><i /></span>}

      {card && (
        <div className="gs-card glass-strong pointer-events-auto absolute w-[260px] rounded-3xl p-4 text-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]" style={{ bottom: size + 10, left: cardLeft }} role="dialog" aria-label="Plant">
          {card === 'pot' ? (
            <PotCard growth={growth} thirstLabel={thirst.label} thirsty={thirst.days > 0} mult={thirst.mult} onWater={water} onClose={() => setCard(null)} />
          ) : (
            <PlantCard plant={garden.plants.find((p) => p.id === card)} onClose={() => setCard(null)} />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Watering({ size, top }: { size: number; top: number }) {
  return (
    <span className="pointer-events-none absolute inset-0">
      <WateringCan className="gs-can absolute" style={{ width: size * 0.42, left: '30%', top: Math.max(-size * 0.2, top * size - size * 0.34) }} />
      {[0, 1, 2, 3].map((i) => (
        <i
          key={i}
          className="gs-drop absolute block h-2 w-[3px] rounded-full bg-sky-400/80"
          style={{ left: `${36 + i * 7}%`, top: Math.max(0, top * size - size * 0.12), animationDelay: `${0.35 + i * 0.13}s`, ['--fall' as string]: `${size * 0.14}px` }}
        />
      ))}
    </span>
  );
}

function Butterfly({ top, onDone }: { top: number; onDone: () => void }) {
  const [rest, setRest] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setRest(true), 11_500);
    const b = setTimeout(() => setRest(false), 26_500);
    const c = setTimeout(onDone, 34_500);
    return () => [a, b, c].forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span className="gs-visit pointer-events-none absolute left-1/2 -ml-3" style={{ top: top - 14, ['--fx' as string]: '-180px', ['--fy' as string]: '-120px' }}>
      <ButterflySvg className={cn('gs-flap block w-6', rest && 'gs-rest')} />
    </span>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[linear-gradient(90deg,#8fc47a,#f2b45c)] transition-[width] duration-700" style={{ width: `${Math.max(3, value * 100)}%` }} />
    </div>
  );
}

const BTN = 'pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-extrabold whitespace-nowrap';

function PotCard({ growth, thirstLabel, thirsty, mult, onWater, onClose }: { growth: number; thirstLabel: string; thirsty: boolean; mult: number; onWater: () => void; onClose: () => void }) {
  const { pot } = usePot();
  if (!pot) {
    return (
      <div>
        <p className="font-display text-lg font-semibold">Your pot is empty 🪴</p>
        <p className="mt-1 text-sm font-semibold text-muted">{hasFreeSeed() ? 'Your first seed is a gift. Pick one and it grows while you focus.' : 'Buy a seed with fish coins and it grows while you focus.'}</p>
        <button
          className={cn(BTN, 'mt-3 w-full bg-accent text-accent-ink')}
          onClick={() => {
            onClose();
            openGarden();
          }}
        >
          🌱 Plant a seed
        </button>
      </div>
    );
  }
  const sp = speciesOf(pot.species);
  const { stage } = stageOf(growth);
  const done = growth >= 1;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg leading-tight font-semibold">
          {sp.emoji} {sp.name}
        </p>
        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-extrabold text-muted">{STAGE_NAMES[stage]}</span>
      </div>
      <div className="mt-3">
        <Bar value={growth} />
        <p className="mt-1.5 text-xs font-bold text-muted">{done ? 'In full bloom! 🌼' : `${Math.floor(growth * 100)}% · about ${minutesLeft(growth, pot.species, mult)} focus min to full bloom`}</p>
      </div>
      <p className={cn('mt-2 text-sm font-bold', thirsty ? 'text-[#c0782a]' : 'text-[#4d9a5b]')}>💧 {thirstLabel}</p>
      <div className="mt-3 flex gap-2">
        {!done && (
          <button className={cn(BTN, thirsty ? 'bg-sky-500 text-white' : 'bg-surface text-muted')} disabled={!thirsty} onClick={onWater}>
            {thirsty ? '💧 Water' : '✓ Watered'}
          </button>
        )}
        <button
          className={cn(BTN, done ? 'bg-accent text-accent-ink' : 'bg-surface text-ink')}
          onClick={() => {
            onClose();
            openGarden();
          }}
        >
          {done ? '🌸 Plant in garden' : '🌸 Garden'}
        </button>
      </div>
    </div>
  );
}

function PlantCard({ plant, onClose }: { plant?: GardenPlant; onClose: () => void }) {
  if (!plant) return null;
  const sp = speciesOf(plant.species);
  return (
    <div>
      <p className="font-display text-lg leading-tight font-semibold">
        {sp.emoji} {sp.name}
      </p>
      <p className="mt-1 text-sm font-semibold text-muted">
        Bloomed {new Date(plant.bloomed).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} after {plant.minutes} focused minutes.
      </p>
      <button
        className={cn(BTN, 'mt-3 w-full bg-surface text-ink')}
        onClick={() => {
          onClose();
          openGarden();
        }}
      >
        🌸 Visit the garden
      </button>
    </div>
  );
}
