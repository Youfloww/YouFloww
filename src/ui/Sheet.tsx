import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './primitives';

export function useIsDesktop(bp = 900) {
  const [d, setD] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(`(min-width: ${bp}px)`).matches);
  useEffect(() => {
    const m = matchMedia(`(min-width: ${bp}px)`);
    const on = () => setD(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [bp]);
  return d;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: number;
}

/** Right-side floating drawer on desktop; draggable bottom sheet on mobile. */
export function Sheet({ open, onClose, title, subtitle, icon, actions, children, width = 440 }: SheetProps) {
  const desktop = useIsDesktop();
  const drag = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) {
      // don't leave focus inside a closing panel (it would swallow shortcuts)
      if (panelRef.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    addEventListener('keydown', onKey);
    // move focus into the sheet (once, on open) for keyboard + screen-reader users
    const t = setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => {
      removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {!desktop && (
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}
          <motion.aside
            key="sheet"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal={!desktop}
            aria-label={typeof title === 'string' ? title : undefined}
            className={
              desktop
                ? 'glass-sheet fixed top-3 right-3 bottom-3 z-40 flex flex-col overflow-hidden rounded-[28px] outline-none'
                : 'glass-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[30px] pb-[env(safe-area-inset-bottom)] outline-none'
            }
            style={desktop ? { width: `min(${width}px, calc(100vw - 24px))` } : undefined}
            initial={desktop ? { x: 40, opacity: 0, scale: 0.98 } : { y: '100%' }}
            animate={desktop ? { x: 0, opacity: 1, scale: 1 } : { y: 0 }}
            exit={desktop ? { x: 40, opacity: 0, scale: 0.98 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
            drag={desktop ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <header className="shrink-0 touch-none px-5 pt-3 pb-3" onPointerDown={(e) => !desktop && drag.start(e)}>
              {!desktop && <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />}
              <div className="flex items-center gap-3">
                {icon && <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-xl">{icon}</div>}
                <div className="min-w-0 flex-1">
                  <h2 className="font-display truncate text-xl leading-tight font-semibold">{title}</h2>
                  {subtitle && <p className="truncate text-[13px] font-semibold text-muted">{subtitle}</p>}
                </div>
                {actions}
                <IconButton label="Close" onClick={onClose} size={36}>
                  <X size={18} strokeWidth={2.6} />
                </IconButton>
              </div>
            </header>
            <div className="soft-scroll sheet-fade min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/** Centered dialog (completion, auth, onboarding). */
export function Dialog({ open, onClose, children, labelledBy, dismissable = true }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy?: string; dismissable?: boolean }) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => dismissable && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby={labelledBy}
            className="glass-strong relative w-full max-w-[420px] rounded-[32px] p-6"
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
