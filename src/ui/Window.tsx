import { motion } from 'motion/react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { WindowRect } from '@/store/prefs';
import { cn } from '@/lib/utils';
import { IconButton } from './primitives';

/**
 * Keep a floating rect usable: its title bar always on screen vertically, and at least `grip` px
 * reachable horizontally, so it can never get stuck where it can't be dragged back.
 */
export function clampRect(r: WindowRect, min = { w: 320, h: 240 }, grip = 140): WindowRect {
  const W = innerWidth;
  const H = innerHeight;
  const w = Math.min(Math.max(r.w, min.w), W - 16);
  const h = Math.min(Math.max(r.h, min.h), H - 16);
  return { w, h, x: Math.min(Math.max(r.x, grip - w), W - grip), y: Math.min(Math.max(r.y, 8), H - 60) };
}

type Handlers = Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', (e: ReactPointerEvent<HTMLElement>) => void>;

/** Pointer-captured drag: moves keep arriving even over iframes (YouTube) or outside the window. */
export function usePointerDrag(cb: { onStart?: () => void; onMove: (dx: number, dy: number) => void; onEnd?: () => void }): { active: boolean; handlers: Handlers } {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cbs = useRef(cb);
  cbs.current = cb;
  const [active, setActive] = useState(false);
  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (!origin.current) return;
    origin.current = null;
    setActive(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    cbs.current.onEnd?.();
  };
  return {
    active,
    handlers: {
      onPointerDown: (e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, select, textarea, a, [data-nodrag]')) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
        setActive(true);
        cbs.current.onStart?.();
      },
      onPointerMove: (e) => origin.current && cbs.current.onMove(e.clientX - origin.current.x, e.clientY - origin.current.y),
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}

interface WindowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  rect: WindowRect;
  z: number;
  active: boolean;
  onRect: (r: WindowRect) => void;
  onFocus: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** A desktop panel window: drag by the title bar, resize from the edges, double-click the title to maximise. */
export function FloatingWindow({ title, subtitle, icon, rect, z, active, onRect, onFocus, onClose, children }: WindowProps) {
  const [r, setR] = useState(() => clampRect(rect));
  const [maxed, setMaxed] = useState(false);
  const live = useRef(r);
  live.current = r;
  const base = useRef(r);
  const restore = useRef(r);
  const self = useRef<HTMLElement>(null);

  useEffect(() => {
    const onResize = () => setR((x) => (maxed ? fullRect() : clampRect(x)));
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [maxed]);

  // Focus the window when it opens so keyboard users land inside it
  useEffect(() => {
    const t = setTimeout(() => !self.current?.contains(document.activeElement) && self.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, []);

  const save = () => onRect(live.current);
  const move = usePointerDrag({
    onStart: () => (base.current = live.current),
    onMove: (dx, dy) => {
      if (maxed) setMaxed(false);
      setR(clampRect({ ...base.current, x: base.current.x + dx, y: base.current.y + dy }));
    },
    onEnd: save,
  });
  const resizeBy = (sx: 0 | 1, sy: 0 | 1) => ({
    onStart: () => (base.current = live.current),
    onMove: (dx: number, dy: number) => setR(clampRect({ ...base.current, w: base.current.w + dx * sx, h: base.current.h + dy * sy })),
    onEnd: save,
  });
  const resizeE = usePointerDrag(resizeBy(1, 0));
  const resizeS = usePointerDrag(resizeBy(0, 1));
  const resizeSE = usePointerDrag(resizeBy(1, 1));
  const busy = move.active || resizeE.active || resizeS.active || resizeSE.active;

  const toggleMax = () => {
    if (maxed) {
      setR(clampRect(restore.current));
      setMaxed(false);
    } else {
      restore.current = live.current;
      setR(fullRect());
      setMaxed(true);
    }
  };

  return (
    <motion.section
      ref={self}
      role="dialog"
      aria-label={typeof title === 'string' ? title : undefined}
      data-cat-perch="window"
      tabIndex={-1}
      onPointerDownCapture={onFocus}
      onFocusCapture={() => !active && onFocus()}
      className={cn(
        'glass-sheet fixed flex flex-col overflow-hidden rounded-[26px] outline-none',
        active ? 'shadow-[0_30px_80px_-24px_rgb(0_0_0/0.45)]' : 'shadow-[0_12px_40px_-24px_rgb(0_0_0/0.35)]',
        busy && '[&_iframe]:pointer-events-none',
      )}
      style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z }}
      initial={{ opacity: 0, scale: 0.9, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 18, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <header
        {...move.handlers}
        onDoubleClick={(e) => !(e.target as HTMLElement).closest('button') && toggleMax()}
        className={cn('flex shrink-0 touch-none items-center gap-3 px-4 pt-3 pb-3', move.active ? 'cursor-grabbing' : 'cursor-grab')}
      >
        {icon && <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-xl">{icon}</div>}
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-xl leading-tight font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-[13px] font-semibold text-muted">{subtitle}</p>}
        </div>
        <IconButton label={maxed ? 'Restore size' : 'Maximise'} onClick={toggleMax} size={32}>
          {maxed ? <Minimize2 size={15} strokeWidth={2.6} /> : <Maximize2 size={15} strokeWidth={2.6} />}
        </IconButton>
        <IconButton label="Close" onClick={onClose} size={36}>
          <X size={18} strokeWidth={2.6} />
        </IconButton>
      </header>
      <div className="soft-scroll sheet-fade min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">{children}</div>

      {/* resize handles: right edge, bottom edge, corner */}
      <div {...resizeE.handlers} aria-hidden className="absolute top-14 right-0 bottom-4 w-2 cursor-ew-resize touch-none" />
      <div {...resizeS.handlers} aria-hidden className="absolute right-4 bottom-0 left-4 h-2 cursor-ns-resize touch-none" />
      <div {...resizeSE.handlers} aria-hidden className="absolute right-0 bottom-0 size-5 cursor-nwse-resize touch-none">
        <span className="absolute right-1.5 bottom-1.5 size-2.5 rounded-br-[6px] border-r-2 border-b-2 border-faint" />
      </div>
    </motion.section>
  );
}

const fullRect = (): WindowRect => ({ x: 12, y: 12, w: innerWidth - 24, h: innerHeight - 24 });
