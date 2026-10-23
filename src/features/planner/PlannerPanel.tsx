import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Copy, Play, Plus, Trash2, X } from 'lucide-react';
import { useData } from '@/store/data';
import type { TimeSlot } from '@/data/types';
import { formatHM, hmToMin, todayWeekday, type Weekday } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Empty, Segmented } from '@/ui/primitives';
import { toast } from '@/store/ui';
import { focusSlot, isSlotDone, slotFocusMinutes, toggleSlotDone } from './plannedTasks';
import { TimeField } from './TimeField';

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                  */
/* ------------------------------------------------------------------ */
const DAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
const FIRST = 0; // the whole day; it opens scrolled to now
const LAST = 24 * 60;
const HOUR = 48; // px per hour
const SNAP = 15; // drag snapping; typed times are exact
const MIN_LEN = 5;
const DURATIONS: [number, string][] = [[15, '15m'], [30, '30m'], [45, '45m'], [60, '1h'], [90, '1½h'], [120, '2h'], [180, '3h']];
const durLabel = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);
const PALETTE = ['#ff8a4c', '#9d7bff', '#2fbf85', '#1e9fd6', '#ff5d73', '#ffb020'];

const EMOJI: [RegExp, string][] = [
  [/math|calc|physics|chem|exam|revision/i, '🧮'],
  [/study|learn|class|lecture|course|homework/i, '📚'],
  [/read|book/i, '📖'],
  [/gym|run|workout|yoga|walk|exercise|sport/i, '💪'],
  [/code|dev|program|build|project/i, '💻'],
  [/lunch|dinner|breakfast|eat|meal|snack/i, '🍜'],
  [/sleep|nap|rest|bed/i, '😴'],
  [/write|essay|journal|blog/i, '✍️'],
  [/meet|call|sync|interview/i, '📞'],
  [/music|guitar|piano|sing/i, '🎸'],
  [/clean|chores|laundry/i, '🧹'],
  [/game|play/i, '🎮'],
];
export const emojiFor = (s: string) => EMOJI.find(([r]) => r.test(s))?.[1] ?? '✨';
const colorFor = (slot: Pick<TimeSlot, 'activity' | 'color'>) => {
  if (slot.color) return slot.color;
  let h = 0;
  for (const c of slot.activity) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
};
const minToHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const clampMin = (m: number) => Math.max(FIRST, Math.min(LAST, m));
const yOf = (m: number) => ((m - FIRST) / 60) * HOUR;
const nowMinutes = () => new Date().getHours() * 60 + new Date().getMinutes();
const hourLabel = (h: number, h24: boolean) => (h24 ? `${String(h).padStart(2, '0')}:00` : `${h % 12 || 12} ${h < 12 || h === 24 ? 'am' : 'pm'}`);

function useNow() {
  const [m, setM] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setM(nowMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);
  return m;
}

/* ------------------------------------------------------------------ */
/* Natural-language quick add: "Gym 6-7pm mon wed fri", "Read 30m at 9pm tomorrow"     */
/* ------------------------------------------------------------------ */
interface Plan {
  activity: string;
  start: number;
  end: number;
  days: Weekday[];
}

const T = String.raw`(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`;
function toMin(h: string, m: string | undefined, ap: string | undefined) {
  let H = Number(h);
  const M = m ? Number(m) : 0;
  if (ap && (H < 1 || H > 12)) return null;
  if (ap === 'pm' && H < 12) H += 12;
  if (ap === 'am' && H === 12) H = 0;
  if (!ap && H >= 1 && H <= 5) H += 12; // a bare "5" almost always means 5 pm
  return H > 24 || M > 59 || (H === 24 && M > 0) ? null : H * 60 + M;
}

export function parsePlan(input: string, fallback: Weekday): Plan | null {
  let text = ` ${input.trim()} `;
  if (!input.trim()) return null;
  const days = new Set<Weekday>();
  const take = (re: RegExp, add: Weekday[]) => {
    if (re.test(text)) {
      add.forEach((d) => days.add(d));
      text = text.replace(re, ' ');
    }
  };
  const today = todayWeekday();
  take(/\b(every ?day|daily)\b/gi, DAYS);
  take(/\bweekdays\b/gi, DAYS.slice(0, 5));
  take(/\bweekends?\b/gi, DAYS.slice(5));
  take(/\b(tomorrow|tmrw)\b/gi, [DAYS[(DAYS.indexOf(today) + 1) % 7]]);
  take(/\btoday\b/gi, [today]);
  DAYS.forEach((d) => take(new RegExp(`\\b(${d}|${d.slice(0, 3)})\\b`, 'gi'), [d]));

  // duration: "30m", "1h", "90 min", "1.5 hours"
  let dur = 0;
  const dm = text.match(/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|mins?|minutes?)\b/i);
  if (dm) {
    dur = Math.round(Number(dm[1]) * (/^h/i.test(dm[2]) ? 60 : 1));
    text = text.replace(dm[0], ' ');
  }

  let start: number | null = null;
  let end: number | null = null;
  const range = text.match(new RegExp(`(?:\\b(?:at|from)\\s+)?\\b${T}\\s*(?:-|–|to)\\s*${T}\\b`, 'i'));
  if (range) {
    const [, h1, m1, a1, h2, m2, a2] = range.map((x) => x?.toLowerCase());
    end = toMin(h2, m2, a2 ?? a1); // "1:30pm-2" = until 2 pm
    start = toMin(h1, m1, a1 ?? a2); // "6-7pm" = 6pm to 7pm
    if (start !== null && end !== null && start >= end) {
      if (!a1 && a2) start = toMin(h1, m1, a2 === 'pm' ? 'am' : 'pm'); // "11-1pm"
      else if (a1 && !a2) end = toMin(h2, m2, a1 === 'am' ? 'pm' : 'am'); // "11am-1"
    }
    text = text.replace(range[0], ' ');
  } else {
    // a single time needs am/pm, a colon or "at" so plain numbers in names stay text
    const single = text.match(new RegExp(`(?:\\bat\\s+)?\\b(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)\\b|\\bat\\s+${T}|\\b(\\d{1,2}):(\\d{2})\\b`, 'i'));
    if (single) {
      const g = single.map((x) => x?.toLowerCase());
      start = g[1] ? toMin(g[1], g[2], g[3]) : g[4] ? toMin(g[4], g[5], g[6]) : toMin(g[7], g[8], undefined);
      text = text.replace(single[0], ' ');
    }
  }
  if (start === null) {
    // no time: next full hour today, else 9am
    const next = Math.ceil((nowMinutes() + 1) / 60) * 60;
    start = days.size === 0 || days.has(today) ? Math.min(next, 23 * 60) : 9 * 60;
  }
  if (end === null) end = start + (dur || 60);
  if (end <= start) end = LAST; // "11pm-1am": stop at midnight
  start = Math.min(LAST - MIN_LEN, clampMin(start));
  end = Math.max(start + MIN_LEN, clampMin(end));
  if (days.size === 0) days.add(fallback);
  const activity = text.replace(/\s+/g, ' ').replace(/^\s*(at|on|from)\b|\b(at|on|from)\s*$/gi, '').trim();
  return activity ? { activity: activity[0].toUpperCase() + activity.slice(1), start, end, days: DAYS.filter((d) => days.has(d)) } : null;
}

/* ------------------------------------------------------------------ */
/* Overlap lanes: overlapping blocks sit side by side                   */
/* ------------------------------------------------------------------ */
type Slot = TimeSlot & { id: string; s: number; e: number; lane: number; lanes: number };
function layout(slots: (TimeSlot & { id: string })[]): Slot[] {
  const list = slots.map((x) => ({ ...x, s: hmToMin(x.start), e: hmToMin(x.end), lane: 0, lanes: 1 })).sort((a, b) => a.s - b.s || b.e - a.e);
  let group: Slot[] = [];
  let groupEnd = -1;
  const flush = () => group.forEach((g) => (g.lanes = Math.max(...group.map((x) => x.lane)) + 1));
  for (const x of list) {
    if (x.s >= groupEnd) {
      flush();
      group = [];
      groupEnd = -1;
    }
    const used = new Set(group.filter((g) => g.e > x.s).map((g) => g.lane));
    while (used.has(x.lane)) x.lane++;
    group.push(x);
    groupEnd = Math.max(groupEnd, x.e);
  }
  flush();
  return list;
}

/** What a create-drag will make: the dragged span, or 1 hour for a plain click. */
const createSpan = (d: { a: number; b: number; moved: boolean }) => {
  const s = Math.min(d.a, d.b);
  return { s, e: d.moved ? Math.max(d.a, d.b, s + SNAP) : Math.min(LAST, s + 60) };
};

/* ------------------------------------------------------------------ */
/* Planner                                                              */
/* ------------------------------------------------------------------ */
type Drag =
  | { kind: 'create'; day: Weekday; a: number; b: number; y0: number; moved: boolean }
  | { kind: 'move' | 'resize'; id: string; day: Weekday; s: number; e: number; x0: number; y0: number; moved: boolean; orig: { s: number; e: number } };

export default function PlannerPanel() {
  const timetable = useData((s) => s.data.timetable);
  const h24 = useData((s) => !!s.data.settings.use24h);
  const { addSlot, updateSlot } = useData.getState();
  const now = useNow();
  const today = todayWeekday();

  const root = useRef<HTMLDivElement>(null);
  const gridBox = useRef<HTMLDivElement>(null);
  const nowLine = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [view, setView] = useState<'day' | 'week' | null>(null);
  const [day, setDay] = useState<Weekday>(today);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mode = wide ? (view ?? 'week') : 'day';
  const cols = mode === 'week' ? DAYS : [day];

  const slots = useMemo(() => Object.entries(timetable).map(([id, s]) => ({ ...s, id })), [timetable]);
  const byDay = useMemo(() => {
    const m: Record<string, Slot[]> = {};
    DAYS.forEach((d) => (m[d] = layout(slots.filter((s) => s.day === d))));
    return m;
  }, [slots]);

  // Show "now" when the planner opens
  useEffect(() => {
    const t = setTimeout(() => nowLine.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    return () => clearTimeout(t);
  }, [mode]);

  /* ---------------- pointer maths ---------------- */
  const colAt = (clientX: number): Weekday | null => {
    for (const el of gridBox.current?.querySelectorAll<HTMLElement>('[data-day]') ?? []) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return el.dataset.day as Weekday;
    }
    return null;
  };
  /** `cell` = the 15-minute cell under the pointer (for clicks); otherwise the nearest grid line (for drags) */
  const minAt = (clientY: number, d: Weekday, cell = false) => {
    const el = gridBox.current?.querySelector<HTMLElement>(`[data-day="${d}"]`);
    if (!el) return FIRST;
    const m = FIRST + ((clientY - el.getBoundingClientRect().top) / HOUR) * 60;
    return clampMin(cell ? Math.floor(m / SNAP) * SNAP : snap(m));
  };

  const onColumnDown = (e: ReactPointerEvent<HTMLDivElement>, d: Weekday) => {
    if (e.button !== 0) return;
    if (editing) return setEditing(null); // a click outside the editor just closes it
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = Math.min(minAt(e.clientY, d, true), LAST - SNAP);
    setDrag({ kind: 'create', day: d, a: m, b: m, y0: e.clientY, moved: false });
  };
  const onBlockDown = (e: ReactPointerEvent<HTMLElement>, slot: Slot, kind: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    root.current?.setPointerCapture(e.pointerId);
    setEditing(null);
    setDrag({ kind, id: slot.id, day: slot.day as Weekday, s: slot.s, e: slot.e, x0: e.clientX, y0: e.clientY, moved: false, orig: { s: slot.s, e: slot.e } });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    if (drag.kind === 'create') return setDrag({ ...drag, moved: drag.moved || Math.abs(e.clientY - drag.y0) > 4, b: minAt(e.clientY, drag.day) });
    const moved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4;
    if (!moved) return;
    const dm = ((e.clientY - drag.y0) / HOUR) * 60;
    if (drag.kind === 'resize') return setDrag({ ...drag, moved, e: Math.max(drag.orig.s + SNAP, clampMin(snap(drag.orig.e + dm))) });
    const len = drag.orig.e - drag.orig.s;
    const s = Math.max(FIRST, Math.min(LAST - len, snap(drag.orig.s + dm)));
    setDrag({ ...drag, moved, s, e: s + len, day: mode === 'week' ? (colAt(e.clientX) ?? drag.day) : drag.day });
  };
  const onUp = () => {
    if (!drag) return;
    setDrag(null);
    if (drag.kind === 'create') {
      const { s, e: end } = createSpan(drag);
      const id = addSlot({ day: drag.day, start: minToHM(s), end: minToHM(end), activity: 'New block', color: PALETTE[Math.floor(Math.random() * PALETTE.length)] });
      setEditing(id);
      return;
    }
    if (!drag.moved) return setEditing(drag.id);
    updateSlot(drag.id, { day: drag.day, start: minToHM(drag.s), end: minToHM(drag.e) });
  };

  const hasAny = slots.length > 0;
  const showNow = cols.includes(today) && now >= FIRST && now < LAST;

  return (
    <div ref={root} className="space-y-3" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <NowStrip slots={byDay[today] ?? []} now={now} />
      <QuickAdd fallback={mode === 'day' ? day : today} h24={h24} />

      <div className="flex flex-wrap items-center gap-2">
        {wide && <Segmented value={mode} onChange={(v) => setView(v)} options={[{ value: 'week', label: '🗓️ Week' }, { value: 'day', label: '☀️ Day' }]} />}
        {mode === 'day' && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={cn(
                  'pressable relative rounded-full px-3 py-1.5 text-xs font-extrabold whitespace-nowrap',
                  d === day ? 'bg-accent text-accent-ink shadow-[0_8px_18px_-10px_var(--accent)]' : 'bg-line text-ink hover:bg-accent-soft',
                )}
              >
                {SHORT[d]}
                {(byDay[d]?.length ?? 0) > 0 && <span className="ml-1 opacity-70">{byDay[d].length}</span>}
                {d === today && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-bad" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasAny && <Empty emoji="🗓️" title="Plan your week" body='Drag on the grid, click an empty slot, or type "Gym 6-7pm mon wed fri" above.' />}

      {/* Grid: hour gutter + one column per day */}
      <div ref={gridBox} className="relative grid select-none" style={{ gridTemplateColumns: `40px repeat(${cols.length}, minmax(0, 1fr))` }}>
        {/* sticky day header */}
        <div className="sticky top-0 z-20 col-span-full grid bg-[var(--sheet)] pb-1" style={{ gridTemplateColumns: 'subgrid' }}>
          <span />
          {cols.map((d) => (
            <div key={d} className={cn('rounded-xl py-1 text-center text-xs font-black', d === today ? 'bg-accent-soft text-ink' : 'text-muted')}>
              {mode === 'week' ? SHORT[d] : d[0].toUpperCase() + d.slice(1)}
            </div>
          ))}
        </div>

        <div className="relative" style={{ height: yOf(LAST) }}>
          {Array.from({ length: (LAST - FIRST) / 60 + 1 }, (_, i) => (
            <span key={i} className="tabular absolute right-1.5 -translate-y-1/2 text-[10px] font-bold text-faint" style={{ top: i * HOUR }}>
              {i === 0 ? '' : hourLabel(FIRST / 60 + i, h24)}
            </span>
          ))}
        </div>

        {cols.map((d) => {
          const isToday = d === today;
          const ghost = drag?.kind === 'create' && drag.day === d ? createSpan(drag) : null;
          return (
            <div
              key={d}
              data-day={d}
              onPointerDown={(e) => onColumnDown(e, d)}
              className={cn('relative cursor-cell touch-none', isToday && 'rounded-xl bg-accent-soft/40')}
              style={{
                height: yOf(LAST),
                backgroundImage: 'linear-gradient(to bottom, color-mix(in oklab, var(--ink) 7%, transparent) 1px, transparent 1px)',
                backgroundSize: `100% ${HOUR}px`,
              }}
            >
              {isToday && showNow && (
                <div ref={nowLine} className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: yOf(now) }}>
                  <span className="-ml-1 size-2.5 rounded-full bg-bad shadow-[0_0_10px_var(--color-bad)]" />
                  <span className="h-0.5 flex-1 bg-bad" />
                </div>
              )}
              {ghost && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-10 rounded-xl border-2 border-dashed border-accent bg-accent-soft px-2 py-1 text-[11px] font-extrabold text-ink"
                  style={{ top: yOf(ghost.s), height: Math.max(18, yOf(ghost.e) - yOf(ghost.s)) }}
                >
                  {formatHM(minToHM(ghost.s), h24)} – {formatHM(minToHM(ghost.e), h24)}
                </div>
              )}
              {byDay[d].map((slot) => {
                const live = drag && drag.kind !== 'create' && drag.id === slot.id ? drag : null;
                if (live && live.day !== d) return null; // being dragged into another column
                return <Block key={slot.id} slot={slot} s={live?.s ?? slot.s} e={live?.e ?? slot.e} dragging={!!live?.moved} now={isToday ? now : -1} h24={h24} onDown={onBlockDown} />;
              })}
              {/* a block dragged in from another day */}
              {drag?.kind === 'move' && drag.day === d && !byDay[d].some((x) => x.id === drag.id) && (
                <Block slot={slots.map((x) => ({ ...x, s: 0, e: 0, lane: 0, lanes: 1 })).find((x) => x.id === drag.id)!} s={drag.s} e={drag.e} dragging now={-1} h24={h24} onDown={onBlockDown} />
              )}
            </div>
          );
        })}

        <AnimatePresence>{editing && timetable[editing] && <Editor key={editing} id={editing} slot={timetable[editing]} h24={h24} gridBox={gridBox} onClose={() => setEditing(null)} />}</AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */
function Block({ slot, s, e, dragging, now, h24, onDown }: { slot: Slot; s: number; e: number; dragging: boolean; now: number; h24: boolean; onDown: (e: ReactPointerEvent<HTMLElement>, slot: Slot, kind: 'move' | 'resize') => void }) {
  const color = colorFor(slot);
  const h = yOf(e) - yOf(s);
  const done = isSlotDone(slot);
  const live = now >= s && now < e && !done;
  const w = 100 / slot.lanes;
  return (
    <motion.div
      data-slot={slot.id}
      role="button"
      tabIndex={0}
      aria-label={`${slot.activity}, ${formatHM(minToHM(s), h24)} to ${formatHM(minToHM(e), h24)}`}
      onPointerDown={(ev) => onDown(ev, slot, 'move')}
      onKeyDown={(ev) => ev.key === 'Enter' && (ev.currentTarget as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: dragging ? 1.03 : 1, opacity: done ? 0.5 : 1, boxShadow: live ? [`0 0 0 0px ${color}66`, `0 0 0 6px ${color}00`] : '0 6px 16px -10px rgb(0 0 0 / 0.35)' }}
      transition={live ? { boxShadow: { duration: 1.6, repeat: Infinity }, default: { type: 'spring', stiffness: 500, damping: 30 } } : { type: 'spring', stiffness: 500, damping: 30 }}
      className={cn('absolute z-[5] cursor-grab touch-none overflow-hidden rounded-xl px-2 py-1 text-ink', dragging && 'z-30 cursor-grabbing')}
      style={{
        top: yOf(s) + 1,
        height: Math.max(18, h - 2),
        left: `calc(${slot.lane * w}% + 2px)`,
        width: `calc(${w}% - 4px)`,
        background: `color-mix(in oklab, ${color} 26%, var(--surface-strong))`,
        boxShadow: `inset 3px 0 0 ${color}`,
      }}
    >
      <p className={cn('truncate text-[12px] leading-tight font-extrabold', done && 'line-through')}>
        {emojiFor(slot.activity)} {slot.activity}
      </p>
      {h >= 38 && <p className="tabular truncate text-[10px] font-bold text-muted">{formatHM(minToHM(s), h24)} – {formatHM(minToHM(e), h24)}</p>}
      {live && <span className="absolute top-1 right-1.5 rounded-full px-1.5 text-[9px] font-black text-white" style={{ background: color }}>NOW</span>}
      <span onPointerDown={(ev) => onDown(ev, slot, 'resize')} className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize" aria-hidden />
    </motion.div>
  );
}

function NowStrip({ slots, now }: { slots: Slot[]; now: number }) {
  const current = slots.find((x) => now >= x.s && now < x.e && !isSlotDone(x));
  const next = slots.filter((x) => x.s > now && !isSlotDone(x)).sort((a, b) => a.s - b.s)[0];
  if (current) {
    const left = current.e - now;
    const pct = (now - current.s) / (current.e - current.s);
    return (
      <div className="relative overflow-hidden rounded-2xl bg-accent-soft p-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative size-2.5 rounded-full bg-accent" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink">
            Now: {emojiFor(current.activity)} {current.activity} <span className="text-muted">· {left}m left</span>
          </p>
          <button onClick={() => focusSlot(current.id)} className="pressable flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-black text-accent-ink">
            <Play size={12} fill="currentColor" strokeWidth={0} /> Focus
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${pct * 100}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-line px-3 py-2.5 text-sm font-bold text-muted">
      {next ? (
        <>
          ⏭️ Up next: <span className="font-extrabold text-ink">{emojiFor(next.activity)} {next.activity}</span> in {next.s - now < 60 ? `${next.s - now}m` : `${Math.floor((next.s - now) / 60)}h ${(next.s - now) % 60}m`}
        </>
      ) : (
        <>🌙 Nothing else planned today. Free time!</>
      )}
    </div>
  );
}

function QuickAdd({ fallback, h24 }: { fallback: Weekday; h24: boolean }) {
  const [text, setText] = useState('');
  const plan = useMemo(() => parsePlan(text, fallback), [text, fallback]);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return toast({ emoji: '🤔', title: 'Add a name', body: 'e.g. "Gym 6-7pm mon wed fri"' });
    plan.days.forEach((d) => useData.getState().addSlot({ day: d, start: minToHM(plan.start), end: minToHM(plan.end), activity: plan.activity }));
    toast({ emoji: emojiFor(plan.activity), title: `Planned: ${plan.activity}`, body: `${plan.days.map((d) => SHORT[d]).join(', ')} · ${formatHM(minToHM(plan.start), h24)} – ${formatHM(minToHM(plan.end), h24)}` });
    setText('');
  };
  return (
    <form onSubmit={add}>
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Quick add: "Gym 6-7pm mon wed fri", "Read 30m at 9pm"'
          className="h-11 min-w-0 flex-1 rounded-2xl bg-line px-3.5 text-sm font-bold text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
        />
        <button type="submit" aria-label="Add to planner" className="pressable grid size-11 place-items-center rounded-2xl bg-accent text-accent-ink">
          <Plus size={20} strokeWidth={3} />
        </button>
      </div>
      <AnimatePresence>
        {plan && text.trim() && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-1.5 px-1 text-xs font-bold text-muted">
            {emojiFor(plan.activity)} <span className="text-ink">{plan.activity}</span> · {plan.days.length === 7 ? 'Every day' : plan.days.map((d) => SHORT[d]).join(', ')} · {formatHM(minToHM(plan.start), h24)} – {formatHM(minToHM(plan.end), h24)}
            <span className="text-faint"> · Enter to add</span>
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

function Editor({ id, slot, h24, gridBox, onClose }: { id: string; slot: TimeSlot; h24: boolean; gridBox: React.RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const { updateSlot, deleteSlot, addSlot } = useData.getState();
  const [name, setName] = useState(slot.activity === 'New block' ? '' : slot.activity);
  const [copyTo, setCopyTo] = useState<Weekday[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const W = 300;

  // Sit next to the block, inside the grid, so it scrolls with it
  useEffect(() => {
    const box = gridBox.current;
    const el = box?.querySelector<HTMLElement>(`[data-slot="${CSS.escape(id)}"]`);
    if (!box || !el) return setPos({ top: 40, left: 40 });
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let left = r.right - b.left + 8;
    if (left + W > b.width) left = r.left - b.left - W - 8;
    if (left < 0) left = Math.max(0, Math.min(b.width - W, r.left - b.left));
    setPos({ top: Math.max(0, r.top - b.top), left });
  }, [id, gridBox, slot.day, slot.start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => updateSlot(id, { activity: name.trim() || 'New block' });
  const s = hmToMin(slot.start);
  const e = hmToMin(slot.end);
  const focusMins = slotFocusMinutes(slot, id);
  const done = isSlotDone(slot);
  const color = colorFor(slot);
  /** Moving the start keeps the length (like any calendar); the end can't pass midnight */
  const setTimes = (start: number, end: number) => {
    end = Math.min(LAST, end);
    if (end - start < MIN_LEN) return false;
    updateSlot(id, { start: minToHM(start), end: minToHM(end) });
  };

  if (!pos) return null;
  return (
    <motion.div
      onPointerDown={(ev) => ev.stopPropagation()}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="glass-strong absolute z-40 space-y-3 rounded-3xl p-3.5 text-ink"
      style={{ top: pos.top, left: pos.left, width: W }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{emojiFor(name || slot.activity)}</span>
        <input
          autoFocus
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          onBlur={save}
          onKeyDown={(ev) => ev.key === 'Enter' && (save(), onClose())}
          placeholder="What's this block?"
          className="h-10 min-w-0 flex-1 rounded-xl bg-line px-3 text-sm font-extrabold outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
        />
        <button onClick={onClose} aria-label="Close" className="pressable grid size-8 place-items-center rounded-full bg-line hover:bg-accent-soft">
          <X size={15} strokeWidth={2.8} />
        </button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <TimeField label="Start time" value={s} h24={h24} max={LAST - MIN_LEN} onCommit={(m) => setTimes(m, m + (e - s))} className="w-auto min-w-0 flex-1" />
          <span className="text-sm font-black text-muted">→</span>
          <TimeField label="End time" value={e} h24={h24} endOfDay min={s + MIN_LEN} onCommit={(m) => setTimes(s, m)} className="w-auto min-w-0 flex-1" />
        </div>
        <div className="flex items-center gap-1">
          {DURATIONS.map(([m, label]) => (
            <button
              key={m}
              onClick={() => setTimes(s, s + m)}
              disabled={s + m > LAST}
              className={cn('pressable flex-1 rounded-full py-1 text-[11px] font-extrabold disabled:opacity-35', e - s === m ? 'bg-accent text-accent-ink' : 'bg-line text-ink hover:bg-accent-soft')}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="px-1 text-[11px] font-bold text-muted">
          ⏱️ {durLabel(e - s)} · type any time like <span className="text-ink">7:40pm</span> or <span className="text-ink">1945</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {PALETTE.map((c) => (
          <button key={c} aria-label={`Colour ${c}`} onClick={() => updateSlot(id, { color: c })} className="pressable size-7 rounded-full" style={{ background: c, boxShadow: c === color ? `0 0 0 2px var(--surface-strong), 0 0 0 4px ${c}` : undefined }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => (save(), focusSlot(id), onClose())} className="pressable flex items-center justify-center gap-1.5 rounded-2xl bg-accent py-2 text-sm font-black text-accent-ink">
          <Play size={14} fill="currentColor" strokeWidth={0} /> Focus {focusMins}m
        </button>
        <button onClick={() => toggleSlotDone(id)} className={cn('pressable flex items-center justify-center gap-1.5 rounded-2xl py-2 text-sm font-black', done ? 'bg-good text-white' : 'bg-line text-ink')}>
          <Check size={15} strokeWidth={3} /> {done ? 'Done!' : 'Mark done'}
        </button>
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-black tracking-wider text-muted uppercase">
          <Copy size={11} strokeWidth={3} /> Copy to
        </p>
        <div className="flex flex-wrap gap-1">
          {DAYS.filter((d) => d !== slot.day).map((d) => (
            <button
              key={d}
              onClick={() => setCopyTo((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d]))}
              className={cn('pressable rounded-full px-2 py-1 text-[11px] font-extrabold', copyTo.includes(d) ? 'bg-accent text-accent-ink' : 'bg-line text-ink')}
            >
              {SHORT[d]}
            </button>
          ))}
        </div>
        {copyTo.length > 0 && (
          <button
            onClick={() => {
              copyTo.forEach((d) => addSlot({ day: d, start: slot.start, end: slot.end, activity: name.trim() || slot.activity, color: slot.color }));
              toast({ emoji: '📋', title: `Copied to ${copyTo.map((d) => SHORT[d]).join(', ')}` });
              setCopyTo([]);
            }}
            className="pressable mt-2 w-full rounded-2xl bg-accent-soft py-1.5 text-xs font-black text-ink"
          >
            Copy to {copyTo.length} day{copyTo.length > 1 ? 's' : ''}
          </button>
        )}
      </div>
      <button
        onClick={() => {
          const keep = { ...slot };
          deleteSlot(id);
          onClose();
          toast({ emoji: '🗑️', title: 'Block deleted', body: keep.activity, action: { label: 'Undo', run: () => addSlot({ day: keep.day, start: keep.start, end: keep.end, activity: keep.activity, color: keep.color }) } });
        }}
        className="pressable flex w-full items-center justify-center gap-1.5 rounded-2xl py-1.5 text-xs font-black text-bad hover:bg-bad/10"
      >
        <Trash2 size={13} strokeWidth={2.8} /> Delete block
      </button>
    </motion.div>
  );
}
