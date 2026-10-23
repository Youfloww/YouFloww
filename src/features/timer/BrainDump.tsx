import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { bus } from '@/lib/bus';
import { cn, haptic } from '@/lib/utils';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { toast, useUI } from '@/store/ui';
import { play } from '@/audio/sfx';

export const PARKED_PREFIX = '💭 ';

/**
 * ADHD helper: a distraction parking lot. Mid-session thoughts ("reply to Sam", "buy milk")
 * get parked as tasks in two keystrokes, so they stop nagging without breaking the flow.
 */
export function BrainDump({ onMedia }: { onMedia: boolean }) {
  const mode = useTimer((s) => s.mode);
  const status = useTimer((s) => s.status);
  const addTodo = useData((s) => s.addTodo);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [parked, setParked] = useState(0);
  const [flying, setFlying] = useState<{ id: number; text: string }[]>([]);
  const parkedRef = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const visible = mode === 'focus' && status !== 'idle';

  useEffect(() => {
    const onKey = () => setOpen((o) => !o);
    addEventListener('floww:braindump', onKey);
    const offs = [
      bus.on('session:start', () => {
        parkedRef.current = 0;
        setParked(0);
      }),
      bus.on('session:complete', () => {
        const n = parkedRef.current;
        if (!n) return;
        setTimeout(
          () =>
            toast({
              emoji: '💭',
              title: `You parked ${n} thought${n > 1 ? 's' : ''}`,
              body: 'They are waiting in your Tasks.',
              action: { label: 'See', run: () => useUI.getState().openPanel('tasks') },
              ms: 8000,
            }),
          2200,
        );
      }),
    ];
    return () => {
      removeEventListener('floww:braindump', onKey);
      offs.forEach((off) => off());
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    addEventListener('pointerdown', close);
    return () => removeEventListener('pointerdown', close);
  }, [open]);

  const park = () => {
    const t = text.trim();
    if (!t) return;
    addTodo(PARKED_PREFIX + t);
    parkedRef.current += 1;
    setParked(parkedRef.current);
    setFlying((f) => [...f, { id: Date.now(), text: t }]);
    setText('');
    play('park');
    haptic(8);
  };

  return (
    <div ref={box} className="pointer-events-none fixed right-4 bottom-[104px] z-30 flex flex-col items-end gap-2 sm:right-6">
      <AnimatePresence>
        {open && (
          <motion.form
            onSubmit={(e) => {
              e.preventDefault();
              park();
            }}
            initial={{ opacity: 0, scale: 0.6, y: 20, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={{ type: 'spring', stiffness: 520, damping: 30 }}
            className="glass-strong pointer-events-auto w-[min(84vw,320px)] rounded-3xl p-3 text-ink"
          >
            <p className="font-display px-1 text-[15px] font-semibold">💭 Park a thought</p>
            <p className="px-1 pb-2 text-xs font-semibold text-muted">It waits in Tasks. Back to the session!</p>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              placeholder="e.g. reply to Sam, buy milk…"
              className="h-11 w-full rounded-2xl bg-line px-3 text-sm font-bold outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
            />
            <p className="px-1 pt-2 text-[11px] font-bold text-faint">Enter to park · Esc to close · D to open</p>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(visible || open) && (
          <motion.button
            onClick={() => setOpen((o) => !o)}
            aria-label="Park a distracting thought (D)"
            title="Park a thought (D)"
            initial={{ opacity: 0, scale: 0, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0, rotate: 90 }}
            whileHover={{ scale: 1.12, rotate: -8 }}
            whileTap={{ scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className={cn(
              'pointer-events-auto relative grid size-12 place-items-center rounded-full text-[22px] shadow-lg',
              onMedia ? 'bg-white/20 backdrop-blur-md' : 'glass',
            )}
          >
            <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
              💭
            </motion.span>
            <AnimatePresence>
              {parked > 0 && (
                <motion.span
                  key={parked}
                  initial={{ scale: 2.2 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 14 }}
                  className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-black text-accent-ink"
                >
                  {parked}
                </motion.span>
              )}
            </AnimatePresence>
            {/* parked thoughts fly into the bubble */}
            {flying.map((f) => (
              <motion.span
                key={f.id}
                className="pointer-events-none absolute right-0 bottom-full max-w-48 truncate rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-accent-ink"
                initial={{ opacity: 1, y: -70, x: -40, scale: 1 }}
                animate={{ opacity: 0, y: 30, x: 0, scale: 0.2 }}
                transition={{ duration: 0.6, ease: [0.5, 0, 0.75, 0] }}
                onAnimationComplete={() => setFlying((all) => all.filter((x) => x.id !== f.id))}
              >
                {f.text}
              </motion.span>
            ))}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
