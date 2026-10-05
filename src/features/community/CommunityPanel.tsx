import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { usePresence, refreshCount } from '@/services/presence';
import { fetchFocusLeaders, fetchStreakLeaders, type LeaderRow } from '@/services/community';
import { Button, Segmented } from '@/ui/primitives';
import { Flowy } from '../mascot/Flowy';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/time';
import { getFb } from '@/services/sync';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function CommunityPanel() {
  const user = useData((s) => s.user);
  const setUI = useUI((s) => s.set);
  const online = usePresence((s) => s.online);
  const focusing = usePresence((s) => s.focusing);
  const [tab, setTab] = useState<'focus' | 'streak'>('focus');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState(false);
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(false);
    (tab === 'focus' ? fetchFocusLeaders() : fetchStreakLeaders())
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true));
    void refreshCount(getFb());
    return () => {
      alive = false;
    };
  }, [tab, spin]);

  const myIndex = rows?.findIndex((r) => r.uid === user?.uid) ?? -1;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary to-secondary p-5 text-white">
        <div className="absolute -right-4 -bottom-6 flex opacity-90">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} animate={{ y: [0, -6, 0] }} transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.25 }} className="-ml-6">
              <Flowy mood={i === 1 ? 'focus' : 'idle'} size={70 - i * 6} track={false} />
            </motion.div>
          ))}
        </div>
        <p className="text-xs font-black tracking-widest uppercase opacity-80">Live right now</p>
        <p className="font-display mt-1 text-5xl leading-none font-semibold">{online ?? '—'}</p>
        <p className="mt-1 text-sm font-extrabold opacity-90">Flowwies online{focusing ? ` · ${focusing} in deep focus` : ''}</p>
        <p className="mt-3 max-w-[60%] text-xs font-bold opacity-80">You’re never focusing alone. Start a session and you’ll light up for everyone.</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'focus', label: '⏱ Today' }, { value: 'streak', label: '🔥 Streaks' }]} />
        <button aria-label="Refresh" onClick={() => setSpin((x) => x + 1)} className="pressable grid size-9 place-items-center rounded-xl bg-line">
          <motion.span key={spin} animate={{ rotate: 360 }} transition={{ duration: 0.6 }}>
            <RefreshCw size={16} />
          </motion.span>
        </button>
      </div>

      {error ? (
        <p className="rounded-3xl bg-line p-6 text-center text-sm font-bold text-muted">Couldn’t reach the leaderboard. Check your connection and try again.</p>
      ) : !rows ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-line p-6 text-center text-sm font-bold text-muted">{tab === 'focus' ? 'Nobody on the board yet today. Be the first! 🚀' : 'No active streaks yet.'}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const me = r.uid === user?.uid;
            return (
              <motion.li
                key={r.uid}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1', me ? 'bg-accent-soft ring-2 ring-accent' : i < 3 ? 'bg-surface-strong ring-line' : 'bg-surface-strong/60 ring-line')}
              >
                <span className={cn('w-7 text-center font-black', i < 3 ? 'text-xl' : 'text-sm text-muted')}>{MEDALS[i] ?? i + 1}</span>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-black text-white">{r.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                  {r.name}
                  {me && <span className="ml-1.5 text-xs text-accent">(you)</span>}
                </span>
                <span className="font-display tabular text-lg font-semibold">{tab === 'focus' ? formatDuration(r.value * 60) : `${r.value}🔥`}</span>
              </motion.li>
            );
          })}
        </ol>
      )}

      {!user ? (
        <div className="rounded-3xl bg-surface-strong/70 p-4 text-center ring-1 ring-line">
          <p className="font-display text-lg font-semibold">Want your name up there?</p>
          <p className="mt-1 mb-3 text-sm font-semibold text-muted">Sign in to join the leaderboards and sync across devices. Your current progress comes with you.</p>
          <Button variant="primary" onClick={() => setUI({ auth: true })}>
            Join the leaderboard
          </Button>
        </div>
      ) : (
        myIndex === -1 &&
        rows && <p className="text-center text-xs font-bold text-muted">Focus a little today to appear on the board ✨</p>
      )}
    </div>
  );
}
