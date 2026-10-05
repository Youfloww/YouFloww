import { motion } from 'motion/react';
import { useMemo } from 'react';
import { usePrefs } from '@/store/prefs';
import { useUI } from '@/store/ui';
import { dateKey } from '@/lib/time';
import { cn, hashString } from '@/lib/utils';
import { Buddy } from '../mascot/Buddy';
import { TimerOrb } from './TimerOrb';
import { Controls, CycleDots, ModeSwitch, TaskChip } from './Controls';

const QUOTES = [
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['It always seems impossible until it’s done.', 'Nelson Mandela'],
  ['Quality is not an act, it is a habit.', 'Aristotle'],
  ['Don’t watch the clock; do what it does. Keep going.', 'Sam Levenson'],
  ['Start where you are. Use what you have. Do what you can.', 'Arthur Ashe'],
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb'],
  ['Discipline is choosing what you want most over what you want now.', ''],
  ['You don’t have to see the whole staircase, just take the first step.', 'Martin Luther King Jr.'],
  ['Concentrate all your thoughts upon the work at hand.', 'Alexander Graham Bell'],
  ['Small deeds done are better than great deeds planned.', 'Peter Marshall'],
  ['Slow progress is still progress.', ''],
  ['Focus is a matter of deciding what things you’re not going to do.', 'John Carmack'],
  ['Energy flows where attention goes.', ''],
  ['Be so good they can’t ignore you.', 'Steve Martin'],
  ['What we fear doing most is usually what we most need to do.', 'Tim Ferriss'],
] as const;

export function Quote({ onMedia }: { onMedia: boolean }) {
  const [text, author] = useMemo(() => QUOTES[hashString(dateKey()) % QUOTES.length], []);
  return (
    <motion.figure
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 1 }}
      className={cn('max-w-[min(90vw,480px)] text-center text-[13px] leading-snug font-semibold [@media(max-height:700px)]:hidden', onMedia ? 'text-white/75' : 'text-muted')}
    >
      <blockquote>“{text}”</blockquote>
      {author && <figcaption className="mt-0.5 text-[11px] font-extrabold opacity-70">— {author}</figcaption>}
    </motion.figure>
  );
}

export function FocusStage({ onMedia }: { onMedia: boolean }) {
  const showMascot = usePrefs((s) => s.showMascot);
  const showQuote = usePrefs((s) => s.showQuote);
  const zen = useUI((s) => s.zen);

  return (
    <div className="flex flex-col items-center gap-[clamp(10px,2.4vh,22px)]">
      <motion.div animate={{ opacity: zen ? 0 : 1, y: zen ? -10 : 0 }} className={cn(zen && 'pointer-events-none')}>
        <ModeSwitch onMedia={onMedia} />
      </motion.div>

      <div className="relative">
        <TimerOrb onMedia={onMedia} />
        {showMascot && (
          <motion.div
            className="absolute -right-2 -bottom-3 sm:-right-8 sm:-bottom-4"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.35 }}
          >
            <Buddy size={typeof innerWidth !== 'undefined' && innerWidth < 640 ? 68 : 88} />
          </motion.div>
        )}
      </div>

      <motion.div animate={{ opacity: zen ? 0 : 1 }} className={cn('flex flex-col items-center gap-3', zen && 'pointer-events-none')}>
        <TaskChip onMedia={onMedia} />
      </motion.div>

      <Controls onMedia={onMedia} />
      <CycleDots onMedia={onMedia} />
      {showQuote && !zen && <Quote onMedia={onMedia} />}
    </div>
  );
}
