import { useState } from 'react';
import { useWallet } from '@/features/economy/wallet';
import { useFeatureData } from '@/lib/featureData';
import { cn } from '@/lib/utils';
import { MAX_LEVEL, MOOD_FACE, levelOf, levelProgress, moodOf, nextMilestone, unlocked, useCat } from './brain';
import { FOODS, foodImg, serve, type Food } from './care';
import { SKINS } from './skins';
import { CRAFT_VERB, HOME_EMPTY, HOME_KEY, craftName, studyProgress, type CatHomeData } from './study';

export type CareAction = { kind: 'pet' } | { kind: 'play' } | { kind: 'treat' } | { kind: 'food'; food: Food };

function Meter({ label, v, tone }: { label: string; v: number; tone: string }) {
  return (
    <div className="flex items-center gap-2" role="meter" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <span className="w-[68px] shrink-0">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
        <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${Math.max(3, Math.min(100, v))}%` }} />
      </div>
    </div>
  );
}

/**
 * Her care card: how she feels (the brain's own needs), pet / play, and snacks bought with fish coins.
 * The parent animates her through `onAction`; this card only does the bookkeeping.
 */
export function CareCard({ onAction, onClose, onHome, skins = true, className }: { onAction: (a: CareAction) => void; onClose?: () => void; onHome?: () => void; skins?: boolean; className?: string }) {
  const cat = useCat();
  const { name, treats, hunger, energy, joy, xp, skin, kittens } = cat;
  const mood = moodOf(cat);
  const wallet = useWallet();
  const home = useFeatureData<CatHomeData>(HOME_KEY, HOME_EMPTY);
  const [note, setNote] = useState<string | null>(null);
  const lv = levelOf(xp);
  const prog = levelProgress(xp);
  const next = nextMilestone(cat);
  const say = (t: string) => {
    setNote(t);
    window.setTimeout(() => setNote((n) => (n === t ? null : n)), 2600);
  };
  const give = (f: Food) => {
    const r = serve(f.id);
    if (r === 'poor') return say(`Needs 🐟 ${f.price}. Focus a little to earn more!`);
    if (r === 'full') return say(`${name} is full! Maybe a toy? 😸`);
    onAction({ kind: 'food', food: f });
  };

  return (
    <div className={cn('text-ink', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display truncate text-base font-bold">{name}</span>
        <span className="flex items-center gap-1 text-xs font-bold text-muted capitalize">
          {MOOD_FACE[mood]} {mood}
        </span>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="pressable grid size-6 shrink-0 place-items-center rounded-full bg-line text-xs font-black">
            ✕
          </button>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-[11px] font-black text-muted">
          <span>
            💞 Bond lv {lv}
            {lv >= MAX_LEVEL && ' (max!)'}
          </span>
          {prog.need > 0 && <span>{prog.need} to go</span>}
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-secondary transition-[width] duration-500" style={{ width: `${prog.pct * 100}%` }} />
        </div>
        {next && <p className="mt-1 text-[11px] leading-snug font-bold text-muted">{next}</p>}
      </div>

      <div className="mt-2.5 space-y-1.5 text-[11px] font-bold text-muted">
        <Meter label="💖 Happy" v={joy} tone="bg-gradient-to-r from-[#f59ab5] to-[#f37a9b]" />
        <Meter label="🍗 Full" v={100 - hunger} tone={hunger > 72 ? 'bg-[#f0a35e]' : 'bg-gradient-to-r from-[#f7c873] to-[#f0a35e]'} />
        <Meter label="⚡ Energy" v={energy} tone="bg-gradient-to-r from-[#9fd6bd] to-[#6fbf9c]" />
      </div>

      {home.project && (
        <p className="mt-2 truncate rounded-xl bg-line/70 px-2.5 py-1 text-[11px] font-extrabold" title={craftName(home.project.k, home.project.p)}>
          {home.project.k === 'scarf' ? '🧶' : home.project.k === 'book' ? '📖' : '✏️'} {CRAFT_VERB[home.project.k]} {craftName(home.project.k, home.project.p)} · {Math.round(studyProgress() * 100)}%
        </p>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <button onClick={() => onAction({ kind: 'pet' })} className="pressable rounded-xl bg-accent-soft py-1.5 text-[12px] font-extrabold text-ink">
          💕 Pet
        </button>
        <button onClick={() => onAction({ kind: 'play' })} disabled={energy < 8} className="pressable rounded-xl bg-accent-soft py-1.5 text-[12px] font-extrabold text-ink disabled:opacity-45" title={energy < 8 ? 'Too sleepy to play' : 'Play with yarn'}>
          🧶 Play
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] font-black text-muted">
        <span>Snacks & toys</span>
        <span className="text-ink">🐟 {wallet.coins}</span>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        <button
          onClick={() => (treats > 0 ? onAction({ kind: 'treat' }) : say('Finish a focus session to earn a free treat 🐟'))}
          className={cn('pressable flex flex-col items-center rounded-xl bg-line/70 px-0.5 pt-1 pb-0.5', treats === 0 && 'opacity-55')}
          title="Free treat, earned by focusing"
          aria-label={`Focus treat, ${treats} left`}
        >
          <span className="grid h-[30px] place-items-center text-[22px] leading-none">🎁</span>
          <span className="text-[10px] font-black">×{treats}</span>
        </button>
        {FOODS.map((f) => {
          const own = wallet.items[f.id] ?? 0;
          return (
            <button
              key={f.id}
              onClick={() => give(f)}
              title={`${f.name}${own ? ` (you have ${own})` : ` · 🐟 ${f.price}`}`}
              aria-label={`${f.toy ? 'Give' : 'Feed'} ${f.name}${own ? `, ${own} owned` : `, costs ${f.price} fish coins`}`}
              className={cn('pressable flex flex-col items-center rounded-xl bg-line/70 px-0.5 pt-1 pb-0.5', !own && wallet.coins < f.price && 'opacity-55')}
            >
              <img src={foodImg(f.id)} alt="" width={30} height={30} decoding="async" draggable={false} className="size-[30px] object-contain" />
              <span className="text-[10px] font-black">{own ? `×${own}` : `🐟${f.price}`}</span>
            </button>
          );
        })}
      </div>
      {note && <p className="mt-1.5 rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-bold">{note}</p>}

      {skins && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Skins">
          {SKINS.map((s) => {
            const ok = unlocked(s.id, xp);
            return (
              <button
                key={s.id}
                title={ok ? s.name : `${s.name}: unlocks at bond level ${s.unlock}`}
                aria-label={ok ? `Skin: ${s.name}` : `${s.name}, locked`}
                disabled={!ok}
                onClick={() => useCat.getState().setSkin(s.id)}
                className="pressable relative grid size-6 place-items-center rounded-full text-[10px] disabled:opacity-40"
                style={{
                  background: s.ramp ? `linear-gradient(135deg, ${s.ramp[2]}, ${s.ramp[0]})` : 'linear-gradient(135deg,#8a8a8a,#3a3a3a)',
                  boxShadow: skin === s.id ? '0 0 0 2px var(--surface-strong), 0 0 0 4px var(--accent)' : undefined,
                }}
              >
                {!ok && '🔒'}
              </button>
            );
          })}
        </div>
      )}
      {kittens.length > 0 && <p className="mt-2 truncate text-[11px] font-bold text-muted">🐾 Kittens: {kittens.map((k) => k.name).join(', ')}</p>}
      {onHome && (
        <button onClick={onHome} className="pressable mt-2.5 w-full rounded-xl bg-accent py-1.5 text-[12px] font-extrabold text-accent-ink">
          🏡 Visit {name}’s home
        </button>
      )}
    </div>
  );
}
