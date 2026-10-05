import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2, Copy } from 'lucide-react';
import { useData } from '@/store/data';
import { formatHM, hmToMin, todayWeekday, type Weekday } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Button, Empty } from '@/ui/primitives';
import { toast } from '@/store/ui';

const ORDER: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const EMOJI_HINTS: [RegExp, string][] = [
  [/math|calc|physics|chem/i, '🧮'],
  [/read|book/i, '📖'],
  [/gym|run|workout|yoga|walk/i, '🏃'],
  [/code|dev|program/i, '💻'],
  [/lunch|dinner|breakfast|eat/i, '🍜'],
  [/sleep|nap/i, '😴'],
  [/write|essay/i, '✍️'],
  [/meet|call/i, '📞'],
  [/study|learn|class|lecture/i, '📚'],
  [/music|guitar|piano/i, '🎸'],
];
const emojiFor = (s: string) => EMOJI_HINTS.find(([r]) => r.test(s))?.[1] ?? '✨';

function useNowMinutes() {
  const [m, setM] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => {
    const id = setInterval(() => setM(new Date().getHours() * 60 + new Date().getMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);
  return m;
}

export default function PlannerPanel() {
  const timetable = useData((s) => s.data.timetable);
  const use24h = useData((s) => !!s.data.settings.use24h);
  const { addSlot, toggleSlot, deleteSlot } = useData.getState();
  const [day, setDay] = useState<Weekday>(todayWeekday());
  const [form, setForm] = useState({ start: '09:00', end: '10:00', activity: '' });
  const [adding, setAdding] = useState(false);
  const now = useNowMinutes();
  const isToday = day === todayWeekday();

  const slots = useMemo(
    () =>
      Object.entries(timetable)
        .filter(([, s]) => s.day === day)
        .sort(([, a], [, b]) => hmToMin(a.start) - hmToMin(b.start)),
    [timetable, day],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(timetable).forEach((s) => (c[s.day] = (c[s.day] || 0) + 1));
    return c;
  }, [timetable]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.activity.trim()) return;
    if (hmToMin(form.end) <= hmToMin(form.start)) return toast({ emoji: '⏰', title: 'End time should be after start' });
    addSlot({ day, start: form.start, end: form.end, activity: form.activity.trim().slice(0, 80) });
    const dur = hmToMin(form.end) - hmToMin(form.start);
    const nextEnd = hmToMin(form.end) + dur;
    const fmt = (m: number) => `${String(Math.floor(Math.min(m, 1439) / 60)).padStart(2, '0')}:${String(Math.min(m, 1439) % 60).padStart(2, '0')}`;
    setForm({ start: form.end, end: fmt(nextEnd), activity: '' });
  };

  const copyToWeekdays = () => {
    const src = slots.map(([, s]) => s);
    if (!src.length) return;
    ORDER.slice(0, 5)
      .filter((d) => d !== day)
      .forEach((d) => src.forEach((s) => addSlot({ day: d, start: s.start, end: s.end, activity: s.activity })));
    toast({ emoji: '📋', title: 'Copied to weekdays', body: `${src.length} blocks × 4 days` });
  };

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
        {ORDER.map((d) => {
          const on = d === day;
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={cn('relative flex min-w-[52px] flex-col items-center rounded-2xl px-2 py-2 text-xs font-black uppercase transition-colors', on ? 'text-accent-ink' : 'bg-line text-muted hover:text-ink')}
            >
              {on && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className="relative">{d.slice(0, 3)}</span>
              <span className="relative mt-0.5 flex h-1.5 gap-0.5">
                {Array.from({ length: Math.min(4, counts[d] || 0) }, (_, i) => (
                  <span key={i} className={cn('size-1.5 rounded-full', on ? 'bg-accent-ink/70' : 'bg-accent')} />
                ))}
              </span>
              {d === todayWeekday() && !on && <span className="absolute -top-1 right-1 size-2 rounded-full bg-secondary" />}
            </button>
          );
        })}
      </div>

      {slots.length ? (
        <ol className="relative space-y-2 border-l-2 border-dashed border-line pl-4">
          <AnimatePresence initial={false}>
            {slots.map(([id, s]) => {
              const live = isToday && now >= hmToMin(s.start) && now < hmToMin(s.end);
              const past = isToday && now >= hmToMin(s.end);
              const pct = live ? (now - hmToMin(s.start)) / (hmToMin(s.end) - hmToMin(s.start)) : 0;
              return (
                <motion.li key={id} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="group relative">
                  <span className={cn('absolute top-4 -left-[23px] size-3 rounded-full ring-4 ring-[var(--surface-strong)]', live ? 'bg-accent' : s.completed ? 'bg-good' : 'bg-line')}>
                    {live && <span className="absolute inset-0 animate-ping rounded-full bg-accent" />}
                  </span>
                  <div className={cn('overflow-hidden rounded-3xl ring-1', live ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-strong/70 ring-line', (s.completed || past) && !live && 'opacity-60')}>
                    <div className="flex items-center gap-3 p-3">
                      <span className="text-2xl">{emojiFor(s.activity)}</span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-[15px] font-extrabold', s.completed && 'line-through')}>{s.activity}</p>
                        <p className="text-xs font-bold text-muted">
                          {formatHM(s.start, use24h)} – {formatHM(s.end, use24h)}
                          {live && <span className="ml-1.5 font-black text-accent">● now</span>}
                        </p>
                      </div>
                      <button aria-label={s.completed ? 'Mark not done' : 'Mark done'} onClick={() => toggleSlot(id)} className={cn('pressable grid size-8 place-items-center rounded-xl', s.completed ? 'bg-good text-white' : 'bg-line')}>
                        <Check size={15} strokeWidth={3.5} />
                      </button>
                      <button aria-label="Delete block" onClick={() => deleteSlot(id)} className="grid size-8 place-items-center rounded-xl text-faint opacity-0 group-hover:opacity-100 hover:text-bad max-sm:opacity-100">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {live && <motion.div className="h-1 bg-accent" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} />}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      ) : (
        <Empty emoji="🗓️" title={`Nothing planned for ${day[0].toUpperCase() + day.slice(1)}`} body="Time-block your day: plans you can see are plans you keep." />
      )}

      <AnimatePresence initial={false}>
        {adding ? (
          <motion.form key="f" onSubmit={submit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden rounded-3xl bg-surface-strong/70 p-3 ring-1 ring-line">
            <input
              autoFocus
              value={form.activity}
              onChange={(e) => setForm({ ...form, activity: e.target.value })}
              placeholder="What’s the plan? (e.g. Math revision)"
              className="h-11 w-full rounded-2xl bg-line px-3 text-sm font-bold outline-none placeholder:text-faint"
            />
            <div className="flex items-center gap-2">
              <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="h-10 flex-1 rounded-2xl bg-line px-3 text-sm font-bold outline-none" aria-label="Start" />
              <span className="font-black text-muted">→</span>
              <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="h-10 flex-1 rounded-2xl bg-line px-3 text-sm font-bold outline-none" aria-label="End" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="flex-1" icon={<Plus size={16} />}>
                Add block
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Done
              </Button>
            </div>
          </motion.form>
        ) : (
          <motion.div key="b" className="flex gap-2">
            <Button variant="primary" className="flex-1" size="lg" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
              Add a time block
            </Button>
            {slots.length > 0 && ORDER.indexOf(day) < 5 && (
              <Button size="lg" icon={<Copy size={16} />} onClick={copyToWeekdays} title="Copy this day to all weekdays">
                Weekdays
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
