/** The seed shop: what each plant costs and how much focus it needs to reach full bloom. */
import { PLANT_INFO, PLANT_READY, PLANT_SPECIES, type PlantSpeciesId } from './PlantView';

export interface Species {
  id: PlantSpeciesId;
  name: string;
  emoji: string;
  /** fish coins for a seed */
  price: number;
  /** focused minutes (well watered) from seed to full bloom */
  minutes: number;
  blurb: string;
  /** a soft colour for cards and sparkles */
  tint: string;
}

const EXTRA: Record<PlantSpeciesId, Omit<Species, 'id' | 'name' | 'emoji'>> = {
  sunflower: { price: 30, minutes: 100, blurb: 'Quick and cheerful. Turns its face to your hard work.', tint: '#f6c445' },
  tulip: { price: 50, minutes: 125, blurb: 'A spring classic in soft pink. Blooms in a couple of days.', tint: '#f49ab4' },
  lavender: { price: 80, minutes: 175, blurb: 'Calm, fragrant spikes of purple. Bees adore it.', tint: '#a58ad8' },
  rose: { price: 110, minutes: 225, blurb: 'Slow to open, worth every minute. Velvet red petals.', tint: '#d9465f' },
  sakura: { price: 180, minutes: 350, blurb: 'A tiny cherry tree. A true labour of focus.', tint: '#f7b8c8' },
};

export const SPECIES: Species[] = PLANT_SPECIES.filter((id) => PLANT_READY[id]).map((id) => ({ id, ...PLANT_INFO[id], ...EXTRA[id] }));
export const speciesOf = (id: PlantSpeciesId) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];
