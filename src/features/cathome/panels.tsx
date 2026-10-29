import { useEffect, useState } from 'react';
import { buy, useWallet } from '@/features/economy/wallet';
import { cn } from '@/lib/utils';
import { CatSprite } from '../cat/CatSprite';
import { MAX_LEVEL, MILESTONES, levelOf, levelProgress, nextMilestone, useCat } from '../cat/brain';
import { FOODS, foodImg } from '../cat/care';
import { CraftIcon } from '../cat/crafts';
import { CRAFTS, CRAFT_VERB, craftName, studyProgress, type CraftKind } from '../cat/study';
import { DECOR, ITEMS, ROOMS, itemOf, type RoomId, type SlotKind } from './catalog';
import { RoomPic } from './RoomArt';
import { ItemPic } from './ItemPic';
import { buyDecor, buyRoom, goRoom, putAway, unlockedRooms, useHome } from './home';
import type { Sel } from './CatHome';

const H3 = 'font-display text-[15px] font-semibold';
const CARD = 'rounded-2xl bg-surface-strong/80 ring-1 ring-line';

/* ------------------------------------------------------------------ */
/* Shop                                                                 */
/* ------------------------------------------------------------------ */
export type ShopTab = SlotKind | 'food' | 'rooms';
const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: 'floor', label: '🛋️ Furniture' },
  { id: 'wall', label: '🖼️ Wall' },
  { id: 'rug', label: '🧶 Rugs' },
  { id: 'food', label: '🐟 Snacks' },
  { id: 'rooms', label: '🚪 Rooms' },
];

function Price({ price, coins, onBuy, label = 'Buy' }: { price: number; coins: number; onBuy: () => void; label?: string }) {
  const short = coins < price;
  return (
    <button
      onClick={onBuy}
      disabled={short}
      title={short ? `${price - coins} more fish coins (1 per focused minute)` : undefined}
      className="pressable mt-1.5 w-full rounded-xl bg-accent py-1.5 text-[12px] font-extrabold text-accent-ink disabled:bg-line disabled:text-muted"
    >
      {short ? `🐟 ${price} · need ${price - coins}` : `${label} · 🐟 ${price}`}
    </button>
  );
}

export function ShopPanel({ tab, setTab, room, onPlaced }: { tab: ShopTab; setTab: (t: ShopTab) => void; room: RoomId; onPlaced: (slot: string) => void }) {
  const wallet = useWallet();
  const home = useHome();
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 3200);
    return () => clearTimeout(id);
  }, [note]);
  const rooms = unlockedRooms(home);
  const roomName = ROOMS.find((r) => r.id === room)?.name ?? 'room';

  return (
    <div>
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Shop sections">
        {SHOP_TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('pressable shrink-0 rounded-xl px-2.5 py-1.5 text-[12px] font-extrabold whitespace-nowrap', tab === t.id ? 'bg-accent text-accent-ink' : 'bg-line/70 hover:bg-line')}>
            {t.label}
          </button>
        ))}
      </div>
      {note && <p className="mt-1.5 rounded-xl bg-accent-soft px-3 py-1.5 text-[12px] font-bold">{note}</p>}

      {tab === 'rooms' ? (
        <div className="mt-2 space-y-2">
          {ROOMS.map((r) => {
            const open = rooms.includes(r.id);
            return (
              <div key={r.id} className={cn(CARD, 'overflow-hidden')}>
                <div className="relative aspect-[16/7] w-full overflow-hidden">
                  <RoomPic room={r.id} className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2" />
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5">
                  <span className={H3}>
                    {r.emoji} {r.name}
                  </span>
                  {open ? (
                    <button onClick={() => goRoom(r.id)} disabled={r.id === room} className="pressable rounded-xl bg-line px-3 py-1.5 text-[12px] font-extrabold disabled:opacity-50">
                      {r.id === room ? 'You’re here' : 'Go there'}
                    </button>
                  ) : (
                    <div className="w-40">
                      <Price price={r.price} coins={wallet.coins} label="Unlock" onBuy={() => buyRoom(r.id) && setNote(`${r.name} unlocked! ✨`)} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'food' ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FOODS.map((f) => {
            const own = wallet.items[f.id] ?? 0;
            return (
              <div key={f.id} className={cn(CARD, 'relative flex flex-col items-center p-2.5')}>
                {own > 0 && <span className="absolute top-1.5 right-1.5 rounded-full bg-accent-soft px-1.5 text-[10px] font-black">×{own}</span>}
                <img src={foodImg(f.id)} alt="" loading="lazy" decoding="async" className="h-14 w-auto object-contain" />
                <span className="mt-1 text-center text-[12.5px] leading-tight font-extrabold">{f.name}</span>
                <span className="text-[10.5px] font-bold text-muted">{f.toy ? `💖 +${f.joy} joy` : `🍗 +${f.hunger} full · 💖 +${f.joy}`}</span>
                <Price price={f.price} coins={wallet.coins} onBuy={() => buy(f.id, f.price) && setNote(`${f.name} is in her pantry 🐟 Feed it from 💕 Care.`)} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ITEMS.filter((i) => i.kind === tab)
            .sort((a, b) => a.price - b.price)
            .map((it) => {
              const own = wallet.items[DECOR(it.id)] ?? 0;
              return (
                <div key={it.id} className={cn(CARD, 'relative flex flex-col items-center p-2.5')}>
                  {own > 0 && <span className="absolute top-1.5 right-1.5 rounded-full bg-accent-soft px-1.5 text-[10px] font-black">×{own}</span>}
                  <div className="grid h-20 w-full place-items-center">
                    <ItemPic item={it} className="max-h-20 max-w-full object-contain" />
                  </div>
                  <span className="mt-1 text-center text-[12.5px] leading-tight font-extrabold">{it.name}</span>
                  {it.use && <span className="text-[10.5px] font-bold text-muted">{USE_NOTE[it.use]}</span>}
                  <Price
                    price={it.price}
                    coins={wallet.coins}
                    onBuy={() => {
                      const r = buyDecor(it.id, room);
                      if (r === 'poor') return;
                      if (r) {
                        onPlaced(r);
                        setNote(`${it.name} is in the ${roomName} ✨ Move it with 🪄 Decorate.`);
                      } else setNote(`${it.name} is in storage: no free ${it.kind} spot here. Swap things in 🪄 Decorate.`);
                    }}
                  />
                </div>
              );
            })}
        </div>
      )}
      <p className="mt-3 text-center text-[11px] font-bold text-muted">You earn 🐟 1 fish coin for every focused minute.</p>
    </div>
  );
}
const USE_NOTE: Record<string, string> = {
  nap: 'she naps in it 💤',
  sit: 'she sits on it',
  top: 'she climbs to the top 👑',
  scratch: 'she scratches it ✨',
  watch: 'she watches the fish 👀',
  play: 'she plays with it 🧶',
  cuddle: 'she cuddles it 🧸',
  warm: 'she naps by the fire 🔥',
  dance: 'she dances to it 🎶',
};

/* ------------------------------------------------------------------ */
/* Decorate: what's in storage                                          */
/* ------------------------------------------------------------------ */
export function DecorPanel({
  room,
  sel,
  setSel,
  free,
  startDrag,
  onShop,
  onDone,
}: {
  room: RoomId;
  sel: Sel | null;
  setSel: (s: Sel | null) => void;
  free: (id: string) => number;
  startDrag: (e: React.PointerEvent, id: string, from?: string) => void;
  onShop: () => void;
  onDone: () => void;
}) {
  const wallet = useWallet();
  const owned = ITEMS.filter((i) => (wallet.items[DECOR(i.id)] ?? 0) > 0);
  const stored = owned.filter((i) => free(i.id) > 0);
  const selItem = sel ? itemOf(sel.id) : null;
  return (
    <div>
      <p className="text-[12.5px] leading-snug font-bold text-muted">
        Drag a piece onto a glowing spot, or tap it and then tap a spot. Drag things around the room to move them; drop one here to put it away.
      </p>
      {selItem && (
        <div className={cn(CARD, 'mt-2 flex items-center gap-2 p-2')}>
          <ItemPic item={selItem} className="size-10 object-contain" />
          <span className="min-w-0 flex-1 text-[12.5px] font-extrabold">
            {selItem.name}
            <span className="block text-[11px] font-bold text-muted">Tap a glowing {selItem.kind} spot</span>
          </span>
          {sel?.from && (
            <button
              onClick={() => {
                putAway(room, sel.from!);
                setSel(null);
              }}
              className="pressable rounded-xl bg-line px-2.5 py-1.5 text-[11.5px] font-extrabold"
            >
              Put away
            </button>
          )}
          <button onClick={() => setSel(null)} aria-label="Cancel" className="pressable grid size-7 place-items-center rounded-full bg-line text-xs font-black">
            ✕
          </button>
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between">
        <span className={H3}>In storage</span>
        <span className="text-[11px] font-bold text-muted">{owned.length} kinds owned</span>
      </div>
      {stored.length ? (
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {stored.map((it) => (
            <button
              key={it.id}
              onPointerDown={(e) => startDrag(e, it.id)}
              onClick={(e) => e.detail === 0 && setSel({ id: it.id })}
              aria-pressed={sel?.id === it.id && !sel.from}
              aria-label={`${it.name}, ${free(it.id)} in storage`}
              className={cn(CARD, 'relative flex touch-none flex-col items-center p-1.5 select-none', sel?.id === it.id && !sel.from && 'ring-2 ring-accent')}
            >
              <span className="absolute top-1 right-1 rounded-full bg-accent-soft px-1 text-[10px] font-black">×{free(it.id)}</span>
              <ItemPic item={it} className="pointer-events-none h-14 w-auto object-contain" />
              <span className="mt-0.5 text-center text-[10.5px] leading-tight font-extrabold">{it.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className={cn(CARD, 'mt-1.5 p-3 text-center')}>
          <p className="text-[12.5px] font-bold text-muted">{owned.length ? 'Everything you own is already out. 🏡' : 'Nothing in storage yet.'}</p>
          <button onClick={onShop} className="pressable mt-2 rounded-xl bg-accent px-3 py-1.5 text-[12px] font-extrabold text-accent-ink">
            🛍️ Visit the shop
          </button>
        </div>
      )}
      <button onClick={onDone} className="pressable mt-3 w-full rounded-xl bg-line py-2 text-[12.5px] font-extrabold">
        Done decorating ✨
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What she made                                                        */
/* ------------------------------------------------------------------ */
const KIND_TITLE: Record<CraftKind, string> = { scarf: '🧣 Scarves', book: '📚 Books read', journal: '📓 Journals' };

export function MadePanel() {
  const home = useHome();
  const name = useCat((s) => s.name);
  const made = home.made ?? [];
  const pr = home.project;
  const [p, setP] = useState(() => studyProgress());
  useEffect(() => {
    const id = window.setInterval(() => setP(studyProgress()), 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <p className="text-[12.5px] leading-snug font-bold text-muted">
        While you focus, {name} knits, reads and writes beside your timer. Every finished session finishes her piece, and she keeps it here.
      </p>
      {pr && (
        <div className={cn(CARD, 'mt-2.5 flex items-center gap-3 p-2.5')}>
          <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-line/60">
            <CraftIcon k={pr.k} p={pr.p} size={44} className={p < 1 ? 'opacity-80' : ''} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-black text-muted uppercase">Now {CRAFT_VERB[pr.k]}</span>
            <span className="block truncate text-[13px] font-extrabold">{craftName(pr.k, pr.p)}</span>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-secondary" style={{ width: `${Math.max(3, p * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
      {made.length === 0 ? (
        <div className={cn(CARD, 'mt-2.5 p-4 text-center')}>
          <div className="flex justify-center gap-2 opacity-70">
            <CraftIcon k="scarf" p={0} size={40} />
            <CraftIcon k="book" p={0} size={40} />
            <CraftIcon k="journal" p={0} size={40} />
          </div>
          <p className="mt-2 text-[13px] font-extrabold">Her shelf is still empty</p>
          <p className="text-[12px] font-bold text-muted">Finish a focus session and she’ll finish her first piece with you.</p>
        </div>
      ) : (
        CRAFTS.map((k) => {
          const list = made.filter((m) => m.k === k).reverse();
          if (!list.length) return null;
          return (
            <section key={k} className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className={H3}>{KIND_TITLE[k]}</span>
                <span className="text-[11px] font-black text-muted">{list.length}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {list.slice(0, 60).map((m) => (
                  <div key={m.t} className={cn(CARD, 'flex flex-col items-center p-1.5 text-center')} title={`${craftName(m.k, m.p)} · ${m.m} min`}>
                    <CraftIcon k={m.k} p={m.p} size={42} />
                    <span className="mt-1 line-clamp-2 text-[10.5px] leading-tight font-extrabold">{craftName(m.k, m.p).replace('Journal: ', '')}</span>
                    <span className="text-[10px] font-bold text-muted">{new Date(m.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Her journey                                                          */
/* ------------------------------------------------------------------ */
export function FamilyPanel() {
  const cat = useCat();
  const lv = levelOf(cat.xp);
  const prog = levelProgress(cat.xp);
  const next = nextMilestone(cat);
  const steps = [
    { at: 1, label: 'Moved in with you', done: true, emoji: '🏡' },
    { at: MILESTONES.partner, label: cat.partner ? `Met ${cat.partner.name}` : 'Meets someone special', done: !!cat.partner, emoji: '💌' },
    { at: MILESTONES.expecting, label: 'Big news', done: cat.stage === 'expecting' || cat.stage === 'family', emoji: '🍼' },
    { at: MILESTONES.expecting, label: cat.kittens.length ? `${cat.kittens.length} kittens` : 'Kittens arrive', done: cat.kittens.length > 0, emoji: '🐾' },
    { at: MAX_LEVEL, label: 'Best friends forever', done: lv >= MAX_LEVEL, emoji: '💖' },
  ];
  return (
    <div>
      <div className={cn(CARD, 'flex items-center gap-3 p-3')}>
        <CatSprite anim="idle" face="love" height={64} />
        <div className="min-w-0 flex-1">
          <span className={H3}>{cat.name}</span>
          <div className="flex items-center justify-between text-[11px] font-black text-muted">
            <span>💞 Bond level {lv}</span>
            {prog.need > 0 && <span>{prog.need} xp to go</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-secondary" style={{ width: `${prog.pct * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] font-bold text-muted">{cat.together} focus sessions together</p>
        </div>
      </div>
      {next && <p className="mt-2 rounded-xl bg-accent-soft px-3 py-1.5 text-[12px] font-bold">Next: {next}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className={cn(CARD, 'flex flex-col items-center p-2.5 text-center')}>
          {cat.partner ? (
            <>
              <CatSprite anim="idle" face="happy" skin={cat.partner.skin} height={56} />
              <span className="text-[13px] font-extrabold">{cat.partner.name}</span>
              <span className="text-[11px] font-bold text-muted">her special someone 💕</span>
            </>
          ) : (
            <>
              <span className="grid h-14 place-items-center text-3xl">💌</span>
              <span className="text-[12px] font-extrabold">Someone special</span>
              <span className="text-[11px] font-bold text-muted">arrives at bond level {MILESTONES.partner}</span>
            </>
          )}
        </div>
        <div className={cn(CARD, 'flex flex-col items-center p-2.5 text-center')}>
          {cat.kittens.length ? (
            <>
              <div className="flex h-14 items-end -space-x-3">
                {cat.kittens.slice(0, 4).map((k) => (
                  <CatSprite key={k.id} anim="idle" skin={k.skin} height={36} />
                ))}
              </div>
              <span className="text-[12px] leading-tight font-extrabold">{cat.kittens.map((k) => k.name).join(', ')}</span>
              <span className="text-[11px] font-bold text-muted">rename them in Settings</span>
            </>
          ) : (
            <>
              <span className="grid h-14 place-items-center text-3xl">{cat.stage === 'expecting' ? '🍼' : '🐾'}</span>
              <span className="text-[12px] font-extrabold">{cat.stage === 'expecting' ? 'Kittens on the way!' : 'Kittens'}</span>
              <span className="text-[11px] font-bold text-muted">{cat.stage === 'expecting' ? next : `after the big news (level ${MILESTONES.expecting})`}</span>
            </>
          )}
        </div>
      </div>

      <span className={cn(H3, 'mt-3 block')}>Her journey</span>
      <ol className="mt-1.5 space-y-1.5">
        {steps.map((s) => (
          <li key={s.label} className={cn('flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-extrabold', s.done ? 'bg-accent-soft' : 'bg-line/50 text-muted')}>
            <span className="text-base">{s.done ? s.emoji : '🔒'}</span>
            <span className="flex-1">{s.label}</span>
            <span className="text-[10.5px] font-black text-muted">lv {s.at}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] font-bold text-muted">Focus sessions grow your bond most; pets and meals help a little.</p>
    </div>
  );
}
