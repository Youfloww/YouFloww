import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'window',
  label: 'Window Seat',
  emoji: '🪟',
  description: 'Sit by a real window: live and looping views from Tokyo, Paris, a snowy cabin…',
  kind: 'mode',
  order: 46,
  load: () => import('./WindowSeat'),
};
