import { useEffect, useState } from 'react';
import { BadgeIndianRupee, CalendarCheck2, HandHeart, Lock, Mail, RotateCcw, ShieldCheck, Store, UserCheck } from 'lucide-react';
import { Dialog } from '@/ui/Sheet';
import { Button } from '@/ui/primitives';
import { cn } from '@/lib/utils';
import { SUPPORT_EMAIL, goalSummary, type Goal } from './rules';
import { Fact } from './ui';

/** The plain-words terms. Shown before paying (with the 18+ tick box) and from "How it works". */
export function TermsList({ amount, charity }: { amount?: number; charity: string }) {
  const money = amount ? `₹${amount}` : 'your pledge';
  return (
    <ul className="flex flex-col gap-3">
      <Fact icon={<ShieldCheck size={15} />}>
        <b>A promise to yourself, not a bet or a game.</b> You can never win money, and nobody else&rsquo;s money is involved. It&rsquo;s your money, on your own goal.
      </Fact>
      <Fact icon={<RotateCcw size={15} />}>
        <b>Goal met:</b> we refund {money} in full to the way you paid. Refunds take 5&ndash;7 working days to reach you. Payment fees may not be refunded.
      </Fact>
      <Fact icon={<HandHeart size={15} />}>
        <b>Goal missed:</b> {money} is donated to {charity}. We donate all missed pledges together once a month and show the running total in the app.
      </Fact>
      <Fact icon={<CalendarCheck2 size={15} />}>
        <b>Checked from your own YouFloww focus log:</b> the focus sessions you start after pledging, synced to your account. We check the morning after your
        deadline, so open YouFloww online before then to make sure your last sessions have synced.
      </Fact>
      <Fact icon={<Lock size={15} />}>
        <b>One active pledge at a time.</b> Once paid, a pledge can&rsquo;t be changed or cancelled early.
      </Fact>
      <Fact icon={<UserCheck size={15} />}>
        <b>18+ only.</b> You need to be at least 18 years old to make a pledge.
      </Fact>
      <Fact icon={<Store size={15} />}>
        <b>Payments are processed by our partner store giftasite</b> through Razorpay, so the checkout shows the name giftasite (and your bank statement may too).
      </Fact>
      {SUPPORT_EMAIL && (
        <Fact icon={<Mail size={15} />}>
          <b>Questions about a payment?</b> Write to{' '}
          <a className="font-bold text-accent underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{' '}
          with your payment ID.
        </Fact>
      )}
    </ul>
  );
}

export function TermsDialog({
  open,
  onClose,
  goal,
  amount,
  charity,
  onPay,
  stage,
}: {
  open: boolean;
  onClose: () => void;
  /** without a goal it is the read-only "How it works" sheet */
  goal?: Goal | null;
  amount?: number;
  charity: string;
  onPay?: () => void;
  stage: 'idle' | 'creating' | 'paying' | 'verifying';
}) {
  const [agree, setAgree] = useState(false);
  // untick when the sheet closes, so it never reopens pre-ticked (not even for a frame)
  useEffect(() => {
    if (!open) setAgree(false);
  }, [open]);
  const busy = stage !== 'idle';
  const label = { idle: `Pay ₹${amount} & start`, creating: 'Preparing…', paying: 'Waiting for payment…', verifying: 'Confirming your payment…' }[stage];

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} labelledBy="pledge-terms" dismissable={!busy}>
      <div className="flex max-h-[min(86dvh,780px)] flex-col">
        <h2 id="pledge-terms" className="font-display text-2xl font-semibold">
          {goal ? 'Before you pledge' : 'How Focus Pledge works'}
        </h2>
        {goal && amount ? (
          <p className="mt-1 mb-3 text-[14px] text-muted">
            <BadgeIndianRupee size={14} className="mr-1 inline -translate-y-px text-accent" />
            ₹{amount} on <b className="text-ink">{goalSummary(goal)}</b>
          </p>
        ) : (
          <p className="mt-1 mb-3 text-[14px] text-muted">Plain words, no small print.</p>
        )}
        {/* the terms scroll; the tick box and the pay button always stay in view */}
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1 [mask-image:linear-gradient(to_bottom,transparent,#000_10px,#000_calc(100%-14px),transparent)]">
          <TermsList amount={amount} charity={charity} />
        </div>
        {goal && onPay ? (
          <div className="shrink-0 pt-3">
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition-colors', agree ? 'bg-accent-soft ring-accent' : 'bg-surface ring-line')}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={busy} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
              <span className="text-[13.5px] leading-snug font-bold">I&rsquo;m 18 or older, I&rsquo;ve read the above, and I understand this is not a bet: I can&rsquo;t win money.</span>
            </label>
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Not now
              </Button>
              <Button variant="primary" size="lg" onClick={onPay} disabled={!agree || busy} aria-busy={busy}>
                {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
                {label}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 justify-end pt-4">
            <Button variant="soft" onClick={onClose}>
              Got it
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
