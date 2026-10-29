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

/** "Are you sure?" before something ends the running session */
export interface ConfirmSpec {
  emoji: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}

export interface Toast {
  id: string;
  title: string;
  body?: string;
  emoji?: string;
  action?: { label: string; run: () => void };
  ms?: number;
}

interface UIState {
  /** Top-most open panel window (null when none) */
  panel: PanelId | null;
  /** All open panel windows, back to front */
  panels: PanelId[];
  palette: boolean;
  zen: boolean;
  help: boolean;
  auth: boolean;
  onboarding: boolean;
  /** Buy Me a Coffee / UPI support dialog */
  support: boolean;
  /** The open full-screen mode (a feature id from src/features/registry, e.g. 'cafe'), or null */
  mode: string | null;
  /** The Worlds launcher (every mode and layer) */
  launcher: boolean;
  confirm: ConfirmSpec | null;
  completion: { seconds: number; taskText?: string | null } | null;
  toasts: Toast[];
  /** Open (or bring to front) a panel window; null closes them all */
  openPanel: (p: PanelId | null) => void;
  /** Dock behaviour: close if it's the front window, otherwise open / bring to front */
  togglePanel: (p: PanelId) => void;
  closePanel: (p: PanelId) => void;
  set: (patch: Partial<Omit<UIState, 'set' | 'openPanel' | 'togglePanel' | 'closePanel' | 'toast' | 'dismiss' | 'panels'>>) => void;
  toast: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

/** Window stack helpers: the last entry is the front window. */
const stack = (panels: PanelId[]) => ({ panels, panel: panels.at(-1) ?? null });
const raise = (panels: PanelId[], p: PanelId) => stack([...panels.filter((x) => x !== p), p]);

export const useUI = create<UIState>()((set) => ({
  panel: null,
  panels: [],
  palette: false,
  zen: false,
  help: false,
  auth: false,
  onboarding: false,
  support: false,
  mode: null,
  launcher: false,
  confirm: null,
  completion: null,
  toasts: [],
  openPanel: (p) => set((s) => (p ? { ...raise(s.panels, p), mode: null } : stack([]))),
  togglePanel: (p) => set((s) => (s.panel === p ? stack(s.panels.filter((x) => x !== p)) : { ...raise(s.panels, p), mode: null })),
  closePanel: (p) => set((s) => stack(s.panels.filter((x) => x !== p))),
  // `panel` in a patch keeps its old meaning: open that window (or close all with null)
  set: (patch) =>
    set((s) => {
      if (!('panel' in patch)) return patch;
      const { panel, ...rest } = patch;
      return { ...rest, ...(panel ? raise(s.panels, panel) : stack([])) };
    }),
  toast: (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUI.getState().toast(t);
