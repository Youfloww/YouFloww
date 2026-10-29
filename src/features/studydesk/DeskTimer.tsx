import { Pause, Play, SkipForward } from 'lucide-react';
import { useTimer, MODE_META } from '@/store/timer';
import { cn, haptic } from '@/lib/utils';
import { useTimerView } from '../timer/TimerOrb';
import { requestEnd, skipBreak, toggle } from '../timer/engine';

/** The small timer that sits in a corner of the Study Desk. */
export function DeskTimer({ className, compact }: { className?: string; compact?: boolean }) {
  const v = useTimerView();
  const mode = useTimer((s) => s.mode);
  const running = v.status === 'running';
  const onBreak = mode !== 'focus';
  const label = v.status === 'paused' ? 'Paused' : MODE_META[mode].label;
  return (
    <div className={cn('glass-strong flex items-center gap-1.5 overflow-hidden rounded-full py-1.5 pr-1.5', compact ? 'pl-3' : 'pl-3.5', className)} role="group" aria-label={`${label} timer`}>
      <span className="text-base leading-none" aria-hidden>
        {MODE_META[mode].emoji}
      </span>
      <span className="flex flex-col leading-none">
        {!compact && <span className="text-[9.5px] font-black tracking-[0.14em] text-muted uppercase">{label}</span>}
        <span className={cn('tabular font-display font-semibold', compact ? 'text-lg' : 'text-xl')}>{v.clock}</span>
      </span>
      <button
        onClick={() => {
          haptic(8);
          toggle();
        }}
        aria-label={running ? 'Pause' : v.status === 'paused' ? 'Resume' : onBreak ? 'Start break' : 'Start focus'}
        title={running ? 'Pause (space)' : 'Start (space)'}
        className="pressable ml-1 grid size-9 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_6px_16px_-8px_var(--accent)]"
      >
        {running ? <Pause size={16} fill="currentColor" strokeWidth={0} /> : <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-px" />}
      </button>
      {(v.status !== 'idle' || onBreak) && (
        <button
          onClick={onBreak && v.status === 'idle' ? skipBreak : requestEnd}
          aria-label={onBreak ? 'Skip break' : 'End session'}
          title={onBreak ? 'Skip break' : 'End session'}
          className="pressable grid size-9 place-items-center rounded-full bg-line text-ink hover:bg-surface"
        >
          <SkipForward size={15} strokeWidth={2.6} />
        </button>
      )}
      <span className="absolute bottom-0 left-0 h-[3px] rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${v.progress * 100}%` }} aria-hidden />
    </div>
  );
}
