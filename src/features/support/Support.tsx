import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useUI } from '@/store/ui';
import { Dialog } from '@/ui/Sheet';
import { Segmented } from '@/ui/primitives';

const BMC_WIDGET = 'https://www.buymeacoffee.com/widget/page/YouFloww';

/** The sticky "Buy me a coffee" pill from v2, bottom-left on wide screens (phones get a ☕ in the top bar). */
export function CoffeeButton() {
  const zen = useUI((s) => s.zen);
  const setUI = useUI((s) => s.set);
  return (
    <AnimatePresence>
      {!zen && (
        <motion.button
          onClick={() => setUI({ support: true })}
          aria-label="Support YouFloww: buy me a coffee"
          className="font-display fixed bottom-5 left-5 z-20 hidden items-center gap-2 rounded-full bg-[#ffdd00] py-2 pr-4 pl-3 text-[15px] font-semibold text-[#1d1d1d] shadow-[0_10px_30px_-10px_rgb(255_190_0/0.9)] lg:flex"
          initial={{ opacity: 0, y: 30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.8 }}
          whileHover={{ scale: 1.07, rotate: -2 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          <span className="relative">
            {/* steam */}
            {[0, 1].map((i) => (
              <motion.span
                key={i}
                className="absolute -top-2 left-[5px] h-2 w-[3px] rounded-full bg-[#1d1d1d]/25"
                style={{ left: 5 + i * 6 }}
                animate={{ y: [2, -6], opacity: [0, 0.8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
              />
            ))}
            <motion.span className="inline-block" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 4 }}>
              ☕
            </motion.span>
          </span>
          Buy me a coffee
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Support dialog: Buy Me a Coffee (cards, worldwide) or UPI QR (India). */
export function SupportDialog() {
  const open = useUI((s) => s.support);
  const setUI = useUI((s) => s.set);
  const [tab, setTab] = useState<'coffee' | 'upi'>('coffee');
  const close = () => setUI({ support: false });

  return (
    <Dialog open={open} onClose={close} labelledBy="support-title">
      <button onClick={close} aria-label="Close" className="pressable absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-line text-ink hover:bg-accent-soft">
        <X size={18} strokeWidth={2.6} />
      </button>
      <div className="flex flex-col items-center text-center">
        <motion.div className="text-5xl" animate={{ rotate: [0, -10, 10, -6, 0] }} transition={{ duration: 0.8, delay: 0.2 }}>
          ☕
        </motion.div>
        <h2 id="support-title" className="font-display mt-1 text-2xl font-semibold">
          Support YouFloww ❤️
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted">
          Your support keeps YouFloww running: database storage, servers and new features. If it helps you focus, a small contribution makes a big difference.
        </p>
        <Segmented
          className="mt-4 w-full"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'coffee', label: '☕ Buy Me a Coffee' },
            { value: 'upi', label: '📱 UPI (India)' },
          ]}
        />
        <div className="mt-3 w-full">
          {tab === 'coffee' ? (
            <>
              <iframe src={BMC_WIDGET} title="Buy Me a Coffee for YouFloww" className="h-[min(50vh,470px)] w-full rounded-2xl border-0 bg-white" loading="lazy" />
              <a href="https://www.buymeacoffee.com/YouFloww" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-extrabold text-muted hover:text-ink">
                Open in a new tab ↗
              </a>
            </>
          ) : (
            <>
              <img src="/img/support-qr.webp" alt="PhonePe UPI QR code for YouFloww" className="mx-auto max-h-[min(46vh,440px)] w-auto rounded-2xl bg-white" />
              <p className="mt-2 text-xs font-semibold text-muted">Scan with PhonePe, GPay, Paytm or any UPI app.</p>
            </>
          )}
        </div>
        <p className="mt-3 text-xs font-extrabold text-muted">Thank you for being part of the flow. You keep this project alive ✨</p>
      </div>
    </Dialog>
  );
}
