import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { Dialog } from '@/ui/Sheet';

/** "Are you sure?" before anything ends a running session. "Keep going" is the safe default. */
export function ConfirmEnd() {
  const spec = useUI((s) => s.confirm);
  const setUI = useUI((s) => s.set);
  const [dontAsk, setDontAsk] = useState(false);
  useEffect(() => setDontAsk(false), [spec]);

  const close = () => setUI({ confirm: null });
  const confirm = () => {
    if (dontAsk && !spec?.fixed) usePrefs.getState().set({ confirmEnd: false });
    const run = spec?.onConfirm;
    close();
    run?.();
  };

  return (
    <Dialog open={!!spec} onClose={close} labelledBy="confirm-title">
      {spec && (
        <div className="flex flex-col items-center text-center">
          <motion.div className="text-5xl" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: [0, -8, 8, 0] }} transition={{ type: 'spring', stiffness: 420, damping: 12 }}>
            {spec.emoji}
          </motion.div>
          <h2 id="confirm-title" className="font-display mt-2 text-2xl font-semibold text-ink">
            {spec.title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted">{spec.body}</p>
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <button autoFocus onClick={close} className="pressable rounded-2xl bg-accent py-3 text-sm font-black text-accent-ink shadow-[0_12px_28px_-14px_var(--accent)]">
              {spec.cancelLabel}
            </button>
            <button onClick={confirm} className="pressable rounded-2xl bg-line py-3 text-sm font-black text-ink hover:bg-bad/15 hover:text-bad">
              {spec.confirmLabel}
            </button>
          </div>
          {!spec.fixed && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-bold text-muted">
              <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Don’t ask me again (turn back on in Settings)
            </label>
          )}
        </div>
      )}
    </Dialog>
  );
}
