import type { FeatureMeta } from '../registry';

export const meta: FeatureMeta = {
  id: 'studydesk',
  label: 'Study Desk',
  emoji: '📚',
  description: 'Open your PDFs, notes and slides and study with your buddy on top',
  kind: 'mode',
  order: 50,
  key: 'u',
  load: () => import('./StudyDesk'),
};
