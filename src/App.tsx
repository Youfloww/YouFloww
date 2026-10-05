import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import { usePrefs, THEMES } from '@/store/prefs';
import { useUI } from '@/store/ui';
import { useTimer } from '@/store/timer';
import { useData } from '@/store/data';
import { syncMixer, hasCustomMusic, setCustomMusic } from '@/audio/mixer';
import { get as idbGet } from 'idb-keyval';
import { setWakeLock } from '@/lib/notify';
import { SceneLayer } from './features/scene/SceneLayer';
import { TopBar } from './features/shell/TopBar';
import { Dock } from './features/shell/Dock';
import { FocusStage } from './features/timer/FocusStage';
import { Celebrations, Toaster } from './features/celebrate/Celebrations';
import { CommandPalette } from './features/shell/CommandPalette';
import { useShortcuts } from './features/shell/useShortcuts';
import { PipPortal, usePip } from './features/pip/PipTimer';
import { useIsDesktop } from './ui/Sheet';
import { start } from './features/timer/engine';
import { cn } from './lib/utils';

const Panels = lazy(() => import('./features/panels/Panels'));
const Overlays = lazy(() => import('./features/panels/Overlays'));

function useAppEffects() {
  const theme = usePrefs((s) => s.theme);
  const autoDark = usePrefs((s) => s.autoDark);
  const mode = useTimer((s) => s.mode);
  const status = useTimer((s) => s.status);
  const mixer = usePrefs((s) => s.mixer);
  const settings = useData((s) => s.data.settings);

  // Theme + mode drive every CSS variable
  useEffect(() => {
    const prefersDark = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = autoDark && prefersDark.matches && !THEMES.find((x) => x.id === theme)?.dark ? 'midnight' : theme;
      document.documentElement.dataset.theme = t;
      const meta = document.querySelector('meta[name="theme-color"]:not([media])') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
      meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    };
    apply();
    prefersDark.addEventListener('change', apply);
    return () => prefersDark.removeEventListener('change', apply);
  }, [theme, autoDark]);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  // Ambient mixer follows prefs (and optionally only plays while focusing)
  const [musicReady, setMusicReady] = useState(0);
  useEffect(() => {
    if (!mixer.on.custom || hasCustomMusic()) return;
    void idbGet<Blob>('floww:music').then((b) => {
      if (b) {
        setCustomMusic(URL.createObjectURL(b));
        setMusicReady((x) => x + 1);
      }
    });
  }, [mixer.on.custom]);

  useEffect(() => {
    const focusing = status === 'running' && mode === 'focus';
    const gate = settings.ambienceOnlyWhileFocusing ? (focusing ? 1 : 0) : 1;
    const levels: Record<string, number> = {};
    for (const [id, on] of Object.entries(mixer.on)) if (on) levels[id] = (mixer.volumes[id] ?? 0.5) * gate;
    syncMixer(levels, mixer.master);
  }, [mixer, status, mode, settings.ambienceOnlyWhileFocusing, musicReady]);

  // Keep the screen awake while a session runs
  useEffect(() => {
    const want = settings.keepAwake && status === 'running';
    void setWakeLock(!!want);
    const onVis = () => document.visibilityState === 'visible' && want && void setWakeLock(true);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [status, settings.keepAwake]);

  // PWA shortcuts / deep links: ?start=focus, ?panel=tasks
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const panel = p.get('panel');
    if (panel) useUI.getState().openPanel(panel as never);
    if (p.get('start') === 'focus' && useTimer.getState().status !== 'running') setTimeout(start, 400);
    if (p.size) history.replaceState(null, '', location.pathname);
  }, []);
}

export default function App() {
  useAppEffects();
  const pip = usePip();
  useShortcuts(pip.supported ? pip.open : undefined);
  const scene = usePrefs((s) => s.scene.kind);
  const onMedia = scene === 'youtube' || scene === 'image' || scene === 'video';
  const zen = useUI((s) => s.zen);
  const panel = useUI((s) => s.panel);
  const setUI = useUI((s) => s.set);
  const wide = useIsDesktop(1180);
  const shift = wide && !!panel;

  return (
    <div className="relative h-dvh w-full overflow-hidden text-ink">
      <SceneLayer />

      <div className="relative z-10 flex h-full flex-col">
        <AnimatePresence>
          {!zen && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <TopBar onMedia={onMedia} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.main
          className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-4"
          animate={{ paddingRight: shift ? 470 : 16 }}
          transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        >
          <FocusStage onMedia={onMedia} />
        </motion.main>

        <AnimatePresence>
          {!zen && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(shift && 'pr-[460px]', 'transition-[padding] duration-500')}
            >
              <Dock onPip={pip.supported ? pip.open : undefined} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {zen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setUI({ zen: false })}
            className={cn(
              'pressable fixed top-4 right-4 z-20 flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-extrabold opacity-40 transition-opacity hover:opacity-100',
              onMedia ? 'bg-black/25 text-white backdrop-blur-md' : 'glass',
            )}
          >
            <Minimize2 size={16} /> Exit zen <span className="opacity-60">Esc</span>
          </motion.button>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <Panels />
        <Overlays />
      </Suspense>
      <Celebrations />
      <CommandPalette onPip={pip.supported ? pip.open : undefined} />
      <Toaster />
      <PipPortal win={pip.win} />
    </div>
  );
}
