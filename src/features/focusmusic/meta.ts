import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'focusmusic',
  label: 'Focus music',
  emoji: '🧠',
  description: 'Brain-tuned music that keeps you in flow',
  kind: 'layer',
  defaultOn: false,
  order: 32,
  load: () => import('./FocusMusic'),
};
