import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { usePrefs } from '@/store/prefs';
import { useTimer, MODE_META } from '@/store/timer';
import { CatSprite } from '../cat/CatSprite';
import { endEarly, toggle } from '../timer/engine';
import { useTimerView } from '../timer/TimerOrb';
import { toast } from '@/store/ui';

type DPiP = { requestWindow: (o: { width: number; height: number; disallowReturnToOpener?: boolean }) => Promise<Window> };
const dpip = () => (window as Window & { documentPictureInPicture?: DPiP }).documentPictureInPicture;

export const pipSupported = () => typeof window !== 'undefined' && !!dpip();

/** Document Picture-in-Picture: a tiny always-on-top window with your timer. */
export function usePip() {
  const [win, setWin] = useState<Window | null>(null);

  const open = useCallback(async () => {
    const api = dpip();
    if (!api) {
      toast({ emoji: '🪟', title: 'Pop-out not supported', body: 'Try Chrome or Edge on desktop.' });
      return;
    }
    if (win) {
      win.close();
      return;
    }
    try {
      const w = await api.requestWindow({ width: 300, height: 340 });
      // Bring our styles along
      for (const sheet of [...document.styleSheets]) {
        try {
          const css = [...sheet.cssRules].map((r) => r.cssText).join('\n');
          const style = w.document.createElement('style');
          style.textContent = css;
          w.document.head.appendChild(style);
        } catch {
          if (sheet.href) {
            const link = w.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            w.document.head.appendChild(link);
          }
        }
      }
      w.document.title = 'YouFloww';
      w.document.body.style.margin = '0';
      w.addEventListener('pagehide', () => setWin(null));
      setWin(w);
    } catch {
      /* user dismissed */
    }
  }, [win]);

  return { win, open, supported: pipSupported() };
}

function PipContent() {
  const v = useTimerView();
  const mode = useTimer((s) => s.mode);
  const running = v.status === 'running';
  // The main window's confirm dialog isn't visible from here, so ending takes two taps
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 3000);
    return () => clearTimeout(t);
  }, [arm]);
  const onEnd = () => {
    if (v.status === 'idle' || !usePrefs.getState().confirmEnd || arm) {
      setArm(false);
      endEarly();
    } else setArm(true);
  };
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center gap-2 overflow-hidden bg-bg text-ink select-none">
      <div
        className="absolute inset-0 opacity-90"
        style={{ background: 'radial-gradient(70% 60% at 20% 10%, var(--a1), transparent), radial-gradient(60% 60% at 90% 30%, var(--a2), transparent), radial-gradient(70% 70% at 50% 100%, var(--a3), transparent)' }}
      />
      <div className="absolute inset-x-0 bottom-0 bg-accent/25 transition-all duration-1000" style={{ height: `${v.progress * 100}%` }} />
      <div className="relative flex flex-col items-center gap-1">
        <span className="text-[11px] font-black tracking-[0.18em] text-muted uppercase">
          {MODE_META[mode].emoji} {MODE_META[mode].label}
        </span>
        <span className="font-display tabular text-[64px] leading-none font-semibold">{v.clock}</span>
      </div>
      <div className="relative flex items-center gap-3">
        <button onClick={toggle} aria-label={running ? 'Pause' : 'Start'} className="pressable grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg">
          {running ? <Pause size={24} fill="currentColor" strokeWidth={0} /> : <Play size={24} fill="currentColor" strokeWidth={0} />}
        </button>
        <button
          onClick={onEnd}
          aria-label={arm ? 'Tap again to end' : 'End / skip'}
          className={arm ? 'pressable h-11 rounded-full bg-bad px-3 text-xs font-black text-white' : 'pressable grid size-11 place-items-center rounded-full bg-surface-strong'}
        >
          {arm ? 'Sure? Tap' : <SkipForward size={18} strokeWidth={2.6} />}
        </button>
      </div>
      <div className="absolute right-2 bottom-1">
        <CatSprite anim={running && mode !== 'focus' ? 'walk' : 'idle'} height={54} />
      </div>
    </div>
  );
}

export function PipPortal({ win }: { win: Window | null }) {
  const theme = usePrefs((s) => s.theme);
  const mode = useTimer((s) => s.mode);
  useEffect(() => {
    if (!win) return;
    win.document.documentElement.dataset.theme = theme;
    win.document.documentElement.dataset.mode = mode;
  }, [win, theme, mode]);
  if (!win) return null;
  return createPortal(<PipContent />, win.document.body);
}
