import { useEffect } from 'react';
import { useUI, type PanelId } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { isTypingTarget } from '@/lib/utils';
import { adjust, endEarly, reset, setMode, toggle } from '../timer/engine';

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
      if (ui.palette || ui.auth || ui.completion || ui.onboarding) return;

      const k = e.key.toLowerCase();
      if (e.key === ' ' || k === 'k') {
        e.preventDefault();
        toggle();
      } else if (k === 'r') reset();
      else if (k === 'e') endEarly();
      else if (k === '1') setMode('focus');
      else if (k === '2') setMode('short');
      else if (k === '3') setMode('long');
      else if (e.key === '+' || e.key === '=') adjust(5);
      else if (e.key === '-' || e.key === '_') adjust(-5);
      else if (k === 'z' || k === 'f') ui.set({ zen: !ui.zen, panel: null });
      else if (k === 'o') onPip?.();
      else if (k === 'm') usePrefs.getState().set({ mixer: { ...usePrefs.getState().mixer, on: {} } });
      else if (e.key === '?') ui.set({ help: true });
      else if (e.key === 'Escape') {
        if (ui.panel) ui.openPanel(null);
        else if (ui.zen) ui.set({ zen: false });
      } else if (PANEL_KEYS[k]) ui.togglePanel(PANEL_KEYS[k]);
      else return;
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onPip]);
}
