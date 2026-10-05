import { motion } from 'motion/react';
import { useData } from '@/store/data';
import { ACHIEVEMENTS, RARITY_STYLE } from './defs';
import { cn } from '@/lib/utils';

export default function AchievementsPanel() {
  const d = useData((s) => s.data);
  const have = d.achievements ?? {};
  const count = Object.keys(have).filter((k) => ACHIEVEMENTS.some((a) => a.id === k)).length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-surface-strong/70 p-4 ring-1 ring-line">
        <div className="flex items-end justify-between">
          <p className="font-display text-3xl font-semibold">
            {count}
            <span className="text-lg text-muted">/{ACHIEVEMENTS.length}</span>
          </p>
          <p className="text-sm font-extrabold text-muted">badges collected</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" initial={{ width: 0 }} animate={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a, i) => {
          const at = have[a.id];
          const p = at ? 1 : a.progress(d);
          const r = RARITY_STYLE[a.rarity];
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              whileHover={at ? { y: -4, rotate: -1 } : {}}
              title={at ? `Unlocked ${new Date(at).toLocaleDateString()}` : `${Math.round(p * 100)}% there`}
              className={cn('relative flex flex-col items-center rounded-3xl p-3 text-center ring-1', at ? 'bg-surface-strong ring-line' : 'bg-line/60 ring-transparent')}
            >
              <div
                className="relative mb-2 grid size-16 place-items-center rounded-full text-3xl"
                style={at ? { background: `radial-gradient(circle, ${r.glow}, transparent 70%)`, boxShadow: `0 0 0 3px ${r.ring}` } : { boxShadow: '0 0 0 3px var(--line)' }}
              >
                <span className={cn(!at && 'opacity-30 grayscale')}>{a.emoji}</span>
                {!at && p > 0 && (
                  <svg className="absolute inset-[-3px] -rotate-90" viewBox="0 0 70 70">
                    <circle cx="35" cy="35" r="33.5" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 33.5} strokeDashoffset={2 * Math.PI * 33.5 * (1 - p)} />
                  </svg>
                )}
              </div>
              <p className="text-[13px] leading-tight font-black">{a.name}</p>
              <p className="mt-0.5 text-[11px] leading-snug font-bold text-muted">{a.desc}</p>
              <span className="mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ color: at ? r.ring : undefined, background: at ? `${r.ring}22` : 'var(--line)' }}>
                {at ? r.label : `${Math.round(p * 100)}%`}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
