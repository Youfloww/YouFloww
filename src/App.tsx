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
import { MemePop } from './features/celebrate/MemePop';
import { BrainDump } from './features/timer/BrainDump';
import { CoffeeButton, SupportDialog } from './features/support/Support';
import { ConfirmEnd } from './features/timer/ConfirmEnd';
import { CommandPalette } from './features/shell/CommandPalette';
import { useShortcuts } from './features/shell/useShortcuts';
import { PipPortal, usePip } from './features/pip/PipTimer';
import { reset, start } from './features/timer/engine';
import { cn } from './lib/utils';
import { LayerHost, ModeHost, useTabPresence } from './features/shell/FeatureHosts';
import { startEarnings } from './features/economy/earnings';
import { startGardenBanking } from './features/garden/banking';
import { ChunkBoundary } from './ui/ChunkBoundary';

startEarnings();
startGardenBanking();
// the cat hears about sessions even while a world (café, flights, ...) covers her: loaded right after boot, off the main bundle
void import('./features/cat/life').then((m) => m.startCatLife());
// the cat follows the account: her saved self is kept in step with data.cat (cat/cloud.ts)
void import('./features/cat/cloud').then((m) => m.startCatCloud());

const Panels = lazy(() => import('./features/panels/Panels'));
const Overlays = lazy(() => import('./features/panels/Overlays'));
const CatWorld = lazy(() => import('./features/cat/CatWorld'));
const Launcher = lazy(() => import('./features/shell/Launcher'));

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
    if (p.get('start') === 'focus' && useTimer.getState().status !== 'running')
      setTimeout(() => {
        // "Start focusing" means focus, even if the last thing on the clock was a break
        const t = useTimer.getState();
        if (t.mode !== 'focus') {
          if (t.status !== 'idle') return;
          reset('focus');
        }
        start();
      }, 400);
    // a Study Hall invite (?together=ABCDE): remember it, the hall joins the group after the person picks an animal
    const together = p.get('together');
    if (together) {
      try {
        sessionStorage.setItem('together:invite', together);
      } catch {
        /* private mode */
      }
      useUI.getState().set({ mode: 'together' });
    }
    if (p.size) history.replaceState(null, '', location.pathname);
  }, []);
}

export default function App() {
  useAppEffects();
  const pip = usePip();
  useShortcuts(pip.open);
  const scene = usePrefs((s) => s.scene.kind);
  const onMedia = scene === 'youtube' || scene === 'image' || scene === 'video';
  const zen = useUI((s) => s.zen);
  const showCat = usePrefs((s) => s.showMascot);
  const mode = useUI((s) => s.mode);
  const launcher = useUI((s) => s.launcher);
  useTabPresence();
  const setUI = useUI((s) => s.set);

  return (
    <div className="relative h-dvh w-full overflow-hidden text-ink">
      <SceneLayer />

      {/* The stage scrolls under floating bars: its edges are the screen edges, and content
          fades out near the bars instead of being cut off by a hard line. */}
      <div className="relative z-10 h-full">
        <main className={cn('no-scrollbar absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain', !zen && 'scroll-fade')}>
          <div className={cn('flex min-h-full items-center justify-center px-4 transition-[padding] duration-500', zen ? 'py-6' : 'pt-[84px] pb-[108px]')}>
            <FocusStage onMedia={onMedia} />
          </div>
        </main>

        <AnimatePresence>
          {!zen && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 top-0 [&_header>*]:pointer-events-auto"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <TopBar onMedia={onMedia} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!zen && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="pointer-events-none absolute inset-x-0 bottom-0"
            >
              <Dock onPip={pip.supported ? pip.open : undefined} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BrainDump onMedia={onMedia} />
      <MemePop />
      <CoffeeButton />
      <SupportDialog />
      <ConfirmEnd />

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
        <ChunkBoundary name="panels">
          <Panels />
          <Overlays />
        </ChunkBoundary>
        {showCat && !mode && (
          <ChunkBoundary name="cat">
            <CatWorld />
          </ChunkBoundary>
        )}
        <ChunkBoundary name="layers">
          <LayerHost />
        </ChunkBoundary>
        <ChunkBoundary name="world" key={mode ?? 'home'}>
          <ModeHost />
        </ChunkBoundary>
        {launcher && (
          <ChunkBoundary name="launcher">
            <Launcher />
          </ChunkBoundary>
        )}
      </Suspense>
      <Celebrations />
      <CommandPalette onPip={pip.supported ? pip.open : undefined} />
      <Toaster />
      <PipPortal win={pip.win} />
    </div>
  );
}
