import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'cathome',
  label: "Cat's Home",
  emoji: '🏡',
  description: 'Visit your cat at home: decorate her rooms, feed her, see what she made',
  kind: 'mode',
  order: 20,
  key: 'h',
  load: () => import('./CatHome'),
};
