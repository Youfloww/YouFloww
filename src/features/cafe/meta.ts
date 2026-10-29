import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'cafe',
  label: 'YouFloww Café',
  emoji: '☕',
  description: 'Order a drink, pick a cup size and focus with the regulars',
  kind: 'mode',
  order: 10,
  key: 'c',
  load: () => import('./Cafe'),
};
