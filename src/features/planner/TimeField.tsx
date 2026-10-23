import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, useAnimate } from 'motion/react';
import { formatHM } from '@/lib/time';
import { cn } from '@/lib/utils';

const minToHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const show = (m: number, h24: boolean) => (m >= 1440 ? (h24 ? '24:00' : '12:00am') : formatHM(minToHM(m), h24));

/**
 * Typed time -> minutes since midnight, or null. Takes "9", "930", "9:30", "9.30pm", "21:30", "12:45 a.m.", "noon", "midnight".
 * A bare 1-12 with no am/pm picks whichever half of the day is closer to `near` (24h users get it literally).
 * With `endOfDay`, midnight means 24:00 (the end of a block), not 00:00.
 */
export function parseTime(input: string, opts: { near: number; endOfDay?: boolean; h24?: boolean }): number | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const midnight = opts.endOfDay ? 1440 : 0;
  if (raw === 'noon') return 720;
  if (raw === 'midnight') return midnight;

  let s = raw;
  let ap: 'am' | 'pm' | null = null;
  const mer = s.match(/\s*(a\.?m\.?|p\.?m\.?|a|p)$/);
  if (mer) {
    ap = mer[1].startsWith('a') ? 'am' : 'pm';
    s = s.slice(0, mer.index).trim();
  }

  let h: number;
  let m = 0;
  if (/^\d{1,2}[:.]\d{2}$/.test(s)) [h, m] = s.split(/[:.]/).map(Number);
  else if (/^\d{1,4}$/.test(s)) {
    // "9" / "21" / "930" / "2130"
    const cut = s.length <= 2 ? s.length : s.length - 2;
    h = Number(s.slice(0, cut));
    m = Number(s.slice(cut) || 0);
  } else return null;
  if (m > 59 || h > 24) return null;

  if (h === 24) return m === 0 && !ap && opts.endOfDay ? 1440 : null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    const t = ((h % 12) + (ap === 'pm' ? 12 : 0)) * 60 + m;
    return t === 0 ? midnight : t;
  }
  if (opts.h24 || h === 0 || h >= 13 || s.startsWith('00')) {
    const t = h * 60 + m;
    return t === 0 ? midnight : t;
  }
  const am = (h % 12) * 60 + m;
  const t = Math.abs(am - opts.near) <= Math.abs(am + 720 - opts.near) ? am : am + 720;
  return t === 0 ? midnight : t;
}

interface Props {
  value: number;
  /** return false to refuse the time (the field shakes and snaps back) */
  onCommit: (min: number) => boolean | void;
  h24: boolean;
  label: string;
  endOfDay?: boolean;
  min?: number;
  max?: number;
  className?: string;
}

/** A time box you can actually type into: commits on Enter/blur, never mid-typing. Arrows and chevrons nudge 5 min (Shift = 1 h). */
export function TimeField({ value, onCommit, h24, label, endOfDay, min = 0, max = 1440, className }: Props) {
  const formatted = show(value, h24);
  const [draft, setDraft] = useState(formatted);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const skipBlur = useRef(false);
  const errTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [scope, animate] = useAnimate();
  const parse = (text: string) => parseTime(text, { near: value, endOfDay, h24 });

  useEffect(() => {
    if (!focused) setDraft(formatted);
  }, [formatted, focused]);

  // Typed a time then clicked away and the editor closed before blur: keep what they typed
  const pending = useRef<{ dirty: boolean; commit: () => void }>({ dirty: false, commit: () => {} });
  pending.current = {
    dirty: focused && draft !== formatted,
    commit: () => {
      const t = parse(draft);
      if (t !== null && t >= min && t <= max) onCommit(t);
    },
  };
  useEffect(
    () => () => {
      clearTimeout(errTimer.current);
      if (pending.current.dirty) pending.current.commit();
    },
    [],
  );

  const reject = () => {
    setDraft(formatted);
    setInvalid(true);
    clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setInvalid(false), 600);
    void animate(scope.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.35 });
  };
  const apply = (t: number) => {
    if (t < min || t > max || onCommit(t) === false) return reject();
    setInvalid(false);
    setDraft(show(t, h24));
  };
  const commitDraft = () => {
    const t = parse(draft);
    if (t === null) reject();
    else if (t !== value) apply(t);
    else setDraft(formatted);
  };
  const step = (dir: 1 | -1, big = false) => {
    const base = focused && draft !== formatted ? (parse(draft) ?? value) : value;
    // land on the 5-minute grid first: 9:07 up -> 9:10, down -> 9:05
    const t = big ? base + dir * 60 : dir > 0 ? Math.floor(base / 5) * 5 + 5 : Math.ceil(base / 5) * 5 - 5;
    apply(Math.max(min, Math.min(max, t)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
      input.current?.select();
    } else if (e.key === 'Escape') {
      skipBlur.current = true;
      setInvalid(false);
      setDraft(formatted);
      input.current?.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
    }
  };

  return (
    <motion.div
      ref={scope}
      className={cn(
        'inline-flex h-10 w-[7.5rem] items-center rounded-xl bg-line pr-1 pl-2.5 text-sm font-bold text-ink tabular-nums transition-shadow',
        focused && !invalid && 'ring-2 ring-accent',
        invalid && 'text-bad ring-2 ring-bad',
        className,
      )}
    >
      <input
        ref={input}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        placeholder={h24 ? '21:30' : '9:30am'}
        value={focused ? draft : formatted}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          setDraft(formatted);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          if (skipBlur.current) skipBlur.current = false;
          else commitDraft();
        }}
        onKeyDown={onKeyDown}
        className="w-full min-w-0 flex-1 bg-transparent text-inherit outline-none select-text placeholder:text-faint"
      />
      <div className="ml-0.5 flex flex-col">
        {([1, -1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            tabIndex={-1}
            aria-label={`${label} ${dir > 0 ? 'later' : 'earlier'}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => step(dir)}
            className="pressable grid h-4 w-5 place-items-center rounded text-muted hover:bg-accent-soft hover:text-ink"
          >
            {dir > 0 ? <ChevronUp size={14} strokeWidth={2.8} /> : <ChevronDown size={14} strokeWidth={2.8} />}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
