import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'flights',
  label: 'Focus Flights',
  emoji: '✈️',
  description: 'Fly anywhere on Earth: the flight is your focus session',
  kind: 'mode',
  order: 40,
  key: 'i',
  load: () => import('./Flights'),
};
