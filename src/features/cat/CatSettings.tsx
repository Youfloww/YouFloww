import { motion } from 'motion/react';
import { usePrefs } from '@/store/prefs';
import { cn } from '@/lib/utils';
import { SectionTitle, Switch } from '@/ui/primitives';
import { CatSprite } from './CatSprite';
import { MAX_LEVEL, levelOf, levelProgress, nextMilestone, unlocked, useCat } from './brain';
import { SKINS } from './skins';

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
      <span className="min-w-0">
        <span className="block text-sm font-extrabold">{title}</span>
        {sub && <span className="block text-xs font-semibold text-muted">{sub}</span>}
      </span>
      {children}
    </label>
  );
}

/** Settings → Your cat: name, wardrobe, her habits, and the family she's building with you */
export function CatSettings() {
  const cat = useCat();
  const prefs = usePrefs();
  const lv = levelOf(cat.xp);
  const prog = levelProgress(cat.xp);
  const next = nextMilestone(cat);

  return (
    <section className="space-y-2">
      <SectionTitle>Your cat</SectionTitle>
      <Row title="🐱 Name" sub="She earns a 🐟 treat for every focus session you finish">
        <input
          defaultValue={cat.name}
          maxLength={20}
          onBlur={(e) => cat.rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Cat's name"
          className="h-9 w-32 rounded-xl bg-line px-3 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-accent"
        />
      </Row>

      <div className="rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-extrabold">💞 Bond level {lv}</span>
          <span className="text-xs font-bold text-muted">{prog.need > 0 ? `${prog.need} xp to level ${lv + 1}` : lv >= MAX_LEVEL ? 'Max!' : ''}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-secondary" initial={false} animate={{ width: `${prog.pct * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs font-semibold text-muted">Focus sessions grow your bond most; pets and meals help a little.{next ? ` Next: ${next}` : ''}</p>
      </div>

      <div className="rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
        <span className="block text-sm font-extrabold">👗 Skins</span>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {SKINS.map((s) => {
            const ok = unlocked(s.id, cat.xp);
            const on = cat.skin === s.id;
            return (
              <button
                key={s.id}
                disabled={!ok}
                onClick={() => cat.setSkin(s.id)}
                aria-pressed={on}
                className={cn('pressable relative flex flex-col items-center rounded-2xl p-1.5 pb-2 text-[11px] font-extrabold', on ? 'bg-accent-soft ring-2 ring-accent' : 'bg-line hover:bg-accent-soft', !ok && 'opacity-55')}
              >
                <CatSprite anim="idle" skin={s.id} height={58} frame={on ? undefined : 0} style={ok ? undefined : { filter: 'grayscale(1) brightness(.6)' }} />
                <span className="mt-0.5 text-center leading-tight">{s.name}</span>
                {!ok && <span className="text-[10px] font-bold text-muted">🔒 Lv {s.unlock}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <Row title="Show the cat" sub="She roams the screen, climbs the timer and naps on it while you focus">
        <Switch checked={prefs.showMascot} onChange={(v) => prefs.set({ showMascot: v })} />
      </Row>
      <Row title="🎶 Purring" sub="Soft purrs now and then (muted when sounds are off)">
        <Switch checked={cat.purrs} onChange={(v) => cat.set({ purrs: v })} />
      </Row>
      <Row title="📣 Pep talks" sub="A kind word in her bubble every few minutes of focus">
        <Switch checked={cat.cheers} onChange={(v) => cat.set({ cheers: v })} />
      </Row>

      <div className="rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-extrabold">🏡 Family</span>
            <span className="block text-xs font-semibold text-muted">
              {cat.stage === 'single'
                ? `A special someone shows up at bond level 3.`
                : cat.stage === 'dating'
                  ? `${cat.name} & ${cat.partner?.name} 💕 Big news comes at bond level 4.`
                  : cat.stage === 'expecting'
                    ? `${cat.name} is expecting! 🍼 ${next ?? ''}`
                    : `${cat.name} & ${cat.partner?.name}'s kittens`}
            </span>
          </span>
          {cat.kittens.length > 0 && <Switch checked={cat.showFamily} onChange={(v) => cat.set({ showFamily: v })} label="Show the kittens" />}
        </div>
        {cat.kittens.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {cat.kittens.map((k) => (
              <div key={k.id} className="flex items-center gap-2 rounded-xl bg-line p-1.5 pr-2">
                <CatSprite anim="idle" skin={k.skin} height={40} />
                <input
                  defaultValue={k.name}
                  maxLength={16}
                  aria-label={`Kitten name (${k.name})`}
                  onBlur={(e) => cat.renameKitten(k.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="h-8 min-w-0 flex-1 rounded-lg bg-surface-strong px-2 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
