import { bus } from '@/lib/bus';
import { play } from '@/audio/sfx';
import { useData } from '@/store/data';
import { durationFor, elapsedAt, remainingAt, useClock, useTimer, MODE_META, SOURCES, type Mode, type SessionSource } from '@/store/timer';
import { formatClock, formatDuration } from '@/lib/time';
import { toast, useUI } from '@/store/ui';
import { haptic } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { usePrefs } from '@/store/prefs';

/* ------------------------------------------------------------------ */
/* Worker-driven ticks: setInterval inside a worker isn't throttled     */
/* the way main-thread timers are in background tabs.                  */
/* ------------------------------------------------------------------ */
let worker: Worker | null = null;
let fallback: ReturnType<typeof setInterval> | null = null;
/** this tab, so two open tabs agree on who runs a session */
const TAB = Math.random().toString(36).slice(2, 10);
/** last tick, to notice when the page stopped ticking (computer asleep, tab frozen) */
let lastTickAt = 0;
/** last sign of a person (key, tap, coming back to the tab), so auto-start never runs focus for nobody */
let lastInputAt = Date.now();
/** when auto-start last began a focus session by itself */
let autoFocusAt = 0;

function startTicking() {
  stopTicking();
  lastTickAt = Date.now();
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
/** Time-blindness check-ins already given for the current run ('half', 'five'). */
let nudged = new Set<string>();
function checkIns(rem: number, s: ReturnType<typeof useTimer.getState>) {
  if (s.mode !== 'focus' || !usePrefs.getState().checkIns) return;
  const total = s.durationMs;
  if (total >= 10 * 60_000 && rem <= total / 2 && rem > total / 2 - 5000 && !nudged.has('half')) {
    nudged.add('half');
    play('nudge');
    bus.emit('mascot:say', { text: `Halfway there! ${formatClock(rem)} to go 💪`, mood: 'wow', ms: 4200 });
  }
  if (total > 8 * 60_000 && rem <= 5 * 60_000 && rem > 5 * 60_000 - 5000 && !nudged.has('five')) {
    nudged.add('five');
    play('nudge');
    bus.emit('mascot:say', { text: '5 minutes left: finish this thought ✍️', mood: 'happy', ms: 4200 });
  }
}

function tick() {
  const now = Date.now();
  const gap = lastTickAt ? now - lastTickAt : 0;
  lastTickAt = now;
  useClock.setState({ now });
  const s = useTimer.getState();
  if (s.status !== 'running') return;
  const rem = remainingAt(s, now);
  const sec = Math.ceil(rem / 1000);
  if (s.ownerTab && s.ownerTab !== TAB) {
    // another tab runs this session: only show it, unless that tab went quiet (closed or crashed without a word)
    if (now - (s.aliveAt ?? 0) < 15_000) {
      if (sec !== lastSecond) updateTitle(rem, s.mode);
      lastSecond = sec;
      return;
    }
    useTimer.setState({ ownerTab: TAB, aliveAt: now });
  } else if (s.mode === 'focus' && gap > 60_000 && s.endAt && now - gap < s.endAt) {
    // the page stopped ticking for a while (asleep, frozen): stop at the last tick and ask
    const snap = snapshot(s);
    freezeAt(now - gap, false);
    askAboutGap(snap, gap);
    return;
  }
  // heartbeat, so a crash or a killed tab can be cut off at the last moment we know the page was open
  if (now - (s.aliveAt ?? 0) > 5000) useTimer.setState({ aliveAt: now });
  if (sec !== lastSecond) {
    lastSecond = sec;
    updateTitle(rem, s.mode);
    checkIns(rem, s);
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
/** Set when the current focus run came from "Just 5 min", so finishing can offer momentum. */
let quickRun = false;
/** who asked for the next focus session (a world's "start" button); plain starts are named after the open world */
let nextSource: SessionSource | null = null;

const sourceOf = (id: string, label?: string, emoji?: string): SessionSource => ({ id, label: label ?? SOURCES[id]?.label ?? id, emoji: emoji ?? SOURCES[id]?.emoji ?? '🎯' });
/** A plain start (space bar, the timer's button): credited to the world that's open, else the main timer. */
function plainSource(): SessionSource {
  if (quickRun) return sourceOf('quick');
  const m = useUI.getState().mode;
  return sourceOf(m && SOURCES[m] ? m : 'timer');
}

/** A focus session running on another device of this account (set by the live-session service). */
export interface Elsewhere {
  device: string;
  phone: boolean;
  label: string;
  emoji: string;
  leftMs: number;
}
let elsewhere: () => Elsewhere | null = () => null;
export const setElsewhere = (fn: () => Elsewhere | null) => void (elsewhere = fn);

/** One session at a time, across devices too: starting here while another device focuses asks to move it. */
function askMove(o: Elsewhere, go: () => void) {
  useUI.getState().set({
    confirm: {
      emoji: o.phone ? '📱' : '💻',
      title: `You’re focusing on ${o.device}`,
      body: `${o.emoji} ${o.label} is running there, ${formatClock(o.leftMs)} left. Only one session runs at a time: start here and that one ends, with its minutes logged.`,
      cancelLabel: 'Keep it there',
      confirmLabel: 'Move it here',
      fixed: true,
      onConfirm: go,
    },
  });
}

/** Start or resume. A focus session never runs on two devices at once. */
export function start() {
  const s = useTimer.getState();
  if (s.status === 'running') return;
  const o = s.mode === 'focus' ? elsewhere() : null;
  if (o) return askMove(o, begin);
  begin();
}

function begin() {
  const s = useTimer.getState();
  if (s.status === 'running') return;
  const now = Date.now();
  const fresh = s.status === 'idle';
  // An idle countdown may have been adjusted (±5 min, "Just 5 min", "10 more min"), so start from what's shown
  const remaining = s.remainingMs > 0 ? s.remainingMs : fresh ? durationFor(s.mode) : 1000;
  useTimer.setState({
    status: 'running',
    durationMs: fresh ? remaining : s.durationMs,
    endAt: now + remaining,
    runStartedAt: now,
    focusedMs: fresh ? 0 : s.focusedMs,
    sessionStartedAt: fresh ? now : s.sessionStartedAt ?? now,
    taskMarkMs: fresh ? 0 : s.taskMarkMs,
    autoPaused: false,
    aliveAt: now,
    leftMidSession: false,
    ownerTab: TAB,
    source: s.mode !== 'focus' ? null : fresh ? nextSource ?? plainSource() : s.source ?? plainSource(),
  });
  nextSource = null;
  startTicking();
  haptic(12);
  if (fresh) nudged = new Set();
  if (fresh && s.mode === 'focus') {
    play('start');
    bus.emit('session:start', { quick: quickRun });
  } else play(fresh ? 'pop' : 'resume');
  tick();
}

/** A world's "start" (a café order, a train ticket, a planner block…): a focus round of its own length, named after it. */
export function startFocusFor(minutes: number, label: string, todoId?: string | null, emoji = '🗓️', src = 'planner') {
  const o = elsewhere();
  if (o) return askMove(o, () => go());
  go();
  function go() {
    const s = useTimer.getState();
    if (s.status !== 'idle' && s.mode === 'focus') endEarly();
    if (todoId !== undefined) useTimer.setState({ activeTodoId: todoId });
    reset('focus');
    const ms = Math.max(1, Math.min(360, Math.round(minutes))) * 60_000;
    useTimer.setState({ remainingMs: ms, durationMs: ms });
    nextSource = sourceOf(src, label, emoji);
    begin();
    toast({ emoji, title: `Focusing: ${label}`, body: `${formatDuration(ms / 1000, { long: true })} on the clock` });
  }
}

/** ADHD starter: a tiny focus sprint is easier to begin than a full session. */
export function startQuick(minutes: number) {
  const o = elsewhere();
  if (o) return askMove(o, () => startQuick(minutes));
  reset('focus');
  const ms = minutes * 60_000;
  useTimer.setState({ remainingMs: ms, durationMs: ms });
  quickRun = true;
  begin();
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
  const d = mode === 'focus' ? focusDurationFor(useTimer.getState().activeTodoId) : durationFor(mode);
  useTimer.setState({
    mode,
    status: 'idle',
    durationMs: d,
    remainingMs: d,
    endAt: null,
    runStartedAt: null,
    focusedMs: 0,
    sessionStartedAt: null,
    taskMarkMs: 0,
    autoPaused: false,
    aliveAt: null,
    leftMidSession: false,
    ownerTab: null,
    source: null,
  });
  stopTicking();
  lastSecond = -1;
  quickRun = false;
  document.title = 'YouFloww — cozy focus timer';
}

/* ------------------------------------------------------------------ */
/* "Are you sure?" layer for everything that can end a session          */
/* ------------------------------------------------------------------ */
type EndKind = 'switch' | 'end' | 'reset' | 'replace';

function askToEnd(kind: EndKind, run: () => void, target?: Mode, next?: SessionSource) {
  const s = useTimer.getState();
  // Any running or paused session asks first, however short (unless the user turned the question off)
  if (s.status === 'idle' || !usePrefs.getState().confirmEnd) return run();
  const sec = Math.round(elapsedAt(s, Date.now()) / 1000);
  const focus = s.mode === 'focus';
  const spent = formatDuration(sec, { long: true });
  const logged = sec >= 30 ? `${spent} will be logged.` : 'Under 30 seconds, so it won’t be logged.';
  const copy: Record<EndKind, [string, string, string, string, string]> = {
    switch: focus
      ? ['🛑', `Switch to ${MODE_META[target ?? 'short'].label.toLowerCase()}?`, `This ends your focus session. ${logged}`, 'Keep focusing', 'End & switch']
      : ['☕', 'Cut your break short?', `You’ll switch to ${MODE_META[target ?? 'focus'].label.toLowerCase()} now.`, 'Keep resting', 'Switch'],
    end: focus ? ['🛑', 'End this session now?', `${logged} Every minute counts!`, 'Keep going', 'End session'] : ['☕', 'Skip the rest of your break?', 'You’ll go straight back to focus mode.', 'Keep resting', 'Skip break'],
    reset: ['🔄', 'Reset the timer?', focus ? `This session (${spent}) won’t count in your stats. Time on your task is kept.` : 'Your break starts over.', 'Keep going', 'Reset'],
    replace: focus
      ? [
          '⏱️',
          'One session at a time',
          `${s.source ? `${s.source.emoji} ${s.source.label}` : 'A focus session'} is running (${spent} in). Starting ${next ? `${next.emoji} ${next.label}` : 'a new one'} ends it first, so time is never counted twice. ${logged}`,
          'Keep the current one',
          'End it & start new',
        ]
      : ['☕', 'End your break?', `${next ? `${next.emoji} ${next.label}` : 'A focus session'} starts now.`, 'Keep resting', 'Start focusing'],
  };
  const [emoji, title, body, cancelLabel, confirmLabel] = copy[kind];
  useUI.getState().set({ confirm: { emoji, title, body, cancelLabel, confirmLabel, onConfirm: run } });
}

/** Mode tabs / 1-2-3 keys: picking the mode you're already in never ends anything. */
export function requestMode(mode: Mode) {
  const s = useTimer.getState();
  if (s.mode === mode) return;
  askToEnd('switch', () => setMode(mode), mode);
}
export const requestEnd = () => askToEnd('end', endEarly);
export const requestReset = () => askToEnd('reset', resetTimer);
/** `task` runs only once the user agrees, and returns the task to lock onto */
export const requestFocusFor = (minutes: number, label: string, task?: () => string | null, emoji?: string, src?: string) =>
  askToEnd('replace', () => startFocusFor(minutes, label, task?.(), emoji, src), undefined, sourceOf(src ?? 'planner', label, emoji));

/** The Reset button: the session isn't logged, but time already spent on a task still counts for that task. */
export function resetTimer() {
  bankTaskTime();
  reset();
}

export function setMode(mode: Mode) {
  const s = useTimer.getState();
  if (s.mode === mode && s.status === 'idle') return;
  // the same rule the confirm dialog states (30 s and up is logged; under that, task time is still kept)
  if (s.status !== 'idle' && s.mode === 'focus') endEarly();
  reset(mode);
  play('pop');
}

/** Add (or remove) minutes to the current countdown. */
export function adjust(minutes: number) {
  const s = useTimer.getState();
  const delta = minutes * 60_000;
  if (s.status === 'running' && s.endAt) {
    const now = Date.now();
    const rem = s.endAt - now;
    if (rem + delta < 30_000 || elapsedAt(s, now) + rem + delta > 6 * 3600_000) return;
    useTimer.setState({ endAt: s.endAt + delta, durationMs: Math.max(60_000, s.durationMs + delta) });
  } else {
    const next = Math.min(6 * 3600_000 - (s.status === 'paused' ? s.focusedMs : 0), Math.max(60_000, s.remainingMs + delta));
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
    const res = useData.getState().recordSession({ seconds, completed: false, startedAt: s.sessionStartedAt ?? Date.now() - seconds * 1000, todoId: s.activeTodoId, todoSeconds: taskShare(s, seconds), src: s.source?.id });
    play('early');
    bus.emit('session:early', { seconds });
    toast({ emoji: '🫧', title: `Logged ${formatDuration(seconds, { long: true })}`, body: 'Ended early — every minute still counts.' });
    if (res.streak === 'inc') bus.emit('mascot:say', { text: `Streak +1! 🔥`, mood: 'wow' });
  } else bankTaskTime();
  reset('focus');
}

export function skipBreak() {
  reset('focus');
  play('skip');
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
    const wasQuick = quickRun;
    const seconds = Math.round(Math.min(elapsedAt(s, Date.now()), s.durationMs + 5000) / 1000);
    const todo = useData.getState().data.todos.find((t) => t.id === s.activeTodoId);
    const res = useData.getState().recordSession({ seconds, completed: true, startedAt: s.sessionStartedAt ?? Date.now() - seconds * 1000, todoId: s.activeTodoId, todoSeconds: taskShare(s, seconds), src: s.source?.id });
    const cycle = s.cycle + 1;
    const mode = nextMode(cycle);
    useTimer.setState({ cycle, activeTodoId: res.autoCompletedTodo ? null : s.activeTodoId });
    reset(mode);
    play(res.goalReached ? 'goal' : res.streak === 'inc' && useData.getState().data.streakCount > 1 ? 'streak' : 'complete');
    haptic([20, 40, 20, 40, 60]);
    bus.emit('session:complete', { seconds, streak: res.streak, goalReached: res.goalReached, taskText: todo?.text });
    if (res.autoCompletedTodo) bus.emit('task:done', { text: res.autoCompletedTodo.text });
    notify('Focus session complete 🎉', `${formatDuration(seconds, { long: true })} of deep focus. Time for a ${mode === 'long' ? 'long' : 'short'} break!`);
    // Quick sprints never roll into a break: offer momentum instead (the completion dialog has its own "+10 min")
    if (wasQuick && settings.autoStartBreaks)
      setTimeout(
        () => toast({ emoji: '🚀', title: 'You started. That was the hard part!', body: 'Ride the momentum?', action: { label: '+10 min', run: () => startQuick(10) }, ms: 9000 }),
        1400,
      );
    else if (settings.autoStartBreaks && !wasQuick) setTimeout(start, 1200);
  } else {
    const long = s.mode === 'long';
    if (long) useTimer.setState({ cycle: 0 });
    reset('focus');
    play('break');
    haptic([30, 50, 30]);
    bus.emit('break:complete', { long });
    notify('Break is over ✨', 'Ready for another round of focus?');
    toast({ emoji: '✨', title: 'Break over', body: 'Ready when you are.', action: { label: 'Start focus', run: start } });
    // auto-start runs at most one focus session in a row for nobody: after that it waits for a key or a tap
    if (settings.autoStartFocus && !(autoFocusAt && lastInputAt < autoFocusAt))
      setTimeout(() => {
        autoFocusAt = Date.now();
        start();
      }, 1200);
  }
}

/* ------------------------------------------------------------------ */
/* Leaving the page: focus time only counts while the page is open      */
/* ------------------------------------------------------------------ */
const focusing = () => {
  const s = useTimer.getState();
  return s.status === 'running' && s.mode === 'focus';
};

/** Stop a running focus session at `at` (the moment the page went away) and keep it paused there. */
function freezeAt(at: number, left = true) {
  const s = useTimer.getState();
  if (s.status !== 'running' || s.mode !== 'focus' || !s.endAt || !s.runStartedAt) return;
  // it had already run out: that's a finished session, not a pause at 00:00
  if (at >= s.endAt) return complete();
  const cut = Math.max(s.runStartedAt, at);
  useTimer.setState({
    status: 'paused',
    remainingMs: Math.max(0, s.endAt - cut),
    focusedMs: s.focusedMs + (cut - s.runStartedAt),
    endAt: null,
    runStartedAt: null,
    autoPaused: false,
    aliveAt: null,
    leftMidSession: left,
    ownerTab: null,
  });
  stopTicking();
}

type Snapshot = Pick<ReturnType<typeof useTimer.getState>, 'endAt' | 'runStartedAt' | 'focusedMs' | 'remainingMs' | 'sessionStartedAt'>;
const snapshot = (s: Snapshot): Snapshot => ({ endAt: s.endAt, runStartedAt: s.runStartedAt, focusedMs: s.focusedMs, remainingMs: s.remainingMs, sessionStartedAt: s.sessionStartedAt });

/** YouFloww couldn't see the page for `gap` ms (asleep, frozen, killed): the person decides if that was focus */
function askAboutGap(snap: Snapshot, gap: number) {
  useUI.getState().set({
    confirm: {
      emoji: '💤',
      title: 'Were you focusing?',
      body: `YouFloww couldn’t see this page for ${formatDuration(Math.round(gap / 1000), { long: true })} (screen off, asleep or closed). Your session is paused there. Count that time as focus?`,
      cancelLabel: 'No, keep it paused',
      confirmLabel: 'Yes, count it',
      fixed: true,
      onConfirm: () => {
        const t = useTimer.getState();
        if (t.status !== 'paused' || t.mode !== 'focus' || t.sessionStartedAt !== snap.sessionStartedAt) return;
        useTimer.setState({ ...snap, status: 'running', autoPaused: false, aliveAt: Date.now(), leftMidSession: false, ownerTab: TAB });
        startTicking();
        tick();
      },
    },
  });
}

function welcomeBack() {
  const s = useTimer.getState();
  if (s.status !== 'paused' || !s.leftMidSession) return;
  updateTitle(s.remainingMs, s.mode);
  setTimeout(
    () =>
      toast({
        emoji: '⏸',
        title: 'Paused when you left',
        body: `${formatClock(s.remainingMs)} left · time away wasn’t counted`,
        action: { label: 'Resume', run: start },
        ms: 12000,
      }),
    1500,
  );
}

/** Run `fn` now, or as soon as no focus session is running (used to apply app updates between sessions). */
export function whenNotFocusing(fn: () => void) {
  const busy = () => {
    const s = useTimer.getState();
    return s.mode === 'focus' && (s.status === 'running' || (s.status === 'paused' && document.visibilityState === 'visible'));
  };
  if (!busy()) return fn();
  const check = () => {
    if (busy()) return;
    off();
    document.removeEventListener('visibilitychange', check);
    fn();
  };
  const off = useTimer.subscribe(check);
  document.addEventListener('visibilitychange', check);
}

/** Called once on boot: restore the timer honestly, and watch for the page closing mid-session. */
export function hydrateTimer() {
  const s = useTimer.getState();
  if (s.status === 'running') {
    const now = Date.now();
    const alive = s.aliveAt ?? now;
    if (s.mode === 'focus' && now - alive < 7000) startTicking(); // another open tab runs it: follow along
    else if (s.mode === 'focus') {
      // The page closed without saying so (crash, killed tab): stop the clock at the last moment it was open, then ask
      useTimer.setState({ ownerTab: TAB });
      if (s.endAt && s.endAt <= alive) setTimeout(complete, 900);
      else {
        const snap = snapshot(s);
        freezeAt(alive, false);
        setTimeout(() => askAboutGap(snap, now - alive), 1500);
      }
    } else if (s.endAt && s.endAt <= now) setTimeout(complete, 900);
    else startTicking();
  } else if (s.status === 'idle') {
    reset(s.mode);
  }
  welcomeBack();
  // Closing or refreshing mid-focus asks first (the browser's own "Leave site?"); leaving pauses the session right there
  window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
    if (!focusing()) return;
    e.preventDefault();
    e.returnValue = ''; // older Chrome/Edge need this too
  });
  window.addEventListener('pagehide', () => {
    const t = useTimer.getState();
    if (!t.ownerTab || t.ownerTab === TAB) freezeAt(Date.now());
  });
  // Another tab started, paused or ended a session: show the same timer here
  window.addEventListener('storage', (e) => {
    if (e.key !== 'floww:timer') return;
    void Promise.resolve(useTimer.persist.rehydrate()).then(() => {
      const t = useTimer.getState();
      if (t.status === 'running') startTicking();
      else stopTicking();
      updateTitle(remainingAt(t, Date.now()), t.mode);
    });
  });
  const seen = () => (lastInputAt = Date.now());
  window.addEventListener('pointerdown', seen, { capture: true, passive: true });
  window.addEventListener('keydown', seen, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && seen());
  window.addEventListener('pageshow', (e: PageTransitionEvent) => e.persisted && welcomeBack());
  // Settings changes refresh an idle timer's duration
  let prev = useData.getState().data.settings;
  let prevTodo = useData.getState().data.todos.find((x) => x.id === useTimer.getState().activeTodoId);
  useData.subscribe((st) => {
    const next = st.data.settings;
    const t = useTimer.getState();
    // The active task's estimate or logged time changed (edited, synced from another device…)
    const todo = st.data.todos.find((x) => x.id === t.activeTodoId);
    if (todo !== prevTodo) {
      prevTodo = todo;
      if (t.status === 'idle' && t.mode === 'focus' && focusDurationFor(t.activeTodoId) !== t.durationMs) reset('focus');
    }
    if (next === prev) return;
    const changed = next.workDuration !== prev.workDuration || next.shortBreakDuration !== prev.shortBreakDuration || next.longBreakDuration !== prev.longBreakDuration;
    prev = next;
    if (changed && t.status === 'idle') reset();
  });
}

/* ------------------------------------------------------------------ */
/* Task timing                                                          */
/* ------------------------------------------------------------------ */
/** What's left of a task's estimate, rounded up to whole minutes (0 if none or used up). */
export function taskRemainingMs(todoId: string | null) {
  const t = todoId ? useData.getState().data.todos.find((x) => x.id === todoId && !x.completed) : undefined;
  if (!t?.estimateMinutes) return 0;
  const left = t.estimateMinutes * 60_000 - (t.loggedSeconds || 0) * 1000;
  return left >= 60_000 ? Math.min(6 * 3600_000, Math.ceil(left / 60_000) * 60_000) : 0;
}

/** A focus round counts down the active task's remaining estimate, else the usual work length. */
const focusDurationFor = (todoId: string | null) => taskRemainingMs(todoId) || durationFor('focus');

/** Seconds of a finished session that belong to the task active at the end. */
const taskShare = (s: ReturnType<typeof useTimer.getState>, seconds: number) => Math.max(0, seconds - Math.round((s.taskMarkMs || 0) / 1000));

/** Mid-session task change: bank the time so far on the previous task (or "no task"). */
function bankTaskTime() {
  const s = useTimer.getState();
  if (s.mode !== 'focus' || s.status === 'idle') return;
  const focused = elapsedAt(s, Date.now());
  const sec = (focused - (s.taskMarkMs || 0)) / 1000;
  if (sec >= 1) useData.getState().creditTask(s.activeTodoId, sec);
  useTimer.setState({ taskMarkMs: focused });
}

export function focusOnTodo(id: string | null) {
  const s = useTimer.getState();
  if (id === s.activeTodoId) return;
  bankTaskTime();
  useTimer.setState({ activeTodoId: id });
  // An idle focus timer follows the task's estimate (or goes back to the usual length)
  if (s.status === 'idle' && s.mode === 'focus') reset('focus');
  if (id) {
    const t = useData.getState().data.todos.find((x) => x.id === id);
    const left = taskRemainingMs(id);
    if (t) toast({ emoji: '🎯', title: 'Focusing on', body: left && s.status === 'idle' && s.mode === 'focus' ? `${t.text} · timer set to ${formatDuration(left / 1000)}` : t.text });
  }
}
