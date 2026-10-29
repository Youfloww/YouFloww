/** The Worlds launcher: every full-screen mode and every layer the person can switch on. */
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { useWallet } from '../economy/wallet';
import { LAYERS, MODES, prefetchFeature } from '../registry';
import { Switch } from '@/ui/primitives';
import { cn } from '@/lib/utils';

export default function Launcher() {
  const open = useUI((s) => s.launcher);
  const set = useUI((s) => s.set);
  const layers = usePrefs((s) => s.layers);
  const setPrefs = usePrefs((s) => s.set);
  const coins = useWallet().coins;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[58] grid place-items-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => set({ launcher: false })}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Worlds"
            className="glass-strong relative w-full max-w-[760px] rounded-[32px] p-5 sm:p-7"
            initial={{ y: 30, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl font-semibold">Worlds</h2>
                <p className="text-sm font-bold text-muted">Places to focus in, and little lives that grow while you work.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-extrabold" title="Fish coins: 1 per focused minute">
                  🐟 <span className="tabular">{coins}</span>
                </span>
                <button onClick={() => set({ launcher: false })} aria-label="Close" className="pressable grid size-10 place-items-center rounded-full hover:bg-line">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODES.map((m, i) => (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  onMouseEnter={() => prefetchFeature(m)}
                  onFocus={() => prefetchFeature(m)}
                  onClick={() => set({ mode: m.id, launcher: false, panel: null })}
                  className="pressable group flex items-center gap-4 rounded-[22px] bg-surface p-4 text-left ring-1 ring-line transition-colors hover:bg-surface-strong"
                >
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-3xl transition-transform group-hover:scale-110">{m.emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg leading-tight font-semibold">
                      {m.label}
                      {m.key && <span className="ml-2 text-xs font-black text-faint">{m.key.toUpperCase()}</span>}
                    </span>
                    <span className="block text-sm font-bold text-muted">{m.description}</span>
                  </span>
                </motion.button>
              ))}
            </div>

            {LAYERS.length > 0 && (
              <>
                <h3 className="mt-6 mb-2 text-xs font-black tracking-wide text-faint uppercase">On your screen</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {LAYERS.map((l) => {
                    const on = layers[l.id] ?? !!l.defaultOn;
                    return (
                      <div key={l.id} className={cn('flex items-center gap-3 rounded-2xl p-3 ring-1 ring-line', on ? 'bg-accent-soft' : 'bg-surface')}>
                        <span className="text-2xl">{l.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold">{l.label}</span>
                          <span className="block text-xs font-bold text-muted">{l.description}</span>
                        </span>
                        <Switch checked={on} onChange={(v) => setPrefs({ layers: { ...layers, [l.id]: v } })} label={l.label} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
