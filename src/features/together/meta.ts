import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'together',
  label: 'Study Hall',
  emoji: '🫶',
  description: 'A cozy shared hall: study beside real people, send high-fives, grow a plant together',
  kind: 'mode',
  order: 60,
  key: 'v',
  load: () => import('./Together'),
};
