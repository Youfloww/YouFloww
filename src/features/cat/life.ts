import { bus } from '@/lib/bus';
import { useCat } from './brain';
import { settleStudy } from './study';

/**
 * Optional always-on hook-up (see cathome/INTEGRATION.md): the cat's bookkeeping for a finished or
 * abandoned session, even while a mode hides her (CatWorld is unmounted then). Safe next to CatWorld's
 * own listeners: every session is counted once.
 */
let started = false;
export function startCatLife() {
  if (started) return;
  started = true;
  bus.on('session:complete', ({ seconds }) => {
    useCat.getState().onSessionDone(Math.round(seconds / 60));
    settleStudy(true);
  });
  bus.on('session:early', () => {
    useCat.getState().onSessionEarly();
    settleStudy(true);
  });
}
