/** How focus turns into fish coins. Imported once at startup (tiny, no UI). */
import { bus } from '@/lib/bus';
import { getFeatureData, updateFeatureData } from '@/lib/featureData';
import { earn } from './wallet';

/** Once-a-day bonus markers (the date each bonus was last paid), saved with the user's data. */
interface Paid {
  streak?: string;
  goal?: string;
}
const KEY = 'earningsPaid';
const day = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
/** True the first time it is asked for today; remembers the answer so it can't be earned twice. */
function firstToday(field: keyof Paid): boolean {
  const today = day();
  if (getFeatureData<Paid>(KEY, {})[field] === today) return false;
  updateFeatureData<Paid>(KEY, {}, (p) => void (p[field] = today));
  return true;
}

let started = false;

export function startEarnings() {
  if (started) return;
  started = true;
  // 1 coin per really-logged focused minute (completed or ended early; paused/away time is never logged),
  // +25% once a day on the session that extends the streak, +10 once a day for reaching the goal
  const pay = (seconds: number, extra: { streak?: boolean; goal?: boolean }, reason: string) => {
    const minutes = Math.floor(seconds / 60);
    const streakBonus = extra.streak && firstToday('streak') ? minutes * 0.25 : 0;
    const goalBonus = extra.goal && firstToday('goal') ? 10 : 0;
    earn(minutes + streakBonus + goalBonus, reason);
  };
  bus.on('session:complete', ({ seconds, streak, goalReached }) => pay(seconds, { streak: streak === 'inc', goal: goalReached }, 'focus'));
  bus.on('session:early', ({ seconds }) => pay(seconds, {}, 'focus-early'));
}
