import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'pledge',
  label: 'Focus Pledge',
  emoji: '🤝',
  description: 'Put a little money on your own goal: keep it and get it all back, miss it and it goes to charity',
  kind: 'mode',
  order: 70,
  key: 'q',
  load: () => import('./Pledge'),
};
