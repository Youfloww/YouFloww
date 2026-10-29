import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'window',
  label: 'Window Seat',
  emoji: '🪟',
  description: 'A calm window where the day passes, dawn to night, as you focus',
  kind: 'mode',
  order: 46,
  load: () => import('./WindowSeat'),
};
