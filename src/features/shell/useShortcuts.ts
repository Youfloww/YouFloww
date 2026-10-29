import { useEffect } from 'react';
import { useUI, type PanelId } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { isTypingTarget } from '@/lib/utils';
import { adjust, requestEnd, requestMode, requestReset, toggle } from '../timer/engine';
import { MODES } from '../registry';

const PANEL_KEYS: Record<string, PanelId> = {
  t: 'tasks',
  s: 'sounds',
  b: 'scenes',
  g: 'stats',
  j: 'journal',
  p: 'planner',
  l: 'community',
  a: 'achievements',
  ',': 'settings',
};

export function useShortcuts(onPip?: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.set({ palette: !ui.palette });
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (ui.palette || ui.auth || ui.completion || ui.onboarding || ui.confirm || ui.support) return;

      const k = e.key.toLowerCase();
      if (ui.mode && e.key === 'Escape') return ui.set({ mode: null });
      if (ui.launcher && e.key === 'Escape') return ui.set({ launcher: false });
      if (ui.mode && !(e.key === ' ' || k === 'k' || k === 'e')) return;
      if (e.key === ' ' || k === 'k') {
        e.preventDefault();
        toggle();
      } else if (k === 'r') requestReset();
      else if (k === 'e') requestEnd();
      else if (k === '1') requestMode('focus');
      else if (k === '2') requestMode('short');
      else if (k === '3') requestMode('long');
      else if (e.key === '+' || e.key === '=') adjust(5);
      else if (e.key === '-' || e.key === '_') adjust(-5);
      else if (k === 'w') ui.set({ launcher: !ui.launcher });
      else if (MODES.some((m) => m.key === k)) ui.set({ mode: MODES.find((m) => m.key === k)!.id, panel: null, launcher: false });
      else if (k === 'z' || k === 'f') ui.set({ zen: !ui.zen, panel: null });
      else if (k === 'o') onPip?.();
      else if (k === 'd') dispatchEvent(new Event('floww:braindump'));
      else if (k === 'm') usePrefs.getState().set({ mixer: { ...usePrefs.getState().mixer, on: {} } });
      else if (e.key === '?') ui.set({ help: true });
      else if (e.key === 'Escape') {
        if (ui.panel) ui.closePanel(ui.panel);
        else if (ui.zen) ui.set({ zen: false });
      } else if (PANEL_KEYS[k]) ui.togglePanel(PANEL_KEYS[k]);
      else return;
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onPip]);
}
