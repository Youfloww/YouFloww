import { create } from 'zustand';
import { creditTask, normalizeUserData, normalizeTodo, recordFocusSession, rollover, type RecordSessionInput, type RecordSessionResult } from '@/data/model';
import type { JournalEntry, Settings, TimeSlot, Todo, UserData } from '@/data/types';
import { dateKey } from '@/lib/time';
import { uid } from '@/lib/utils';

export const GUEST_KEY = 'youfloww_guest';

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
  photo: string | null;
}

export type SyncState = 'local' | 'saving' | 'saved' | 'offline' | 'error';

interface DataState {
  data: UserData;
  user: AuthUser | null;
  authReady: boolean;
  sync: SyncState;
  /** bumps on every local mutation so the sync layer can persist */
  rev: number;
  /** true when the last change came from the server (don't echo it back) */
  remote: boolean;

  mutate: (fn: (d: UserData) => void) => void;
  replace: (d: UserData, remote?: boolean) => void;

  recordSession: (input: RecordSessionInput) => RecordSessionResult;
  /** Credit part of a running session to a task when the focused task changes mid-session. */
  creditTask: (todoId: string | null, seconds: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setProfileName: (name: string) => void;

  addTodo: (text: string, extra?: Partial<Todo>) => Todo;
  updateTodo: (id: string, patch: Partial<Todo>) => void;
  toggleTodo: (id: string) => Todo | undefined;
  deleteTodo: (id: string) => Todo | undefined;
  restoreTodo: (todo: Todo, index: number) => void;
  reorderTodos: (ids: string[]) => void;
  clearCompleted: () => void;
  addSubtask: (todoId: string, text: string) => void;
  toggleSubtask: (todoId: string, subId: string) => void;
  deleteSubtask: (todoId: string, subId: string) => void;
  ensureCategory: (name: string) => string;
  deleteCategory: (id: string) => void;

  saveJournal: (key: string, patch: Partial<JournalEntry>) => void;
  deleteJournal: (key: string) => void;

  addSlot: (slot: Omit<TimeSlot, 'completed'>) => string;
  updateSlot: (id: string, patch: Partial<TimeSlot>) => void;
  deleteSlot: (id: string) => void;

  unlockAchievements: (ids: string[]) => void;
  rateLastSession: (rating: number, note?: string) => void;
}

function loadGuest(): UserData {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      const d = normalizeUserData(JSON.parse(raw));
      return d;
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  const d = normalizeUserData({});
  return d;
}

/** A planner block's task was removed by hand: don't re-add it for that date. */
const skipPlanned = (d: UserData, t?: Todo) => {
  const slot = t?.plan && d.timetable[t.plan.slot];
  if (slot) slot.skipOn = t.plan!.date;
};

export const useData = create<DataState>()((set, get) => {
  const mutate = (fn: (d: UserData) => void) => {
    const draft = structuredClone(get().data);
    fn(draft);
    draft.updatedAt = Date.now();
    set((s) => ({ data: draft, rev: s.rev + 1, remote: false }));
  };

  return {
    data: loadGuest(),
    user: null,
    authReady: false,
    sync: 'local',
    rev: 0,
    remote: false,

    mutate,
    replace: (d, remote = false) => set((s) => ({ data: d, remote, rev: remote ? s.rev : s.rev + 1 })),

    recordSession: (input) => {
      let result!: RecordSessionResult;
      mutate((d) => {
        rollover(d, dateKey(new Date(input.startedAt)));
        result = recordFocusSession(d, input);
      });
      return result;
    },

    creditTask: (todoId, seconds) =>
      mutate((d) => {
        creditTask(d, todoId ? d.todos.find((t) => t.id === todoId) : undefined, Math.round(seconds));
      }),

    updateSettings: (patch) => mutate((d) => void Object.assign(d.settings, patch)),
    setProfileName: (name) => mutate((d) => void (d.profileName = name.trim().slice(0, 40) || 'Floww User')),

    addTodo: (text, extra = {}) => {
      const todo = normalizeTodo({ text, createdAt: Date.now(), ...extra, id: uid() });
      mutate((d) => {
        // New tasks go above completed ones, below the existing open ones
        const firstDone = d.todos.findIndex((t) => t.completed);
        if (firstDone === -1) d.todos.push(todo);
        else d.todos.splice(firstDone, 0, todo);
      });
      return todo;
    },
    updateTodo: (id, patch) =>
      mutate((d) => {
        const t = d.todos.find((x) => x.id === id);
        if (t) Object.assign(t, patch);
      }),
    toggleTodo: (id) => {
      let out: Todo | undefined;
      mutate((d) => {
        const t = d.todos.find((x) => x.id === id);
        if (!t) return;
        t.completed = !t.completed;
        t.completedAt = t.completed ? Date.now() : null;
        if (t.completed && t.canonicalId) {
          const k = dateKey();
          d.weeklyCategoryCompletionsByDate[k] ??= {};
          const c = String(t.canonicalId);
          d.weeklyCategoryCompletionsByDate[k][c] = (d.weeklyCategoryCompletionsByDate[k][c] || 0) + 1;
        }
        // Completed items sink to the bottom
        d.todos.sort((a, b) => Number(a.completed) - Number(b.completed));
        out = { ...t };
      });
      return out;
    },
    deleteTodo: (id) => {
      let out: Todo | undefined;
      mutate((d) => {
        const i = d.todos.findIndex((x) => x.id === id);
        if (i >= 0) out = d.todos.splice(i, 1)[0];
        skipPlanned(d, out);
      });
      return out;
    },
    restoreTodo: (todo, index) =>
      mutate((d) => {
        d.todos.splice(Math.min(index, d.todos.length), 0, todo);
      }),
    reorderTodos: (ids) =>
      mutate((d) => {
        const map = new Map(d.todos.map((t) => [t.id, t]));
        const ordered = ids.map((id) => map.get(id)).filter(Boolean) as Todo[];
        const rest = d.todos.filter((t) => !ids.includes(t.id));
        d.todos = [...ordered, ...rest];
      }),
    clearCompleted: () =>
      mutate((d) => {
        d.todos.filter((t) => t.completed).forEach((t) => skipPlanned(d, t));
        d.todos = d.todos.filter((t) => !t.completed);
      }),
    addSubtask: (todoId, text) =>
      mutate((d) => {
        d.todos.find((x) => x.id === todoId)?.subtasks.push({ id: uid(), text: text.slice(0, 200), completed: false });
      }),
    toggleSubtask: (todoId, subId) =>
      mutate((d) => {
        const s = d.todos.find((x) => x.id === todoId)?.subtasks.find((x) => x.id === subId);
        if (s) s.completed = !s.completed;
      }),
    deleteSubtask: (todoId, subId) =>
      mutate((d) => {
        const t = d.todos.find((x) => x.id === todoId);
        if (t) t.subtasks = t.subtasks.filter((s) => s.id !== subId);
      }),
    ensureCategory: (name) => {
      const clean = name.trim().replace(/^#/, '').slice(0, 30);
      const existing = get().data.regularTasks.find((r) => r.name.toLowerCase() === clean.toLowerCase());
      if (existing) return existing.id;
      const id = uid();
      mutate((d) => void d.regularTasks.push({ id, name: clean }));
      return id;
    },
    deleteCategory: (id) =>
      mutate((d) => {
        d.regularTasks = d.regularTasks.filter((r) => r.id !== id);
        d.todos.forEach((t) => {
          if (t.canonicalId === id) t.canonicalId = null;
        });
      }),

    saveJournal: (key, patch) =>
      mutate((d) => {
        const prev = d.journalEntries[key] ?? { text: '', date: key };
        d.journalEntries[key] = { ...prev, ...patch, date: key, updatedAt: Date.now() };
      }),
    deleteJournal: (key) => mutate((d) => void delete d.journalEntries[key]),

    addSlot: (slot) => {
      const id = `${slot.day}-${slot.start}-${slot.end}-${uid().slice(0, 4)}`;
      mutate((d) => {
        d.timetable[id] = { ...slot, completed: false };
      });
      return id;
    },
    updateSlot: (id, patch) =>
      mutate((d) => {
        const s = d.timetable[id];
        if (s) Object.assign(s, patch);
      }),
    deleteSlot: (id) => mutate((d) => void delete d.timetable[id]),

    unlockAchievements: (ids) =>
      mutate((d) => {
        d.achievements ??= {};
        for (const id of ids) d.achievements[id] ??= Date.now();
      }),
    rateLastSession: (rating, note) =>
      mutate((d) => {
        const last = d.sessionLog?.[d.sessionLog.length - 1];
        if (last) {
          last.rating = rating;
          if (note) last.note = note.slice(0, 200);
        }
      }),
  };
});

/** Hydrate a fresh guest state, used on sign-out. */
export const loadGuestData = loadGuest;
