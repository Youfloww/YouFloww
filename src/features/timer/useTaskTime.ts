import type { Todo } from '@/data/types';
import { elapsedAt, useClock, useTimer } from '@/store/timer';

/** A task's logged seconds, including the focus session running on it right now. */
export function useLiveLoggedSeconds(todo: Todo | undefined) {
  const live = useTimer((s) => !!todo && s.activeTodoId === todo.id && s.mode === 'focus' && s.status !== 'idle');
  // Only the active task re-renders on clock ticks
  const now = useClock((s) => (live ? s.now : 0));
  const base = todo?.loggedSeconds || 0;
  if (!live) return base;
  const t = useTimer.getState();
  return base + Math.max(0, Math.floor((elapsedAt(t, Math.max(now, Date.now() - 1000)) - (t.taskMarkMs || 0)) / 1000));
}
