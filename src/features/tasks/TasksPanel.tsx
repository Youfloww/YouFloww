import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, GripVertical, Plus, Star, Target, Trash2, Clock, Tag, X } from 'lucide-react';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { toast } from '@/store/ui';
import { bus } from '@/lib/bus';
import { cn, haptic } from '@/lib/utils';
import { formatDuration } from '@/lib/time';
import { Empty, Segmented } from '@/ui/primitives';
import type { Todo } from '@/data/types';
import { focusOnTodo, start } from '../timer/engine';
import { parseTask } from './parse';
import { play } from '@/audio/sfx';

const TAG_COLORS = ['#ff8a4c', '#9d7bff', '#2fc39a', '#5b8cff', '#ff5c8a', '#e7a93f', '#1e9fd6'];
export const tagColor = (id: string) => TAG_COLORS[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % TAG_COLORS.length];

function Checkbox({ checked, onToggle }: { checked: boolean; onToggle: (e: React.MouseEvent) => void }) {
  return (
    <motion.button
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? 'Mark as not done' : 'Mark as done'}
      onClick={onToggle}
      whileTap={{ scale: 0.8 }}
      className={cn('relative grid size-6 shrink-0 place-items-center rounded-full border-[2.5px] transition-colors', checked ? 'border-good bg-good text-white' : 'border-[color-mix(in_oklab,var(--ink)_25%,transparent)] hover:border-accent')}
    >
      <AnimatePresence>
        {checked && (
          <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
            <Check size={14} strokeWidth={4} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function TaskItem({ todo, draggable }: { todo: Todo; draggable: boolean }) {
  const s = useData();
  const activeId = useTimer((x) => x.activeTodoId);
  const status = useTimer((x) => x.status);
  const controls = useDragControls();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sub, setSub] = useState('');
  const cat = s.data.regularTasks.find((r) => r.id === todo.canonicalId);
  const est = (todo.estimateMinutes || 0) * 60;
  const pct = est ? Math.min(1, (todo.loggedSeconds || 0) / est) : 0;
  const subDone = todo.subtasks.filter((x) => x.completed).length;
  const isActive = activeId === todo.id;

  const toggle = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = s.toggleTodo(todo.id);
    if (t?.completed) {
      bus.emit('task:done', { text: t.text, x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight });
      if (isActive) focusOnTodo(null);
      haptic([10, 30, 10]);
    } else play('pop');
  };

  const remove = () => {
    const index = s.data.todos.findIndex((t) => t.id === todo.id);
    const t = s.deleteTodo(todo.id);
    if (isActive) focusOnTodo(null);
    if (t) toast({ emoji: '🗑️', title: 'Task deleted', body: t.text, action: { label: 'Undo', run: () => useData.getState().restoreTodo(t, index) } });
  };

  const body = (
    <motion.div
      layout="position"
      className={cn('group rounded-3xl bg-surface-strong/70 ring-1 transition-shadow', isActive ? 'shadow-[0_8px_24px_-12px_var(--accent)] ring-2 ring-accent' : 'ring-line', todo.completed && 'opacity-60')}
    >
      <div className="flex items-center gap-2.5 py-2.5 pr-2 pl-2">
        {draggable ? (
          <button
            aria-label="Drag to reorder"
            onPointerDown={(e) => controls.start(e)}
            className="hidden cursor-grab touch-none text-faint opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing sm:block"
          >
            <GripVertical size={16} />
          </button>
        ) : (
          <span className="hidden w-4 sm:block" />
        )}
        <Checkbox checked={todo.completed} onToggle={toggle} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              defaultValue={todo.text}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== todo.text) s.updateTodo(todo.id, { text: v });
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full rounded-lg bg-line px-2 py-0.5 text-[15px] font-bold outline-none"
            />
          ) : (
            <button onDoubleClick={() => setEditing(true)} onClick={() => setOpen((o) => !o)} className="block w-full text-left">
              <span className={cn('block truncate text-[15px] font-bold', todo.completed && 'line-through decoration-2')}>{todo.text}</span>
            </button>
          )}
          {(cat || est > 0 || todo.subtasks.length > 0 || !!todo.loggedSeconds) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold text-muted">
              {cat && (
                <span className="rounded-full px-2 py-0.5" style={{ background: `color-mix(in oklab, ${tagColor(cat.id)} 18%, transparent)`, color: tagColor(cat.id) }}>
                  #{cat.name}
                </span>
              )}
              {(est > 0 || !!todo.loggedSeconds) && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} strokeWidth={3} />
                  {formatDuration(todo.loggedSeconds || 0)}
                  {est > 0 && ` / ${formatDuration(est)}`}
                </span>
              )}
              {todo.subtasks.length > 0 && (
                <span>
                  {subDone}/{todo.subtasks.length} steps
                </span>
              )}
            </div>
          )}
          {est > 0 && !todo.completed && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-secondary" initial={false} animate={{ width: `${pct * 100}%` }} />
            </div>
          )}
        </div>

        {!todo.completed && (
          <button
            aria-label={todo.starred ? 'Unstar' : 'Star as priority'}
            onClick={() => s.updateTodo(todo.id, { starred: !todo.starred })}
            className={cn('pressable grid size-8 place-items-center rounded-xl', todo.starred ? 'text-warn' : 'text-faint opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100')}
          >
            <Star size={16} strokeWidth={2.6} fill={todo.starred ? 'currentColor' : 'none'} />
          </button>
        )}
        {!todo.completed && (
          <button
            aria-label={isActive ? 'Stop focusing on this task' : 'Focus on this task'}
            title={isActive ? 'Focused' : 'Focus on this'}
            onClick={() => {
              if (isActive) focusOnTodo(null);
              else {
                focusOnTodo(todo.id);
                if (status === 'idle' && useTimer.getState().mode === 'focus') start();
              }
            }}
            className={cn('pressable grid size-8 place-items-center rounded-xl', isActive ? 'bg-accent text-accent-ink' : 'bg-line text-ink hover:bg-accent-soft')}
          >
            <Target size={16} strokeWidth={2.6} />
          </button>
        )}
        <button aria-label="More" onClick={() => setOpen((o) => !o)} className="pressable grid size-8 place-items-center rounded-xl text-muted hover:bg-line">
          <ChevronRight size={16} strokeWidth={2.6} className={cn('transition-transform', open && 'rotate-90')} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-1 px-3 pb-3 sm:pl-11">
              {todo.subtasks.map((st) => (
                <div key={st.id} className="group/sub flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-line">
                  <button
                    role="checkbox"
                    aria-checked={st.completed}
                    onClick={() => {
                      s.toggleSubtask(todo.id, st.id!);
                      play(st.completed ? 'pop' : 'task');
                    }}
                    className={cn('grid size-[18px] shrink-0 place-items-center rounded-md border-2', st.completed ? 'border-good bg-good text-white' : 'border-faint')}
                  >
                    {st.completed && <Check size={11} strokeWidth={4} />}
                  </button>
                  <span className={cn('flex-1 truncate text-sm font-semibold', st.completed && 'text-muted line-through')}>{st.text}</span>
                  <button aria-label="Delete step" onClick={() => s.deleteSubtask(todo.id, st.id!)} className="text-faint opacity-0 group-hover/sub:opacity-100 hover:text-bad">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!sub.trim()) return;
                  s.addSubtask(todo.id, sub.trim());
                  setSub('');
                }}
                className="flex items-center gap-2"
              >
                <Plus size={16} className="ml-1 text-faint" />
                <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Add a step…" className="h-8 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-faint" />
              </form>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <label className="flex items-center gap-1.5 rounded-xl bg-line px-2 py-1 text-xs font-extrabold text-muted">
                  <Clock size={12} />
                  <input
                    type="number"
                    min={0}
                    max={600}
                    defaultValue={todo.estimateMinutes || ''}
                    placeholder="est"
                    onBlur={(e) => s.updateTodo(todo.id, { estimateMinutes: Math.max(0, Math.min(600, parseInt(e.target.value || '0', 10))) })}
                    className="w-10 bg-transparent text-ink outline-none"
                    aria-label="Estimated minutes"
                  />
                  min
                </label>
                <select
                  value={todo.canonicalId ?? ''}
                  onChange={(e) => s.updateTodo(todo.id, { canonicalId: e.target.value || null })}
                  className="rounded-xl bg-line px-2 py-1 text-xs font-extrabold text-ink outline-none"
                  aria-label="Category"
                >
                  <option value="">No category</option>
                  {s.data.regularTasks.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => setEditing(true)} className="rounded-xl px-2 py-1 text-xs font-extrabold text-muted hover:bg-line">
                  Rename
                </button>
                <button onClick={remove} className="ml-auto inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-extrabold text-bad hover:bg-bad/10">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (!draggable) return <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>{body}</motion.li>;
  return (
    <Reorder.Item
      value={todo.id}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30, transition: { duration: 0.18 } }}
      whileDrag={{ scale: 1.03, boxShadow: '0 20px 40px -20px rgba(0,0,0,.35)', zIndex: 5 }}
      className="relative list-none"
    >
      {body}
    </Reorder.Item>
  );
}

export default function TasksPanel() {
  const todos = useData((s) => s.data.todos);
  const cats = useData((s) => s.data.regularTasks);
  const { addTodo, ensureCategory, reorderTodos, clearCompleted, deleteCategory } = useData.getState();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<'all' | 'starred' | 'done'>('all');
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseTask(text), [text]);

  const openTodos = todos.filter((t) => !t.completed && (filter !== 'starred' || t.starred));
  const done = todos.filter((t) => t.completed);
  const openIds = openTodos.map((t) => t.id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.text) return;
    const canonicalId = parsed.tag ? ensureCategory(parsed.tag) : null;
    addTodo(parsed.text, { estimateMinutes: parsed.estimateMinutes, canonicalId, starred: parsed.starred });
    play('pop');
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="sticky top-0 z-10 -mx-1 bg-gradient-to-b from-[var(--surface-strong)] via-[var(--surface-strong)] to-transparent px-1 pb-2">
        <div className="flex items-center gap-2 rounded-3xl bg-surface-strong p-1.5 ring-2 ring-line focus-within:ring-accent">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a task…  try “Essay 45m #school !”"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] font-bold outline-none placeholder:text-faint"
            aria-label="New task"
          />
          <motion.button whileTap={{ scale: 0.88 }} type="submit" aria-label="Add task" className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_8px_20px_-10px_var(--accent)] disabled:opacity-40" disabled={!parsed.text}>
            <Plus size={22} strokeWidth={3} />
          </motion.button>
        </div>
        <AnimatePresence>
          {text && (parsed.estimateMinutes > 0 || parsed.tag || parsed.starred) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex gap-1.5 overflow-hidden px-2 pt-2 text-[11px] font-extrabold">
              {parsed.estimateMinutes > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5">⏱ {formatDuration(parsed.estimateMinutes * 60)}</span>}
              {parsed.tag && <span className="rounded-full bg-accent-soft px-2 py-0.5">#{parsed.tag}</span>}
              {parsed.starred && <span className="rounded-full bg-accent-soft px-2 py-0.5">⭐ priority</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <div className="flex items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${todos.filter((t) => !t.completed).length || ''}` },
            { value: 'starred', label: '⭐ Priority' },
            { value: 'done', label: `Done ${done.length || ''}` },
          ]}
        />
      </div>

      {filter !== 'done' &&
        (openTodos.length ? (
          <Reorder.Group axis="y" values={openIds} onReorder={(ids) => reorderTodos([...ids, ...todos.filter((t) => !ids.includes(t.id)).map((t) => t.id)])} className="space-y-2">
            <AnimatePresence initial={false}>
              {openTodos.map((t) => (
                <TaskItem key={t.id} todo={t} draggable={filter === 'all'} />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <Empty emoji={filter === 'starred' ? '⭐' : '🌱'} title={filter === 'starred' ? 'No priorities yet' : 'A fresh, empty list'} body={filter === 'starred' ? 'Star the one task that would make today a win.' : 'Add the first thing you want to get done. Small is perfect.'} />
        ))}

      {(filter === 'done' || (filter === 'all' && done.length > 0)) && (
        <div>
          {filter === 'all' && (
            <button onClick={() => setShowDone((x) => !x)} className="mb-2 flex items-center gap-1 text-[13px] font-black tracking-wide text-muted uppercase hover:text-ink">
              <ChevronRight size={14} className={cn('transition-transform', showDone && 'rotate-90')} /> Completed ({done.length})
            </button>
          )}
          <AnimatePresence initial={false}>
            {(showDone || filter === 'done') && (
              <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                {done.map((t) => (
                  <TaskItem key={t.id} todo={t} draggable={false} />
                ))}
                {done.length > 0 && (
                  <button onClick={clearCompleted} className="w-full rounded-2xl py-2 text-xs font-extrabold text-muted hover:bg-line">
                    Clear completed
                  </button>
                )}
                {!done.length && <Empty emoji="🏁" title="Nothing done yet" body="Your wins will collect here." />}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {cats.length > 0 && (
        <div className="pt-2">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-black tracking-wide text-muted uppercase">
            <Tag size={13} /> Categories
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <span key={c.id} className="group inline-flex items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-xs font-extrabold" style={{ background: `color-mix(in oklab, ${tagColor(c.id)} 16%, transparent)`, color: tagColor(c.id) }}>
                #{c.name}
                <button aria-label={`Delete category ${c.name}`} onClick={() => deleteCategory(c.id)} className="grid size-4 place-items-center rounded-full opacity-50 hover:opacity-100">
                  <X size={11} strokeWidth={3} />
                </button>
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-faint">Tip: type #name when adding a task to create or use a category. Time spent shows up in Stats.</p>
        </div>
      )}
    </div>
  );
}
