/** How focus turns into fish coins. Imported once at startup (tiny, no UI). */
import { bus } from '@/lib/bus';
import { earn } from './wallet';

let started = false;

export function startEarnings() {
  if (started) return;
  started = true;
  // 1 coin per focused minute, +25% on a streak day, +10 when the daily goal is hit
  bus.on('session:complete', ({ seconds, streak, goalReached }) => {
    const minutes = Math.floor(seconds / 60);
    earn(minutes * (streak === 'inc' ? 1.25 : 1) + (goalReached ? 10 : 0), 'focus');
  });
  // ended early: half pay, and only for real effort
  bus.on('session:early', ({ seconds }) => {
    if (seconds >= 5 * 60) earn(Math.floor(seconds / 120), 'focus-early');
  });
}
