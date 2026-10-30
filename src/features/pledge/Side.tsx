import { ExternalLink, History as HistoryIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { goalSummary, rupees, type Charity, type PledgeDoc, type PledgeStats } from './rules';
import { ART, Medallion, StatusChip, dur, when } from './ui';

const card = 'rounded-[28px] glass p-5';

export function CharityCard({ charity, stats }: { charity: Charity; stats: PledgeStats | null }) {
  const donated = stats?.donatedPaise ?? 0;
  const forfeited = stats?.forfeitedPaise ?? 0;
  const waiting = Math.max(0, forfeited - donated);
  const last = stats?.donations?.[0];
  return (
    <section className={card} aria-labelledby="pl-charity">
      <div className="flex items-center gap-3">
        <Medallion src={ART.charity} size={64} />
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-wider text-muted uppercase">Missed pledges go to</p>
          <h3 id="pl-charity" className="font-display text-lg leading-tight font-semibold">
            {charity.name}
          </h3>
        </div>
      </div>
      <p className="mt-3 text-[13.5px] leading-snug text-muted">{charity.blurb}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
          <dt className="text-[11px] font-black text-muted uppercase">Donated so far</dt>
          <dd className={cn('font-display text-2xl font-semibold tabular', stats === null && 'animate-pulse text-faint')}>{rupees(donated)}</dd>
        </div>
        <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
          <dt className="text-[11px] font-black text-muted uppercase">This month&rsquo;s gift</dt>
          <dd className={cn('font-display text-2xl font-semibold tabular', stats === null && 'animate-pulse text-faint')}>{rupees(waiting)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[12px] leading-snug text-muted">
        {(stats?.keptCount ?? 0) + (stats?.missedCount ?? 0) > 0
          ? `${stats?.keptCount ?? 0} pledges kept · ${stats?.missedCount ?? 0} missed. `
          : ''}
        The total of missed pledges is donated once a month.
        {last && (
          <>
            {' '}
            Last donation: {rupees(last.amountPaise)} ({last.month})
            {last.receiptUrl && /^https:\/\//.test(last.receiptUrl) && (
              <>
                {' · '}
                <a href={last.receiptUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline-offset-2 hover:underline">
                  receipt
                </a>
              </>
            )}
          </>
        )}
      </p>
      {/^https:\/\//.test(charity.url) && (
        <a
          href={charity.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pressable mt-3 inline-flex items-center gap-1.5 rounded-xl px-1 text-[13px] font-extrabold text-accent hover:underline"
        >
          Visit their website <ExternalLink size={13} />
        </a>
      )}
    </section>
  );
}

export function HistoryCard({ pledges }: { pledges: PledgeDoc[] | null }) {
  return (
    <section className={card} aria-labelledby="pl-history">
      <h3 id="pl-history" className="mb-3 flex items-center gap-2 text-[12px] font-black tracking-wider text-muted uppercase">
        <HistoryIcon size={14} /> Your pledges
      </h3>
      {pledges === null ? (
        <div className="flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-line" />
          ))}
        </div>
      ) : pledges.length === 0 ? (
        <p className="py-3 text-center text-[13.5px] text-muted">No pledges yet. Your first one will show up here.</p>
      ) : (
        <ul className="-mx-1 flex max-h-[360px] flex-col gap-1.5 overflow-y-auto px-1">
          {pledges.map((p) => (
            <li key={p.id} className="rounded-2xl bg-surface p-3 ring-1 ring-line">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[13.5px] leading-snug font-extrabold">{p.outcome === 'unclaimed' ? 'Payment not started (refunded)' : p.outcome === 'duplicate' ? 'Extra payment (refunded)' : goalSummary(p.goal)}</p>
                <span className="font-display text-[15px] font-semibold tabular">{rupees(p.amountPaise)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[12px] text-muted">
                  {when(p.createdAt, p.tz, false)}
                  {p.progressSeconds != null && p.outcome !== 'duplicate' && p.outcome !== 'unclaimed' && ` · ${p.goal.kind === 'hours' ? dur(p.progressSeconds) : `${p.daysMet ?? 0}/${p.goal.days} days`}`}
                </span>
                <StatusChip p={p} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
