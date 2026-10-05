import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { bus } from '@/lib/bus';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { Dialog } from '@/ui/Sheet';
import { Button } from '@/ui/primitives';
import { Flowy } from '../mascot/Flowy';
import { formatDuration } from '@/lib/time';
import { reset, start } from '../timer/engine';
import { newlyUnlocked, ACHIEVEMENTS } from '../achievements/defs';
import { play } from '@/audio/sfx';
import { prefersReducedMotion } from '@/lib/utils';
import { deriveStats } from '@/data/model';

export async function confetti(opts: { x?: number; y?: number; big?: boolean } = {}) {
  if (prefersReducedMotion()) return;
  const { default: c } = await import('canvas-confetti');
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--primary', '--secondary', '--a1', '--a2', '--accent'].map((v) => cs.getPropertyValue(v).trim()).filter((x) => x.startsWith('#'));
  const origin = { x: opts.x ?? 0.5, y: opts.y ?? 0.55 };
  const shapes = [c.shapeFromText({ text: '✨', scalar: 2 }), 'circle' as const, 'square' as const];
  if (opts.big) {
    c({ particleCount: 90, spread: 100, startVelocity: 42, origin, colors, shapes, scalar: 1.1, ticks: 220, zIndex: 70 });
    setTimeout(() => c({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, zIndex: 70 }), 180);
    setTimeout(() => c({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, zIndex: 70 }), 320);
  } else {
    c({ particleCount: 36, spread: 60, startVelocity: 26, origin, colors, scalar: 0.8, ticks: 120, zIndex: 70 });
  }
}

const RATINGS = [
  { v: 1, e: '😵‍💫', l: 'Scattered' },
  { v: 2, e: '😐', l: 'Meh' },
  { v: 3, e: '🙂', l: 'Okay' },
  { v: 4, e: '😄', l: 'Good' },
  { v: 5, e: '🔥', l: 'In the zone' },
];

function CompletionDialog() {
  const completion = useUI((s) => s.completion);
  const setUI = useUI((s) => s.set);
  const rate = useData((s) => s.rateLastSession);
  const data = useData((s) => s.data);
  const mode = useTimer((s) => s.mode);
  const [rating, setRating] = useState<number | null>(null);
  const stats = deriveStats(data);

  useEffect(() => setRating(null), [completion]);
  const close = () => setUI({ completion: null });

  return (
    <Dialog open={!!completion} onClose={close} labelledBy="done-title">
      <div className="flex flex-col items-center text-center">
        <div className="-mt-16 mb-1">
          <Flowy mood="happy" size={110} track={false} />
        </div>
        <h2 id="done-title" className="font-display text-3xl font-semibold">
          Session complete!
        </h2>
        <p className="mt-1 font-semibold text-muted">
          You focused for <span className="font-black text-ink">{formatDuration(completion?.seconds ?? 0, { long: true })}</span>
          {completion?.taskText ? (
            <>
              {' '}on <span className="font-black text-ink">“{completion.taskText}”</span>
            </>
          ) : null}
        </p>

        <div className="mt-4 grid w-full grid-cols-3 gap-2">
          {[
            ['Today', formatDuration(stats.todaySeconds)],
            ['Streak', `${stats.streak} 🔥`],
            ['Goal', `${Math.round(stats.goalProgress * 100)}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-line px-2 py-2.5">
              <div className="font-display text-xl font-semibold">{v}</div>
              <div className="text-[11px] font-black tracking-wider text-muted uppercase">{k}</div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm font-extrabold">How was your focus?</p>
        <div className="mt-2 flex gap-1.5">
          {RATINGS.map((r) => (
            <motion.button
              key={r.v}
              whileHover={{ scale: 1.15, y: -3 }}
              whileTap={{ scale: 0.9 }}
              aria-label={r.l}
              title={r.l}
              onClick={() => {
                setRating(r.v);
                rate(r.v);
                play('pop');
              }}
              className={`grid size-12 place-items-center rounded-2xl text-2xl transition-colors ${rating === r.v ? 'bg-accent-soft ring-2 ring-accent' : 'bg-line hover:bg-accent-soft'}`}
            >
              {r.e}
            </motion.button>
          ))}
        </div>

        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => {
              close();
              start();
            }}
          >
            {mode === 'long' ? '🌿 Start long break' : '☕ Start break'}
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              close();
              reset('focus');
              useTimer.setState({ remainingMs: 600_000, durationMs: 600_000 });
              start();
            }}
          >
            ⚡ 10 more min
          </Button>
        </div>
        <button onClick={close} className="mt-3 text-sm font-extrabold text-muted hover:text-ink">
          Maybe later
        </button>
      </div>
    </Dialog>
  );
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onDone={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ t, onDone }: { t: ReturnType<typeof useUI.getState>['toasts'][number]; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, t.ms ?? (t.action ? 6000 : 3600));
    return () => clearTimeout(id);
  }, [t, onDone]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 480, damping: 32 }}
      className="glass-strong pointer-events-auto flex max-w-[min(92vw,420px)] items-center gap-3 rounded-2xl py-2.5 pr-2.5 pl-3.5"
      onClick={onDone}
      role="status"
    >
      {t.emoji && <span className="text-xl">{t.emoji}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{t.title}</p>
        {t.body && <p className="truncate text-[13px] font-semibold text-muted">{t.body}</p>}
      </div>
      {t.action && (
        <Button
          size="sm"
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            t.action!.run();
            onDone();
          }}
        >
          {t.action.label}
        </Button>
      )}
    </motion.div>
  );
}

/** Wires bus events to confetti, dialogs and achievement checks. */
export function Celebrations() {
  useEffect(() => {
    const offs = [
      bus.on('session:complete', (p) => {
        void confetti({ big: true });
        const s = useData.getState().data.settings;
        if (!s.autoStartBreaks) useUI.getState().set({ completion: { seconds: p.seconds, taskText: p.taskText } });
        if (p.goalReached) setTimeout(() => useUI.getState().toast({ emoji: '🏆', title: 'Daily goal reached!', body: 'Anything more is bonus flow.' }), 1200);
      }),
      bus.on('task:done', (p) => {
        void confetti({ x: p.x, y: p.y });
        play('task');
      }),
      bus.on('confetti', (p) => void confetti(p)),
    ];
    // Achievement checks whenever data changes
    let prevRev = -1;
    const unsub = useData.subscribe((st) => {
      if (st.rev === prevRev) return;
      prevRev = st.rev;
      const ids = newlyUnlocked(st.data);
      if (!ids.length) return;
      st.unlockAchievements(ids);
      bus.emit('achievement', { ids });
      play('achievement');
      if (ids.length > 3) {
        useUI.getState().toast({ emoji: '🏅', title: `${ids.length} badges unlocked!`, action: { label: 'See', run: () => useUI.getState().openPanel('achievements') } });
        return;
      }
      ids.forEach((id, i) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id)!;
        setTimeout(() => useUI.getState().toast({ emoji: a.emoji, title: `Badge unlocked: ${a.name}`, body: a.desc, action: { label: 'See', run: () => useUI.getState().openPanel('achievements') } }), 900 + i * 700);
      });
    });
    // Seed silently on boot so existing users don't get a flood of old badges
    const boot = newlyUnlocked(useData.getState().data);
    if (boot.length && useData.getState().data.totalSessions > 0) useData.getState().unlockAchievements(boot);
    return () => {
      offs.forEach((o) => o());
      unsub();
    };
  }, []);

  return <CompletionDialog />;
}
