import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, RotateCcw, SkipForward, Square, ChevronDown, Check, Plus, Target } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTimer, MODE_META, type Mode } from '@/store/timer';
import { useData } from '@/store/data';
import { cn, haptic } from '@/lib/utils';
import { endEarly, focusOnTodo, reset, setMode, toggle } from './engine';
import { formatDuration } from '@/lib/time';

export function ModeSwitch({ onMedia }: { onMedia: boolean }) {
  const mode = useTimer((s) => s.mode);
  const modes: Mode[] = ['focus', 'short', 'long'];
  return (
    <div role="tablist" aria-label="Timer mode" className={cn('inline-flex rounded-full p-1', onMedia ? 'bg-black/25 backdrop-blur-md' : 'glass')}>
      {modes.map((m) => {
        const on = mode === m;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={on}
            onClick={() => setMode(m)}
            className={cn(
              'relative rounded-full px-3.5 py-2 text-[13px] font-extrabold whitespace-nowrap transition-colors sm:px-4',
              on ? 'text-accent-ink' : onMedia ? 'text-white/80 hover:text-white' : 'text-muted hover:text-ink',
            )}
          >
            {on && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full bg-accent shadow-[0_8px_20px_-8px_var(--accent)]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">
              <span className="mr-1">{MODE_META[m].emoji}</span>
              {MODE_META[m].short}
              <span className="hidden sm:inline">{m === 'focus' ? '' : ' break'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Controls({ onMedia }: { onMedia: boolean }) {
  const status = useTimer((s) => s.status);
  const mode = useTimer((s) => s.mode);
  const running = status === 'running';
  const side = cn(
    'pressable grid size-14 place-items-center rounded-full disabled:opacity-30',
    onMedia ? 'bg-white/15 text-white backdrop-blur-md hover:bg-white/25' : 'glass text-ink hover:bg-surface-strong',
  );

  return (
    <div className="flex items-center gap-5">
      <button className={side} aria-label="Reset timer (R)" title="Reset (R)" onClick={() => reset()} disabled={status === 'idle'}>
        <RotateCcw size={22} strokeWidth={2.6} />
      </button>

      <motion.button
        aria-label={running ? 'Pause (Space)' : 'Start (Space)'}
        title={running ? 'Pause (Space)' : 'Start (Space)'}
        onClick={toggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className="relative grid size-[84px] place-items-center rounded-full bg-accent text-accent-ink shadow-[0_18px_40px_-12px_var(--accent)]"
      >
        {!running && status === 'idle' && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-accent"
            animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={running ? 'pause' : 'play'}
            initial={{ scale: 0.3, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.3, opacity: 0, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 600, damping: 26 }}
          >
            {running ? <Pause size={34} fill="currentColor" strokeWidth={0} /> : <Play size={34} fill="currentColor" strokeWidth={0} className="translate-x-[2px]" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <button
        className={side}
        aria-label={mode === 'focus' ? 'End session & log time (E)' : 'Skip break (E)'}
        title={mode === 'focus' ? 'End & log (E)' : 'Skip break (E)'}
        onClick={endEarly}
        disabled={status === 'idle' && mode === 'focus'}
      >
        {mode === 'focus' ? <Square size={20} fill="currentColor" strokeWidth={0} /> : <SkipForward size={22} strokeWidth={2.6} />}
      </button>
    </div>
  );
}

export function CycleDots({ onMedia }: { onMedia: boolean }) {
  const cycle = useTimer((s) => s.cycle);
  const interval = useData((s) => s.data.settings.longBreakInterval || 4);
  const filled = cycle % interval === 0 && cycle > 0 ? interval : cycle % interval;
  return (
    <div className="flex items-center gap-1.5" aria-label={`${filled} of ${interval} sessions until long break`} title="Sessions until your long break">
      {Array.from({ length: interval }, (_, i) => (
        <motion.span
          key={i}
          className={cn('size-2 rounded-full', i < filled ? 'bg-accent' : onMedia ? 'bg-white/30' : 'bg-line')}
          animate={i === filled - 1 ? { scale: [1, 1.6, 1] } : {}}
          transition={{ duration: 0.5 }}
        />
      ))}
    </div>
  );
}

export function TaskChip({ onMedia }: { onMedia: boolean }) {
  const activeId = useTimer((s) => s.activeTodoId);
  const todos = useData((s) => s.data.todos);
  const addTodo = useData((s) => s.addTodo);
  const active = todos.find((t) => t.id === activeId && !t.completed);
  const open = todos.filter((t) => !t.completed).slice(0, 8);
  const [show, setShow] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setShow(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setShow(false);
    addEventListener('pointerdown', close);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('pointerdown', close);
      removeEventListener('keydown', esc);
    };
  }, [show]);

  const est = active?.estimateMinutes ? active.estimateMinutes * 60 : 0;
  const pct = est ? Math.min(1, (active?.loggedSeconds || 0) / est) : 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          haptic(6);
          setShow((s) => !s);
        }}
        aria-expanded={show}
        className={cn(
          'pressable flex max-w-[min(86vw,420px)] items-center gap-2 rounded-full py-2 pr-3 pl-2.5 text-sm font-extrabold',
          onMedia ? 'bg-black/25 text-white backdrop-blur-md hover:bg-black/35' : 'glass text-ink',
        )}
      >
        <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', active ? 'bg-accent text-accent-ink' : onMedia ? 'bg-white/15' : 'bg-line')}>
          <Target size={14} strokeWidth={2.8} />
        </span>
        <span className={cn('truncate', !active && (onMedia ? 'text-white/80' : 'text-muted'))}>{active ? active.text : 'What are you working on?'}</span>
        {active && est > 0 && <span className="shrink-0 text-xs opacity-70">{Math.round(pct * 100)}%</span>}
        <ChevronDown size={16} className={cn('shrink-0 transition-transform', show && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="glass-strong absolute top-[calc(100%+8px)] left-1/2 z-30 w-[min(86vw,360px)] -translate-x-1/2 rounded-3xl p-2 text-ink"
          >
            <form
              className="flex items-center gap-2 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                const t = addTodo(text.trim());
                focusOnTodo(t.id);
                setText('');
                setShow(false);
              }}
            >
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type an intention…"
                className="h-10 min-w-0 flex-1 rounded-2xl bg-line px-3 text-sm font-bold outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
              />
              <button type="submit" aria-label="Add and focus" className="pressable grid size-10 place-items-center rounded-2xl bg-accent text-accent-ink">
                <Plus size={18} strokeWidth={3} />
              </button>
            </form>
            {open.length > 0 && <p className="px-3 pt-2 pb-1 text-[11px] font-black tracking-wider text-muted uppercase">Your tasks</p>}
            <ul className="soft-scroll max-h-64 overflow-y-auto">
              {open.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      focusOnTodo(t.id === activeId ? null : t.id);
                      setShow(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-bold hover:bg-line"
                  >
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2', t.id === activeId ? 'border-accent bg-accent text-accent-ink' : 'border-line')}>
                      {t.id === activeId && <Check size={12} strokeWidth={4} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.text}</span>
                    {!!t.loggedSeconds && <span className="shrink-0 text-xs text-muted">{formatDuration(t.loggedSeconds)}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {activeId && (
              <button onClick={() => (focusOnTodo(null), setShow(false))} className="w-full rounded-2xl px-3 py-2 text-left text-xs font-extrabold text-muted hover:bg-line">
                Clear focus
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
