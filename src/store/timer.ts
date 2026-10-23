import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useData } from './data';

export type Mode = 'focus' | 'short' | 'long';
export type Status = 'idle' | 'running' | 'paused';

export const MODE_META: Record<Mode, { label: string; short: string; emoji: string }> = {
  focus: { label: 'Focus', short: 'Focus', emoji: '🎯' },
  short: { label: 'Short break', short: 'Short', emoji: '☕' },
  long: { label: 'Long break', short: 'Long', emoji: '🌿' },
};

interface TimerState {
  mode: Mode;
  status: Status;
  durationMs: number;
  /** remaining when idle/paused */
  remainingMs: number;
  /** wall clock time the countdown hits zero while running */
  endAt: number | null;
  runStartedAt: number | null;
  /** running ms accumulated before the most recent resume */
  focusedMs: number;
  sessionStartedAt: number | null;
  /** focus sessions completed in the current cycle */
  cycle: number;
  activeTodoId: string | null;
  /** focused ms into the session when the current task became active (earlier time belongs to other tasks) */
  taskMarkMs: number;
  /** set when auto-paused by presence guard */
  autoPaused: boolean;

  set: (p: Partial<TimerState>) => void;
}

export const durationFor = (mode: Mode) => {
  const s = useData.getState().data.settings;
  return 1000 * (mode === 'focus' ? s.workDuration : mode === 'short' ? s.shortBreakDuration : s.longBreakDuration);
};

export const useTimer = create<TimerState>()(
  persist(
    (set) => ({
      mode: 'focus',
      status: 'idle',
      durationMs: 25 * 60 * 1000,
      remainingMs: 25 * 60 * 1000,
      endAt: null,
      runStartedAt: null,
      focusedMs: 0,
      sessionStartedAt: null,
      cycle: 0,
      activeTodoId: null,
      taskMarkMs: 0,
      autoPaused: false,
      set: (p) => set(p),
    }),
    { name: 'floww:timer', version: 1 },
  ),
);

/** Remaining ms at time `now`. */
export function remainingAt(s: Pick<TimerState, 'status' | 'endAt' | 'remainingMs'>, now: number) {
  return s.status === 'running' && s.endAt ? Math.max(0, s.endAt - now) : s.remainingMs;
}

/** Actual running (non-paused) ms of the current session at `now`. */
export function elapsedAt(s: Pick<TimerState, 'status' | 'runStartedAt' | 'focusedMs'>, now: number) {
  return s.focusedMs + (s.status === 'running' && s.runStartedAt ? now - s.runStartedAt : 0);
}

/** A tiny clock store, ticked by a worker so it keeps going in background tabs. */
export const useClock = create<{ now: number }>(() => ({ now: Date.now() }));
