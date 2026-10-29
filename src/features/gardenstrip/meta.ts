import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'gardenstrip',
  label: 'Little garden',
  emoji: '🌱',
  description: 'Your plant grows on screen while you focus',
  kind: 'layer',
  defaultOn: true,
  order: 31,
  load: () => import('./GardenStrip'),
};
