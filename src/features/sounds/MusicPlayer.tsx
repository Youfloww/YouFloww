import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useState } from 'react';
import { GripHorizontal, Minus, X, Maximize2 } from 'lucide-react';
import { usePrefs } from '@/store/prefs';
import { cn } from '@/lib/utils';

/** Floating, draggable YouTube player for music/podcasts (v2's PiP player, reborn). */
export function MusicPlayer() {
  const mv = usePrefs((s) => s.musicVideo);
  const set = usePrefs((s) => s.set);
  const drag = useDragControls();
  const [mini, setMini] = useState(false);

  return (
    <AnimatePresence>
      {mv.open && mv.id && (
        <motion.div
          drag
          dragControls={drag}
          dragListener={false}
          dragMomentum={false}
          dragConstraints={{ left: -innerWidth + 120, right: innerWidth - 120, top: -innerHeight + 80, bottom: innerHeight - 80 }}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="glass-strong fixed bottom-28 left-4 z-30 overflow-hidden rounded-3xl"
          style={{ width: mini ? 220 : 'min(340px, calc(100vw - 32px))' }}
        >
          <div className="flex cursor-grab touch-none items-center gap-1 px-2.5 py-1.5 active:cursor-grabbing" onPointerDown={(e) => drag.start(e)}>
            <GripHorizontal size={16} className="text-faint" />
            <span className="flex-1 truncate text-xs font-black text-muted">🎵 Now playing</span>
            <button aria-label={mini ? 'Expand' : 'Minimise'} onClick={() => setMini((m) => !m)} className="grid size-7 place-items-center rounded-lg hover:bg-line">
              {mini ? <Maximize2 size={13} /> : <Minus size={14} />}
            </button>
            <button aria-label="Close player" onClick={() => set({ musicVideo: { ...mv, open: false } })} className="grid size-7 place-items-center rounded-lg hover:bg-line">
              <X size={14} />
            </button>
          </div>
          <div className={cn('aspect-video w-full bg-black transition-all', mini && 'h-0 aspect-auto')}>
            <iframe
              title="Music player"
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${mv.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
