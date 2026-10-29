import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'garden',
  label: 'Garden',
  emoji: '🌸',
  description: 'Grow flowers with your focus and plant them in your own garden',
  kind: 'mode',
  order: 30,
  key: 'n',
  load: () => import('./Garden'),
};
