import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { bus } from '@/lib/bus';
import { pick } from '@/lib/utils';
import { useTimer } from '@/store/timer';
import { Flowy, type FlowyMood } from './Flowy';
import { BREAK_LINES, DONE_LINES, EARLY_LINES, POKES, START_LINES, TIPS } from './lines';
import { play } from '@/audio/sfx';

/** Flowy + speech bubble, reacting to everything that happens in the app. */
export function Buddy({ size = 84 }: { size?: number }) {
  const status = useTimer((s) => s.status);
  const mode = useTimer((s) => s.mode);
  const autoPaused = useTimer((s) => s.autoPaused);
  const [override, setOverride] = useState<FlowyMood | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pokes = useRef(0);

  const say = (text: string, mood?: FlowyMood, ms = 3800) => {
    timers.current.forEach(clearTimeout);
    setBubble(text);
    if (mood) setOverride(mood);
    timers.current = [
      setTimeout(() => setBubble(null), ms),
      setTimeout(() => setOverride(null), Math.min(ms, mood === 'happy' ? 4200 : 2600)),
    ];
  };

  useEffect(() => {
    const offs = [
      bus.on('session:complete', (p) => say(p.goalReached ? 'Daily goal smashed!! 🏆' : p.streak === 'inc' ? 'Streak +1 🔥 so proud!' : pick(DONE_LINES), 'happy', 5200)),
      bus.on('session:early', () => say(pick(EARLY_LINES), 'sad')),
      bus.on('break:complete', () => say('Break’s over — ready? ✨', 'wow')),
      bus.on('task:done', () => say('Task crushed! ✅', 'happy', 2600)),
      bus.on('achievement', () => say('Ooh, a new badge! 🏅', 'wow')),
      bus.on('mascot:say', (p) => say(p.text, p.mood ?? 'happy', p.ms)),
    ];
    return () => {
      offs.forEach((o) => o());
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // React to timer transitions
  const prev = useRef({ status, mode });
  useEffect(() => {
    const p = prev.current;
    if (p.status !== 'running' && status === 'running') say(mode === 'focus' ? pick(START_LINES) : pick(BREAK_LINES), mode === 'focus' ? 'wow' : 'happy', 2600);
    if (autoPaused && status === 'paused') say('Where’d you go? I paused for you 👀', 'sad', 6000);
    prev.current = { status, mode };
  }, [status, mode, autoPaused]);

  const base: FlowyMood = status === 'running' ? (mode === 'focus' ? 'focus' : 'break') : status === 'paused' ? 'paused' : mode !== 'focus' ? 'sleepy' : 'idle';
  const mood = override ?? base;

  const onPoke = () => {
    pokes.current++;
    play('pop');
    if (pokes.current % 3 === 0) say(pick(TIPS), 'wow', 7000);
    else say(pick(POKES), 'love', 3200);
  };

  return (
    <div className="relative grid place-items-center">
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble}
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="glass-strong absolute bottom-[calc(100%+6px)] left-1/2 z-10 w-max max-w-[240px] -translate-x-1/2 rounded-2xl px-3.5 py-2 text-center text-[13px] font-bold leading-snug text-ink"
          >
            {bubble}
            <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-sm bg-surface-strong" />
          </motion.div>
        )}
      </AnimatePresence>
      <Flowy mood={mood} size={size} onClick={onPoke} />
    </div>
  );
}
