import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI, toast } from '@/store/ui';
import { deriveStats } from '@/data/model';
import { addDays, dateKey, formatDuration, keyToDate, lastNDays, relativeDay } from '@/lib/time';
import { Button, Card, Segmented, SectionTitle } from '@/ui/primitives';
import { BarChart, Heatmap, HBars, Ring } from './charts';
import { ACHIEVEMENTS } from '../achievements/defs';

const RATING_EMOJI = ['', '😵‍💫', '😐', '🙂', '😄', '🔥'];

function Tile({ label, value, sub, delay = 0 }: { label: string; value: string; sub?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="rounded-3xl bg-surface-strong/70 p-3.5 ring-1 ring-line">
      <p className="text-[11px] font-black tracking-wider text-muted uppercase">{label}</p>
      <p className="font-display tabular mt-0.5 text-[26px] leading-tight font-semibold">{value}</p>
      {sub && <p className="text-xs font-bold text-muted">{sub}</p>}
    </motion.div>
  );
}

export default function StatsPanel() {
  const d = useData((s) => s.data);
  const openPanel = useUI((s) => s.openPanel);
  const s = useMemo(() => deriveStats(d), [d]);
  const [range, setRange] = useState<'7' | '30'>('7');
  const [sharing, setSharing] = useState(false);
  const daily = d.dailyFocusSeconds ?? {};

  const bars = useMemo(() => {
    const keys = lastNDays(range === '7' ? 7 : 30);
    return keys.map((k, i) => {
      const date = keyToDate(k);
      return {
        label: range === '7' ? date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2) : i % 5 === 4 || i === keys.length - 1 ? String(date.getDate()) : '',
        sub: relativeDay(k),
        value: (daily[k] || 0) / 60,
      };
    });
  }, [daily, range]);

  const heat = useMemo(() => {
    const today = new Date();
    const n = 7 * 18;
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(today, i - (n - 1));
      const key = dateKey(date);
      return { key, date, value: daily[key] || 0 };
    });
  }, [daily]);

  const hours = d.hourlyFocusSeconds ?? Array(24).fill(0);
  const peak = hours.indexOf(Math.max(...hours));
  const hourBars = hours.map((v, h) => ({ label: h % 6 === 0 ? `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` : '', sub: `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`, value: v / 60 }));

  const cats = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const k of lastNDays(7)) {
      for (const [cid, sec] of Object.entries(d.weeklyCategorySecondsByDate[k] ?? {})) totals[cid] = (totals[cid] || 0) + sec;
      totals.__anon = (totals.__anon || 0) + (d.weeklyAnonymousSeconds[k] || 0);
    }
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([cid, v]) => ({ label: cid === '__anon' ? 'Untagged' : `#${d.regularTasks.find((r) => r.id === cid)?.name ?? 'Archived'}`, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [d]);

  const recent = (d.sessionLog ?? []).slice(-8).reverse();
  const unlocked = Object.keys(d.achievements ?? {}).length;
  const fmtMin = (m: number) => formatDuration(m * 60);

  return (
    <div className="space-y-6">
      <Card className="flex items-center gap-4">
        <Ring value={s.goalProgress} size={104} stroke={11}>
          <p className="font-display text-2xl leading-none font-semibold">{Math.round(s.goalProgress * 100)}%</p>
          <p className="text-[10px] font-black text-muted uppercase">of goal</p>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black tracking-wider text-muted uppercase">Today</p>
          <p className="font-display text-3xl font-semibold">{formatDuration(s.todaySeconds)}</p>
          <p className="text-sm font-bold text-muted">
            {s.todaySessions} session{s.todaySessions === 1 ? '' : 's'} · goal {formatDuration(s.goalSec)}
          </p>
          {s.goalProgress >= 1 && <p className="mt-1 text-sm font-black text-good">Goal reached! 🎉</p>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="Streak" value={`${s.streak} 🔥`} sub={`Best ${d.bestStreak} days`} delay={0.02} />
        <Tile label="This week" value={formatDuration(s.weekSeconds)} sub={`${s.weekSessions} sessions`} delay={0.04} />
        <Tile label="All time" value={formatDuration(d.totalFocusSeconds)} sub={`${d.totalSessions} sessions`} delay={0.06} />
        <Tile label="Avg session" value={formatDuration(s.avgSessionSec)} sub={`Longest ${formatDuration(d.longestSession * 60)}`} delay={0.08} />
        <Tile label="Follow-through" value={`${Math.round(s.completionRate * 100)}%`} sub="Sessions finished (7d)" delay={0.1} />
        <Tile label="Active days" value={`${s.activeDays}`} sub="Days with focus" delay={0.12} />
      </div>

      <section>
        <SectionTitle right={<Segmented size="sm" value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />}>Focus per day</SectionTitle>
        <Card>
          <BarChart data={bars} goal={(d.settings.dailyGoalMinutes ?? 120)} format={fmtMin} />
        </Card>
      </section>

      <section>
        <SectionTitle>Focus garden</SectionTitle>
        <Card>
          <Heatmap days={heat} format={(v) => (v ? formatDuration(v) : 'No focus')} />
        </Card>
      </section>

      <section>
        <SectionTitle right={hours.some((h) => h > 0) && <span className="text-xs font-extrabold text-muted">Peak: {peak % 12 || 12}{peak < 12 ? 'am' : 'pm'} ⚡</span>}>Power hours</SectionTitle>
        <Card>
          {hours.some((h) => h > 0) ? <BarChart data={hourBars} format={fmtMin} highlightLast={false} height={110} /> : <p className="py-6 text-center text-sm font-bold text-muted">Finish a few sessions to discover your power hours.</p>}
        </Card>
      </section>

      {cats.length > 0 && (
        <section>
          <SectionTitle>Where your time went · 7d</SectionTitle>
          <Card>
            <HBars rows={cats} format={(v) => formatDuration(v)} />
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Recent sessions</SectionTitle>
        {recent.length ? (
          <ul className="space-y-1.5">
            {recent.map((r, i) => (
              <motion.li
                key={r.at + '-' + i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 rounded-2xl bg-surface-strong/70 px-3 py-2.5 ring-1 ring-line"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-lg">{r.rating ? RATING_EMOJI[r.rating] : r.done ? '✅' : '⏹️'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{r.task || (r.done ? 'Focus session' : 'Ended early')}</span>
                  <span className="block text-xs font-bold text-muted">
                    {relativeDay(dateKey(new Date(r.at)))} · {new Date(r.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </span>
                <span className="font-display text-lg font-semibold">{formatDuration(r.sec)}</span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-surface-strong/70 p-6 text-center text-sm font-bold text-muted ring-1 ring-line">Your sessions will show up here. Press space to start your first one ✨</p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="lg"
          icon={<Share2 size={18} />}
          disabled={sharing}
          onClick={async () => {
            setSharing(true);
            try {
              const { shareCard } = await import('./shareCard');
              const r = await shareCard(d);
              if (r === 'downloaded') toast({ emoji: '🖼️', title: 'Floww Wrap saved', body: 'Post it to your story!' });
            } finally {
              setSharing(false);
            }
          }}
        >
          {sharing ? 'Painting…' : 'Share wrap'}
        </Button>
        <Button size="lg" onClick={() => openPanel('achievements')}>
          🏅 Badges {unlocked}/{ACHIEVEMENTS.length}
        </Button>
      </div>
    </div>
  );
}
