/**
 * Focus Pledge: put your own money behind your own focus goal. Met -> full refund. Missed -> donated to charity.
 * A commitment device, not a bet: nobody can ever win money. Money moves only on the server (api/pledge/*).
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, HandCoins, HeartHandshake, Info, RotateCcw } from 'lucide-react';
import { Button, IconButton } from '@/ui/primitives';
import { useData } from '@/store/data';
import { toast, useUI } from '@/store/ui';
import { bus } from '@/lib/bus';
import { updateFeatureData, useFeatureData } from '@/lib/featureData';
import { ActiveView, OutcomeView } from './Active';
import { Builder } from './Builder';
import { CharityCard, HistoryCard } from './Side';
import { TermsDialog } from './Terms';
import { clearPending, createOrder, payWithRazorpay, readPending, usePledge, verifyPayment, watchPledges } from './api';
import { DEFAULT_CHARITY, goalSummary, type Charity, type Goal, type PledgeAmount } from './rules';
import { ART, Medallion } from './ui';

const KEY = 'pledge';
interface Saved {
  /** settled pledges whose outcome screen was already shown */
  seen: string[];
}
const FALLBACK: Saved = { seen: [] };
type Stage = 'idle' | 'creating' | 'paying' | 'verifying';

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function Panel({ children, k }: { children: ReactNode; k: string }) {
  return (
    <motion.div
      key={k}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

function Intro({ onHow }: { onHow: () => void }) {
  const steps: [ReactNode, string, string][] = [
    [<HandCoins key="a" size={18} />, 'Pick a goal', 'Like 10 focus hours this week, or 15 minutes every day.'],
    [<HeartHandshake key="b" size={18} />, 'Pledge ₹49 to ₹499', 'Your own money, on your own goal. Never a bet.'],
    [<RotateCcw key="c" size={18} />, 'Keep it, get it all back', 'Miss it and the money is donated to charity.'],
  ];
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <Medallion src={ART.promise} size={168} />
      <div>
        <h2 className="font-display text-[30px] leading-tight font-semibold">A promise with a little weight</h2>
        <p className="mx-auto mt-2 max-w-[480px] text-[15px] leading-relaxed text-muted">
          Focus Pledge helps you follow through. You put a small amount behind your own focus goal. Hit it and every rupee comes back to you. Miss it and it goes to
          charity. You can never win money, and nobody else&rsquo;s money is involved.
        </p>
      </div>
      <ol className="grid w-full gap-2 text-left sm:grid-cols-3">
        {steps.map(([icon, t, b], i) => (
          <li key={t} className="rounded-3xl bg-surface p-4 ring-1 ring-line">
            <span className="mb-2 grid size-9 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</span>
            <p className="text-[14px] font-extrabold">
              {i + 1}. {t}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">{b}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-col items-center gap-2">
        <Button variant="primary" size="lg" onClick={() => useUI.getState().set({ auth: true })}>
          Sign in with Google to start
        </Button>
        <button className="text-[13px] font-bold text-muted underline-offset-2 hover:text-ink hover:underline" onClick={onHow}>
          How it works &amp; terms
        </button>
        <p className="text-[12px] text-muted">18+ only · goals are checked from your own YouFloww focus log</p>
      </div>
    </div>
  );
}

function Skeleton({ error }: { error?: string | null }) {
  if (error) return <p className="py-16 text-center text-[14px] text-muted">{error}</p>;
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading">
      <div className="h-9 w-2/3 animate-pulse rounded-2xl bg-line" />
      <div className="h-40 animate-pulse rounded-3xl bg-line" />
      <div className="h-24 animate-pulse rounded-3xl bg-line" />
    </div>
  );
}

export default function Pledge() {
  const user = useData((s) => s.user);
  const authReady = useData((s) => s.authReady);
  const pledges = usePledge((s) => s.pledges);
  const stats = usePledge((s) => s.stats);
  const loadError = usePledge((s) => s.loadError);
  const saved = useFeatureData<Saved>(KEY, FALLBACK);
  const [review, setReview] = useState<{ goal: Goal; amount: PledgeAmount } | null>(null);
  const [how, setHow] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const uid = user?.uid ?? null;

  useEffect(() => {
    usePledge.setState({ pledges: null, loadError: null });
    return watchPledges(uid);
  }, [uid]);

  const charity: Charity = useMemo(() => {
    const c = stats?.charity ?? {};
    return { name: str(c.name, 80) ?? DEFAULT_CHARITY.name, blurb: str(c.blurb, 240) ?? DEFAULT_CHARITY.blurb, url: str(c.url, 300) ?? DEFAULT_CHARITY.url };
  }, [stats]);

  const active = pledges?.find((p) => p.status === 'active') ?? null;
  const unseen = pledges?.find((p) => p.status !== 'active' && !saved.seen.includes(p.id) && (p.settledAt ?? 0) > Date.now() - 45 * 86400000) ?? null;

  // A payment that was made but never confirmed (tab closed, connection dropped): finish it now.
  const loaded = pledges !== null;
  useEffect(() => {
    if (!uid || !loaded) return;
    const pend = readPending();
    if (!pend) return;
    if (usePledge.getState().pledges?.some((p) => p.id === pend.orderId)) return clearPending();
    verifyPayment(pend)
      .then(() => toast({ emoji: '🤝', title: 'Pledge confirmed', body: 'We finished confirming your earlier payment.' }))
      .catch(() => {});
  }, [uid, loaded]);

  // after paying, wait for the new pledge to arrive from Firestore instead of flashing the builder
  useEffect(() => {
    if (!awaiting) return;
    if (pledges?.some((p) => p.id === awaiting)) return setAwaiting(null);
    const t = setTimeout(() => setAwaiting(null), 10000);
    return () => clearTimeout(t);
  }, [awaiting, pledges]);

  // Escape must not close the whole mode while the pay sheet is open (or mid-payment)
  const sheetOpen = !!review || how;
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (stage === 'idle') {
        setReview(null);
        setHow(false);
      }
    };
    addEventListener('keydown', onKey, { capture: true });
    return () => removeEventListener('keydown', onKey, { capture: true });
  }, [sheetOpen, stage]);

  const markSeen = (id: string) =>
    updateFeatureData<Saved>(KEY, FALLBACK, (d) => {
      d.seen = [...(d.seen ?? []).filter((x) => x !== id), id].slice(-40);
    });

  const pay = async () => {
    if (!review || !user || stage !== 'idle') return;
    const { goal, amount } = review;
    setStage('creating');
    try {
      const order = await createOrder(amount, goal);
      let body: { orderId: string; paymentId?: string; signature?: string } = { orderId: order.orderId };
      if (order.mode === 'stub') {
        toast({ emoji: '🧪', title: 'Test mode', body: 'This server has no payment keys, so nothing is charged and nothing is refunded.' });
      } else {
        setStage('paying');
        const r = await payWithRazorpay(order, { name: user.name, email: user.email }, `YouFloww Focus Pledge · ${goalSummary(goal)}`);
        body = { orderId: order.orderId, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature };
      }
      setStage('verifying');
      const v = await verifyPayment(body);
      setAwaiting(v.pledgeId);
      setReview(null);
      if (v.duplicate) {
        toast({ emoji: '↩️', title: 'Extra payment refunded', body: 'You already had an active pledge, so this payment is being refunded in full.' });
      } else {
        toast({ emoji: '🤝', title: 'Pledge made!', body: `₹${amount} on ${goalSummary(goal)}. You’ve got this.` });
        bus.emit('confetti', { big: true });
      }
    } catch (e) {
      toast({ emoji: '😿', title: 'Pledge not made', body: e instanceof Error ? e.message : 'Something went wrong. Please try again.', ms: 9000 });
    } finally {
      setStage('idle');
    }
  };

  let main: ReactNode;
  let k: string;
  if (!authReady) [main, k] = [<Skeleton />, 'boot'];
  else if (!user) [main, k] = [<Intro onHow={() => setHow(true)} />, 'intro'];
  else if (pledges === null || awaiting) [main, k] = [<Skeleton error={loadError} />, 'loading'];
  else if (active) [main, k] = [<ActiveView p={active} />, `active-${active.id}`];
  else if (unseen) [main, k] = [<OutcomeView p={unseen} charity={charity.name} onDone={() => markSeen(unseen.id)} />, `outcome-${unseen.id}`];
  else [main, k] = [<Builder charity={charity.name} busy={stage !== 'idle'} onReview={(goal, amount) => setReview({ goal, amount })} />, 'builder'];

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-bg text-ink" role="dialog" aria-modal="true" aria-label="Focus Pledge">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(60% 50% at 8% 0%, color-mix(in oklab, var(--a1) 75%, transparent), transparent 70%), radial-gradient(50% 45% at 100% 10%, color-mix(in oklab, var(--a2) 60%, transparent), transparent 70%), radial-gradient(60% 50% at 50% 110%, color-mix(in oklab, var(--a3) 55%, transparent), transparent 70%)',
        }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1060px] flex-col px-4 pb-[max(28px,env(safe-area-inset-bottom))] sm:px-6">
        <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-2 bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <IconButton label="Back to focus" variant="glass" onClick={() => useUI.getState().set({ mode: null })} size={42}>
            <ChevronLeft size={20} strokeWidth={2.6} />
          </IconButton>
          <h1 className="flex min-w-0 items-center gap-2 font-display text-xl font-semibold sm:text-2xl">
            <span aria-hidden>🤝</span> Focus Pledge
          </h1>
          <div className="ml-auto">
            <Button variant="glass" size="sm" icon={<Info size={14} />} onClick={() => setHow(true)}>
              <span className="max-[360px]:hidden">How it works</span>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="glass-strong min-w-0 rounded-[32px] p-5 sm:p-7">
            <AnimatePresence mode="wait" initial={false}>
              <Panel k={k}>{main}</Panel>
            </AnimatePresence>
          </main>
          <aside className="flex min-w-0 flex-col gap-4">
            <CharityCard charity={charity} stats={stats} />
            {user && <HistoryCard pledges={pledges} />}
            <p className="px-2 text-[12px] leading-snug text-muted">
              Not a bet or a game: you can never win money. Payments are processed by our partner store giftasite via Razorpay.
            </p>
          </aside>
        </div>
      </div>

      <TermsDialog
        open={!!review || how}
        onClose={() => {
          setReview(null);
          setHow(false);
        }}
        goal={review?.goal ?? null}
        amount={review?.amount}
        charity={charity.name}
        onPay={pay}
        stage={stage}
      />
    </div>
  );
}
