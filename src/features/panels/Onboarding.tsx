import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useData } from '@/store/data';
import { usePrefs, THEMES } from '@/store/prefs';
import { useUI } from '@/store/ui';
import { Dialog } from '@/ui/Sheet';
import { Button, Kbd } from '@/ui/primitives';
import { CatSprite } from '../cat/CatSprite';
import { cn, isMac, withViewTransition } from '@/lib/utils';
import { start } from '../timer/engine';
import { previewPack } from '@/audio/sfx';
import { APP_VERSION } from '@/lib/version';

/** What's new in 4.0. `open` is the world it opens (or the Worlds launcher), so every card is a door. */
const NEW_STUFF: { e: string; t: string; b: string; open: string | 'launcher' | null }[] = [
  { e: '🌍', t: 'Worlds', b: 'A café, flights, a scenic train, a window seat and a study desk. Press W.', open: 'launcher' },
  { e: '🫶', t: 'Study Hall', b: 'Focus beside real people, ask “Study together?” and chat in your group.', open: 'together' },
  { e: '🌱', t: 'A living garden', b: 'Plants grow a little with every focused second, seed to full bloom.', open: 'garden' },
  { e: '🏡', t: 'Cat’s Home', b: 'Decorate your cat’s rooms. Everything is free for now!', open: 'cathome' },
  { e: '🧠', t: 'Focus music', b: 'Calm, brain-tuned music that loops forever. Switch it on in Worlds.', open: 'launcher' },
  { e: '⏸', t: 'An honest timer', b: 'Close the tab and your session pauses. Time away never counts.', open: null },
];

export function Onboarding() {
  const open = useUI((s) => s.onboarding);
  const setUI = useUI((s) => s.set);
  const data = useData((s) => s.data);
  const setName = useData((s) => s.setProfileName);
  const update = useData((s) => s.updateSettings);
  const prefs = usePrefs();
  const returning = data.totalSessions > 0;
  const [step, setStep] = useState(0);
  const [name, setNameLocal] = useState(data.profileName === 'Floww User' ? '' : data.profileName);

  const finish = (go = false) => {
    if (name.trim()) setName(name);
    prefs.set({ lastSeenVersion: APP_VERSION });
    setUI({ onboarding: false });
    if (go) setTimeout(start, 350);
  };
  const visit = (open: string | null) => {
    finish();
    if (open === 'launcher') setUI({ launcher: true });
    else if (open) setUI({ mode: open });
  };

  const steps = returning
    ? [
        <div key="new" className="text-center">
          <div className="-mt-16 mb-2 flex justify-center">
            <CatSprite anim="jump" height={110} />
          </div>
          <h2 className="font-display text-3xl font-semibold">YouFloww 4.0 is here!</h2>
          <p className="mt-1 font-semibold text-muted">Whole little worlds to focus in, and friends to focus with. Tap one to take a look.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            {NEW_STUFF.map(({ e, t, b, open }, i) => (
              <motion.button
                key={t}
                type="button"
                disabled={!open}
                onClick={() => visit(open)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                whileHover={open ? { y: -2 } : undefined}
                whileTap={open ? { scale: 0.97 } : undefined}
                className={cn('rounded-2xl bg-line p-2.5 text-left', open && 'pressable hover:bg-accent-soft')}
              >
                <div className="text-xl">{e}</div>
                <p className="text-sm font-black">{t}</p>
                <p className="text-[11px] leading-snug font-semibold text-muted">{b}</p>
              </motion.button>
            ))}
          </div>
          <Button variant="primary" size="lg" className="mt-5 w-full" onClick={() => finish()}>
            Let’s flow 🌊
          </Button>
        </div>,
      ]
    : [
        <div key="hi" className="text-center">
          <div className="-mt-16 mb-2 flex justify-center">
            <CatSprite anim="jump" height={120} />
          </div>
          <h2 className="font-display text-3xl font-semibold">Hi, I’m Flowy!</h2>
          <p className="mt-1 font-semibold text-muted">I’ll keep you company while you focus. What should I call you?</p>
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setNameLocal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
            placeholder="Your name"
            className="mt-4 h-12 w-full rounded-2xl bg-line px-4 text-center text-lg font-bold outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
          />
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => setStep(1)}>
            {name.trim() ? `Nice to meet you, ${name.trim().split(' ')[0]}!` : 'Continue'}
          </Button>
        </div>,
        <div key="vibe" className="text-center">
          <h2 className="font-display text-2xl font-semibold">Pick your vibe</h2>
          <p className="mt-1 text-sm font-semibold text-muted">You can change this anytime in Scenes.</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <motion.button
                key={t.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => withViewTransition(() => prefs.set({ theme: t.id }))}
                className={cn('flex flex-col items-center gap-1 rounded-2xl p-1.5 ring-2', prefs.theme === t.id ? 'ring-accent' : 'ring-transparent')}
                aria-label={t.name}
              >
                <span className="grid size-12 place-items-center rounded-2xl text-xl" style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]}, ${t.swatch[2]})` }}>
                  {t.emoji}
                </span>
                <span className="text-[10px] font-black">{t.name.split(' ')[0]}</span>
              </motion.button>
            ))}
          </div>
          <p className="mt-5 mb-2 text-sm font-extrabold">When you finish a session…</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['chimes', '🔔', 'Cute chimes'],
                ['indian', '😂', 'Meme sounds'],
              ] as const
            ).map(([v, e, l]) => (
              <button
                key={v}
                onClick={() => {
                  update({ soundProfile: v });
                  previewPack(v);
                }}
                className={cn('rounded-2xl p-3 text-sm font-extrabold ring-2', data.settings.soundProfile === v ? 'bg-accent-soft ring-accent' : 'bg-line ring-transparent')}
              >
                <span className="mr-1 text-lg">{e}</span> {l}
              </button>
            ))}
          </div>
          <Button variant="primary" size="lg" className="mt-5 w-full" onClick={() => setStep(2)}>
            Looks cute ✨
          </Button>
        </div>,
        <div key="go" className="text-center">
          <div className="-mt-16 mb-2 flex justify-center">
            <CatSprite anim="idle" height={110} />
          </div>
          <h2 className="font-display text-2xl font-semibold">You’re all set!</h2>
          <ul className="mt-4 space-y-2 text-left text-sm font-bold">
            <li className="flex items-center gap-3 rounded-2xl bg-line p-3">
              <Kbd>Space</Kbd> start or pause the timer
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-line p-3">
              <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd> do anything, fast
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-line p-3">
              <span className="text-lg">🎯</span> pick a task so your time gets tracked
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-line p-3">
              <Kbd>W</Kbd> worlds: a café, a garden, the Study Hall and more
            </li>
          </ul>
          <Button variant="primary" size="lg" className="mt-5 w-full" onClick={() => finish(true)}>
            Start my first session 🚀
          </Button>
          <button className="mt-3 text-sm font-extrabold text-muted hover:text-ink" onClick={() => (finish(), setUI({ auth: true }))}>
            Sign in to sync first
          </button>
        </div>,
      ];

  return (
    <Dialog open={open} onClose={() => finish()} labelledBy="onb">
      <AnimatePresence mode="wait">
        <motion.div key={step} id="onb" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }}>
          {steps[Math.min(step, steps.length - 1)]}
        </motion.div>
      </AnimatePresence>
      {steps.length > 1 && (
        <div className="mt-5 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <motion.span key={i} className={cn('h-2 rounded-full', i === step ? 'bg-accent' : 'bg-line')} animate={{ width: i === step ? 22 : 8 }} />
          ))}
        </div>
      )}
    </Dialog>
  );
}
