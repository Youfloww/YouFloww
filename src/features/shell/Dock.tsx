import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { BarChart3, BookHeart, CalendarDays, Headphones, ListTodo, Maximize2, Palette, Settings2, Trophy, PictureInPicture2, Command } from 'lucide-react';
import { useUI, type PanelId } from '@/store/ui';
import { useData } from '@/store/data';
import { cn, haptic } from '@/lib/utils';
import { useIsDesktop } from '@/ui/Sheet';

interface Item {
  id: PanelId | 'zen' | 'pip' | 'palette';
  label: string;
  icon: ReactNode;
  kbd?: string;
}

export const DOCK_ITEMS: Item[] = [
  { id: 'tasks', label: 'Tasks', icon: <ListTodo />, kbd: 'T' },
  { id: 'sounds', label: 'Sounds', icon: <Headphones />, kbd: 'S' },
  { id: 'scenes', label: 'Scenes', icon: <Palette />, kbd: 'B' },
  { id: 'stats', label: 'Stats', icon: <BarChart3 />, kbd: 'G' },
  { id: 'journal', label: 'Journal', icon: <BookHeart />, kbd: 'J' },
  { id: 'planner', label: 'Planner', icon: <CalendarDays />, kbd: 'P' },
  { id: 'community', label: 'Community', icon: <Trophy />, kbd: 'L' },
  { id: 'settings', label: 'Settings', icon: <Settings2 />, kbd: ',' },
];

function DockIcon({ item, mouseX, active, badge, onClick, magnify }: { item: Item; mouseX: MotionValue<number>; active: boolean; badge?: number; onClick: () => void; magnify: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const dist = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? x - (r.left + r.width / 2) : 9999;
  });
  const sizeT = useTransform(dist, [-140, 0, 140], [46, magnify ? 66 : 46, 46]);
  const size = useSpring(sizeT, { stiffness: 380, damping: 26, mass: 0.2 });
  const iconScale = useTransform(size, [46, 66], [1, 1.28]);

  return (
    <motion.button
      ref={ref}
      onClick={() => {
        haptic(8);
        onClick();
      }}
      aria-label={item.label}
      aria-pressed={active}
      style={{ width: size, height: size }}
      whileTap={{ scale: 0.85 }}
      className={cn(
        'group relative grid shrink-0 place-items-center rounded-[18px] transition-colors duration-200 [&_svg]:size-[22px] [&_svg]:stroke-[2.3]',
        active ? 'bg-accent text-accent-ink shadow-[0_10px_24px_-10px_var(--accent)]' : 'text-ink hover:bg-surface-strong',
      )}
    >
      <motion.span style={{ scale: iconScale }}>{item.icon}</motion.span>
      {!!badge && (
        <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[10px] font-black text-white ring-2 ring-[var(--surface-strong)]">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {/* hover label */}
      <span className="pointer-events-none absolute -top-10 left-1/2 hidden -translate-x-1/2 translate-y-1 rounded-xl bg-ink px-2.5 py-1 text-xs font-extrabold whitespace-nowrap text-bg opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 md:block">
        {item.label}
        {item.kbd && <span className="ml-1.5 opacity-60">{item.kbd}</span>}
      </span>
    </motion.button>
  );
}

export function Dock({ onPip }: { onPip?: () => void }) {
  const panel = useUI((s) => s.panel);
  const togglePanel = useUI((s) => s.togglePanel);
  const setUI = useUI((s) => s.set);
  const openTasks = useData((s) => s.data.todos.filter((t) => !t.completed).length);
  const mouseX = useMotionValue(Infinity);
  const desktop = useIsDesktop(768);

  const extras: Item[] = [
    { id: 'zen', label: 'Zen mode', icon: <Maximize2 />, kbd: 'Z' },
    ...(onPip ? [{ id: 'pip' as const, label: 'Pop-out timer', icon: <PictureInPicture2 />, kbd: 'O' }] : []),
    { id: 'palette', label: 'Command menu', icon: <Command />, kbd: '⌘K' },
  ];

  return (
    <nav aria-label="Main" className="pointer-events-none flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.15 }}
        className="glass no-scrollbar pointer-events-auto flex max-w-full items-end gap-1.5 overflow-x-auto rounded-[26px] p-2 md:overflow-visible"
      >
        {DOCK_ITEMS.map((it) => (
          <DockIcon
            key={it.id}
            item={it}
            mouseX={mouseX}
            magnify={desktop}
            active={panel === it.id}
            badge={it.id === 'tasks' ? openTasks : undefined}
            onClick={() => togglePanel(it.id as PanelId)}
          />
        ))}
        <span className="mx-1 h-8 w-px shrink-0 self-center bg-line" />
        {extras.map((it) => (
          <DockIcon
            key={it.id}
            item={it}
            mouseX={mouseX}
            magnify={desktop}
            active={false}
            onClick={() => {
              if (it.id === 'zen') setUI({ zen: true, panel: null });
              else if (it.id === 'pip') onPip?.();
              else setUI({ palette: true });
            }}
          />
        ))}
      </motion.div>
    </nav>
  );
}
