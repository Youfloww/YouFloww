import { motion } from 'motion/react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useWallet } from '../economy/wallet';
import { usePresence } from '@/services/presence';
import { deriveStats } from '@/data/model';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export function Logo({ onMedia }: { onMedia: boolean }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <motion.img src="/favicon.svg" alt="" className="size-9 drop-shadow-sm" whileHover={{ rotate: [-6, 6, -4, 0], scale: 1.08 }} transition={{ duration: 0.5 }} />
      <span className={cn('font-display hidden text-[22px] font-semibold tracking-tight sm:inline', onMedia ? 'text-white' : 'text-ink')}>
        You<span className={onMedia ? 'text-white' : 'text-gradient'}>Floww</span>
      </span>
    </div>
  );
}

function GoalRing({ value, size = 22 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="3" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - value) }}
        transition={{ type: 'spring', stiffness: 60, damping: 18 }}
      />
    </svg>
  );
}

export function TopBar({ onMedia }: { onMedia: boolean }) {
  const data = useData((s) => s.data);
  const user = useData((s) => s.user);
  const authReady = useData((s) => s.authReady);
  const sync = useData((s) => s.sync);
  const online = usePresence((s) => s.online);
  const focusing = usePresence((s) => s.focusing);
  const openPanel = useUI((s) => s.openPanel);
  const setUI = useUI((s) => s.set);
  const stats = useMemo(() => deriveStats(data), [data]);
  const coins = useWallet().coins;

  const pill = cn(
    'pressable flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-extrabold',
    onMedia ? 'bg-black/25 text-white backdrop-blur-md hover:bg-black/35' : 'glass text-ink hover:bg-surface-strong',
  );
  const initials = (user?.name || data.profileName || 'F').trim().charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] sm:px-6">
      <Logo onMedia={onMedia} />
      <div className="flex items-center gap-2">
        {online !== null && (
          <button className={pill} onClick={() => openPanel('community')} title={`${online} flowing now${focusing ? ` · ${focusing} in deep focus` : ''}`}>
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-good" />
            </span>
            <span className="tabular">{online}</span>
            <span className="hidden opacity-70 md:inline">flowing now</span>
          </button>
        )}
        <button className={pill} onClick={() => openPanel('stats')} title={`Streak ${stats.streak} · today ${Math.round(stats.goalProgress * 100)}% of goal`}>
          <motion.span
            animate={stats.streakDoneToday ? { scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] } : { opacity: 0.55 }}
            transition={{ duration: 1.6, repeat: stats.streakDoneToday ? Infinity : 0, repeatDelay: 2.5 }}
            className={cn('text-base', !stats.streakDoneToday && 'grayscale')}
          >
            🔥
          </motion.span>
          <span className="tabular">{stats.streak}</span>
          <span className="mx-0.5 h-4 w-px bg-current opacity-20" />
          <GoalRing value={stats.goalProgress} />
        </button>
        <button className={pill} onClick={() => setUI({ launcher: true })} title="Fish coins: 1 per focused minute. Spend them in the worlds.">
          <span className="text-base">🐟</span>
          <motion.span key={coins} initial={{ scale: 1.5, color: 'var(--accent)' }} animate={{ scale: 1, color: 'currentColor' }} transition={{ duration: 0.5 }} className="tabular">
            {coins}
          </motion.span>
        </button>
        <button onClick={() => setUI({ support: true })} aria-label="Buy me a coffee" title="Buy me a coffee" className={cn(pill, 'w-auto px-3 text-base lg:hidden')}>
          ☕
        </button>
        <button
          onClick={() => (user ? openPanel('account') : setUI({ auth: true }))}
          aria-label={user ? 'Your account' : 'Sign in'}
          className={cn(
            'pressable relative grid size-10 place-items-center overflow-hidden rounded-full text-sm font-black',
            user ? 'bg-gradient-to-br from-primary to-secondary text-white' : pill + ' w-auto px-3.5',
          )}
        >
          {user?.photo ? (
            <img src={user.photo} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : user ? (
            initials
          ) : (
            <span className={cn(!authReady && 'opacity-60')}>Sign in</span>
          )}
          {user && (sync === 'saving' || sync === 'error' || sync === 'offline') && (
            <span
              className={cn('absolute right-0.5 bottom-0.5 size-2.5 rounded-full ring-2 ring-white', sync === 'saving' ? 'animate-pulse bg-warn' : sync === 'error' ? 'bg-bad' : 'bg-faint')}
              title={sync === 'saving' ? 'Syncing…' : sync === 'error' ? 'Sync error' : 'Offline — will sync later'}
            />
          )}
        </button>
      </div>
    </header>
  );
}
