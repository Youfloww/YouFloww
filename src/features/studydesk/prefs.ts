import type { Paper } from './viewers/types';

/** Tiny saved settings (synced like other feature data). File names and files never go here. */
export interface DeskPrefs {
  paper: Paper;
  sidebar: boolean;
  /** the cat on the page */
  buddy: boolean;
}
export const DESK_KEY = 'studydesk';
export const DESK_DEFAULT: DeskPrefs = { paper: 'day', sidebar: true, buddy: true };
