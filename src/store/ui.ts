import { create } from 'zustand';
import { uid } from '@/lib/utils';

export type PanelId =
  | 'tasks'
  | 'sounds'
  | 'scenes'
  | 'stats'
  | 'journal'
  | 'planner'
  | 'community'
  | 'achievements'
  | 'settings'
  | 'account';

export interface Toast {
  id: string;
  title: string;
  body?: string;
  emoji?: string;
  action?: { label: string; run: () => void };
  ms?: number;
}

interface UIState {
  panel: PanelId | null;
  palette: boolean;
  zen: boolean;
  help: boolean;
  auth: boolean;
  onboarding: boolean;
  completion: { seconds: number; taskText?: string | null } | null;
  toasts: Toast[];
  openPanel: (p: PanelId | null) => void;
  togglePanel: (p: PanelId) => void;
  set: (patch: Partial<Omit<UIState, 'set' | 'openPanel' | 'togglePanel' | 'toast' | 'dismiss'>>) => void;
  toast: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useUI = create<UIState>()((set) => ({
  panel: null,
  palette: false,
  zen: false,
  help: false,
  auth: false,
  onboarding: false,
  completion: null,
  toasts: [],
  openPanel: (panel) => set({ panel }),
  togglePanel: (p) => set((s) => ({ panel: s.panel === p ? null : p })),
  set: (patch) => set(patch),
  toast: (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUI.getState().toast(t);
