import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Coffee, DoorOpen, Pause, Play, Square, Volume2, VolumeX } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { usePresence } from '@/services/presence';
import { cn, haptic } from '@/lib/utils';
import { useTimerView } from '../timer/TimerOrb';
import { requestEnd, requestFocusFor, skipBreak, toggle } from '../timer/engine';
import { CAFE_ART, DRINKS, REGULARS, SIZES, VIEWS, drinkImg, drinkOf, sizeOf, type CafeOrder, type CafeView, type DrinkId, type SizeId } from './menu';

type Step = 'outside' | 'menu' | 'size' | 'ticket' | 'intent' | 'table';
interface Draft {
  drink: DrinkId | null;
  size: SizeId;
  name: string;
  intent: string;
  todoId: string | null;
}

const INK = 'text-[#3b2a20]';
const PAPER = 'bg-[#fffaf1] border-2 border-[#5b3f2c]/70 shadow-[0_30px_80px_-30px_rgb(60_30_10/0.6)]';
const BTN = 'pressable inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold disabled:opacity-40';
const DARK_BTN = cn(BTN, 'h-12 bg-[#3b2a20] px-6 text-[#fff6ea] hover:bg-[#4a3529]');
const LIGHT_BTN = cn(BTN, 'h-11 border-2 border-[#5b3f2c]/60 bg-[#fffaf1] px-4 text-[#3b2a20] hover:bg-[#fff1e0]');
const ROUND = 'pressable grid size-12 shrink-0 place-items-center rounded-full border-2 border-[#5b3f2c]/70 bg-[#fffaf1] text-[#3b2a20] shadow-[0_8px_20px_-10px_rgb(60_30_10/0.6)]';

/** A painting that covers the screen like object-cover, with children placed in % of the painting. */
function Art({ src, ratio = 1.5, className, children }: { src: string; ratio?: number; className?: string; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={cn('absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', className)} style={{ width: `max(100vw, ${ratio * 100}dvh)`, aspectRatio: ratio }}>
        <img src={src} alt="" decoding="async" draggable={false} className="size-full object-cover select-none" />
        {children}
      </div>
    </div>
  );
}

function Steam() {
  return (
    <svg viewBox="0 0 60 90" className="pointer-events-none absolute bottom-full left-1/2 h-[42%] -translate-x-1/2 overflow-visible blur-[1.5px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${16 + i * 14} 88 q-7-11 0-22 t0-22 t0-22`} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" className="cafe-steam" style={{ animationDelay: `${i * 1.2}s` }} />
      ))}
    </svg>
  );
}

function Drink({ id, className }: { id: DrinkId; className?: string }) {
  const d = drinkOf(id);
  return (
    <motion.div className={cn('relative', className)} whileTap={{ rotate: [0, -6, 4, 0], y: -6 }} transition={{ duration: 0.5 }}>
      {d.hot && (
        <div className="absolute" style={{ left: `${d.steam[0]}%`, top: `${d.steam[1]}%`, width: '40%', height: '60%', transform: 'translateX(-50%)' }}>
          <Steam />
        </div>
      )}
      <img src={drinkImg(id)} alt={d.name} draggable={false} className="relative h-full w-auto object-contain drop-shadow-[0_14px_14px_rgb(60_30_10/0.25)] select-none" />
    </motion.div>
  );
}

/** Paper card for the ordering steps. */
function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={cn('relative max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-[28px] p-5 sm:p-7', PAPER, INK, className)}
    >
      {children}
    </motion.div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="pressable mt-3 w-full rounded-xl py-2 text-sm font-extrabold opacity-60 hover:opacity-100">
      ← back
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Ordering steps                                                      */
/* ------------------------------------------------------------------ */
function Outside({ onEnter, onLeave }: { onEnter: () => void; onLeave: () => void }) {
  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.6 }}>
      <Art src="/img/cafe/storefront.webp">
        {/* the blank board above the awning */}
        <div className="absolute grid place-items-center" style={{ left: '33.4%', top: '17%', width: '33.2%', height: '8.9%' }}>
          <span className="font-display font-semibold tracking-tight text-[#4a2f1d] [text-shadow:0_1px_0_rgb(255_240_220/0.6)]" style={{ fontSize: 'calc(max(100vw, 150dvh) * 0.031)' }}>
            YouFloww Café
          </span>
        </div>
        <button onClick={onEnter} aria-label="Walk into the café" className="absolute cursor-pointer" style={{ left: '24%', top: '38%', width: '52%', height: '48%' }} />
      </Art>
      <button onClick={onLeave} className={cn(LIGHT_BTN, 'absolute top-[max(16px,env(safe-area-inset-top))] left-4 h-10 text-sm')}>
        <DoorOpen size={16} /> Back to YouFloww
      </button>
      <div className="absolute inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] flex justify-center px-4">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35, type: 'spring', stiffness: 220, damping: 24 }} className={cn('flex flex-col items-center gap-3 rounded-[26px] px-6 py-4 text-center', PAPER, INK)}>
          <div>
            <p className="font-display text-2xl font-semibold">Ready to lock in?</p>
            <p className="text-sm font-bold opacity-70">Pull up a chair, order a drink, and focus with the regulars.</p>
          </div>
          <button onClick={onEnter} className={DARK_BTN}>
            Step inside ☕
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Menu({ draft, setDraft, onNext, onBack, swapping }: { draft: Draft; setDraft: (d: Partial<Draft>) => void; onNext: () => void; onBack: () => void; swapping: boolean }) {
  return (
    <Card className="max-w-[680px]">
      <div className="text-center">
        <p className="text-3xl">☕</p>
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">What are we sipping today?</h2>
        {swapping && <p className="mt-1 text-sm font-bold opacity-70">Your timer keeps running. This just changes what’s in your cup.</p>}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {DRINKS.map((d) => {
          const on = draft.drink === d.id;
          return (
            <button
              key={d.id}
              onClick={() => {
                haptic(6);
                setDraft({ drink: d.id });
              }}
              onDoubleClick={onNext}
              aria-pressed={on}
              className={cn('pressable group flex flex-col items-center rounded-2xl p-2.5 transition-colors', on ? 'bg-[#ffe6d2] ring-2 ring-[#e07a5f]' : 'hover:bg-[#fff1e0]')}
            >
              <motion.img src={drinkImg(d.id)} alt="" draggable={false} animate={{ y: on ? -6 : 0, scale: on ? 1.06 : 1 }} className="h-24 w-auto object-contain sm:h-28" />
              <span className="mt-1.5 font-display text-[17px] leading-tight font-semibold">{d.name}</span>
              <span className="text-xs font-bold opacity-60">{d.note}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-center">
        <button onClick={onNext} disabled={!draft.drink} className={DARK_BTN}>
          {draft.drink ? (swapping ? 'Swap my drink' : 'Next') : 'Choose a drink first'}
        </button>
      </div>
      <Back onClick={onBack} />
    </Card>
  );
}

function Size({ draft, setDraft, onNext, onBack }: { draft: Draft; setDraft: (d: Partial<Draft>) => void; onNext: () => void; onBack: () => void }) {
  return (
    <Card className="max-w-[640px]">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">What size?</h2>
        <p className="text-sm font-bold opacity-70">Bigger cup, longer focus. You can always order another.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {SIZES.map((s) => {
          const on = draft.size === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setDraft({ size: s.id })}
              onDoubleClick={onNext}
              aria-pressed={on}
              className={cn('pressable flex flex-col items-center rounded-2xl p-3 transition-colors', on ? 'bg-[#ffe6d2] ring-2 ring-[#e07a5f]' : 'hover:bg-[#fff1e0]')}
            >
              <div className="flex h-28 items-end">
                <img src={drinkImg(draft.drink ?? 'latte')} alt="" draggable={false} className="w-auto object-contain" style={{ height: `${s.scale * 100}%` }} />
              </div>
              <span className="mt-2 font-display text-lg leading-tight font-semibold">{s.name}</span>
              <span className="text-sm font-black">{s.minutes} min</span>
              <span className="text-xs font-bold opacity-60">{s.note}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-center">
        <button onClick={onNext} className={DARK_BTN}>
          Next
        </button>
      </div>
      <Back onClick={onBack} />
    </Card>
  );
}

function Ticket({ draft, setDraft, no, onNext, onBack }: { draft: Draft; setDraft: (d: Partial<Draft>) => void; no: number; onNext: () => void; onBack: () => void }) {
  const size = sizeOf(draft.size);
  const now = new Date();
  return (
    <Card className="max-w-[360px] rounded-[10px] font-mono uppercase">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <p className="text-center font-display text-xl font-semibold normal-case">YouFloww Café</p>
        <p className="text-center text-[11px] font-bold opacity-60">
          {now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>
        <div className="my-4 border-t-2 border-dashed border-[#5b3f2c]/40" />
        <p className="text-center text-sm font-black">Order #{no}</p>
        <div className="mt-3 flex justify-between gap-3 text-sm font-bold">
          <span>
            1× {size.name} {drinkOf(draft.drink ?? 'latte').name}
          </span>
          <span className="shrink-0">{size.minutes} min</span>
        </div>
        <div className="my-4 border-t-2 border-dashed border-[#5b3f2c]/40" />
        <label className="block text-[11px] font-black opacity-70" htmlFor="cafe-name">
          Name for the cup
        </label>
        <input
          id="cafe-name"
          autoFocus
          value={draft.name}
          maxLength={24}
          onChange={(e) => setDraft({ name: e.target.value })}
          placeholder="your name"
          autoComplete="off"
          className="mt-1.5 h-12 w-full rounded-xl border-2 border-[#5b3f2c]/50 bg-white px-3 font-display text-xl font-semibold normal-case outline-none focus:border-[#e07a5f]"
        />
        <button type="submit" className={cn(DARK_BTN, 'mt-5 w-full normal-case')}>
          Next
        </button>
        <Back onClick={onBack} />
      </form>
    </Card>
  );
}

function Intent({ draft, setDraft, onStart, onBack }: { draft: Draft; setDraft: (d: Partial<Draft>) => void; onStart: () => void; onBack: () => void }) {
  const todos = useData((s) => s.data.todos);
  const open = todos
    .filter((t) => !t.completed)
    .sort((a, b) => Number(!!b.starred) - Number(!!a.starred))
    .slice(0, 4);
  return (
    <Card className="max-w-[560px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <h2 className="text-center font-display text-2xl font-semibold sm:text-3xl">While you sip, I will…</h2>
        <input
          autoFocus
          value={draft.intent}
          maxLength={80}
          onChange={(e) => setDraft({ intent: e.target.value, todoId: null })}
          placeholder="finish chapter 3"
          autoComplete="off"
          className="mt-5 h-14 w-full rounded-2xl border-2 border-[#5b3f2c]/50 bg-white px-4 font-display text-2xl font-semibold outline-none focus:border-[#e07a5f]"
        />
        {open.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {open.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setDraft({ intent: t.text.slice(0, 80), todoId: t.id })}
                className={cn('pressable max-w-full truncate rounded-full border-2 px-3 py-1 text-sm font-bold', draft.todoId === t.id ? 'border-[#e07a5f] bg-[#ffe6d2]' : 'border-[#5b3f2c]/30 hover:bg-[#fff1e0]')}
              >
                {t.starred ? '⭐ ' : ''}
                {t.text}
              </button>
            ))}
          </div>
        )}
        <button type="submit" className={cn(DARK_BTN, 'mt-6 w-full')}>
          Start sipping ☕
        </button>
        <Back onClick={onBack} />
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* At the table                                                        */
/* ------------------------------------------------------------------ */
function Rain() {
  return (
    <div className="pointer-events-none absolute overflow-hidden" style={{ left: '9%', top: '3%', width: '83%', height: '78%' }}>
      <div className="cafe-rain absolute -inset-[20%] rotate-[8deg]" />
    </div>
  );
}

function useViewport() {
  const [size, setSize] = useState(() => ({ w: innerWidth, h: innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: innerWidth, h: innerHeight });
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return size;
}

function Backdrop({ view }: { view: CafeView }) {
  const focusing = usePresence((s) => s.focusing);
  const meFocusing = useTimer((s) => s.status === 'running' && s.mode === 'focus');
  const { w, h } = useViewport();
  // the painting is wider than a phone: which slice of it (in %) is on screen
  const artW = Math.max(w, 1.5 * h);
  const edge = ((artW - w) / 2 / artW) * 100;
  const pad = (78 / artW) * 100;
  const tags = REGULARS.filter((r) => r.x > edge + 1 && r.x < 100 - edge - 1);
  return (
    <AnimatePresence mode="sync">
      <motion.div key={view} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}>
        {view === 'focus' && (
          <>
            <Art src="/img/cafe/interior.webp" className="scale-110 blur-[10px] brightness-[0.97]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#fff6ea]/55 via-[#fff6ea]/25 to-transparent" />
          </>
        )}
        {view === 'regulars' && (
          <Art src="/img/cafe/interior.webp">
            {tags.map((r, i) => (
              <motion.div
                key={r.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
                className="absolute w-max max-w-[150px] -translate-x-1/2 -translate-y-full rounded-xl bg-[#fffaf1]/95 px-2.5 py-1 text-center text-xs leading-tight font-bold text-[#3b2a20] shadow-md"
                style={{ left: `${Math.min(100 - edge - pad, Math.max(edge + pad, r.x))}%`, top: `${r.y}%` }}
              >
                <b className="font-black">{r.name}</b> {r.doing}
              </motion.div>
            ))}
          </Art>
        )}
        {view === 'window' && (
          <Art src="/img/cafe/window.webp" ratio={1536 / 858}>
            <Rain />
          </Art>
        )}
        {view === 'regulars' && (
          <div className="absolute top-[calc(max(16px,env(safe-area-inset-top))+56px)] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
            {focusing !== null && focusing > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-[#fffaf1]/95 px-3 py-1.5 text-xs font-extrabold whitespace-nowrap text-[#3b2a20] shadow-md">
                <span className="size-2 rounded-full bg-[#2fbf85]" />
                {focusing === 1 && meFocusing ? 'Just you focusing right now' : `${focusing} focusing right now`}
              </div>
            )}
            <div className="rounded-full bg-[#fffaf1]/80 px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-[#6b5444] shadow-sm">
              Mochi, Bruno, Miso &amp; Pip are the café&apos;s painted regulars
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function TableTop() {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 rounded-[50%] border-[3px] border-[#5b3f2c]/75"
      style={{
        bottom: '-40dvh',
        width: 'max(130vw, 1000px)',
        height: '70dvh',
        background: 'radial-gradient(ellipse at 50% 22%, #fffdf8 0%, #f8eedf 45%, #ecdcc5 75%, #e2ccb0 100%)',
        boxShadow: '0 -18px 60px -20px rgb(60 30 10 / 0.45), inset 0 10px 30px -10px rgb(255 255 255 / 0.9)',
      }}
    />
  );
}

function Table({ order, onLeave, onSwap, onNewOrder, onAgain }: { order: CafeOrder; onLeave: () => void; onSwap: () => void; onNewOrder: () => void; onAgain: () => void }) {
  const [view, setView] = useState<CafeView>('focus');
  const t = useTimerView();
  const cafeOn = usePrefs((s) => !!s.mixer.on.cafe);
  const toggleTrack = usePrefs((s) => s.toggleTrack);
  const onBreak = t.mode !== 'focus';
  const done = t.mode === 'focus' && t.status === 'idle';
  const idx = VIEWS.findIndex((v) => v.id === view);
  const step = (dir: 1 | -1) => setView(VIEWS[(idx + dir + VIEWS.length) % VIEWS.length].id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + 1) % VIEWS.length].id);
      if (e.key === 'ArrowLeft') setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + VIEWS.length - 1) % VIEWS.length].id);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const who = order.name.trim();
  const line = order.intent.trim() ? `${who || 'I'} will ${order.intent.trim()}` : who ? `${who}’s focus time` : 'Just focusing';

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <Backdrop view={view} />
      <TableTop />

      {/* top: leave · view · change drink */}
      <div className="absolute inset-x-0 top-[max(16px,env(safe-area-inset-top))] flex items-center justify-between gap-2 px-3 sm:px-4">
        <button onClick={onLeave} className={cn(LIGHT_BTN, 'h-10 px-3 text-sm')} title="Leave the café (your timer keeps going)">
          <DoorOpen size={16} /> <span className="hidden sm:inline">Leave café</span>
        </button>
        <div className={cn('rounded-xl px-4 py-1.5 font-display text-base font-semibold', PAPER, INK)}>{VIEWS[idx].label}</div>
        <button onClick={onSwap} className={cn(LIGHT_BTN, 'h-10 px-3 text-sm')} title="Change your drink">
          <Coffee size={16} /> <span className="hidden sm:inline">Change drink</span>
        </button>
      </div>

      <button onClick={() => step(-1)} aria-label="Previous view" className={cn(ROUND, 'absolute top-1/2 left-3 -translate-y-1/2 sm:left-4')}>
        <ChevronLeft size={22} />
      </button>
      <button onClick={() => step(1)} aria-label="Next view" className={cn(ROUND, 'absolute top-1/2 right-3 -translate-y-1/2 sm:right-4')}>
        <ChevronRight size={22} />
      </button>

      {/* the big clock lives in the focus view; elsewhere it shrinks onto the table */}
      <AnimatePresence>
        {view === 'focus' && !done && (
          <motion.div
            key="clock"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none absolute inset-x-0 top-[13dvh] flex flex-col items-center px-16 text-center text-[#3b2a20]"
          >
            <span className="tabular font-display leading-none font-semibold [text-shadow:0_2px_24px_rgb(255_246_234/0.9)]" style={{ fontSize: 'clamp(64px, 13vmin + 20px, 150px)' }}>
              {t.clock}
            </span>
            <span className="mt-3 max-w-[560px] rounded-full bg-[#fffaf1]/80 px-4 py-1 text-base font-extrabold">{onBreak ? 'Break time: stretch, sip some water, look outside' : line}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the drink, resting on the table */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ bottom: 'calc(9dvh + 64px)', height: 'clamp(130px, 30dvh, 300px)' }}>
        <Drink id={order.drink} className="pointer-events-auto h-full" />
      </div>

      {/* finished cup: what next? */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn('absolute top-[13dvh] left-1/2 w-[min(92vw,380px)] -translate-x-1/2 rounded-[24px] p-5 text-center', PAPER, INK)}
          >
            <p className="font-display text-2xl font-semibold">Cup finished ☕</p>
            <p className="mt-1 text-sm font-bold opacity-70">Fancy another round?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={onAgain} className={cn(DARK_BTN, 'h-11 px-5')}>
                Same again
              </button>
              <button onClick={onNewOrder} className={LIGHT_BTN}>
                New order
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* controls on the table */}
      <div className="absolute inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] flex items-center justify-center gap-3">
        {view !== 'focus' && !done && (
          <span className={cn('tabular rounded-full px-4 py-2.5 font-display text-xl font-semibold', PAPER, INK)}>
            {onBreak ? '☕ ' : ''}
            {t.clock}
          </span>
        )}
        {!done && (
          <>
            <button onClick={toggle} aria-label={t.status === 'running' ? 'Pause' : 'Resume'} className={ROUND}>
              {t.status === 'running' ? <Pause size={20} /> : <Play size={20} className="translate-x-px" />}
            </button>
            <button onClick={onBreak && t.status === 'idle' ? skipBreak : requestEnd} aria-label={onBreak ? 'Skip break' : 'End session'} title={onBreak ? 'Skip break' : 'End session'} className={ROUND}>
              <Square size={17} />
            </button>
          </>
        )}
        <button onClick={() => toggleTrack('cafe', !cafeOn)} aria-label={cafeOn ? 'Mute café sounds' : 'Play café sounds'} title={cafeOn ? 'Mute café sounds' : 'Play café sounds'} className={ROUND}>
          {cafeOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
export default function Cafe() {
  const setUI = useUI((s) => s.set);
  const order = usePrefs((s) => s.cafeOrder);
  const setPrefs = usePrefs((s) => s.set);
  const profileName = useData((s) => s.data.profileName);
  const totalSessions = useData((s) => s.data.totalSessions);
  const [step, setStep] = useState<Step>(() => {
    const t = useTimer.getState();
    const busy = t.status !== 'idle' || t.mode !== 'focus';
    return busy ? (order ? 'table' : 'menu') : 'outside';
  });
  const [swapping, setSwapping] = useState(() => step === 'menu');
  const [draft, setDraftState] = useState<Draft>(() => ({
    drink: order?.drink ?? null,
    size: order?.size ?? 'tall',
    name: order?.name || (profileName !== 'Floww User' ? profileName : ''),
    intent: '',
    todoId: null,
  }));
  const setDraft = (p: Partial<Draft>) => setDraftState((d) => ({ ...d, ...p }));

  // Café sounds while you're inside (only if we were the ones who turned them on)
  const turnedOn = useRef(false);
  useEffect(() => {
    const p = usePrefs.getState();
    if (!p.mixer.on.cafe) {
      p.toggleTrack('cafe', true);
      turnedOn.current = true;
    }
    for (const src of CAFE_ART) new Image().src = src;
    return () => {
      if (turnedOn.current) usePrefs.getState().toggleTrack('cafe', false);
    };
  }, []);

  const leave = () => {
    const t = useTimer.getState();
    if (t.status === 'running') toast({ emoji: '☕', title: 'Your drink will be waiting', body: 'The timer keeps going. Come back any time.' });
    setUI({ mode: null });
  };

  const start = (o: CafeOrder, todoId: string | null) => {
    setPrefs({ cafeOrder: o });
    // the table (and the drink going down) only once this order's session really starts
    requestFocusFor(
      sizeOf(o.size).minutes,
      o.intent || `${sizeOf(o.size).name} ${drinkOf(o.drink).name}`,
      () => {
        setStep('table');
        return todoId;
      },
      '☕',
      'cafe',
    );
  };

  const pickDrink = () => {
    if (!draft.drink) return;
    if (!swapping) return setStep('size');
    const base = order ?? { size: draft.size, name: draft.name, intent: '', no: totalSessions + 1 };
    setPrefs({ cafeOrder: { ...base, drink: draft.drink } });
    setSwapping(false);
    setStep('table');
  };

  return (
    <div className={cn('fixed inset-0 z-[45] overflow-hidden bg-[#2b1a10]', INK)} role="dialog" aria-modal="true" aria-label="YouFloww Café">
      {step !== 'outside' && step !== 'table' && (
        <>
          <Art src="/img/cafe/interior.webp" className="scale-110 blur-[6px]" />
          <div className="absolute inset-0 bg-[#2b1a10]/30" />
        </>
      )}
      <AnimatePresence mode="wait">
        {step === 'outside' && <Outside key="outside" onEnter={() => setStep('menu')} onLeave={leave} />}
        {step === 'table' && order && (
          <Table
            key="table"
            order={order}
            onLeave={leave}
            onSwap={() => {
              setDraft({ drink: order.drink });
              setSwapping(true);
              setStep('menu');
            }}
            onNewOrder={() => {
              setSwapping(false);
              setDraft({ drink: order.drink, size: order.size, intent: '', todoId: null });
              setStep('menu');
            }}
            onAgain={() => start({ ...order, no: totalSessions + 1 }, null)}
          />
        )}
        {step !== 'outside' && step !== 'table' && (
          <motion.div key="order" className="absolute inset-0 grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AnimatePresence mode="wait">
              {step === 'menu' && (
                <Menu
                  key="menu"
                  draft={draft}
                  setDraft={setDraft}
                  swapping={swapping}
                  onNext={pickDrink}
                  onBack={() => {
                    if (swapping && order) {
                      setSwapping(false);
                      setStep('table');
                    } else if (swapping) leave();
                    else setStep('outside');
                  }}
                />
              )}
              {step === 'size' && <Size key="size" draft={draft} setDraft={setDraft} onNext={() => setStep('ticket')} onBack={() => setStep('menu')} />}
              {step === 'ticket' && <Ticket key="ticket" draft={draft} setDraft={setDraft} no={totalSessions + 1} onNext={() => setStep('intent')} onBack={() => setStep('size')} />}
              {step === 'intent' && (
                <Intent
                  key="intent"
                  draft={draft}
                  setDraft={setDraft}
                  onBack={() => setStep('ticket')}
                  onStart={() => start({ drink: draft.drink ?? 'latte', size: draft.size, name: draft.name.trim(), intent: draft.intent.trim(), no: totalSessions + 1 }, draft.todoId)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
