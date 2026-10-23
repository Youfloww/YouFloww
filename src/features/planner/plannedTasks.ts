import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { bus } from '@/lib/bus';
import { dateKey, hmToMin, todayWeekday, WEEKDAYS, type Weekday } from '@/lib/time';
import { normalizeTodo } from '@/data/model';
import type { TimeSlot, Todo } from '@/data/types';
import { play } from '@/audio/sfx';
import { focusOnTodo, requestFocusFor, taskRemainingMs } from '../timer/engine';

/**
 * Today's planner blocks are today's tasks too: each named block gets a linked task whose estimate is the
 * block's length. Ticking either one off ticks the other; the links are refreshed whenever the plan, the
 * tasks or the date changes. A task id is the same on every device, so cloud sync never doubles them.
 */
export const plannedTodoId = (slotId: string, date = dateKey()) => `plan:${slotId}:${date}`;
const sigOf = (s: TimeSlot) => `${s.activity}|${s.start}|${s.end}`;
const lengthOf = (s: TimeSlot) => Math.max(1, hmToMin(s.end) - hmToMin(s.start));
const named = (s: TimeSlot) => typeof s.activity === 'string' && !!s.activity.trim() && s.activity !== 'New block' && !!s.start && !!s.end;
const nowMinutes = () => new Date().getHours() * 60 + new Date().getMinutes();

/** The date of this week's (Mon-Sun) occurrence of a weekly block. */
export function occurrenceKey(day: string, now = new Date()) {
  const mon0 = (d: number) => (d + 6) % 7;
  const d = new Date(now);
  d.setDate(now.getDate() + mon0(WEEKDAYS.indexOf(day as Weekday)) - mon0(now.getDay()));
  return dateKey(d);
}
export const isSlotDone = (s: TimeSlot) => !!s.doneOn && s.doneOn === occurrenceKey(s.day);

const makeTodo = (slotId: string, s: TimeSlot, date: string, done = false) =>
  normalizeTodo({ id: plannedTodoId(slotId, date), text: s.activity, estimateMinutes: lengthOf(s), createdAt: Date.now(), completed: done, completedAt: done ? Date.now() : null, plan: { slot: slotId, date, sig: sigOf(s) } });

/** Bring the task list in line with today's plan. Changes nothing (and saves nothing) when they already agree. */
export function syncPlannedTasks() {
  const { data, mutate } = useData.getState();
  const today = dateKey();
  const weekday = todayWeekday();
  const active = useTimer.getState().activeTodoId;
  const untouched = (t: Todo) => !t.completed && !t.loggedSeconds && !t.subtasks.length && t.id !== active;

  const drop = new Set<string>();
  const patch = new Map<string, Partial<Todo>>();
  const doneOn = new Map<string, string | null>();
  for (const t of data.todos) {
    if (!t.plan) continue;
    const slot = data.timetable[t.plan.slot];
    if (t.plan.date !== today) {
      // an earlier day's plan: finished ones stay as history, unfinished ones make way for today's
      if (t.plan.date < today && !t.completed && t.id !== active) drop.add(t.id);
      continue;
    }
    // block deleted, unnamed or moved off today: its task goes too, unless you already started on it
    if (!slot || slot.day !== weekday || !named(slot)) {
      if (untouched(t)) drop.add(t.id);
      continue;
    }
    // the block was edited in the planner: follow it (edits made in the task list stay until then)
    if (t.plan.sig !== sigOf(slot) && !t.completed) patch.set(t.id, { text: slot.activity, estimateMinutes: lengthOf(slot), plan: { ...t.plan, sig: sigOf(slot) } });
    if (t.completed !== (slot.doneOn === today)) doneOn.set(t.plan.slot, t.completed ? today : null);
  }

  const have = new Set(data.todos.map((t) => t.id));
  const add = Object.entries(data.timetable)
    .filter(([id, s]) => s.day === weekday && named(s) && s.skipOn !== today && !have.has(plannedTodoId(id, today)))
    .sort(([, a], [, b]) => hmToMin(a.start) - hmToMin(b.start))
    .map(([id, s]) => makeTodo(id, s, today, s.doneOn === today));

  if (!drop.size && !patch.size && !doneOn.size && !add.length) return;
  mutate((d) => {
    d.todos = d.todos.filter((t) => !drop.has(t.id));
    for (const t of d.todos) if (patch.has(t.id)) Object.assign(t, patch.get(t.id));
    for (const [id, on] of doneOn) {
      const s = d.timetable[id];
      if (s && on) s.doneOn = on;
      else if (s) delete s.doneOn;
    }
    // new ones go below the open tasks, in time order; already-done ones join the finished pile
    const firstDone = d.todos.findIndex((t) => t.completed);
    d.todos.splice(firstDone === -1 ? d.todos.length : firstDone, 0, ...add.filter((t) => !t.completed));
    d.todos.push(...add.filter((t) => t.completed));
  });
}

export function initPlannedTasks() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      try {
        syncPlannedTasks();
      } catch (e) {
        console.error('[floww] planner → tasks sync failed', e);
      }
    });
  };
  let prev = useData.getState().data;
  useData.subscribe((s) => {
    if (s.data.timetable === prev.timetable && s.data.todos === prev.todos) return;
    prev = s.data;
    schedule();
  });
  // a new day brings a new set of tasks; finished timer sessions free yesterday's active one
  setInterval(schedule, 60_000);
  schedule();
}

/** Inside the block: until it ends (or less, if most of it is already logged). Otherwise what's left of the task, or the whole block. */
export function slotFocusMinutes(slot: TimeSlot, slotId: string) {
  const s = hmToMin(slot.start);
  const e = hmToMin(slot.end);
  const now = nowMinutes();
  const left = Math.round(taskRemainingMs(plannedTodoId(slotId)) / 60_000);
  return slot.day === todayWeekday() && now >= s && now < e ? Math.min(e - now, left || Infinity) : left || e - s;
}

/** Planner "Focus": the block becomes the current task, and the timer runs for it. */
export function focusSlot(slotId: string) {
  const slot = useData.getState().data.timetable[slotId];
  if (!slot) return;
  const id = plannedTodoId(slotId);
  requestFocusFor(slotFocusMinutes(slot, slotId), slot.activity, () => {
    const st = useData.getState();
    const todo = st.data.todos.find((t) => t.id === id);
    if (todo) return todo.completed ? null : id;
    st.mutate((d) => {
      const firstDone = d.todos.findIndex((t) => t.completed);
      d.todos.splice(firstDone === -1 ? d.todos.length : firstDone, 0, makeTodo(slotId, slot, dateKey()));
    });
    return id;
  });
}

/** Planner "Mark done": today's block ticks its task (with the usual celebration); other days just flip the block. */
export function toggleSlotDone(slotId: string) {
  const st = useData.getState();
  const slot = st.data.timetable[slotId];
  if (!slot) return;
  const id = plannedTodoId(slotId);
  if (slot.day === todayWeekday() && st.data.todos.some((t) => t.id === id)) {
    const t = st.toggleTodo(id);
    if (t?.completed) {
      bus.emit('task:done', { text: t.text });
      if (useTimer.getState().activeTodoId === id) focusOnTodo(null);
    } else play('pop');
    return;
  }
  const done = isSlotDone(slot);
  st.mutate((d) => {
    const s = d.timetable[slotId];
    if (!s) return;
    if (done) delete s.doneOn;
    else s.doneOn = occurrenceKey(s.day);
  });
  play(done ? 'pop' : 'task');
}
