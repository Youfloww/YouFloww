import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { useUI, type PanelId } from '@/store/ui';
import { usePrefs, THEMES, type EffectId } from '@/store/prefs';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { adjust, endEarly, reset, setMode, toggle } from '../timer/engine';
import { PRESETS } from '@/audio/mixer';
import { cn, withViewTransition, pick } from '@/lib/utils';
import { bus } from '@/lib/bus';
import { TIPS } from '../mascot/lines';
import { DOCK_ITEMS } from './Dock';
import { Kbd } from '@/ui/primitives';
import { signOut } from '@/services/sync';

interface Cmd {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  kbd?: string;
  keywords?: string;
  run: () => void;
}

function score(q: string, text: string) {
  if (!q) return 1;
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i === 0) return 3;
  if (i > 0) return 2;
  // subsequence match
  let j = 0;
  for (const ch of t) if (ch === q[j]) j++;
  return j === q.length ? 1 : 0;
}

export function CommandPalette({ onPip }: { onPip?: () => void }) {
  const open = useUI((s) => s.palette);
  const setUI = useUI((s) => s.set);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const status = useTimer((s) => s.status);
  const user = useData((s) => s.user);

  const close = () => setUI({ palette: false });

  const commands = useMemo<Cmd[]>(() => {
    const p = usePrefs.getState();
    const panel = (id: PanelId) => () => setUI({ panel: id, palette: false });
    const effects: { id: EffectId; label: string; e: string }[] = [
      { id: 'snow', label: 'Snowfall', e: '❄️' },
      { id: 'rain', label: 'Rain', e: '🌧️' },
      { id: 'sakura', label: 'Sakura petals', e: '🌸' },
      { id: 'fireflies', label: 'Fireflies', e: '✨' },
      { id: 'stars', label: 'Starry night', e: '🌟' },
      { id: 'bubbles', label: 'Bubbles', e: '🫧' },
    ];
    return [
      { id: 'toggle', group: 'Timer', label: status === 'running' ? 'Pause timer' : 'Start timer', icon: status === 'running' ? '⏸️' : '▶️', kbd: 'Space', run: toggle },
      { id: 'reset', group: 'Timer', label: 'Reset timer', icon: '🔄', kbd: 'R', run: () => reset() },
      { id: 'end', group: 'Timer', label: 'End session & log time', icon: '⏹️', kbd: 'E', run: endEarly },
      { id: 'focus', group: 'Timer', label: 'Switch to Focus', icon: '🎯', kbd: '1', run: () => setMode('focus') },
      { id: 'short', group: 'Timer', label: 'Switch to Short break', icon: '☕', kbd: '2', run: () => setMode('short') },
      { id: 'long', group: 'Timer', label: 'Switch to Long break', icon: '🌿', kbd: '3', run: () => setMode('long') },
      { id: 'plus5', group: 'Timer', label: 'Add 5 minutes', icon: '➕', kbd: '+', run: () => adjust(5) },
      { id: 'minus5', group: 'Timer', label: 'Remove 5 minutes', icon: '➖', kbd: '-', run: () => adjust(-5) },
      ...DOCK_ITEMS.map((d) => ({ id: `p-${d.id}`, group: 'Open', label: d.label, icon: <span className="[&_svg]:size-4">{d.icon}</span>, kbd: d.kbd, run: panel(d.id as PanelId) })),
      { id: 'p-ach', group: 'Open', label: 'Achievements', icon: '🏅', kbd: 'A', run: panel('achievements') },
      { id: 'zen', group: 'View', label: 'Zen mode', icon: '🧘', kbd: 'Z', run: () => setUI({ zen: true, panel: null }) },
      ...(onPip ? [{ id: 'pip', group: 'View', label: 'Pop-out timer (Picture-in-Picture)', icon: '🪟', kbd: 'O', run: onPip }] : []),
      { id: 'mascot', group: 'View', label: p.showMascot ? 'Hide Flowy' : 'Show Flowy', icon: '🫧', run: () => p.set({ showMascot: !p.showMascot }) },
      { id: 'style', group: 'View', label: 'Toggle timer style (orb / minimal)', icon: '⭕', run: () => p.set({ timerStyle: p.timerStyle === 'orb' ? 'minimal' : 'orb' }) },
      ...THEMES.map((t) => ({ id: `t-${t.id}`, group: 'Theme', label: `Theme: ${t.name}`, icon: t.emoji, keywords: 'color palette dark light', run: () => withViewTransition(() => p.set({ theme: t.id })) })),
      { id: 'aurora', group: 'Scene', label: 'Scene: Aurora gradient', icon: '🌈', run: () => p.set({ scene: { kind: 'aurora' } }) },
      ...effects.map((e) => ({ id: `e-${e.id}`, group: 'Effects', label: `${p.effects[e.id] ? 'Stop' : 'Start'} ${e.label}`, icon: e.e, run: () => p.toggleEffect(e.id) })),
      ...PRESETS.map((pr) => ({
        id: `mix-${pr.name}`,
        group: 'Sounds',
        label: `Sound mix: ${pr.name}`,
        icon: pr.emoji,
        run: () => {
          const st = usePrefs.getState();
          const on: Record<string, boolean> = {};
          const volumes = { ...st.mixer.volumes };
          for (const [k, v] of Object.entries(pr.mix)) {
            on[k] = true;
            volumes[k] = v;
          }
          st.set({ mixer: { ...st.mixer, on, volumes } });
        },
      })),
      { id: 'mute', group: 'Sounds', label: 'Stop all sounds', icon: '🔇', kbd: 'M', run: () => usePrefs.getState().set({ mixer: { ...usePrefs.getState().mixer, on: {} } }) },
      { id: 'tip', group: 'Flowy', label: 'Give me a study tip', icon: '💡', run: () => bus.emit('mascot:say', { text: pick(TIPS), mood: 'wow', ms: 8000 }) },
      { id: 'help', group: 'Help', label: 'Keyboard shortcuts', icon: '⌨️', kbd: '?', run: () => setUI({ help: true }) },
      user
        ? { id: 'out', group: 'Account', label: 'Sign out', icon: '👋', run: () => void signOut() }
        : { id: 'in', group: 'Account', label: 'Sign in / create account', icon: '☁️', run: () => setUI({ auth: true }) },
    ];
  }, [status, user, onPip, setUI, open]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    const scored = commands
      .map((c) => ({ c, s: Math.max(score(query, c.label), score(query, c.group) * 0.5, c.keywords ? score(query, c.keywords) * 0.5 : 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    const list = scored.map((x) => x.c);
    if (query.length > 1) {
      list.push({
        id: 'add-task',
        group: 'Tasks',
        label: `Add task “${q.trim()}”`,
        icon: '📝',
        run: () => {
          useData.getState().addTodo(q.trim());
          useUI.getState().toast({ emoji: '📝', title: 'Task added', body: q.trim() });
        },
      });
    }
    return list;
  }, [commands, query, q]);

  useEffect(() => setSel(0), [q, open]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (c: Cmd) => {
    close();
    setTimeout(c.run, 10);
  };

  let lastGroup = '';
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/25 p-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-label="Command menu"
            className="glass-sheet w-full max-w-[560px] overflow-hidden rounded-[28px]"
            initial={{ y: -16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search size={18} className="text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSel((s) => Math.min(results.length - 1, s + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSel((s) => Math.max(0, s - 1));
                  } else if (e.key === 'Enter' && results[sel]) {
                    e.preventDefault();
                    run(results[sel]);
                  } else if (e.key === 'Escape') close();
                }}
                placeholder="Type a command, or a task to add…"
                className="h-14 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-faint"
                aria-label="Search commands"
              />
              <Kbd>esc</Kbd>
            </div>
            <div ref={listRef} className="soft-scroll max-h-[min(56vh,440px)] overflow-y-auto p-2">
              {results.length === 0 && <p className="p-6 text-center text-sm font-bold text-muted">Nothing found. Flowy is confused 🫧</p>}
              {results.map((c, i) => {
                const header = c.group !== lastGroup && !query ? c.group : null;
                lastGroup = c.group;
                return (
                  <div key={c.id}>
                    {header && <p className="px-3 pt-3 pb-1 text-[11px] font-black tracking-wider text-muted uppercase">{header}</p>}
                    <button
                      data-i={i}
                      onMouseMove={() => setSel(i)}
                      onClick={() => run(c)}
                      className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold', i === sel ? 'bg-accent-soft' : '')}
                    >
                      <span className="grid size-7 shrink-0 place-items-center text-base">{c.icon}</span>
                      <span className="flex-1 truncate">{c.label}</span>
                      {c.kbd && <Kbd>{c.kbd}</Kbd>}
                      {i === sel && <CornerDownLeft size={14} className="text-muted" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
