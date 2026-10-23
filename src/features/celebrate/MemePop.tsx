import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { bus } from '@/lib/bus';
import { pick } from '@/lib/utils';
import { usePrefs } from '@/store/prefs';
import { useData } from '@/store/data';
import { preloadMemes, takeMeme, type MemeKind } from './memes';

const CAPTIONS: Record<MemeKind, string[]> = {
  start: ['Locked in 🔒', 'Here we go 🚀', 'Focus mode: ON 🎯', 'Phone down, brain on 🧠'],
  done: ['Session complete 🎉', 'Absolute legend 🏆', 'Brain gains 💪'],
  quit: ['Ended early 🫠', 'It happens 🫧', 'Next one counts 💫'],
};
/** It stays a good while (tap it to send it away sooner) */
const LIFETIME = 40_000;

/** A sticker-style meme that slaps onto the screen when a focus session starts or ends. */
export function MemePop() {
  const on = usePrefs((s) => s.memePops);
  const [meme, setMeme] = useState<{ id: number; src: string; kind: MemeKind; caption: string } | null>(null);

  useEffect(() => {
    if (!on) return;
    const idle = setTimeout(preloadMemes, 2500);
    const show = (kind: MemeKind) => setMeme({ id: Date.now(), src: takeMeme(kind), kind, caption: pick(CAPTIONS[kind]) });
    const offs = [
      bus.on('session:start', () => show('start')),
      // When the completion dialog opens, the meme is shown inside it instead
      bus.on('session:complete', () => useData.getState().data.settings.autoStartBreaks && show('done')),
      bus.on('session:early', () => show('quit')),
    ];
    return () => {
      clearTimeout(idle);
      offs.forEach((off) => off());
    };
  }, [on]);

  useEffect(() => {
    if (!meme) return;
    const t = setTimeout(() => setMeme(null), LIFETIME);
    return () => clearTimeout(t);
  }, [meme]);

  return (
    <div className="pointer-events-none fixed top-[68px] left-3 z-[85] sm:top-auto sm:bottom-[112px] sm:left-6">
      <AnimatePresence>
        {meme && (
          <motion.button
            key={meme.id}
            onClick={() => setMeme(null)}
            aria-label="Close meme"
            className="pointer-events-auto relative block w-[min(58vw,270px)] cursor-pointer rounded-[22px] bg-white p-2 pb-2.5 text-left shadow-[0_30px_60px_-20px_rgb(0_0_0/0.45),0_10px_24px_-10px_rgb(0_0_0/0.3)]"
            initial={{ opacity: 0, scale: 0.2, rotate: -35, x: -160, y: 40 }}
            animate={{ opacity: 1, scale: 1, rotate: meme.kind === 'quit' ? 3 : -4, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 18, y: 80, transition: { duration: 0.35 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 15 }}
            whileHover={{ scale: 1.04, rotate: 0 }}
          >
            {/* washi tape */}
            <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-6 rounded-sm bg-[#ffe37a]/85 shadow-sm" />
            <span aria-hidden className="absolute -top-2.5 -right-2.5 z-10 grid size-7 place-items-center rounded-full bg-[#2a1b3d] text-[13px] font-black text-white shadow-md">
              ✕
            </span>
            <img src={meme.src} alt="" className="block w-full rounded-2xl" draggable={false} />
            <span className="font-display mt-2 block px-1 text-[15px] leading-tight font-semibold text-[#2a1b3d]">{meme.caption}</span>
            <span className="mt-0.5 block px-1 text-[11px] font-bold text-[#2a1b3d]/45">Tap to close</span>
            <motion.span
              className="absolute right-3 bottom-1.5 left-3 h-[3px] origin-left rounded-full bg-[#2a1b3d]/15"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: LIFETIME / 1000, ease: 'linear' }}
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
