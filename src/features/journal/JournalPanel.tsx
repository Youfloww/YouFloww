import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, Trash2, Sparkles } from 'lucide-react';
import { useData } from '@/store/data';
import { dateKey, relativeDay } from '@/lib/time';
import { cn, debounce, hashString } from '@/lib/utils';
import { Empty, SectionTitle } from '@/ui/primitives';
import { toast } from '@/store/ui';

const MOODS = [
  { v: 1, e: '😞', l: 'Rough' },
  { v: 2, e: '😕', l: 'Meh' },
  { v: 3, e: '😌', l: 'Okay' },
  { v: 4, e: '😊', l: 'Good' },
  { v: 5, e: '🤩', l: 'Amazing' },
];

const PROMPTS = [
  'What’s one thing you finished today that you’re proud of?',
  'What drained your focus today, and how could you dodge it tomorrow?',
  'What would make tomorrow a 10/10 day?',
  'Write about something small that made you smile.',
  'What did you learn today that you didn’t know yesterday?',
  'If you could tell your morning self one thing, what would it be?',
  'What are you avoiding? Why?',
  'Describe your ideal focus session in three words.',
];

const LIMIT = 2000;

function Editor({ k, onBack }: { k: string; onBack?: () => void }) {
  const entry = useData((s) => s.data.journalEntries[k]);
  const save = useData((s) => s.saveJournal);
  const [text, setText] = useState(entry?.text ?? '');
  const [grat, setGrat] = useState(entry?.gratitude ?? '');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const prompt = PROMPTS[hashString(k) % PROMPTS.length];
  const persist = useRef(
    debounce((key: string, t: string, g: string) => {
      save(key, { text: t, gratitude: g });
      setSaved('saved');
    }, 700),
  ).current;
  useEffect(() => () => persist.cancel(), [persist]);

  const onChange = (t: string, g: string) => {
    setSaved('saving');
    persist(k, t, g);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="pressable grid size-9 place-items-center rounded-xl bg-line" aria-label="Back to today">
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="flex-1">
          <p className="font-display text-lg font-semibold">{relativeDay(k)}</p>
          <p className="text-xs font-bold text-muted">{new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <span className={cn('text-xs font-extrabold transition-opacity', saved === 'idle' ? 'opacity-0' : 'opacity-100', saved === 'saved' ? 'text-good' : 'text-muted')}>{saved === 'saving' ? 'Saving…' : '✓ Saved'}</span>
      </div>

      <div>
        <p className="mb-2 text-sm font-extrabold">How are you feeling?</p>
        <div className="flex gap-1.5">
          {MOODS.map((m) => (
            <motion.button
              key={m.v}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.88 }}
              aria-label={m.l}
              title={m.l}
              onClick={() => save(k, { mood: entry?.mood === m.v ? null : m.v })}
              className={cn('flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors', entry?.mood === m.v ? 'bg-accent-soft ring-2 ring-accent' : 'bg-line hover:bg-accent-soft')}
            >
              <span className="text-2xl">{m.e}</span>
              <span className="text-[10px] font-black text-muted">{m.l}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-surface-strong/70 p-1 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
        <p className="flex items-start gap-1.5 px-3 pt-3 text-[13px] font-bold text-muted">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" /> {prompt}
        </p>
        <textarea
          value={text}
          maxLength={LIMIT}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value, grat);
          }}
          placeholder="Dear diary…"
          rows={9}
          className="block w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed font-semibold outline-none placeholder:text-faint"
        />
        <p className="px-3 pb-2 text-right text-[11px] font-bold text-faint">
          {text.length}/{LIMIT}
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-extrabold">🌻 One thing I’m grateful for</span>
        <input
          value={grat}
          maxLength={200}
          onChange={(e) => {
            setGrat(e.target.value);
            onChange(text, e.target.value);
          }}
          placeholder="Coffee, a friend, the sunset…"
          className="h-11 w-full rounded-2xl bg-surface-strong/70 px-3 text-sm font-bold ring-1 ring-line outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
        />
      </label>
      {entry?.image && <img src={entry.image} alt="Journal attachment" className="max-h-56 rounded-2xl object-cover" />}
    </div>
  );
}

export default function JournalPanel() {
  const entries = useData((s) => s.data.journalEntries);
  const del = useData((s) => s.deleteJournal);
  const today = dateKey();
  const [open, setOpen] = useState(today);
  const [q, setQ] = useState('');

  const past = useMemo(
    () =>
      Object.entries(entries)
        .filter(([k, e]) => k !== today && (e.text?.trim() || e.mood))
        .filter(([, e]) => !q || (e.text + ' ' + (e.gratitude ?? '')).toLowerCase().includes(q.toLowerCase()))
        .sort(([a], [b]) => (a < b ? 1 : -1)),
    [entries, today, q],
  );

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        <motion.div key={open} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          <Editor k={open} onBack={open !== today ? () => setOpen(today) : undefined} />
        </motion.div>
      </AnimatePresence>

      <section>
        <SectionTitle>Past entries</SectionTitle>
        <div className="mb-2 flex h-10 items-center gap-2 rounded-2xl bg-line px-3">
          <Search size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your journal" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-faint" />
        </div>
        {past.length ? (
          <ul className="space-y-1.5">
            {past.map(([k, e]) => (
              <li key={k} className="group flex items-center gap-1">
                <button onClick={() => setOpen(k)} className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 ring-line hover:bg-surface-strong', open === k ? 'bg-accent-soft' : 'bg-surface-strong/70')}>
                  <span className="text-xl">{MOODS.find((m) => m.v === e.mood)?.e ?? '📝'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{relativeDay(k)}</span>
                    <span className="block truncate text-xs font-semibold text-muted">{e.text || e.gratitude || 'Mood only'}</span>
                  </span>
                </button>
                <button
                  aria-label="Delete entry"
                  onClick={() => {
                    const prev = entries[k];
                    del(k);
                    if (open === k) setOpen(today);
                    toast({ emoji: '🗑️', title: 'Entry deleted', action: { label: 'Undo', run: () => useData.getState().saveJournal(k, prev) } });
                  }}
                  className="grid size-9 place-items-center rounded-xl text-faint opacity-0 group-hover:opacity-100 hover:text-bad max-sm:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty emoji="📔" title={q ? 'No matches' : 'Your story starts today'} body={q ? undefined : 'Write a line or two after each day. Future you will love reading it.'} />
        )}
      </section>
    </div>
  );
}
