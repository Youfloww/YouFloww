import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DoorOpen, Lock } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { bus } from '@/lib/bus';
import { cn, pick } from '@/lib/utils';
import { useWallet } from '@/features/economy/wallet';
import { CatSprite, FEET } from '../cat/CatSprite';
import { catSound, moodOf, useCat } from '../cat/brain';
import { CareCard, type CareAction } from '../cat/CareCard';
import { priceOf } from '../cat/care';
import { foodImg } from '../cat/care';
import { preloadSkin, type SkinId } from '../cat/skins';
import { CRAFT_EMOJI, craftName, settleStudy } from '../cat/study';
import * as L from '../cat/lines';
import { ROOMS, fitsSlot, itemOf, roomImg, depthScale, roomOf, sizeOf, slotsOf, zOfY, type Item, type Room, type RoomId, type Slot } from './catalog';
import { PIC } from './picmeta';
import { currentRoom, goRoom, placeAt, placed, putAway, unlockedRooms, useHome, welcome } from './home';
import { Pet, rand, sleep, type PetView } from './pet';
import { RoomPic } from './RoomArt';
import { ItemPic } from './ItemPic';
import { DecorPanel, FamilyPanel, MadePanel, ShopPanel, type ShopTab } from './panels';

type Tab = 'care' | 'shop' | 'decor' | 'made' | 'family';
const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'care', emoji: '💕', label: 'Care' },
  { id: 'shop', emoji: '🛍️', label: 'Shop' },
  { id: 'decor', emoji: '🪄', label: 'Decorate' },
  { id: 'made', emoji: '🧣', label: 'Made' },
  { id: 'family', emoji: '🐾', label: 'Family' },
];
const RATIO = 16 / 9;
/** where the cats walk: the open floor in front of the furniture */
const WALK = [0.84, 0.94] as const;

export interface Drag {
  id: string;
  from?: string;
  x: number;
  y: number;
  over: string | null;
}
export interface Sel {
  id: string;
  from?: string;
}

function useWide() {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

interface Fx {
  id: number;
  text: string;
  x: number;
  y: number;
  kind: 'float' | 'z';
}
let seq = 1;

/* ------------------------------------------------------------------ */
export default function CatHome() {
  const home = useHome();
  const wallet = useWallet();
  const cat = useCat();
  const wide = useWide();
  const room = currentRoom(home);
  const R = roomOf(room);
  const slots = useMemo(() => slotsOf(R), [R]);
  const here = placed(home, room);
  const [tab, setTab] = useState<Tab | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab>('floor');
  const [sel, setSel] = useState<Sel | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const editing = tab === 'decor';
  const shown: Tab = tab ?? (wide ? 'care' : 'care');
  const panelOpen = wide ? tab !== null : true;

  useEffect(() => {
    welcome();
    const piece = settleStudy();
    if (piece) toast({ emoji: CRAFT_EMOJI[piece.k], title: `${useCat.getState().name} finished ${craftName(piece.k, piece.p)}`, body: 'It’s on her shelf now 🧣📚' });
    for (const r of ROOMS) new Image().src = roomImg(r.id);
  }, []);

  /* stage size: the room painting covers the stage, the overflow scrolls sideways */
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, cw: 0, ch: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current!;
    const fit = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      let h = ch;
      let w = h * RATIO;
      if (w < cw) {
        w = cw;
        h = w / RATIO;
      }
      setBox({ w, h, cw, ch });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const centered = useRef(false);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !box.w || centered.current) return;
    centered.current = true;
    el.scrollLeft = (box.w - box.cw) / 2;
  }, [box]);

  const leave = () => useUI.getState().set({ mode: null });
  const openTab = (t: Tab) => {
    setSel(null);
    setTab((cur) => (cur === t && wide ? null : t));
  };
  const openShop = (t: ShopTab) => {
    setShopTab(t);
    setTab('shop');
  };

  /* ---------------- placing things (drag or tap) ---------------- */
  const slotEls = useRef(new Map<string, HTMLElement>());
  const free = (id: string) => (wallet.items[`home:${id}`] ?? 0) - Object.values(home.place ?? {}).reduce((n, r) => n + Object.values(r).filter((v) => v === id).length, 0);
  const fits = (id: string, s: Slot, from?: string) => {
    if (!fitsSlot(itemOf(id), s)) return false;
    // a swap sends whatever stands there back to `from`, so that has to fit there too
    const other = here[s.id];
    const back = from ? slots.find((x) => x.id === from) : undefined;
    return !other || !back || other === id || fitsSlot(itemOf(other), back);
  };
  const drop = (id: string, slot: string, from?: string) => {
    placeAt(room, slot, id, from);
    setFlash(slot);
    window.setTimeout(() => setFlash((f) => (f === slot ? null : f)), 900);
    setSel(null);
  };
  const startDrag = (e: React.PointerEvent, id: string, from?: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    let live = false;
    const nearest = (x: number, y: number) => {
      let best: string | null = null;
      let bd = Infinity;
      for (const s of slots) {
        if (!fits(id, s, from)) continue;
        const r = slotEls.current.get(s.id)?.getBoundingClientRect();
        if (!r) continue;
        const pad = 34;
        if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) continue;
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < bd) [bd, best] = [d, s.id];
      }
      return best;
    };
    const move = (ev: PointerEvent) => {
      if (!live && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) live = true;
      if (live) {
        ev.preventDefault();
        setDrag({ id, from, x: ev.clientX, y: ev.clientY, over: nearest(ev.clientX, ev.clientY) });
      }
    };
    const up = (ev: PointerEvent) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      setDrag(null);
      if (!live) {
        setSel((s) => (s?.id === id && s.from === from ? null : { id, from }));
        return;
      }
      const over = nearest(ev.clientX, ev.clientY);
      if (over) drop(id, over, from);
      else if (from && (ev.target as Element | null)?.closest?.('[data-home-panel]')) putAway(room, from);
    };
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  };

  /* ---------------- the cats ---------------- */
  const cats = useCats({ room, R, here, box, stage: stageRef, wide });
  cats.onTapMom.current = () => setTab('care');

  const care = (a: CareAction) => {
    if (a.kind === 'pet') return cats.pet();
    if (a.kind === 'play') {
      useCat.getState().treat({ joy: 8, energy: -6 });
      return cats.play();
    }
    if (a.kind === 'treat') {
      if (!useCat.getState().feed()) return;
      return cats.eat('🐟', L.FED);
    }
    if (a.food.toy) return cats.play(a.food.lines);
    cats.eat(foodImg(a.food.id), a.food.lines);
  };

  // a session may end while you're here: her piece is finished, her bond grows
  useEffect(() => {
    const offs = [
      bus.on('session:complete', (p) => {
        const piece = settleStudy(true);
        useCat.getState().onSessionDone(Math.round(p.seconds / 60));
        if (piece) {
          cats.say(`I finished my ${piece.k === 'scarf' ? 'scarf' : piece.k}! ${CRAFT_EMOJI[piece.k]}`);
          toast({ emoji: CRAFT_EMOJI[piece.k], title: `${useCat.getState().name} finished ${craftName(piece.k, piece.p)}!`, body: 'See it under 🧣 Made.' });
        } else cats.say(pick(L.DONE));
        cats.cheer();
      }),
      bus.on('session:early', () => {
        settleStudy(true);
        useCat.getState().onSessionEarly();
        cats.say(pick(L.EARLY('project')));
      }),
    ];
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panel: ReactNode =
    shown === 'care' ? (
      <CareCard onAction={care} skins />
    ) : shown === 'shop' ? (
      <ShopPanel tab={shopTab} setTab={setShopTab} room={room} onPlaced={(slot) => setFlash(slot)} />
    ) : shown === 'decor' ? (
      <DecorPanel room={room} sel={sel} setSel={setSel} free={free} startDrag={startDrag} onShop={() => openShop('floor')} onDone={() => setTab(wide ? null : 'care')} />
    ) : shown === 'made' ? (
      <MadePanel />
    ) : (
      <FamilyPanel />
    );

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-bg text-ink md:block" role="dialog" aria-modal="true" aria-label={`${cat.name}'s home`}>
      {/* ---------------- the room ---------------- */}
      {/* `isolate`: furniture is layered by depth (z-index up to ~1000); that layering stays inside the room,
          so the top bar, the toolbar and the shop panel always sit on top of it */}
      <div className="relative isolate h-[57dvh] shrink-0 md:absolute md:inset-0 md:h-auto">
        <div ref={stageRef} className="no-scrollbar absolute inset-0 isolate overflow-x-auto overflow-y-hidden overscroll-x-contain bg-[#f3dcc6]" onScroll={cats.onScroll}>
          {box.w > 0 && (
            <div className="relative" style={{ width: box.w, height: box.h, marginTop: Math.min(0, (box.ch - box.h) * 0.6) }}>
              <AnimatePresence initial={false}>
                <motion.div key={room} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
                  <RoomPic room={room} className="absolute inset-0" />
                </motion.div>
              </AnimatePresence>
              {/* warm light, a touch of vignette */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_55%,rgb(80_40_20/0.18))]" />

              {slots.map((s) => {
                const it = itemOf(here[s.id] ?? '');
                return it?.kind === 'floor' ? <FloorShadow key={`sh-${s.id}${it.id}`} item={it} slot={s} room={R} box={box} /> : null;
              })}
              {slots.map((s) => {
                const id = here[s.id];
                const it = id ? itemOf(id) : undefined;
                return it ? <Placed key={s.id + id} item={it} slot={s} room={R} box={box} editing={editing} selected={sel?.from === s.id} dragging={drag?.from === s.id} flash={flash === s.id} onDown={(e) => (editing ? startDrag(e, it.id, s.id) : cats.visit(s.id))} /> : null;
              })}

              {editing &&
                slots.map((s) => {
                  const want = drag?.id ?? sel?.id;
                  const ok = want ? fits(want, s, drag?.from ?? sel?.from) : true;
                  const filled = !!here[s.id];
                  return (
                    <SlotMark
                      key={s.id}
                      slot={s}
                      room={R}
                      box={box}
                      filled={filled}
                      hot={!!want && ok}
                      over={drag?.over === s.id}
                      dim={!!want && !ok}
                      refFn={(el) => void (el ? slotEls.current.set(s.id, el) : slotEls.current.delete(s.id))}
                      onTap={() => {
                        if (sel && fits(sel.id, s, sel.from)) drop(sel.id, s.id, sel.from);
                      }}
                    />
                  );
                })}

              {cats.node}
            </div>
          )}
        </div>

        {/* top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-[max(10px,env(safe-area-inset-top))] flex items-start justify-between gap-2 px-2.5 sm:px-4">
          <button onClick={leave} className="glass-strong pressable pointer-events-auto flex h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-extrabold shadow-md" title="Back to YouFloww (Esc)">
            <DoorOpen size={16} /> <span className="hidden sm:inline">Back</span>
          </button>
          <div className="glass-strong no-scrollbar pointer-events-auto flex min-w-0 gap-1 overflow-x-auto rounded-2xl p-1 shadow-md" role="tablist" aria-label="Rooms">
            {ROOMS.map((r) => {
              const open = unlockedRooms(home).includes(r.id);
              const on = r.id === room;
              return (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => (open ? goRoom(r.id) : openShop('rooms'))}
                  title={open ? r.name : `${r.name}: ${priceOf(r.price) ? `🐟 ${r.price}` : 'free'}`}
                  className={cn('pressable flex h-8 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[13px] font-extrabold whitespace-nowrap', on ? 'bg-accent text-accent-ink' : 'hover:bg-line', !open && 'opacity-60')}
                >
                  <span>{r.emoji}</span>
                  <span className={cn(on ? 'inline' : 'hidden lg:inline')}>{r.name}</span>
                  {!open && <Lock size={12} />}
                </button>
              );
            })}
          </div>
          <button onClick={() => openShop('floor')} className="glass-strong pressable pointer-events-auto flex h-10 shrink-0 items-center gap-1 rounded-2xl px-3 text-sm font-black shadow-md tabular" title="Fish coins: 1 for every focused minute">
            🐟 {wallet.coins}
          </button>
        </div>
      </div>

      {/* ---------------- toolbar + panel ---------------- */}
      <div className="relative flex min-h-0 flex-1 flex-col md:contents">
        <nav className="glass-strong z-10 mx-2 mt-2 flex shrink-0 justify-between gap-1 rounded-2xl p-1 shadow-md md:absolute md:bottom-[max(16px,env(safe-area-inset-bottom))] md:left-1/2 md:mx-0 md:mt-0 md:-translate-x-1/2 md:justify-center" aria-label="Cat's Home">
          {TABS.map((t) => {
            const on = shown === t.id && panelOpen;
            return (
              <button key={t.id} onClick={() => openTab(t.id)} aria-pressed={on} className={cn('pressable flex min-w-0 flex-1 flex-col items-center rounded-xl px-2 py-1 text-[11px] font-extrabold md:flex-none md:flex-row md:gap-1.5 md:px-3.5 md:py-2 md:text-sm', on ? 'bg-accent text-accent-ink' : 'hover:bg-line')}>
                <span className="text-lg leading-none md:text-base">{t.emoji}</span>
                {t.label}
              </button>
            );
          })}
        </nav>
        <AnimatePresence>
          {panelOpen && (
            <motion.aside
              key={wide ? 'panel' : 'sheet'}
              data-home-panel
              initial={wide ? { opacity: 0, x: 24 } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] md:glass-strong md:absolute md:top-[68px] md:right-4 md:bottom-[88px] md:w-[360px] md:flex-none md:rounded-3xl md:p-4 md:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)]"
              aria-label={TABS.find((t) => t.id === shown)?.label}
            >
              {wide && (
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-lg font-semibold">
                    {TABS.find((t) => t.id === shown)?.emoji} {TABS.find((t) => t.id === shown)?.label}
                  </span>
                  <button onClick={() => setTab(null)} aria-label="Close panel" className="pressable grid size-7 place-items-center rounded-full bg-line text-xs font-black">
                    ✕
                  </button>
                </div>
              )}
              {panel}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* the piece you're dragging */}
      {drag && (
        <div className="pointer-events-none fixed top-0 left-0 z-[60]" style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0) translate(-50%, -60%)` }}>
          {itemOf(drag.id) && <ItemPic item={itemOf(drag.id)!} className="h-20 w-auto drop-shadow-[0_12px_14px_rgb(60_30_10/0.35)]" />}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Furniture and the spots it can go                                    */
/* ------------------------------------------------------------------ */
interface Box {
  w: number;
  h: number;
}
/** Where a piece is on the stage, in px (its bottom-centre for floor pieces sits exactly on the slot's floor line) */
function geom(it: Item, s: Slot, R: Room, box: Box) {
  const m = PIC[it.id];
  const { k, s: sc } = sizeOf(it, s, R);
  if (it.kind === 'rug') {
    const w = k * box.w;
    return { w, h: m ? (w * m.h) / m.w : w * 0.5, sc };
  }
  const h = k * box.h;
  return { w: m ? (h * m.w) / m.h : h, h, sc };
}

function Placed({ item, slot, room, box, editing, selected, dragging, flash, onDown }: { item: Item; slot: Slot; room: Room; box: Box; editing: boolean; selected: boolean; dragging: boolean; flash: boolean; onDown: (e: React.PointerEvent) => void }) {
  const g = geom(item, slot, room, box);
  const bs = box.h / 800;
  const { dx } = room.light;
  const glow = selected ? ' drop-shadow(0 0 6px var(--accent)) drop-shadow(0 0 2px var(--accent))' : '';
  // colour grade so the cut-out sits in the room's light, plus how it touches its surface
  const filter =
    item.kind === 'wall'
      ? `${room.grade} drop-shadow(${Math.max(-5, Math.min(5, dx * 30)) * bs}px ${4.5 * bs}px ${4 * bs}px rgb(70 40 64/0.3)) drop-shadow(0 ${1.2 * bs}px ${1 * bs}px rgb(70 40 64/0.35))${glow}`
      : item.kind === 'rug'
        ? `${room.grade} drop-shadow(0 ${2 * bs}px ${2.5 * bs}px rgb(70 40 64/0.38))${glow}`
        : `${room.grade}${glow}`;
  const style: React.CSSProperties =
    item.kind === 'floor'
      ? { left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: g.w, height: g.h, transform: 'translate(-50%, -100%)', zIndex: zOfY(slot.y) }
      : { left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: g.w, height: g.h, transform: 'translate(-50%, -50%)', zIndex: item.kind === 'rug' ? 2 : 1 };
  return (
    <div className="absolute" style={style}>
      <motion.div
        className="size-full"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: flash ? [1, 1.12, 1] : 1, opacity: dragging ? 0.35 : 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 18 }}
        style={{ transformOrigin: item.kind === 'floor' ? '50% 100%' : '50% 50%' }}
      >
        <ItemPic
          item={item}
          room
          title={editing ? `${item.name}: drag to move, tap to select` : item.name}
          onPointerDown={onDown}
          className={cn('block size-full max-w-none select-none', editing ? 'cursor-grab touch-none' : item.use ? 'cursor-pointer' : '')}
          style={{ filter, ...(item.kind === 'rug' ? { transform: 'perspective(560px) rotateX(28deg)', transformOrigin: '50% 60%' } : null) }}
        />
      </motion.div>
      {flash && (
        <motion.span className="pointer-events-none absolute -top-3 left-1/2 text-xl" initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -26 }} transition={{ duration: 0.9 }}>
          ✨
        </motion.span>
      )}
    </div>
  );
}

/** A soft contact shadow under a floor piece: sized to its footprint, leaning away from the room's light, multiplied into the floor */
function FloorShadow({ item, slot, room, box }: { item: Item; slot: Slot; room: Room; box: Box }) {
  const m = PIC[item.id];
  const g = geom(item, slot, room, box);
  const { dx, dark } = room.light;
  const fp = (m?.fw ?? 0.7) * g.w;
  const lean = Math.abs(dx) * g.h;
  const sw = fp * 1.18 + lean * 0.6;
  const sh = Math.max(sw * 0.27, 8 * (box.h / 800));
  const cx = slot.x * box.w + (m?.fx ?? 0) * g.w + dx * g.h * 0.4;
  const cy = slot.y * box.h - sh * 0.3;
  const ell = (w: number, h: number, a: number, rgb: string, blur: number): React.CSSProperties => ({
    position: 'absolute',
    left: cx - w / 2,
    top: cy - h / 2,
    width: w,
    height: h,
    borderRadius: '50%',
    background: `radial-gradient(closest-side, rgb(${rgb}/${a}) 0%, rgb(${rgb}/${a * 0.8}) 55%, rgb(${rgb}/0) 100%)`,
    filter: blur ? `blur(${blur}px)` : undefined,
    mixBlendMode: 'multiply',
    zIndex: 3,
    pointerEvents: 'none',
  });
  return (
    <>
      <div aria-hidden style={ell(sw, sh, Math.min(0.95, dark * 1.15), '86 52 84', 0)} />
      <div aria-hidden style={ell(fp * 0.88, sh * 0.55, 0.8, '50 28 50', 1)} />
    </>
  );
}

function SlotMark({ slot, room, box, filled, hot, over, dim, refFn, onTap }: { slot: Slot; room: Room; box: Box; filled: boolean; hot: boolean; over: boolean; dim: boolean; refFn: (el: HTMLElement | null) => void; onTap: () => void }) {
  const sc = slot.kind === 'wall' ? 1 : depthScale(room, slot.y);
  const size = slot.kind === 'wall' ? { w: box.h * 0.17, h: box.h * 0.17 } : slot.kind === 'rug' ? { w: box.w * 0.22 * sc, h: box.h * 0.1 * sc } : { w: box.w * 0.1 * sc, h: box.h * 0.06 * sc };
  return (
    <button
      ref={refFn}
      onClick={onTap}
      aria-label={`${slot.kind} spot${filled ? ' (taken)' : ''}`}
      className={cn(
        'absolute z-[4] grid place-items-center border-[2.5px] border-dashed text-lg font-black transition-all duration-200',
        slot.kind === 'wall' ? 'rounded-2xl' : 'rounded-[50%]',
        over ? 'scale-110 border-solid border-accent bg-accent/35 text-accent-ink' : hot ? 'border-accent bg-white/35 text-accent animate-pulse' : 'border-white/80 bg-white/15 text-white',
        dim && 'opacity-0',
        filled && !over && !hot && 'opacity-0',
      )}
      style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: size.w, height: size.h, transform: `translate(-50%, ${slot.kind === 'floor' ? '-85%' : '-50%'})`, pointerEvents: dim || (filled && !hot) ? 'none' : 'auto' }}
    >
      {!filled && '+'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The cats at home                                                     */
/* ------------------------------------------------------------------ */
interface CatsArgs {
  room: RoomId;
  R: ReturnType<typeof roomOf>;
  here: Record<string, string>;
  box: { w: number; h: number; cw: number; ch: number };
  stage: React.RefObject<HTMLDivElement | null>;
  wide: boolean;
}

function useCats({ room, R, here, box, stage }: CatsArgs) {
  const cat = useCat();
  const { skin, kittens, showFamily, name } = cat;
  const mom = useRef<Pet>(null as unknown as Pet);
  if (!mom.current) mom.current = new Pet(0.5, 0.9);
  const kits = useRef(new Map<string, Pet>());
  const [views, setViews] = useState<Record<string, PetView>>({});
  const [bubble, setBubble] = useState<Record<string, { id: number; text: string } | undefined>>({});
  const [fx, setFx] = useState<Fx[]>([]);
  const [bowl, setBowl] = useState<{ x: number; y: number; img: string } | null>(null);
  const reacting = useRef(false);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lastScroll = useRef(0);
  const ignore = useRef(0);
  const onTapMom = useRef<(() => void) | null>(null);
  const boxRef = useRef(box);
  boxRef.current = box;
  const hereRef = useRef(here);
  hereRef.current = here;
  const roomRef = useRef(R);
  roomRef.current = R;

  const wire = (id: string, p: Pet) => {
    p.onView = (v) => setViews((s) => ({ ...s, [id]: v }));
  };
  const say = (id: string, text: string, ms = 3200) => {
    const n = seq++;
    setBubble((b) => ({ ...b, [id]: { id: n, text } }));
    window.setTimeout(() => setBubble((b) => (b[id]?.id === n ? { ...b, [id]: undefined } : b)), ms);
  };
  const burst = (p: Pet, items: string[], kind: Fx['kind'] = 'float') => {
    const h = 0.2;
    const add = items.map((text) => ({ id: seq++, text, kind, x: p.x + rand(-0.02, 0.02), y: p.y - h * 0.85 - p.lift / Math.max(1, boxRef.current.h) }));
    setFx((f) => [...f.slice(-16), ...add]);
    window.setTimeout(() => setFx((f) => f.filter((x) => !add.includes(x))), 1600);
  };

  /** where a placed piece is, and where she stands to use it */
  const spot = (slotId: string) => {
    const s = slotsOf(roomRef.current).find((x) => x.id === slotId);
    const it = itemOf(hereRef.current[slotId] ?? '');
    if (!s || !it) return null;
    return { s, it };
  };

  /** Mom's visit to a piece of furniture */
  const useItem = async (p: Pet, slotId: string, tok: number) => {
    const sp = spot(slotId);
    if (!sp?.it.use) return;
    const { s, it } = sp;
    const B = boxRef.current;
    const front = Math.min(0.97, Math.max(WALK[0] + 0.01, s.y + 0.025));
    if (it.perch) {
      if (!(await p.walk(s.x + (p.x < s.x ? -0.025 : 0.025), front))) return;
      const top = s.y - sizeOf(it, s, roomRef.current).k * it.perch;
      p.perchZ = zOfY(s.y) + 2;
      p.perchY = s.y - 0.004;
      if (!(await p.hopTo(s.x, top, B.h * 0.12, 0.55))) return;
      if (it.use === 'nap') {
        p.anim('slide', 3);
        useCat.getState().treat({ energy: 6 });
        for (let i = 0; i < 6 && p.alive(tok); i++) {
          burst(p, ['z'], 'z');
          if (!(await p.wait(1900))) return;
        }
      } else if (it.use === 'top') {
        p.face('star');
        say('mom', pick(['King of the castle 👑', 'I can see everything! 👀', 'Up here! ✨']), 2600);
        if (!(await p.wait(rand(5000, 9000)))) return;
      } else {
        p.anim('slide', 9);
        if (!(await p.wait(rand(5000, 10000)))) return;
      }
      p.set({ anim: 'idle', frame: undefined, face: 'normal' });
      await p.hopTo(s.x + (Math.random() < 0.5 ? -0.06 : 0.06), rand(WALK[0], WALK[1]), B.h * 0.08, 0.45);
      return;
    }
    const side = p.x < s.x ? -1 : 1;
    const w = it.h * 0.5 / RATIO;
    if (!(await p.walk(s.x + side * Math.max(0.04, w), front + 0.01))) return;
    p.set({ flip: side > 0 });
    if (it.use === 'scratch') {
      p.face('happy');
      say('mom', pick(['scritch scritch ✨', 'Mani-pedi time 💅', 'Ahh, that’s the spot']), 2400);
      for (let i = 0; i < 4; i++) {
        burst(p, ['✨'], 'float');
        if (!(await p.hop(6, 0.22))) return;
      }
    } else if (it.use === 'watch') {
      p.face('star');
      say('mom', pick(['Fishies!! 🐟', 'So shiny… 👀', 'Hello, little fish 💕']), 2800);
      if (!(await p.wait(4500))) return;
    } else if (it.use === 'play') {
      p.face('star');
      say('mom', pick(['Toys!! 🧶', 'Pounce! 🐾']), 2000);
      for (let i = 0; i < 3; i++) {
        burst(p, [pick(['🧶', '🐭', '✨'])], 'float');
        if (!(await p.hop(26))) return;
        p.set({ flip: !p.view.flip });
      }
    } else if (it.use === 'cuddle') {
      p.face('love');
      burst(p, ['💕', '🧸'], 'float');
      say('mom', 'My teddy 🧸💕', 2400);
      if (!(await p.wait(3500))) return;
    } else if (it.use === 'warm') {
      p.anim('slide', 3);
      say('mom', 'So warm and toasty… 🔥', 2600);
      for (let i = 0; i < 5; i++) {
        burst(p, ['z'], 'z');
        if (!(await p.wait(1900))) return;
      }
    } else if (it.use === 'dance') {
      say('mom', pick(['This song slaps 🎶', '*vibing* 🎵']), 2200);
      for (let i = 0; i < 6; i++) {
        p.face(i % 3 === 2 ? 'star' : 'happy');
        burst(p, [pick(['🎵', '🎶'])], 'float');
        if (!(await p.hop(16, 0.3))) return;
        p.set({ flip: !p.view.flip });
      }
    }
    p.set({ face: 'normal', anim: 'idle', frame: undefined });
  };

  /** A reaction takes her over until it ends */
  const react = async (fn: (p: Pet, tok: number) => Promise<unknown>) => {
    const p = mom.current;
    reacting.current = true;
    const tok = p.interrupt();
    try {
      await Promise.race([fn(p, tok), sleep(20000)]);
    } finally {
      if (p.alive(tok)) reacting.current = false;
    }
  };

  // her life in the room
  useEffect(() => {
    let alive = true;
    const p = mom.current;
    wire('mom', p);
    void preloadSkin(useCat.getState().skin);
    p.x = 0.5;
    p.y = 0.9;
    void (async () => {
      await sleep(500);
      if (!alive) return;
      void react(async (p) => {
        p.face('love');
        say('mom', pick([`Welcome home! 🏡`, 'You came to visit! 😻', 'Make yourself comfy 💛']), 3400);
        catSound('meow', 0.16);
        await p.hop(30);
        await p.hop(20);
        p.face('normal');
      });
      while (alive) {
        if (reacting.current || document.hidden) {
          await sleep(500);
          continue;
        }
        const tok = p.interrupt();
        const st = useCat.getState();
        const mood = moodOf(st);
        const uses = Object.entries(hereRef.current).filter(([, id]) => itemOf(id)?.use);
        const r = Math.random();
        if (uses.length && (r < 0.42 || (mood === 'sleepy' && r < 0.7))) {
          const naps = uses.filter(([, id]) => ['nap', 'warm'].includes(itemOf(id)!.use!));
          const [slotId] = mood === 'sleepy' && naps.length ? pick(naps) : pick(uses);
          await useItem(p, slotId, tok);
        } else if (r < 0.75) {
          await p.walk(rand(0.1, 0.9), rand(WALK[0], WALK[1]));
        } else if (r < 0.87) {
          p.anim('slide', 9);
          if (mood === 'hungry') say('mom', pick(['Snack time? 🐟', 'My tummy is rumbling…']), 2800);
          await p.wait(rand(3000, 6000));
        } else {
          p.face('happy');
          burst(p, ['✨'], 'float');
          await p.wait(2200);
        }
        if (p.alive(tok)) {
          p.set({ anim: 'idle', frame: undefined, face: 'normal' });
          await p.wait(rand(1500, 3500));
        }
      }
    })();
    return () => {
      alive = false;
      p.interrupt();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a new room: she trots in from the side
  const prevRoom = useRef(room);
  useEffect(() => {
    if (prevRoom.current === room) return;
    prevRoom.current = room;
    void react(async (p) => {
      p.x = 0.04;
      p.y = 0.9;
      await p.run(0.4, 0.9);
      p.face('star');
      say('mom', pick(['Ooh, this room! ✨', 'New room, new naps 😸', 'I love it here 💕']), 2600);
      await p.hop(24);
      p.face('normal');
    });
    for (const k of kits.current.values()) {
      k.x = rand(0.05, 0.3);
      k.y = rand(WALK[0], WALK[1]);
    }
  }, [room]);

  // kittens: small lives that stay near mom
  const kitKey = showFamily ? kittens.map((k) => k.id).join(',') : '';
  useEffect(() => {
    const ids = kitKey ? kitKey.split(',') : [];
    const flags: { on: boolean }[] = [];
    for (const id of [...kits.current.keys()]) if (!ids.includes(id)) kits.current.delete(id);
    for (const id of ids) {
      let k = kits.current.get(id);
      if (!k) {
        k = new Pet(rand(0.2, 0.8), rand(WALK[0], WALK[1]));
        wire(id, k);
        kits.current.set(id, k);
      }
      const flag = { on: true };
      flags.push(flag);
      const me = k;
      void (async () => {
        await sleep(rand(600, 2000));
        while (flag.on) {
          if (document.hidden) {
            await sleep(600);
            continue;
          }
          me.interrupt();
          const m = mom.current;
          const r = Math.random();
          if (m.view.anim === 'slide' && m.view.frame === 3 && r < 0.6) {
            await me.walk(m.x + rand(-0.06, 0.06), Math.max(WALK[0], Math.min(WALK[1], m.y + 0.02)), 0.1);
            me.anim('slide', 3);
            await me.wait(rand(6000, 12000));
          } else if (r < 0.55) await me.walk(Math.min(0.95, Math.max(0.05, m.x + rand(-0.12, 0.12))), rand(WALK[0], WALK[1]), 0.14);
          else if (r < 0.75) {
            me.face('star');
            await me.hop(rand(14, 26));
          } else if (r < 0.88) {
            me.face('happy');
            say(id, pick(L.KITTEN), 1600);
            await me.wait(1500);
          } else {
            me.anim('slide', 9);
            await me.wait(rand(2500, 5000));
          }
          me.face('normal');
          await sleep(rand(700, 2400));
        }
      })();
    }
    setViews((v) => ({ ...v }));
    return () => flags.forEach((f) => (f.on = false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitKey]);

  // every frame: move them, keep mom in view on narrow screens
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        const B = boxRef.current;
        const aspect = B.w && B.h ? B.w / B.h : RATIO;
        for (const p of [mom.current, ...kits.current.values()]) {
          p.aspect = aspect;
          p.update(dt, now);
        }
        const el = stage.current;
        if (el && B.w > B.cw + 4 && now - lastScroll.current > 5000) {
          const want = Math.max(0, Math.min(B.w - B.cw, mom.current.x * B.w - B.cw / 2));
          const d = want - el.scrollLeft;
          if (Math.abs(d) > 40) {
            ignore.current = now;
            el.scrollLeft += d * Math.min(1, dt * 1.6);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = () => {
    if (performance.now() - ignore.current > 120) lastScroll.current = performance.now();
  };

  /* ---------------- reactions the page asks for ---------------- */
  const api = {
    say: (t: string) => say('mom', t, 4200),
    pet: () =>
      void react(async (p) => {
        const res = useCat.getState().pet();
        if (res === 'annoyed') {
          p.face('mad');
          say('mom', pick(L.ANNOYED), 2400);
          await p.wait(1800);
          return;
        }
        p.face('love');
        burst(p, ['💕', '❤️', '💖'], 'float');
        if (useCat.getState().purrs) catSound('purr', 0.12);
        if (Math.random() < 0.5) say('mom', pick(L.PET), 2600);
        await p.wait(1800);
        p.face('normal');
      }),
    play: (lines?: string[]) =>
      void react(async (p) => {
        p.face('star');
        say('mom', lines ? pick(lines) : pick(['Play time!! 🧶', 'Chase me! 🐾']), 2400);
        const n = reduced.current ? 1 : 3;
        for (let i = 0; i < n; i++) {
          burst(p, [pick(['🧶', '✨', '🐾', '🌿'])], 'float');
          if (!reduced.current && !(await p.run(Math.min(0.9, Math.max(0.1, p.x + rand(-0.25, 0.25))), rand(WALK[0], WALK[1])))) return;
          if (!(await p.hop(30))) return;
        }
        p.face('love');
        burst(p, ['💕'], 'float');
        await p.wait(1200);
        p.face('normal');
      }),
    eat: (img: string, lines: string[]) =>
      void react(async (p) => {
        const side = p.x > 0.85 ? -1 : 1;
        setBowl({ x: p.x + side * 0.045, y: p.y, img });
        p.set({ flip: side < 0, anim: 'idle', face: 'happy' });
        for (let i = 0; i < 6; i++) {
          burst(p, ['nom'], 'float');
          if (!(await p.wait(480))) break;
        }
        setBowl(null);
        p.face('love');
        say('mom', pick(lines), 2400);
        burst(p, ['💕', '❤️'], 'float');
        if (useCat.getState().purrs) catSound('purr', 0.12);
        await p.wait(1600);
        p.face('normal');
      }),
    cheer: () =>
      void react(async (p) => {
        p.face('star');
        burst(p, ['💖', '✨', '⭐'], 'float');
        await p.hop(30);
        await p.hop(24);
        p.face('normal');
      }),
    visit: (slotId: string) => {
      const sp = spot(slotId);
      if (!sp?.it.use) return;
      void react((p, tok) => useItem(p, slotId, tok));
    },
    onScroll,
  };

  const H = box.h * 0.2;
  const all: [string, Pet, SkinId, number][] = [
    ['mom', mom.current, skin, H],
    ...[...kits.current.entries()].map(([id, p]) => [id, p, kittens.find((k) => k.id === id)?.skin ?? 'tabby', H * 0.55] as [string, Pet, SkinId, number]),
  ];

  const node = (
    <>
      {bowl && (
        <div className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-full" style={{ left: `${bowl.x * 100}%`, top: `${bowl.y * 100}%` }}>
          <div className="flex flex-col items-center" style={{ width: H * 0.4 }}>
            <img src={bowl.img.startsWith('/') ? bowl.img : foodImg('cat:fish')} alt="" style={{ width: H * 0.26, marginBottom: -H * 0.04 }} />
            <div className="rounded-t-md rounded-b-[999px] bg-accent shadow-md ring-2 ring-white/50" style={{ width: H * 0.36, height: H * 0.12 }} />
          </div>
        </div>
      )}
      {all.map(([id, p, sk, h]) => {
        const v = views[id] ?? p.view;
        const b = bubble[id];
        return (
          <div key={id} ref={(el) => void ((p.el = el), p.paint())} className="absolute top-0 left-0 will-change-transform" style={{ width: h * (336 / 288), height: h, zIndex: zOfY(p.y) + 1, marginLeft: (0.5 - FEET.x) * h * (336 / 288) }}>
            <div aria-hidden className="pointer-events-none absolute rounded-[50%] bg-[radial-gradient(closest-side,rgb(60_32_56/0.34),rgb(60_32_56/0.16)_55%,transparent)]" style={{ left: `${FEET.x * 100 - 22}%`, width: '44%', bottom: -h * 0.03, height: h * 0.12 }} />
            <CatSprite anim={v.anim} face={v.face} frame={v.frame} flip={v.flip} loop={v.anim !== 'jump' && v.anim !== 'fall'} skin={sk} height={h} />
            <div
              role="button"
              tabIndex={0}
              aria-label={id === 'mom' ? `${name}: tap to pet and care for her` : 'A kitten'}
              onClick={() => (id === 'mom' ? (api.pet(), onTapMom.current?.()) : (say(id, pick(L.KITTEN), 1500), void p.hop(18)))}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), id === 'mom' && (api.pet(), onTapMom.current?.()))}
              className="absolute cursor-pointer rounded-[40%] outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ left: '28%', top: '12%', width: '44%', height: '85%' }}
            />
            <AnimatePresence>
              {b && (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, scale: 0.6, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  className={cn('glass-strong pointer-events-none absolute bottom-[96%] left-1/2 w-max -translate-x-1/2 rounded-2xl px-3 py-1.5 text-center font-bold text-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]', id === 'mom' ? 'max-w-[220px] text-[13px]' : 'max-w-[140px] text-[11px]')}
                >
                  {b.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      <AnimatePresence>
        {fx.map((f) => (
          <motion.span
            key={f.id}
            className={cn('pointer-events-none absolute z-[7] font-display font-black', f.kind === 'z' ? 'text-base text-[#6b5a8a]' : f.text === 'nom' ? 'rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-accent-ink' : 'text-lg')}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
            initial={{ opacity: 0.95, y: 0, x: 0, scale: 0.6 }}
            animate={f.kind === 'z' ? { opacity: 0, y: -46, x: 22, scale: 1.3 } : { opacity: 0, y: -60, x: rand(-20, 20), scale: 1.1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          >
            {f.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </>
  );
  return { ...api, node, onTapMom };
}
