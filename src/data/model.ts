import { dateKey, diffDays, keyToDate, lastNDays } from '@/lib/time';
import { uid } from '@/lib/utils';
import type { SessionLogEntry, Settings, Todo, UserData } from './types';

export const DEFAULT_SETTINGS: Required<Settings> = {
  workDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  soundProfile: 'indian',
  isAccountabilityOn: false,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  dailyGoalMinutes: 120,
  notifications: false,
  keepAwake: true,
  ambienceOnlyWhileFocusing: false,
  tickSound: false,
  use24h: false,
};

export function defaultUserData(): UserData {
  return {
    profileName: 'Floww User',
    totalFocusMinutes: 0,
    totalFocusSeconds: 0,
    totalSessions: 0,
    streakCount: 0,
    bestStreak: 0,
    lastStreakDate: null,
    longestSession: 0,
    todaySessions: 0,
    lastSessionDate: null,
    weeklyFocus: {},
    weeklyFocusSeconds: {},
    weeklySessions: {},
    weeklyCompletedSessions: {},
    weeklyEarlyEndedSessions: {},
    weeklyAnonymousSeconds: {},
    weeklyAnonymousSessions: {},
    weeklyTaskSecondsByDate: {},
    weeklyCategorySecondsByDate: {},
    weeklyCategoryCompletionsByDate: {},
    regularTasks: [],
    todos: [],
    journalEntries: {},
    timetable: {},
    settings: { ...DEFAULT_SETTINGS },
    theme: { backgroundPath: null, youtubeVideoId: null },
    dailyFocusSeconds: {},
    hourlyFocusSeconds: Array(24).fill(0),
    sessionLog: [],
    achievements: {},
    createdAt: Date.now(),
  };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const obj = <T extends object>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : d);

/**
 * Accepts anything (v2 doc, v3 doc, half-broken localStorage) and returns a
 * well-formed v3 UserData. Unknown keys are preserved.
 */
export function normalizeUserData(raw: unknown): UserData {
  const base = defaultUserData();
  const r = obj<Partial<UserData>>(raw, {});
  const d: UserData = { ...base, ...r } as UserData;

  d.profileName = typeof r.profileName === 'string' && r.profileName.trim() ? r.profileName.slice(0, 40) : base.profileName;
  for (const k of ['totalFocusMinutes', 'totalFocusSeconds', 'totalSessions', 'streakCount', 'bestStreak', 'longestSession', 'todaySessions'] as const) {
    d[k] = Math.max(0, num(r[k]));
  }
  if (!d.totalFocusSeconds && d.totalFocusMinutes) d.totalFocusSeconds = d.totalFocusMinutes * 60;

  for (const k of [
    'weeklyFocus',
    'weeklyFocusSeconds',
    'weeklySessions',
    'weeklyCompletedSessions',
    'weeklyEarlyEndedSessions',
    'weeklyAnonymousSeconds',
    'weeklyAnonymousSessions',
    'weeklyTaskSecondsByDate',
    'weeklyCategorySecondsByDate',
    'weeklyCategoryCompletionsByDate',
    'journalEntries',
    'timetable',
    'dailyFocusSeconds',
    'achievements',
  ] as const) {
    (d as Record<string, unknown>)[k] = { ...obj(r[k], {}) };
  }

  d.settings = { ...DEFAULT_SETTINGS, ...obj(r.settings, {}) };
  // v2 used 'indian' for the meme pack and sometimes a location string
  const sp = d.settings.soundProfile as string;
  if (sp !== 'indian' && sp !== 'chimes' && sp !== 'off') d.settings.soundProfile = sp === 'non-indian' ? 'chimes' : 'indian';
  for (const k of ['workDuration', 'shortBreakDuration', 'longBreakDuration'] as const) {
    const v = num(d.settings[k], DEFAULT_SETTINGS[k]);
    d.settings[k] = Math.min(6 * 3600, Math.max(60, v));
  }

  d.regularTasks = Array.isArray(r.regularTasks)
    ? r.regularTasks.filter((t) => t && typeof t.name === 'string').map((t) => ({ ...t, id: String(t.id ?? uid()) }))
    : [];

  d.todos = Array.isArray(r.todos) ? r.todos.filter(Boolean).map(normalizeTodo) : [];

  // The cloud keeps hours as a map {"0": sec, ...} so devices can add to them atomically; the app uses an array
  const hr = r.hourlyFocusSeconds as unknown;
  d.hourlyFocusSeconds = Array.isArray(hr) && hr.length === 24 ? hr.map((x) => num(x)) : hr && typeof hr === 'object' && !Array.isArray(hr) ? Array.from({ length: 24 }, (_, i) => num((hr as Record<string, unknown>)[i])) : Array(24).fill(0);
  d.sessionLog = Array.isArray(r.sessionLog) ? r.sessionLog.slice(-150) : [];

  // Seed long-lived daily history from the v2 rolling 7-day map
  const daily = d.dailyFocusSeconds!;
  for (const [k, v] of Object.entries(d.weeklyFocusSeconds)) if (!daily[k] || daily[k] < v) daily[k] = v;
  for (const [k, v] of Object.entries(d.weeklyFocus)) if (!daily[k]) daily[k] = v * 60;

  // Previously only stored in localStorage by the v2 achievements module
  try {
    const legacy = JSON.parse(localStorage.getItem('youfloww_achievements') || 'null');
    if (legacy && Array.isArray(legacy.earned)) {
      for (const id of legacy.earned) if (!d.achievements![id]) d.achievements![id] = legacy.lastChecked || Date.now();
    }
  } catch {
    /* ignore */
  }

  return rollover(d);
}

export function normalizeTodo(t: Partial<Todo>): Todo {
  return {
    ...t,
    id: String(t.id ?? uid()),
    text: String(t.text ?? '').slice(0, 300),
    completed: !!t.completed,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map((s) => ({ id: s.id ?? uid(), text: String(s.text ?? ''), completed: !!s.completed })) : [],
    estimateMinutes: num(t.estimateMinutes),
    loggedSeconds: num(t.loggedSeconds, num(t.loggedMinutes) * 60),
    createdAt: num(t.createdAt, Date.now()),
    canonicalId: t.canonicalId ?? null,
  };
}

/** Day-boundary bookkeeping: reset today counters, break dead streaks, prune old buckets. */
export function rollover(d: UserData, streakDay: string = dateKey()): UserData {
  const today = dateKey();
  if (d.lastSessionDate !== today) d.todaySessions = 0;
  // `streakDay` lets a session that started yesterday still extend yesterday's streak
  if (d.lastStreakDate && diffDays(d.lastStreakDate, streakDay) > 1) d.streakCount = 0;
  pruneWeekly(d);
  return d;
}

const WEEKLY_KEYS = [
  'weeklyFocus',
  'weeklyFocusSeconds',
  'weeklySessions',
  'weeklyCompletedSessions',
  'weeklyEarlyEndedSessions',
  'weeklyAnonymousSeconds',
  'weeklyAnonymousSessions',
  'weeklyTaskSecondsByDate',
  'weeklyCategorySecondsByDate',
  'weeklyCategoryCompletionsByDate',
] as const;

export function pruneWeekly(d: UserData) {
  const keep = new Set(lastNDays(14));
  for (const k of WEEKLY_KEYS) {
    const m = d[k] as Record<string, unknown>;
    for (const key of Object.keys(m)) if (!keep.has(key)) delete m[key];
  }
  const daily = d.dailyFocusSeconds ?? {};
  const cutoff = Date.now() - 400 * 86400000;
  for (const key of Object.keys(daily)) if (keyToDate(key).getTime() < cutoff) delete daily[key];
}

const inc = (m: Record<string, number>, k: string, by = 1) => {
  m[k] = (m[k] || 0) + by;
};

export interface RecordSessionInput {
  seconds: number;
  completed: boolean;
  startedAt: number;
  todoId?: string | null;
  /** Seconds of this session spent on `todoId` (earlier parts were credited when the task changed). Defaults to all of it. */
  todoSeconds?: number;
  /** re-recording a session that already happened elsewhere (guest/other tab): leave live task-switch stats alone */
  replay?: boolean;
  /** where it was started (a key of SOURCES in store/timer) */
  src?: string;
}

export interface RecordSessionResult {
  streak: 'inc' | 'reset' | 'none';
  autoCompletedTodo: Todo | null;
  goalReached: boolean;
}

/**
 * Pure-ish session accounting. Mutates a draft copy of the user data. Ported
 * from v2's handleEndOfWorkSession + updateStreak, plus v3 history.
 */
/** Stats for time banked mid-session (task switch). Only counted if the session ends up logged. */
const pendingStats: { at: number; day: string; text: string | null; canon: string | null; sec: number }[] = [];

function addStats(d: UserData, day: string, text: string | null, canon: string | null, sec: number) {
  d.weeklyCategorySecondsByDate[day] ??= {};
  d.weeklyTaskSecondsByDate[day] ??= {};
  if (text) inc(d.weeklyTaskSecondsByDate[day], text.slice(0, 60), sec);
  if (canon) inc(d.weeklyCategorySecondsByDate[day], canon, sec);
  else inc(d.weeklyAnonymousSeconds, day, sec);
}

/**
 * Credit focused seconds to a task's own logged time. The per-task / per-category stats are only
 * added if the session is logged (see recordFocusSession); a reset or a sub-30s session never reaches them.
 */
export function creditTask(_d: UserData, todo: Todo | undefined, sec: number) {
  if (!(sec > 0)) return;
  if (todo) todo.loggedSeconds = (todo.loggedSeconds || 0) + sec;
  pendingStats.push({ at: Date.now(), day: dateKey(), text: todo?.text ?? null, canon: todo?.canonicalId ? String(todo.canonicalId) : null, sec });
  if (pendingStats.length > 50) pendingStats.splice(0, pendingStats.length - 50);
}

/** Split a session's seconds across the local days it covered, in order. */
export function splitByDay(startedAt: number, sec: number): [string, number][] {
  const out: [string, number][] = [];
  let cursor = startedAt;
  let left = sec;
  while (left > 0) {
    const t = new Date(cursor);
    const toMidnight = Math.max(1, Math.ceil((new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime() - cursor) / 1000));
    const chunk = Math.min(left, toMidnight);
    const k = dateKey(t);
    const last = out[out.length - 1];
    if (last && last[0] === k) last[1] += chunk;
    else out.push([k, chunk]);
    left -= chunk;
    cursor += chunk * 1000;
  }
  return out;
}

export function recordFocusSession(d: UserData, input: RecordSessionInput): RecordSessionResult {
  let sec = Math.max(0, Math.round(Math.min(input.seconds, 6 * 3600)));
  const result: RecordSessionResult = { streak: 'none', autoCompletedTodo: null, goalReached: false };
  if (sec <= 0) return result;
  const now = Date.now();
  const startedAt = Number.isFinite(input.startedAt) && input.startedAt > 0 && input.startedAt <= now + 60000 ? input.startedAt : now - sec * 1000;
  // the same minutes never count twice (two devices focusing at once): drop what overlaps a session already logged
  if (!input.replay) sec -= overlapSeconds(d.sessionLog, startedAt, sec);
  if (sec <= 0) return result;
  // a session over midnight is split across both days (the session itself counts on the day it started)
  const days = splitByDay(startedAt, sec);
  const startDay = days[0][0];
  const today = days[days.length - 1][0];

  const goalSec = (d.settings.dailyGoalMinutes ?? 120) * 60;
  const before = d.dailyFocusSeconds?.[today] ?? 0;

  d.totalFocusSeconds += sec;
  d.totalFocusMinutes = Math.floor(d.totalFocusSeconds / 60);
  d.totalSessions += 1;
  d.dailyFocusSeconds ??= {};
  for (const [k, s] of days) {
    inc(d.weeklyFocusSeconds, k, s);
    d.weeklyFocus[k] = Math.floor(d.weeklyFocusSeconds[k] / 60);
    inc(d.dailyFocusSeconds, k, s);
  }
  if (d.lastSessionDate !== today) {
    d.todaySessions = 1;
    d.lastSessionDate = today;
  } else d.todaySessions += 1;
  inc(d.weeklySessions, startDay);
  inc(input.completed ? d.weeklyCompletedSessions : d.weeklyEarlyEndedSessions, startDay);

  // Spread the seconds across hour buckets the session actually covered
  d.hourlyFocusSeconds ??= Array(24).fill(0);
  let cursor = startedAt;
  let left = sec;
  while (left > 0) {
    const t = new Date(cursor);
    const toNextHour = 3600 - (t.getMinutes() * 60 + t.getSeconds());
    const chunk = Math.min(left, toNextHour);
    d.hourlyFocusSeconds[t.getHours()] += chunk;
    left -= chunk;
    cursor += chunk * 1000;
  }

  // Task attribution: the task's own time, plus the stats for every part of this (logged) session
  const todo = input.todoId ? d.todos.find((t) => t.id === input.todoId && !t.completed) : undefined;
  const share = Math.min(sec, Math.max(0, Math.round(input.todoSeconds ?? sec)));
  if (todo) todo.loggedSeconds = (todo.loggedSeconds || 0) + share;
  if (share > 0) addStats(d, today, todo?.text ?? null, todo?.canonicalId ? String(todo.canonicalId) : null, share);
  if (!input.replay) for (const p of pendingStats.splice(0)) if (p.at >= startedAt) addStats(d, p.day, p.text, p.canon, p.sec);
  if (!todo?.canonicalId) inc(d.weeklyAnonymousSessions, startDay);
  if (todo) {
    const est = (todo.estimateMinutes || 0) * 60;
    if (est > 0 && (todo.loggedSeconds || 0) >= est) {
      todo.completed = true;
      todo.completedAt = Date.now();
      if (todo.canonicalId) {
        d.weeklyCategoryCompletionsByDate[today] ??= {};
        inc(d.weeklyCategoryCompletionsByDate[today], String(todo.canonicalId));
      }
      result.autoCompletedTodo = todo;
    }
  }

  d.longestSession = Math.max(d.longestSession, Math.floor(sec / 60));

  d.sessionLog ??= [];
  d.sessionLog.push({
    at: startedAt,
    sec,
    done: input.completed,
    task: todo?.text?.slice(0, 80) ?? null,
    cat: todo?.canonicalId ?? null,
    ...(input.src ? { src: input.src } : {}),
  });
  if (d.sessionLog.length > 150) d.sessionLog.splice(0, d.sessionLog.length - 150);

  // streak: the start day first, then the end day (so a session over midnight keeps a streak alive)
  for (const [k] of days) {
    const r = bumpStreak(d, k);
    if (r === 'reset' || (r === 'inc' && result.streak === 'none')) result.streak = r;
  }
  result.goalReached = before < goalSec && before + sec >= goalSec;
  pruneWeekly(d);
  return result;
}

/**
 * Seconds of [at, at + sec] already covered by logged sessions. Overlaps under a minute are ignored: two devices'
 * clocks can differ a little, and back-to-back sessions must never lose time to that.
 */
export function overlapSeconds(log: SessionLogEntry[] | undefined, at: number, sec: number) {
  const end = at + sec * 1000;
  let ms = 0;
  for (const e of log ?? []) {
    if (e.at === at) continue;
    const o = Math.min(end, e.at + e.sec * 1000) - Math.max(at, e.at);
    if (o >= 60_000) ms += o;
  }
  return Math.min(sec, Math.round(ms / 1000));
}

function bumpStreak(d: UserData, today: string): 'inc' | 'reset' | 'none' {
  if (d.lastStreakDate && d.lastStreakDate >= today) return 'none';
  let change: 'inc' | 'reset' = 'inc';
  if (!d.lastStreakDate) d.streakCount = 1;
  else {
    const gap = diffDays(d.lastStreakDate, today);
    if (gap === 1) d.streakCount += 1;
    else {
      change = d.streakCount > 1 ? 'reset' : 'inc';
      d.streakCount = 1;
    }
  }
  d.lastStreakDate = today;
  d.bestStreak = Math.max(d.bestStreak, d.streakCount);
  return change;
}

/** Derived numbers used across stats, achievements and share cards. */
export function deriveStats(d: UserData) {
  const today = dateKey();
  const week = lastNDays(7);
  const daily = d.dailyFocusSeconds ?? {};
  const weekSeconds = week.reduce((a, k) => a + (daily[k] || 0), 0);
  const weekSessions = week.reduce((a, k) => a + (d.weeklySessions[k] || 0), 0);
  const weekDone = week.reduce((a, k) => a + (d.weeklyCompletedSessions[k] || 0), 0);
  const weekEarly = week.reduce((a, k) => a + (d.weeklyEarlyEndedSessions[k] || 0), 0);
  const todaySeconds = daily[today] || 0;
  const goalSec = (d.settings.dailyGoalMinutes ?? 120) * 60;
  const activeDays = Object.values(daily).filter((v) => v > 0).length;
  const streakAlive = d.lastStreakDate ? diffDays(d.lastStreakDate, today) <= 1 : false;
  return {
    today,
    todaySeconds,
    todaySessions: d.lastSessionDate === today ? d.todaySessions : 0,
    goalSec,
    goalProgress: goalSec ? Math.min(1, todaySeconds / goalSec) : 0,
    weekSeconds,
    weekSessions,
    completionRate: weekDone + weekEarly ? weekDone / (weekDone + weekEarly) : 0,
    avgSessionSec: d.totalSessions ? d.totalFocusSeconds / d.totalSessions : 0,
    activeDays,
    streak: streakAlive ? d.streakCount : 0,
    streakDoneToday: d.lastStreakDate === today,
  };
}
