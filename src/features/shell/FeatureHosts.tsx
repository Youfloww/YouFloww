/** Mounts the open mode and the switched-on layers from the feature registry, and nothing else. */
import { lazy, Suspense, useEffect } from 'react';
import { motion } from 'motion/react';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { useTimer } from '@/store/timer';
import { bus } from '@/lib/bus';
import { LAYERS, MODES, lazyFeature } from '../registry';
import { isBuddyOpen } from '../pip/PipTimer';
import { useTogetherLive } from '../together/live';

/** Study Hall / Study Together tray: only downloaded while a hall seat or group is live in this tab. */
const TogetherTray = lazy(() => import('../together/Tray'));

function ModeLoading({ emoji }: { emoji: string }) {
  return (
    <div className="fixed inset-0 z-[45] grid place-items-center bg-bg/80 backdrop-blur-sm">
      <motion.div className="text-6xl" animate={{ scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
        {emoji}
      </motion.div>
    </div>
  );
}

/** The open full-screen mode. Leaving it unmounts it, so its timers, audio and maps stop. */
export function ModeHost() {
  const mode = useUI((s) => s.mode);
  const f = MODES.find((m) => m.id === mode);
  useEffect(() => {
    if (!f) return;
    bus.emit('mode:open', { id: f.id });
    return () => bus.emit('mode:close', { id: f.id });
  }, [f]);
  if (!f) return null;
  const C = lazyFeature(f);
  return (
    <Suspense fallback={<ModeLoading emoji={f.emoji} />}>
      <C key={f.id} />
    </Suspense>
  );
}

/** Layers that are switched on (their code is only downloaded then). Hidden while a mode covers the app. */
export function LayerHost() {
  const choice = usePrefs((s) => s.layers);
  const mode = useUI((s) => s.mode);
  const together = useTogetherLive((s) => s.on);
  // the tray has its own life: it stays over Home AND over other worlds while a hall seat / group is live
  const tray = together && (
    <Suspense fallback={null}>
      <TogetherTray />
    </Suspense>
  );
  return (
    <>
      {tray}
      {!mode &&
        LAYERS.filter((l) => choice[l.id] ?? !!l.defaultOn).map((l) => {
          const C = lazyFeature(l);
          return (
            <Suspense key={l.id} fallback={null}>
              <C />
            </Suspense>
          );
        })}
    </>
  );
}

/** Tells features when the person leaves the tab mid-session (the cat gets sad, plants wilt a little, ...). */
export function useTabPresence() {
  useEffect(() => {
    let leftAt = 0;
    const onVis = () => {
      const t = useTimer.getState();
      const focusing = t.mode === 'focus' && t.status === 'running' && !isBuddyOpen();
      if (document.visibilityState === 'hidden') {
        leftAt = Date.now();
        bus.emit('tab:away', { focusing });
      } else if (leftAt) {
        bus.emit('tab:back', { focusing, awayMs: Date.now() - leftAt });
        leftAt = 0;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
}
