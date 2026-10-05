import { bus } from '@/lib/bus';
import { play } from '@/audio/sfx';
import { useData } from '@/store/data';
import { durationFor, elapsedAt, remainingAt, useClock, useTimer, MODE_META, type Mode } from '@/store/timer';
import { formatClock, formatDuration } from '@/lib/time';
import { toast } from '@/store/ui';
import { haptic } from '@/lib/utils';
import { notify } from '@/lib/notify';

/* ------------------------------------------------------------------ */
/* Worker-driven ticks: setInterval inside a worker isn't throttled     */
/* the way main-thread timers are in background tabs.                  */
/* ------------------------------------------------------------------ */
let worker: Worker | null = null;
let fallback: ReturnType<typeof setInterval> | null = null;

function startTicking() {
  stopTicking();
  try {
    if (!worker) {
      const code = 'let t;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}';
      worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      worker.onmessage = tick;
    }
    worker.postMessage(250);
  } catch {
    fallback = setInterval(tick, 250);
  }
}
function stopTicking() {
  worker?.postMessage(0);
  if (fallback) clearInterval(fallback);
  fallback = null;
}

let lastSecond = -1;
function tick() {
  const now = Date.now();
  useClock.setState({ now });
  const s = useTimer.getState();
  if (s.status !== 'running') return;
  const rem = remainingAt(s, now);
  const sec = Math.ceil(rem / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    updateTitle(rem, s.mode);
    if (useData.getState().data.settings.tickSound && s.mode === 'focus' && document.visibilityState === 'visible') play('tick');
  }
  if (rem <= 0) complete();
}

function updateTitle(rem: number, mode: Mode) {
  const s = useTimer.getState();
  if (s.status === 'idle') document.title = 'YouFloww — cozy focus timer';
  else document.title = `${s.status === 'paused' ? '⏸' : mode === 'focus' ? '●' : '☕'} ${formatClock(rem)} · ${MODE_META[mode].label} — YouFloww`;
}

/* ------------------------------------------------------------------ */
/* Actions                                                              */
/* ------------------------------------------------------------------ */
export function start() {
  const s = useTimer.getState();
  if (s.status === 'running') return;
  const now = Date.now();
  const fresh = s.status === 'idle';
  const remaining = fresh ? durationFor(s.mode) : s.remainingMs;
  useTimer.setState({
    status: 'running',
    durationMs: fresh ? remaining : s.durationMs,
    endAt: now + remaining,
    runStartedAt: now,
    focusedMs: fresh ? 0 : s.focusedMs,
    sessionStartedAt: fresh ? now : s.sessionStartedAt ?? now,
    autoPaused: false,
  });
  startTicking();
  haptic(12);
  if (fresh && s.mode === 'focus') play('start');
  else play('pop');
  tick();
}

export function pause(auto = false) {
  const s = useTimer.getState();
  if (s.status !== 'running') return;
  const now = Date.now();
  useTimer.setState({
    status: 'paused',
    remainingMs: remainingAt(s, now),
    focusedMs: elapsedAt(s, now),
    endAt: null,
    runStartedAt: null,
    autoPaused: auto,
  });
  if (!auto) play('pause');
  haptic(8);
  updateTitle(useTimer.getState().remainingMs, s.mode);
}

export const toggle = () => (useTimer.getState().status === 'running' ? pause() : start());

/** Back to a fresh countdown for the current mode; nothing is recorded. */
export function reset(mode: Mode = useTimer.getState().mode) {
  const d = durationFor(mode);
  useTimer.setState({
    mode,
    status: 'idle',
    durationMs: d,
    remainingMs: d,
    endAt: null,
    runStartedAt: null,
    focusedMs: 0,
    sessionStartedAt: null,
    autoPaused: false,
  });
  stopTicking();
  lastSecond = -1;
  document.title = 'YouFloww — cozy focus timer';
}

export function setMode(mode: Mode) {
  const s = useTimer.getState();
  if (s.mode === mode && s.status === 'idle') return;
  if (s.status !== 'idle' && s.mode === 'focus') {
    const elapsed = elapsedAt(s, Date.now());
    if (elapsed > 60_000) endEarly();
  }
  reset(mode);
  play('pop');
}

/** Add (or remove) minutes to the current countdown. */
export function adjust(minutes: number) {
  const s = useTimer.getState();
  const delta = minutes * 60_000;
  if (s.status === 'running' && s.endAt) {
    const rem = s.endAt - Date.now();
    if (rem + delta < 30_000) return;
    useTimer.setState({ endAt: s.endAt + delta, durationMs: Math.max(60_000, s.durationMs + delta) });
  } else {
    const next = Math.min(6 * 3600_000, Math.max(60_000, s.remainingMs + delta));
    useTimer.setState({ remainingMs: next, durationMs: s.status === 'idle' ? next : s.durationMs + (next - s.remainingMs) });
  }
  haptic(6);
  tick();
}

/** User ends a focus session before the timer is done: log the minutes, gently. */
export function endEarly() {
  const s = useTimer.getState();
  if (s.status === 'idle') return;
  if (s.mode !== 'focus') {
    skipBreak();
    return;
  }
  const seconds = Math.round(elapsedAt(s, Date.now()) / 1000);
  if (seconds >= 30) {
    const res = useData.getState().recordSession({ seconds, completed: false, startedAt: s.sessionStartedAt ?? Date.now() - seconds * 1000, todoId: s.activeTodoId });
    play('early');
    bus.emit('session:early', { seconds });
    toast({ emoji: '🫧', title: `Logged ${formatDuration(seconds, { long: true })}`, body: 'Ended early — every minute still counts.' });
    if (res.streak === 'inc') bus.emit('mascot:say', { text: `Streak +1! 🔥`, mood: 'wow' });
  }
  reset('focus');
}

export function skipBreak() {
  reset('focus');
  play('pop');
}

function nextMode(cycle: number): Mode {
  const interval = useData.getState().data.settings.longBreakInterval || 4;
  return cycle > 0 && cycle % interval === 0 ? 'long' : 'short';
}

/** Countdown reached zero. */
export function complete() {
  const s = useTimer.getState();
  if (s.status !== 'running') return;
  const settings = useData.getState().data.settings;
  stopTicking();

  if (s.mode === 'focus') {
    const seconds = Math.round(Math.min(elapsedAt(s, Date.now()), s.durationMs + 5000) / 1000);
    const todo = useData.getState().data.todos.find((t) => t.id === s.activeTodoId);
    const res = useData.getState().recordSession({ seconds, completed: true, startedAt: s.sessionStartedAt ?? Date.now() - seconds * 1000, todoId: s.activeTodoId });
    const cycle = s.cycle + 1;
    const mode = nextMode(cycle);
    useTimer.setState({ cycle, activeTodoId: res.autoCompletedTodo ? null : s.activeTodoId });
    reset(mode);
    play(res.streak === 'inc' && useData.getState().data.streakCount > 1 ? 'streak' : 'complete');
    haptic([20, 40, 20, 40, 60]);
    bus.emit('session:complete', { seconds, streak: res.streak, goalReached: res.goalReached, taskText: todo?.text });
    if (res.autoCompletedTodo) bus.emit('task:done', { text: res.autoCompletedTodo.text });
    notify('Focus session complete 🎉', `${formatDuration(seconds, { long: true })} of deep focus. Time for a ${mode === 'long' ? 'long' : 'short'} break!`);
    if (settings.autoStartBreaks) setTimeout(start, 1200);
  } else {
    const long = s.mode === 'long';
    if (long) useTimer.setState({ cycle: 0 });
    reset('focus');
    play('break');
    haptic([30, 50, 30]);
    bus.emit('break:complete', { long });
    notify('Break is over ✨', 'Ready for another round of focus?');
    toast({ emoji: '✨', title: 'Break over', body: 'Ready when you are.', action: { label: 'Start focus', run: start } });
    if (settings.autoStartFocus) setTimeout(start, 1200);
  }
}

/** Called once on boot: resume a persisted running timer, or close out one that finished while we were away. */
export function hydrateTimer() {
  const s = useTimer.getState();
  if (s.status === 'running') {
    // Finished while the tab was closed: wrap it up once the UI is listening
    if (s.endAt && s.endAt <= Date.now()) setTimeout(complete, 900);
    else startTicking();
  } else if (s.status === 'idle') {
    reset(s.mode);
  }
  // Settings changes refresh an idle timer's duration
  let prev = useData.getState().data.settings;
  useData.subscribe((st) => {
    const next = st.data.settings;
    if (next === prev) return;
    const changed = next.workDuration !== prev.workDuration || next.shortBreakDuration !== prev.shortBreakDuration || next.longBreakDuration !== prev.longBreakDuration;
    prev = next;
    if (changed && useTimer.getState().status === 'idle') reset();
  });
}

export function focusOnTodo(id: string | null) {
  useTimer.setState({ activeTodoId: id });
  if (id) {
    const t = useData.getState().data.todos.find((x) => x.id === id);
    if (t) toast({ emoji: '🎯', title: 'Focusing on', body: t.text });
  }
}
