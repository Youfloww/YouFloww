/**
 * Garden bookkeeping that must run even when the garden is not on screen: bank finished focus into the pot as soon as
 * a session is logged, and again at midnight (before the plant's thirst level changes). The garden code is loaded
 * lazily so this stays tiny. Call `startGardenBanking()` once at startup, next to `startEarnings()`.
 */
import { bus } from '@/lib/bus';

let started = false;
const bankNow = () => void import('./model').then((m) => m.bank()).catch(() => {});

export function startGardenBanking() {
  if (started) return;
  started = true;
  const later = () => setTimeout(bankNow, 0);
  bus.on('session:complete', later);
  bus.on('session:early', later);
  const toMidnight = () => {
    const n = new Date();
    // one second before midnight, so focus is banked at the old thirst level
    return Math.max(2000, new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime() - 1000);
  };
  const arm = () =>
    setTimeout(() => {
      bankNow();
      arm();
    }, toMidnight());
  arm();
}
