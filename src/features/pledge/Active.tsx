import { motion } from 'motion/react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Hourglass, Play, Sparkles } from 'lucide-react';
import { Button } from '@/ui/primitives';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { useUI } from '@/store/ui';
import { start } from '../timer/engine';
import { STREAK_DAY_MINUTES, computeProgress, goalSummary, rupees, zonedDateKey, type PledgeDoc } from './rules';
import { ART, DayStrip, Medallion, Ring, StatusChip, dur, timeLeft, useNow, when } from './ui';

/** Seconds of the focus session running right now (not yet in the log), if it started inside the pledge. */
function useLiveSeconds(startAt: number, now: number) {
  const t = useTimer(useShallow((s) => ({ mode: s.mode, status: s.status, focusedMs: s.focusedMs, runStartedAt: s.runStartedAt, sessionStartedAt: s.sessionStartedAt })));
  if (t.mode !== 'focus' || t.status === 'idle' || !t.sessionStartedAt || t.sessionStartedAt < startAt) return 0;
  const ms = t.focusedMs + (t.status === 'running' && t.runStartedAt ? now - t.runStartedAt : 0);
  return Math.max(0, ms / 1000);
}

export function ActiveView({ p }: { p: PledgeDoc }) {
  const running = useTimer((s) => s.status === 'running' && s.mode === 'focus');
  const now = useNow(running ? 1000 : 30000);
  const data = useData((s) => s.data);
  const live = useLiveSeconds(p.startAt, now);
  const prog = useMemo(() => computeProgress(p, data, now, live), [p, data, now, live]);
  const today = zonedDateKey(now, p.tz);
  const left = p.deadline - now;
  const notStarted = now < p.startAt;
  const isHours = p.goal.kind === 'hours';
  const remaining = Math.max(0, prog.target - prog.seconds);
  const daysLeft = Math.max(1, Math.ceil(left / 86400000));
  const perDayNeeded = remaining / daysLeft;
  const lostStreak = !isHours && prog.days.some((d) => d.key < today && !d.met);
  const goal = p.goal;

  const focusNow = () => {
    useUI.getState().set({ mode: null });
    if (useTimer.getState().mode === 'focus' && useTimer.getState().status !== 'running') start();
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-black tracking-wider text-muted uppercase">Your pledge</p>
          <h2 className="font-display text-[26px] leading-tight font-semibold">{goalSummary(goal)}</h2>
        </div>
        <StatusChip p={p} />
      </header>

      <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto">
          <Ring value={prog.fraction} size={212}>
            <div>
              {isHours ? (
                <>
                  <div className="font-display text-[34px] leading-none font-semibold tabular">{dur(prog.seconds)}</div>
                  <div className="mt-1 text-[13px] font-bold text-muted">of {goal.kind === 'hours' ? goal.hours : 0} hours</div>
                </>
              ) : (
                <>
                  <div className="font-display text-[38px] leading-none font-semibold tabular">
                    {prog.daysMet}
                    <span className="text-[22px] text-muted">/{goal.days}</span>
                  </div>
                  <div className="mt-1 text-[13px] font-bold text-muted">days kept</div>
                </>
              )}
              <div className="mt-1.5 font-display text-sm font-semibold text-accent tabular">{Math.floor(prog.fraction * 100)}%</div>
            </div>
          </Ring>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2 text-[15px] font-extrabold">
            <Hourglass size={16} className="text-accent" />
            {notStarted ? `Starts ${when(p.startAt, p.tz)}` : timeLeft(left)}
            <span className="font-bold text-muted">· ends {when(p.deadline, p.tz)}</span>
          </div>
          {live > 30 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[13px] font-extrabold text-accent">
              <span className="size-2 animate-pulse rounded-full bg-accent" /> +{dur(live)} from the session running now
            </motion.p>
          )}
          <p className="text-[14.5px] leading-relaxed">
            {prog.met ? (
              <>
                <Sparkles size={15} className="mr-1 inline -translate-y-px text-good" />
                <b>Goal reached!</b> Your {rupees(p.amountPaise)} comes back to you after the check the morning after your deadline. Keep the flow going if you like.
              </>
            ) : lostStreak ? (
              <>A day was missed, so this streak can&rsquo;t be completed. Your {rupees(p.amountPaise)} will be donated after the deadline. You can still keep focusing for yourself.</>
            ) : isHours ? (
              <>
                <b>{dur(remaining)}</b> to go: about <b>{dur(perDayNeeded)} a day</b> to finish on time. Your {rupees(p.amountPaise)} is waiting for you at the finish line.
              </>
            ) : (
              <>
                Focus at least <b>{STREAK_DAY_MINUTES} minutes</b> today and every remaining day.{' '}
                {prog.days.find((d) => d.key === today)?.met ? 'Today is done ✓' : 'Today still needs its minutes.'}
              </>
            )}
          </p>
          <div>
            <Button variant="primary" icon={<Play size={16} fill="currentColor" />} onClick={focusNow}>
              {running ? 'Back to my session' : 'Focus now'}
            </Button>
          </div>
        </div>
      </div>

      <section aria-label="Pledge calendar">
        <h3 className="mb-2 text-[12px] font-black tracking-wider text-muted uppercase">Day by day</h3>
        <DayStrip days={prog.days} today={today} perDay={isHours && goal.kind === 'hours' ? (goal.hours * 3600) / goal.days : STREAK_DAY_MINUTES * 60} kind={goal.kind} />
      </section>

      <p className="text-[12px] text-muted">
        {rupees(p.amountPaise)} pledged {when(p.createdAt, p.tz)} · payment <span className="font-mono">{p.paymentId}</span>
        {p.mode !== 'live' && <> · {p.mode === 'stub' ? 'TEST MODE: nothing was charged' : 'Razorpay test mode'}</>}
      </p>
    </div>
  );
}

export function OutcomeView({ p, charity, onDone }: { p: PledgeDoc; charity: string; onDone: () => void }) {
  const kept = p.outcome === 'met';
  const duplicate = p.outcome === 'duplicate';
  const donated = p.status === 'forfeited';
  const money = rupees(p.amountPaise);
  const got = p.progressSeconds ?? 0;
  const goal = p.goal;
  const did = goal.kind === 'hours' ? `${dur(got)} of ${goal.hours} hours` : `${p.daysMet ?? 0} of ${goal.days} days`;

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <motion.div initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
        <Medallion src={donated ? ART.charity : ART.refund} size={168} />
      </motion.div>
      <h2 className="font-display text-[30px] leading-tight font-semibold">
        {duplicate ? 'We refunded a second payment' : kept ? 'You kept your promise!' : 'This one got away'}
      </h2>
      <p className="max-w-[460px] text-[15px] leading-relaxed text-muted">
        {duplicate ? (
          <>You already had an active pledge, so this extra {money} payment is being refunded in full. Refunds take 5&ndash;7 working days.</>
        ) : kept ? (
          <>
            You focused <b className="text-ink">{did}</b>. Your <b className="text-ink">{money} refund is on its way</b> to the way you paid. Refunds take 5&ndash;7 working days
            to reach your account.
          </>
        ) : (
          <>
            You focused <b className="text-ink">{did}</b>. As promised, your <b className="text-ink">{money}</b> joins this month&rsquo;s donation to <b className="text-ink">{charity}</b>. It goes
            to a good cause, and you can try again with a goal that fits you better.
          </>
        )}
      </p>
      {p.refundId && (
        <p className="text-[12px] text-muted">
          {p.status === 'refunded' ? 'Refund' : 'Refund started'} · <span className="font-mono">{p.refundId}</span>
          {p.mode !== 'live' && ' · test mode, no real money'}
        </p>
      )}
      <Button variant="primary" size="lg" onClick={onDone}>
        {kept || duplicate ? 'Make a new pledge' : 'Try a new pledge'}
      </Button>
    </div>
  );
}
