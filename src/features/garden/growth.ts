/**
 * The light, shared part of the plant (no drawing code, safe to import anywhere):
 * the species list, the plant box, milestone names and how tall each plant is at a growth value.
 *
 * Growth g (0..1) is a continuous number: the share of the species' focus minutes already done (see model.ts).
 * The painting (render/plants.ts) is a smooth function of g; the names below are only words for the UI.
 */
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

/** Species the shop sells (all five are drawn by the renderer). */
export const PLANT_READY: Record<PlantSpeciesId, boolean> = { sunflower: true, tulip: true, rose: true, lavender: true, sakura: true };

/** The plant box in drawing units (the pot sits at the bottom centre). */
export const BOX_W = 224;
export const BOX_H = 420;
/** width / height of the box */
export const PLANT_RATIO = BOX_W / BOX_H;
/** centre of the soil surface, and its half-axes */
export const SOIL_X = 112;
export const SOIL_Y = 310;
export const SOIL_RX = 46;
export const SOIL_RY = 13;
/** the pot painting's place in the box */
export const POT = { x: 53, y: 284, w: 122, h: 132 };

/** Milestone names. Growth is continuous; these are only labels (they start where the old painted stages began). */
export const STAGE_NAMES = ['Seed', 'Sprout', 'Seedling', 'Young plant', 'Bud', 'Bloom', 'Full bloom'] as const;
export const STAGE_AT = [0, 0.06, 0.16, 0.32, 0.52, 0.76, 1] as const;

/** Which milestone a growth value is in. (`next`/`blend` kept for older callers: the plant itself never swaps.) */
export function stageOf(growth: number) {
  const g = Math.min(1, Math.max(0, growth || 0));
  let stage = 0;
  for (let i = 0; i < STAGE_AT.length; i++) if (g >= STAGE_AT[i]) stage = i;
  const next = Math.min(STAGE_AT.length - 1, stage + 1);
  const within = stage >= STAGE_AT.length - 1 ? 1 : (g - STAGE_AT[stage]) / (STAGE_AT[next] - STAGE_AT[stage]);
  return { stage, next, blend: 0, within, name: STAGE_NAMES[stage] };
}

/**
 * Top of the plant (fraction of the box height from the top) at growth g, for butterflies, drops and bubbles.
 * Sampled from the renderer every 0.05 of growth (tools: the dev sheet prints it), linearly interpolated.
 */
const TOPS: Record<PlantSpeciesId, readonly number[]> = {
  sunflower: [0.7, 0.69, 0.67, 0.67, 0.66, 0.63, 0.6, 0.55, 0.5, 0.46, 0.41, 0.35, 0.28, 0.23, 0.18, 0.15, 0.14, 0.12, 0.1, 0.08, 0.07],
  tulip: [0.72, 0.71, 0.63, 0.53, 0.48, 0.47, 0.51, 0.52, 0.52, 0.5, 0.42, 0.35, 0.28, 0.22, 0.18, 0.17, 0.17, 0.16, 0.16, 0.15, 0.15],
  rose: [0.72, 0.7, 0.68, 0.68, 0.65, 0.6, 0.54, 0.49, 0.42, 0.39, 0.35, 0.29, 0.28, 0.26, 0.25, 0.25, 0.24, 0.22, 0.21, 0.2, 0.2],
  lavender: [0.7, 0.7, 0.68, 0.65, 0.6, 0.59, 0.59, 0.59, 0.59, 0.59, 0.58, 0.5, 0.42, 0.35, 0.31, 0.31, 0.31, 0.31, 0.31, 0.31, 0.31],
  sakura: [0.7, 0.69, 0.67, 0.67, 0.66, 0.62, 0.6, 0.56, 0.51, 0.45, 0.38, 0.32, 0.29, 0.27, 0.27, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26],
};
export function plantTopAt(species: PlantSpeciesId, growth: number) {
  const t = TOPS[species] ?? TOPS.sunflower;
  const f = Math.min(1, Math.max(0, growth || 0)) * (t.length - 1);
  const i = Math.min(t.length - 2, Math.floor(f));
  return t[i] + (t[i + 1] - t[i]) * (f - i);
}
/** @deprecated stage-based: kept so old callers still work */
export const plantTop = (species: PlantSpeciesId, stage: number) => plantTopAt(species, STAGE_AT[Math.max(0, Math.min(6, stage))]);
