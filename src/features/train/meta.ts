import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'train',
  label: 'Scenic Train',
  emoji: '🚆',
  description: 'Ride a real scenic railway while you focus, and collect station stamps',
  kind: 'mode',
  order: 45,
  key: 'x',
  load: () => import('./Train'),
};
