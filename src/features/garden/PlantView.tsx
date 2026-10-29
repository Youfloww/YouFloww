/**
 * PlantView: one painted potted plant that grows and wilts. Reusable anywhere (garden, idle strip, the
 * "together" shared plant, ...).
 *
 *   import { PlantView } from '@/features/garden/PlantView';
 *   <PlantView species="sunflower" growth={0.4} wilt={0} size={160} />
 *
 * Props
 * - species  'sunflower' | 'tulip' | 'rose' | 'lavender' | 'sakura'   (PLANT_SPECIES lists them)
 * - growth   0..1   0 = a seed in the pot, 1 = full bloom. 7 painted stages (STAGE_NAMES); near the end of each
 *                   stage the next one fades in, so live growth during a session looks continuous.
 * - wilt     0..1   0 = healthy, 1 = very droopy (leans, sags and fades a little). Changes animate, so dropping
 *                   it back to 0 shows the plant recovering. Only the plant droops; the pot stays put.
 * - size     px     height of the box. Width is size * PLANT_RATIO. The pot always sits at the bottom centre
 *                   at the same place for every species and stage, so plants line up on a shelf.
 * - sway     boolean (default true) gentle breeze sway (CSS only; off with prefers-reduced-motion).
 * - className, style, alt
 *
 * Dependency-free: React only (no stores, no app imports). Its keyframes are injected once. Images are
 * WebP stages in /img/garden/<species>-<0..6>.webp (224×420, transparent), loaded lazily.
 */
import { useInsertionEffect, type CSSProperties } from 'react';

export const PLANT_SPECIES = ['sunflower', 'tulip', 'rose', 'lavender', 'sakura'] as const;
export type PlantSpeciesId = (typeof PLANT_SPECIES)[number];

/** Display name + emoji for each species. */
export const PLANT_INFO: Record<PlantSpeciesId, { name: string; emoji: string }> = {
  sunflower: { name: 'Sunflower', emoji: '🌻' },
  tulip: { name: 'Tulip', emoji: '🌷' },
  rose: { name: 'Rose', emoji: '🌹' },
  lavender: { name: 'Lavender', emoji: '🪻' },
  sakura: { name: 'Cherry blossom bonsai', emoji: '🌸' },
};

/** Species whose paintings are in /img/garden (a species is only sold once its 7 stages are there). */
export const PLANT_READY: Record<PlantSpeciesId, boolean> = { sunflower: true, tulip: true, rose: true, lavender: true, sakura: true };

export const STAGE_NAMES = ['Seed', 'Sprout', 'Seedling', 'Young plant', 'Bud', 'Bloom', 'Full bloom'] as const;
/** Growth (0..1) at which each stage begins. Early stages come quickly so a first session shows a sprout. */
export const STAGE_AT = [0, 0.06, 0.16, 0.32, 0.52, 0.76, 1] as const;
/** width / height of the art box */
export const PLANT_RATIO = 224 / 420;
/** Soil line (fraction of the box height from the top): the plant droops and sways around it. */
const SOIL = 0.69;

/** Top of the painted plant for each stage (fraction of the box height from the top), for butterflies and bubbles. */
export const PLANT_TOP: Record<PlantSpeciesId, readonly number[]> = {
  sunflower: [0.676, 0.645, 0.514, 0.343, 0.2, 0.133, 0.062],
  tulip: [0.629, 0.636, 0.5, 0.376, 0.279, 0.143, 0.014],
  rose: [0.562, 0.662, 0.564, 0.467, 0.407, 0.41, 0.331],
  lavender: [0.676, 0.679, 0.576, 0.467, 0.379, 0.348, 0.333],
  sakura: [0.71, 0.648, 0.533, 0.386, 0.314, 0.386, 0.25],
};
export const plantTop = (species: PlantSpeciesId, stage: number) => PLANT_TOP[species]?.[Math.max(0, Math.min(6, stage))] ?? 0.4;

export const plantImg = (species: PlantSpeciesId, stage: number) => `/img/garden/${species}-${stage}.webp`;

/** Which stage shows at a growth value, and how far the next stage has faded in (0..1). */
export function stageOf(growth: number) {
  const g = Math.min(1, Math.max(0, growth || 0));
  let stage = 0;
  for (let i = 0; i < STAGE_AT.length; i++) if (g >= STAGE_AT[i]) stage = i;
  if (stage >= STAGE_AT.length - 1) return { stage, next: stage, blend: 0 };
  const a = STAGE_AT[stage];
  const b = STAGE_AT[stage + 1];
  const t = (g - a) / (b - a);
  // the last 15% of a stage slowly becomes the next one
  const blend = Math.max(0, (t - 0.85) / 0.15);
  return { stage, next: stage + 1, blend };
}

const CSS = `
@keyframes pv-sway { 0%,100% { transform: skewX(-1.6deg) } 50% { transform: skewX(1.6deg) } }
.pv-sway { animation: pv-sway var(--pv-sway, 5.5s) ease-in-out infinite; transform-origin: 50% ${SOIL * 100}%; }
.pv-paused .pv-sway { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .pv-sway { animation: none; } }
`;
let injected = false;
function useStyles() {
  useInsertionEffect(() => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const el = document.createElement('style');
    el.dataset.plantView = '';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const IMG: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' };

/** One stage, split at the soil line: the pot stays still, the plant above it droops and sways. */
function Stage({ src, wilt, sway, opacity, swayDelay }: { src: string; wilt: number; sway: boolean; opacity: number; swayDelay: string }) {
  const cut = `${((1 - SOIL) * 100).toFixed(2)}%`;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity, transition: 'opacity 1.2s ease' }}>
      <img src={src} alt="" draggable={false} decoding="async" loading="lazy" style={{ ...IMG, clipPath: `inset(${SOIL * 100}% 0 0 0)` }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 0 ${cut} 0)`,
          transformOrigin: `50% ${SOIL * 100}%`,
          transform: `scaleY(${1 - 0.11 * wilt}) skewX(${-8 * wilt}deg)`,
          filter: wilt > 0.01 ? `saturate(${1 - 0.45 * wilt}) sepia(${0.32 * wilt}) brightness(${1 - 0.06 * wilt})` : undefined,
          transition: 'transform 1.6s cubic-bezier(.3,1.4,.5,1), filter 1.6s ease',
        }}
      >
        <div className={sway ? 'pv-sway' : undefined} style={{ position: 'absolute', inset: 0, animationDelay: swayDelay }}>
          <img src={src} alt="" draggable={false} decoding="async" loading="lazy" style={IMG} />
        </div>
      </div>
    </div>
  );
}

export interface PlantViewProps {
  species: PlantSpeciesId;
  /** 0 = seed, 1 = full bloom */
  growth: number;
  /** 0 = healthy, 1 = very droopy */
  wilt?: number;
  /** box height in px (width = size * PLANT_RATIO) */
  size: number;
  sway?: boolean;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

export function PlantView({ species, growth, wilt = 0, size, sway = true, className, style, alt }: PlantViewProps) {
  useStyles();
  const sp = PLANT_INFO[species] && PLANT_READY[species] ? species : 'sunflower';
  const { stage, next, blend } = stageOf(growth);
  const w = Math.min(1, Math.max(0, wilt || 0));
  // a thirsty plant hardly moves; each plant sways on its own beat
  const doSway = sway && w < 0.6;
  const delay = `-${(sp.length * 0.7 + stage * 0.9) % 5}s`;
  return (
    <div
      role="img"
      aria-label={alt ?? `${PLANT_INFO[sp].name}, ${STAGE_NAMES[stage].toLowerCase()}${w > 0.3 ? ', thirsty' : ''}`}
      className={className}
      style={{ position: 'relative', height: size, width: Math.round(size * PLANT_RATIO), flexShrink: 0, ...style }}
    >
      <Stage key={stage} src={plantImg(sp, stage)} wilt={w} sway={doSway} opacity={1} swayDelay={delay} />
      {blend > 0 && <Stage key={`n${next}`} src={plantImg(sp, next)} wilt={w} sway={doSway} opacity={blend} swayDelay={delay} />}
    </div>
  );
}

export default PlantView;
