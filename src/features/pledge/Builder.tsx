import { motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Clock3, Flame, Minus, Plus } from 'lucide-react';
import { Button, Segmented, Slider } from '@/ui/primitives';
import { cn } from '@/lib/utils';
import {
  DAYS_MAX,
  DAYS_MIN,
  HOURS_MAX,
  HOURS_MIN,
  PLEDGE_AMOUNTS,
  STREAK_DAYS_MAX,
  STREAK_DAYS_MIN,
  STREAK_DAY_MINUTES,
  deadlineFor,
  windowDays,
  windowStart,
  zonedDateKey,
  type Goal,
  type PledgeAmount,
} from './rules';
import { ART, DayStrip, Medallion, dur, when } from './ui';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function Stepper({ value, min, max, onChange, label, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; unit: string }) {
  const btn = 'pressable grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-strong text-ink ring-1 ring-line disabled:opacity-35';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button className={btn} aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus size={18} strokeWidth={2.6} />
        </button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <motion.span key={value} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="inline-block font-display text-[40px] leading-none font-semibold tabular">
            {value}
          </motion.span>
          <span className="ml-1.5 text-base font-extrabold text-muted">{unit}</span>
        </div>
        <button className={btn} aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus size={18} strokeWidth={2.6} />
        </button>
      </div>
      <Slider value={value} min={min} max={max} step={1} onChange={(v) => onChange(Math.round(v))} label={label} />
    </div>
  );
}

const Label = ({ children }: { children: ReactNode }) => <h3 className="mb-2 text-[12px] font-black tracking-wider text-muted uppercase">{children}</h3>;

export function Builder({ charity, onReview, busy }: { charity: string; onReview: (goal: Goal, amount: PledgeAmount) => void; busy: boolean }) {
  const [kind, setKind] = useState<Goal['kind']>('hours');
  const [hours, setHours] = useState(10);
  const [days, setDays] = useState(7);
  const [streakDays, setStreakDays] = useState(5);
  const [from, setFrom] = useState<'today' | 'tomorrow'>(() => (new Date().getHours() >= 20 ? 'tomorrow' : 'today'));
  const [amount, setAmount] = useState<PledgeAmount>(99);

  const goal: Goal = kind === 'hours' ? { kind, hours, days } : { kind, days: streakDays, from };
  // preview uses "now"; the real window starts when the payment is confirmed
  const preview = useMemo(() => {
    const now = Date.now();
    const start = windowStart(goal, now, TZ);
    const deadline = deadlineFor(goal, start, TZ);
    return { start, deadline, keys: windowDays(goal, start, deadline, TZ), today: zonedDateKey(now, TZ) };
  }, [kind, hours, days, streakDays, from]);

  const perDay = (hours * 3600) / days;
  const pomos = perDay / 1500;
  const rupee = `₹${amount}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Medallion src={ART.promise} size={92} className="max-sm:hidden" />
        <div className="min-w-0">
          <h2 className="font-display text-[26px] leading-tight font-semibold sm:text-3xl">Make a promise to yourself</h2>
          <p className="mt-1 text-[14.5px] text-muted">
            Put a little money behind your own goal. Keep it and every rupee comes back to you. Miss it and it goes to charity. You can never win money.
          </p>
        </div>
      </header>

      <section aria-labelledby="pl-goal">
        <Label>
          <span id="pl-goal">1 · Your goal</span>
        </Label>
        <Segmented<Goal['kind']>
          value={kind}
          onChange={setKind}
          className="mb-4 w-full sm:w-auto"
          options={[
            { value: 'hours', label: <span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> Focus hours</span> },
            { value: 'streak', label: <span className="inline-flex items-center gap-1.5"><Flame size={14} /> Daily streak</span> },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === 'hours' ? (
            <>
              <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
                <p className="mb-2 text-sm font-extrabold">Focus for</p>
                <Stepper value={hours} min={HOURS_MIN} max={HOURS_MAX} onChange={setHours} label="hours" unit={hours === 1 ? 'hour' : 'hours'} />
              </div>
              <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
                <p className="mb-2 text-sm font-extrabold">within the next</p>
                <Stepper value={days} min={DAYS_MIN} max={DAYS_MAX} onChange={setDays} label="days" unit={days === 1 ? 'day' : 'days'} />
              </div>
            </>
          ) : (
            <>
              <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
                <p className="mb-2 text-sm font-extrabold">Focus {STREAK_DAY_MINUTES}+ min every day for</p>
                <Stepper value={streakDays} min={STREAK_DAYS_MIN} max={STREAK_DAYS_MAX} onChange={setStreakDays} label="days" unit="days" />
              </div>
              <div className="flex flex-col justify-between gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
                <p className="text-sm font-extrabold">Starting</p>
                <Segmented<'today' | 'tomorrow'>
                  value={from}
                  onChange={setFrom}
                  className="w-full"
                  options={[
                    { value: 'today', label: 'Today' },
                    { value: 'tomorrow', label: 'Tomorrow' },
                  ]}
                />
                <p className="text-[12.5px] text-muted">{from === 'today' ? 'Today counts from the moment you pledge.' : 'Day 1 starts at midnight tonight.'}</p>
              </div>
            </>
          )}
        </div>
      </section>

      <section aria-label="What this means" className="rounded-3xl bg-[color-mix(in_oklab,var(--accent)_9%,transparent)] p-4 ring-1 ring-[color-mix(in_oklab,var(--accent)_22%,transparent)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-black">
          <CalendarDays size={16} className="text-accent" /> What this means
        </div>
        <motion.p key={JSON.stringify(goal)} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="mb-3 text-[15px] leading-relaxed">
          {kind === 'hours' ? (
            <>
              Focus a total of <b>{hours} hours</b> in YouFloww by <b>{when(preview.deadline, TZ)}</b>. That&rsquo;s about <b>{dur(perDay)} a day</b>
              {pomos >= 0.8 ? <>, roughly {pomos < 1.5 ? 'one pomodoro' : `${Math.round(pomos)} pomodoros`}</> : null}. Any focus session you start after pledging counts, on any day.
            </>
          ) : (
            <>
              Focus at least <b>{STREAK_DAY_MINUTES} minutes</b> on <b>each</b> of these {streakDays} days, from <b>{when(preview.start, TZ, false)}</b> to{' '}
              <b>{when(preview.deadline - 1, TZ, false)}</b> (until midnight, your time). One short pomodoro a day is enough; miss a single day and the pledge is missed.
            </>
          )}
        </motion.p>
        <DayStrip days={preview.keys.map((key) => ({ key }))} today={preview.today} perDay={1} kind={kind} last={preview.keys.at(-1)} />
      </section>

      <section aria-labelledby="pl-amount">
        <Label>
          <span id="pl-amount">2 · Your pledge</span>
        </Label>
        <div role="radiogroup" aria-label="Pledge amount" className="grid grid-cols-4 gap-2">
          {PLEDGE_AMOUNTS.map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={amount === a}
              onClick={() => setAmount(a)}
              className={cn(
                'pressable h-14 rounded-2xl font-display text-xl font-semibold tabular ring-2 transition-colors',
                amount === a ? 'bg-accent text-accent-ink ring-accent shadow-[0_10px_26px_-12px_var(--accent)]' : 'bg-surface text-ink ring-line hover:ring-[color-mix(in_oklab,var(--accent)_45%,transparent)]',
              )}
            >
              ₹{a}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-3xl bg-surface p-3 ring-1 ring-line">
            <Medallion src={ART.refund} size={56} />
            <p className="text-[13.5px] leading-snug">
              <b className="text-good">Goal met:</b> your full {rupee} comes back to you (refunds take 5&ndash;7 working days).
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-3xl bg-surface p-3 ring-1 ring-line">
            <Medallion src={ART.charity} size={56} />
            <p className="text-[13.5px] leading-snug">
              <b className="text-bad">Missed:</b> your {rupee} is donated to <b>{charity}</b>.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-stretch gap-2 sm:items-start">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => onReview(goal, amount)} className="sm:min-w-[260px]">
          Review &amp; pledge {rupee}
        </Button>
        <p className="text-[12px] text-muted">18+ only · one pledge at a time · payments are processed by our partner store giftasite</p>
      </div>
    </div>
  );
}
