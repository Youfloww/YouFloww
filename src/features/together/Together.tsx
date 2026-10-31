/**
 * Study Hall: the full-screen VIEW of the live session. session.ts owns the connection, the seat and the group, so
 * closing this view (Back, Esc, Home, another world) never ends anything; only "Leave hall" / "Leave group" do.
 * The hall is a wide 2.5D room: pan it by dragging, wheel / trackpad, arrow keys or a swipe; props move in parallax,
 * people sit at tables y-sorted and scaled by depth. No WebGL, one rAF loop that only runs while the room moves.
 */
import { AnimatePresence, motion } from 'motion/react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { ArrowLeft, Bell, DoorOpen, LocateFixed, Pause, Play, Sprout, Volume2, VolumeX, Users } from 'lucide-react';
import { toast, useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { getFeatureData } from '@/lib/featureData';
import { cn, haptic, prefersReducedMotion } from '@/lib/utils';
import { formatClock } from '@/lib/time';
import { toggle } from '../timer/engine';
import { useTimerView } from '../timer/TimerOrb';
import { ANIMALS, animalImg, animalOf } from './animals';
import { EMPTY_DATA, type TogetherData } from './data';
import { PROPS, ROOM_W, SEATS, TABLES, type SeatSpot } from './hallLayout';
import { cleanCode, type Seat } from './rt';
import { enterHall, groupView, joinGroup, leaveHall, people, restore, saveProfile, serverNow, setWorking, unreadChat, unseenHall, useSession, type Fx } from './session';
import { useServerNow } from './useGroup';
import { GroupPanel } from './GroupPanel';
import { AskCard, HallInbox, HallPeople, LeaveButton, PersonMenu, RING, STATUS, openAskItems } from './ui';
import { isHallMuted, setHallMuted } from './sound';

const INK = 'text-[#3b2a20]';
const PAPER = 'bg-[#fffaf1] border-2 border-[#5b3f2c]/70 shadow-[0_30px_80px_-30px_rgb(60_30_10/0.6)]';
const BTN = 'pressable inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold disabled:opacity-40';
const DARK = cn(BTN, 'h-12 bg-[#3b2a20] px-6 text-[#fff6ea] hover:bg-[#4a3529]');
const LIGHT = cn(BTN, 'relative h-10 border-2 border-[#5b3f2c]/60 bg-[#fffaf1] px-3 text-sm text-[#3b2a20] hover:bg-[#fff1e0]');
const ART = '/img/together/hall';
/** foreground props move this much faster than the room */
const PAR = 1.35;
const BADGE = { f: '🎯', b: '☕', p: '⏸️', i: '' } as const;

/* ------------------------------------------------------------------ */
/* Panning                                                             */
/* ------------------------------------------------------------------ */
class Pan {
  cur = 0;
  target = 0;
  max = 0;
  raf = 0;
  room: HTMLElement | null = null;
  fg: HTMLElement | null = null;
  calm = prefersReducedMotion();
  clamp = (x: number) => Math.max(0, Math.min(this.max, x));
  apply() {
    if (this.room) this.room.style.transform = `translate3d(${-this.cur}px,0,0)`;
    if (this.fg) this.fg.style.transform = `translate3d(${-this.cur * PAR}px,0,0)`;
  }
  tick = () => {
    const d = this.target - this.cur;
    if (Math.abs(d) < 0.5) {
      this.cur = this.target;
      this.raf = 0;
      this.apply();
      return;
    }
    this.cur += d * 0.17;
    this.apply();
    this.raf = requestAnimationFrame(this.tick);
  };
  go(x: number, instant = false) {
    this.target = this.clamp(x);
    if (instant || this.calm) {
      this.stop();
      this.cur = this.target;
      this.apply();
    } else if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

interface SceneApi {
  findMe: () => void;
}

/* ------------------------------------------------------------------ */
/* One person at a table                                               */
/* ------------------------------------------------------------------ */
function seatProgress(s: Seat, now: number) {
  if (s.s === 'f' || s.s === 'b') return s.d > 0 ? Math.min(1, Math.max(0, 1 - (s.e - now) / s.d)) : 0;
  if (s.s === 'p') return s.d > 0 ? Math.min(1, Math.max(0, 1 - s.e / s.d)) : 0;
  return 0;
}

const Person = memo(function Person({
  seat,
  spot,
  H,
  now,
  mine,
  inGroup,
  total,
  fx,
  toName,
  onPick,
}: {
  seat: Seat;
  spot: SeatSpot;
  H: number;
  now: number;
  mine: boolean;
  inGroup: boolean;
  total: number;
  fx: Fx[];
  toName: (uid: string) => string;
  onPick: (s: Seat) => void;
}) {
  const size = spot.size * H;
  const p = seatProgress(seat, now);
  const left = seat.s === 'p' ? seat.e : Math.max(0, seat.e - now);
  const font = Math.max(10, Math.min(13.5, size * 0.135));
  const bubble = fx.filter((f) => f.kind === 'say' && f.uid === seat.uid).at(-1);
  const flies = fx.filter((f) => f.kind === 'kudos' && f.to === seat.uid);
  return (
    <motion.div
      className="absolute"
      style={{ left: spot.x * H - size / 2, top: spot.y * H - size / 2, width: size, height: size, zIndex: spot.row * 10 + 1 }}
      initial={{ opacity: 0, scale: 0.6, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <button
        type="button"
        onClick={() => onPick(seat)}
        aria-label={mine ? `You, ${seat.n}, ${STATUS[seat.s]}` : `${seat.n}, ${STATUS[seat.s]}${seat.w ? `, working on ${seat.w}` : ''}. Tap to say something`}
        className="group relative block size-full rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[#e07a5f]/70"
      >
        <span className="tg-bob absolute inset-0" style={{ animationDelay: `${-(seat.i % 7) * 0.53}s` }}>
          <span
            className="absolute inset-[7%] rounded-full shadow-[0_8px_14px_-6px_rgb(60_30_10/0.55)] transition-transform group-hover:scale-105"
            style={{ background: `radial-gradient(circle at 50% 35%, #fffaf1, ${animalOf(seat.a).tint})` }}
          />
          <img src={animalImg(seat.a)} alt="" draggable={false} decoding="async" className="absolute inset-[11%] size-[78%] object-contain transition-transform group-hover:scale-105" />
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="#5b3f2c" strokeOpacity={seat.s === 'i' ? 0.14 : 0.22} strokeWidth="3.4" strokeDasharray={seat.s === 'i' ? '2 4' : undefined} />
            {seat.s !== 'i' && <circle cx="50" cy="50" r="46" fill="none" stroke={RING[seat.s]} strokeWidth="5.5" strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0.012, p)} 1`} style={{ transition: 'stroke-dasharray 1s linear' }} />}
          </svg>
          {total > 0 && (
            <span className="absolute -top-[4%] -left-[6%] rounded-full bg-[#e07a5f] px-1.5 font-extrabold text-white shadow-sm" style={{ fontSize: font * 0.85, lineHeight: 1.5 }}>
              🙌{total}
            </span>
          )}
        </span>
      </button>
      {/* name above the head (the table covers the chest) */}
      <span
        className={cn('pointer-events-none absolute bottom-[calc(100%-2px)] left-1/2 flex max-w-[190%] -translate-x-1/2 items-center gap-1 truncate rounded-full border border-[#5b3f2c]/35 px-2 font-extrabold whitespace-nowrap shadow-sm', INK, mine ? 'bg-[#ffe6d2]' : 'bg-[#fffaf1]/95')}
        style={{ fontSize: font, lineHeight: 1.55 }}
      >
        {inGroup && <span title="In your group">🌱</span>}
        <span className="truncate">
          {seat.n}
          {mine && ' (you)'}
        </span>
        {seat.s !== 'i' && (
          <span className="tabular-nums opacity-70">
            {BADGE[seat.s]}
            {seat.s === 'p' ? '' : `${Math.max(1, Math.ceil(left / 60000))}m`}
          </span>
        )}
      </span>
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            className={cn('pointer-events-none absolute left-1/2 w-max max-w-[200px] -translate-x-1/2 rounded-2xl border-2 border-[#5b3f2c]/60 bg-[#fffaf1] px-3 py-1.5 text-center shadow-[0_10px_24px_-10px_rgb(60_30_10/0.6)]', INK)}
            style={{ bottom: `calc(100% + ${font * 1.9}px)`, zIndex: 60 }}
            initial={{ opacity: 0, y: 8, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            <p className="text-[13px] leading-tight font-extrabold">{bubble.text}</p>
            <p className="text-[10.5px] font-bold opacity-60">to {toName(bubble.to)}</p>
            <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-[#5b3f2c]/60 bg-[#fffaf1]" />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flies.map((f) => (
          <motion.span
            key={f.id}
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
            style={{ fontSize: size * 0.42, zIndex: 61 }}
            initial={{ y: 0, opacity: 0, scale: 0.4 }}
            animate={{ y: -size * 0.9, opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1, 1] }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
          >
            {f.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.div>
  );
});

/* ------------------------------------------------------------------ */
/* The room                                                            */
/* ------------------------------------------------------------------ */
function HallScene({ list, uid, onPick, api }: { list: Seat[]; uid: string; onPick: (s: Seat) => void; api: MutableRefObject<SceneApi | null> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const roomEl = useRef<HTMLDivElement>(null);
  const fgEl = useRef<HTMLDivElement>(null);
  const [pan] = useState(() => new Pan());
  const [box, setBox] = useState(() => ({ w: innerWidth, h: innerHeight }));
  const now = useServerNow(1000);
  const fx = useSession((s) => s.fx);
  const kudos = useSession((s) => s.kudos);
  const group = useSession((s) => s.group);

  const H = Math.max(box.h, box.w / ROOM_W);
  const W = ROOM_W * H;
  const top = Math.min(0, (box.h - H) * 0.8);
  const max = Math.max(0, W - box.w);
  const fgW = max * PAR + box.w;
  const mine = list.find((x) => x.uid === uid);

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // keep the view on the same spot when the size changes; start centred on my seat
  const prevH = useRef(0);
  useLayoutEffect(() => {
    pan.room = roomEl.current;
    pan.fg = fgEl.current;
    pan.max = max;
    if (!prevH.current) pan.go((mine ? SEATS[mine.i]?.x ?? ROOM_W / 2 : ROOM_W / 2) * H - box.w / 2, true);
    else {
      const r = H / prevH.current;
      pan.cur *= r;
      pan.go(pan.target * r, true);
    }
    prevH.current = H;
  }, [H, max, box.w]); // eslint-disable-line react-hooks/exhaustive-deps

  api.current = {
    findMe: () => {
      const spot = mine && SEATS[mine.i];
      if (spot) pan.go(spot.x * H - box.w / 2);
    },
  };

  // drag / swipe (with a little inertia), wheel / trackpad, arrow keys
  useEffect(() => {
    const el = wrap.current!;
    let down: { x: number; cur: number; id: number; drag: boolean; lx: number; lt: number; v: number } | null = null;
    let dragged = 0;
    const pd = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pan.stop();
      pan.target = pan.cur;
      down = { x: e.clientX, cur: pan.cur, id: e.pointerId, drag: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
    };
    const pm = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      if (!down.drag) {
        if (Math.abs(dx) < 7) return;
        down.drag = true;
        el.setPointerCapture(e.pointerId);
        el.dataset.drag = '1';
      }
      const dt = Math.max(1, e.timeStamp - down.lt);
      down.v = 0.75 * ((e.clientX - down.lx) / dt) + 0.25 * down.v;
      down.lx = e.clientX;
      down.lt = e.timeStamp;
      pan.go(down.cur - dx, true);
    };
    const pu = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      if (down.drag) {
        dragged = performance.now();
        delete el.dataset.drag;
        if (e.timeStamp - down.lt < 90 && Math.abs(down.v) > 0.1) pan.go(pan.cur - down.v * 280);
      }
      down = null;
    };
    const click = (e: MouseEvent) => {
      if (performance.now() - dragged < 120) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const wheel = (e: WheelEvent) => {
      const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const d = (horiz ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 32 : 1);
      if (!d) return;
      e.preventDefault();
      pan.go(pan.target + d * (horiz ? 1 : 1.25));
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      e.preventDefault();
      pan.go(pan.target + (e.key === 'ArrowLeft' ? -1 : 1) * Math.max(160, el.clientWidth * 0.4));
    };
    el.addEventListener('pointerdown', pd);
    el.addEventListener('pointermove', pm);
    el.addEventListener('pointerup', pu);
    el.addEventListener('pointercancel', pu);
    el.addEventListener('click', click, true);
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    return () => {
      pan.stop();
      el.removeEventListener('pointerdown', pd);
      el.removeEventListener('pointermove', pm);
      el.removeEventListener('pointerup', pu);
      el.removeEventListener('pointercancel', pu);
      el.removeEventListener('click', click, true);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
    };
  }, [pan]);

  const totals = useMemo(() => {
    const m = new Map<string, number>();
    kudos.forEach((k) => m.set(k.to, (m.get(k.to) ?? 0) + k.c));
    return m;
  }, [kudos]);
  const inGroup = useMemo(() => new Set(group?.members.map((m) => m.uid) ?? []), [group]);
  const names = useRef(list);
  names.current = list;
  const [toName] = useState(() => (id: string) => (id === useSession.getState().uid ? 'you' : (names.current.find((x) => x.uid === id)?.n ?? 'a friend')));

  return (
    <div
      ref={wrap}
      role="region"
      aria-label="The Study Hall. Drag, scroll or use the left and right arrow keys to look around."
      className="absolute inset-0 isolate cursor-grab touch-none overflow-hidden select-none data-[drag]:cursor-grabbing"
    >
      <div ref={roomEl} className="absolute left-0 will-change-transform" style={{ top, width: W, height: H }}>
        <img src={`${ART}/room.webp`} alt="" draggable={false} decoding="async" className="absolute inset-0 size-full" />
        {TABLES.map((t, i) => (
          <img
            key={i}
            src={`${ART}/table.webp`}
            alt=""
            draggable={false}
            decoding="async"
            className="pointer-events-none absolute"
            style={{ left: (t.x - t.w / 2) * H, top: t.top * H, width: t.w * H, height: t.h * H, zIndex: t.row * 10 + 2, transform: t.flip ? 'scaleX(-1)' : undefined }}
          />
        ))}
        <AnimatePresence>
          {list.map((seat) => {
            const spot = SEATS[seat.i];
            return spot ? (
              <Person
                key={seat.uid}
                seat={seat}
                spot={spot}
                H={H}
                now={now}
                mine={seat.uid === uid}
                inGroup={seat.uid !== uid && inGroup.has(seat.uid)}
                total={totals.get(seat.uid) ?? 0}
                fx={fx}
                toName={toName}
                onPick={onPick}
              />
            ) : null;
          })}
        </AnimatePresence>
      </div>
      <div ref={fgEl} aria-hidden className="pointer-events-none absolute left-0 z-[70] will-change-transform" style={{ top, width: fgW, height: H }}>
        {PROPS.map((p, i) => (
          <img
            key={i}
            src={`${ART}/${p.img}.webp`}
            alt=""
            draggable={false}
            decoding="async"
            loading="lazy"
            className="absolute drop-shadow-[0_10px_18px_rgb(60_30_10/0.35)]"
            style={{ left: p.x * fgW, bottom: -p.drop * H, height: p.h * H }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[71] h-28 bg-gradient-to-t from-[#2a1b14]/45 to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */
function Enter({ invite, onGo, onGroupOnly }: { invite: string; onGo: (p: { name: string; animal: number; working: string }) => void; onGroupOnly: (p: { name: string; animal: number; working: string }) => void }) {
  const saved = getFeatureData<TogetherData>('together', EMPTY_DATA);
  const authUser = useData((s) => s.user);
  const profileName = useData((s) => s.data.profileName);
  const fallback = authUser?.name?.split(' ')[0] || (profileName && profileName !== 'Floww User' ? profileName : '');
  const [name, setName] = useState(saved.name || fallback || '');
  const [animal, setAnimal] = useState(saved.animal || 0);
  const [working, setW] = useState(saved.working || '');
  const p = { name, animal, working };
  return (
    <motion.div className="absolute inset-0 grid place-items-center overflow-y-auto p-4 pt-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onGo(p);
        }}
        initial={{ y: 24, opacity: 0, rotate: -1 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className={cn('relative w-full max-w-[520px] rounded-[28px] p-5 sm:p-7', PAPER, INK)}
      >
        <div className="text-center">
          <p className="text-3xl">🫶</p>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Welcome to the Study Hall</h2>
          <p className="text-sm font-bold opacity-70">Study quietly beside real people. You stay seated while you use the rest of YouFloww.</p>
          {invite && <p className="mt-2 rounded-xl bg-[#dcebd0] px-3 py-1.5 text-sm font-extrabold text-[#3f5a2d]">🌱 You were invited to Study Together group {invite}.</p>}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Choose your animal">
          {ANIMALS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={animal === i}
              aria-label={a.name}
              onClick={() => {
                haptic(6);
                setAnimal(i);
              }}
              className={cn('pressable flex flex-col items-center rounded-2xl p-1.5 transition-colors', animal === i ? 'bg-[#ffe6d2] ring-2 ring-[#e07a5f]' : 'hover:bg-[#fff1e0]')}
            >
              <motion.img src={animalImg(i)} alt="" draggable={false} animate={{ scale: animal === i ? 1.12 : 1, y: animal === i ? -3 : 0 }} className="size-14 object-contain sm:size-16" />
              <span className="text-[11px] font-extrabold">{a.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-extrabold tracking-wide uppercase opacity-70">
            Your name
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} maxLength={20} placeholder="Mochi" className="mt-1 h-11 w-full rounded-2xl border-2 border-[#5b3f2c]/40 bg-white px-4 text-base font-bold normal-case outline-none focus:border-[#e07a5f]" />
          </label>
          <label className="block text-xs font-extrabold tracking-wide uppercase opacity-70">
            Working on (optional)
            <input value={working} onChange={(e) => setW(e.target.value.slice(0, 40))} maxLength={40} placeholder="Organic chemistry" className="mt-1 h-11 w-full rounded-2xl border-2 border-[#5b3f2c]/40 bg-white px-4 text-base font-bold normal-case outline-none focus:border-[#e07a5f]" />
          </label>
        </div>
        <button type="submit" className={cn(DARK, 'mt-5 w-full')} disabled={!name.trim()}>
          Take a seat 🪑
        </button>
        {invite && (
          <button type="button" disabled={!name.trim()} onClick={() => onGroupOnly(p)} className={cn(LIGHT, 'mt-2 w-full')}>
            <Sprout size={16} /> Only join group {invite}
          </button>
        )}
      </motion.form>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Receiving kudos                                                     */
/* ------------------------------------------------------------------ */
function Burst({ emoji, from, said, onDone }: { emoji: string; from: string; said: string; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  // one timer for the burst's whole life: the hall re-renders every second, which must not restart it
  useEffect(() => {
    const id = setTimeout(() => done.current(), 3200);
    return () => clearTimeout(id);
  }, []);
  const bits = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2 + Math.random() * 0.3, d: 120 + Math.random() * 140, e: ['✨', '💖', emoji, '⭐', '🌸'][i % 5], s: 0.8 + Math.random() * 0.8, r: (Math.random() - 0.5) * 220 })),
    [emoji],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
      {[0, 0.14, 0.3].map((d) => (
        <motion.span key={d} className="absolute size-40 rounded-full border-4 border-[#e07a5f]" initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 1.3, delay: d, ease: [0.2, 0.7, 0.3, 1] }} />
      ))}
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: [0, 1.5, 1.1], rotate: [-20, 8, 0] }} transition={{ duration: 0.7, ease: 'easeOut' }} className="text-[100px] leading-none drop-shadow-[0_10px_20px_rgb(60_30_10/0.35)]">
        {emoji}
      </motion.div>
      {bits.map((b, i) => (
        <motion.span key={i} className="absolute text-3xl" initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }} animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d, opacity: [0, 1, 0], scale: b.s, rotate: b.r }} transition={{ duration: 1.5, ease: 'easeOut' }}>
          {b.e}
        </motion.span>
      ))}
      <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 20 }} className={cn('absolute bottom-[28%] mx-4 rounded-full px-5 py-2.5 text-center font-display text-lg font-semibold shadow-lg', PAPER, INK)}>
        {from} {said}
      </motion.p>
    </div>
  );
}

const Dot = ({ n }: { n: number }) =>
  n > 0 ? <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#e07a5f] px-1 text-[11px] font-extrabold text-white shadow">{n > 9 ? '9+' : n}</span> : null;

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */
export default function Together() {
  const s = useSession();
  const now = useServerNow(1000);
  const tv = useTimerView();
  const [panel, setPanel] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [muted, setMuted] = useState(isHallMuted);
  const [invite, setInvite] = useState('');
  const [working, setW] = useState(() => getFeatureData<TogetherData>('together', EMPTY_DATA).working || '');
  const [burst, setBurst] = useState<{ id: string; emoji: string; from: string; said: string } | null>(null);
  const [openedAt] = useState(() => serverNow());
  const api = useRef<SceneApi | null>(null);
  const close = () => useUI.getState().set({ mode: null });

  // on open: rejoin after a reload, pick up an invite link (?together=CODE)
  useEffect(() => {
    void restore();
    let stored = '';
    try {
      stored = sessionStorage.getItem('together:invite') ?? '';
      sessionStorage.removeItem('together:invite');
    } catch {
      /* private mode */
    }
    const code = cleanCode(new URLSearchParams(location.search).get('together') || stored);
    if (code.length !== 5) return;
    try {
      const u = new URL(location.href);
      u.searchParams.delete('together');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {
      /* ignore */
    }
    const st = useSession.getState();
    if (st.code === code) setPanel(true);
    else if (st.hall === 'in') void joinGroup(code).then(() => setPanel(true));
    else setInvite(code);
  }, []);

  // the tray asked for the group view
  useEffect(() => {
    if (!s.focus) return;
    if (s.focus === 'group') setPanel(true);
    useSession.setState({ focus: null, tray: false });
  }, [s.focus]);

  // Escape closes the top-most popover first (the shell closes the whole view otherwise; that never leaves)
  useEffect(() => {
    if (!pick && !inbox && !panel) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      // the closing popover may still hold the focus while it animates out: the next Escape must reach the shell
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (pick) setPick(null);
      else if (inbox) setInbox(false);
      else setPanel(false);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [pick, inbox, panel]);

  // a big burst when someone cheers for me while the hall is open
  const newest = s.items.find((i) => i.kind === 'kudos');
  useEffect(() => {
    if (!newest || newest.t <= openedAt) return;
    const sp = newest.text.indexOf(' ');
    setBurst({ id: newest.id, emoji: newest.text.slice(0, sp), from: newest.name, said: newest.text.slice(sp + 1) });
  }, [newest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const seated = s.hall === 'in';
  const list = seated ? people(s, now) : [];
  const g = groupView(s, now);
  const asks = openAskItems(s.items, now);
  const chatN = unreadChat(s);
  const hallN = unseenHall(s);
  const pickSeat = pick ? list.find((x) => x.uid === pick) : undefined;

  const go = async (p: { name: string; animal: number; working: string }, google = false) => {
    saveProfile(p);
    setW(p.working);
    const ok = await enterHall({ google });
    if (ok && invite) {
      const code = invite;
      setInvite('');
      if (await joinGroup(code)) setPanel(true);
    }
  };
  const groupOnly = async (p: { name: string; animal: number; working: string }) => {
    saveProfile(p);
    const code = invite;
    setInvite('');
    setPanel(true);
    await joinGroup(code);
  };
  const onPick = (seat: Seat) => {
    if (seat.uid === s.uid) (document.getElementById('tg-working') as HTMLInputElement | null)?.focus();
    else {
      haptic(6);
      setPick(seat.uid);
    }
  };
  const groupChip = g.phase === 'running' ? formatClock(g.remaining) : g.phase === 'lobby' ? s.code : g.phase === 'bloom' ? 'Bloomed' : g.phase === 'joining' ? '…' : 'Study Together';

  return (
    <div className="fixed inset-0 z-[45] overflow-hidden bg-[#2a1b14]">
      <style>{'@keyframes tg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3%)}}.tg-bob{animation:tg-bob 3.6s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.tg-bob{animation:none}}'}</style>

      {seated ? (
        <HallScene list={list} uid={s.uid} onPick={onPick} api={api} />
      ) : (
        <>
          <img src={`${ART}/room.webp`} alt="" className="absolute inset-0 size-full scale-105 object-cover blur-[3px] brightness-90" draggable={false} />
          <AnimatePresence mode="wait">
            {s.hall === 'joining' ? (
              <motion.div key="wait" className="absolute inset-0 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} className={cn('rounded-[26px] px-8 py-6 text-center', PAPER, INK)}>
                  <img src={animalImg(getFeatureData<TogetherData>('together', EMPTY_DATA).animal)} alt="" className="mx-auto size-20 object-contain" />
                  <p className="mt-2 font-display text-xl font-semibold">Finding you a seat…</p>
                </motion.div>
              </motion.div>
            ) : s.err ? (
              <motion.div key="err" className="absolute inset-0 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className={cn('w-full max-w-[420px] rounded-[26px] p-6 text-center', PAPER, INK)} role="alert">
                  <p className="text-4xl">🍵</p>
                  <p className="mt-2 font-display text-xl font-semibold">The hall is not reachable</p>
                  <p className="mt-1 text-sm font-bold opacity-75">{s.err.msg}</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button className={DARK} onClick={() => void enterHall({ google: s.err?.kind === 'signin' })}>
                      {s.err.kind === 'signin' ? 'Continue with Google' : 'Try again'}
                    </button>
                    <button className={LIGHT} onClick={() => useSession.setState({ err: null })}>
                      Change my seat
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <Enter key="enter" invite={invite} onGo={(p) => void go(p)} onGroupOnly={(p) => void groupOnly(p)} />
            )}
          </AnimatePresence>
        </>
      )}

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-1.5 p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex gap-1.5">
          <button onClick={close} aria-label="Back to YouFloww (you stay in the hall)" title="Back to YouFloww. You stay in the hall." className={LIGHT}>
            <ArrowLeft size={16} /> <span className="max-sm:hidden">Back</span>
          </button>
          {seated && (
            <LeaveButton
              className={LIGHT}
              label={
                <>
                  <DoorOpen size={16} /> <span className="max-sm:hidden">Leave hall</span>
                </>
              }
              onLeave={() => {
                void leaveHall();
                close();
                toast({ emoji: '🚪', title: 'You left the Study Hall', ms: 2500 });
              }}
            />
          )}
        </div>
        {seated && (
          <div className={cn('pointer-events-auto flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold whitespace-nowrap', PAPER, INK)}>
            <Users size={15} /> {list.length}
            <span className="max-sm:hidden">{list.length === 1 ? 'here · just you so far' : 'here'}</span>
            <span className="opacity-50 max-[480px]:hidden">· Hall {s.room.slice(1)}</span>
          </div>
        )}
        <div className="pointer-events-auto flex gap-1.5">
          {seated && (
            <>
              <button onClick={() => api.current?.findMe()} aria-label="Find me" title="Find me" className={LIGHT}>
                <LocateFixed size={16} /> <span className="max-lg:hidden">Find me</span>
              </button>
              <button onClick={() => setInbox((v) => !v)} aria-label={`Messages${hallN ? `, ${hallN} new` : ''}`} aria-expanded={inbox} className={cn(LIGHT, inbox && 'bg-[#ffe6d2]')}>
                <Bell size={16} />
                <Dot n={hallN} />
              </button>
              <button
                onClick={() => {
                  setHallMuted(!muted);
                  setMuted(!muted);
                }}
                aria-label={muted ? 'Unmute hall sounds' : 'Mute hall sounds'}
                className={cn(LIGHT, 'max-[400px]:hidden')}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </>
          )}
          <button onClick={() => setPanel((p) => !p)} aria-label={`Study Together${chatN ? `, ${chatN} unread` : ''}`} aria-expanded={panel} className={cn(LIGHT, g.phase === 'running' && 'bg-[#dcebd0]')}>
            <Sprout size={16} />
            <span className={cn('tabular-nums whitespace-nowrap', g.phase === 'none' || g.phase === 'closed' ? 'max-sm:hidden' : '')}>{groupChip}</span>
            <Dot n={chatN} />
          </button>
        </div>
      </div>

      {/* "study together?" asks for me */}
      <div className="pointer-events-none absolute top-[68px] left-1/2 z-[26] w-[min(360px,calc(100vw-24px))] -translate-x-1/2 space-y-2">
        <AnimatePresence>
          {asks.map((i) => (
            <motion.div key={i.id} layout initial={{ opacity: 0, y: -12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={cn('pointer-events-auto rounded-[20px] p-1.5', PAPER, INK)}>
              <AskCard item={i} tone="paper" now={now} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* bottom bar: my seat */}
      {seated && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className={cn('pointer-events-auto flex w-full max-w-[640px] items-center gap-2 rounded-[24px] p-2 pl-2.5', PAPER, INK)}>
            <img src={animalImg(getFeatureData<TogetherData>('together', EMPTY_DATA).animal)} alt="" className="size-10 shrink-0 object-contain" />
            <input
              id="tg-working"
              value={working}
              onChange={(e) => {
                setW(e.target.value.slice(0, 40));
                setWorking(e.target.value);
              }}
              maxLength={40}
              placeholder="What are you working on?"
              aria-label="What are you working on?"
              className="h-10 min-w-0 flex-1 rounded-xl bg-[#fff1e0] px-3 text-sm font-bold outline-none placeholder:opacity-50 focus:ring-2 focus:ring-[#e07a5f]"
            />
            <span className="font-display text-lg font-semibold tabular-nums">{tv.clock}</span>
            <button onClick={toggle} aria-label={tv.status === 'running' ? 'Pause' : 'Start'} className={cn(BTN, 'size-10 bg-[#3b2a20] text-[#fff6ea]')}>
              {tv.status === 'running' ? <Pause size={18} /> : <Play size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* messages + people */}
      <AnimatePresence>
        {inbox && seated && (
          <>
            <button aria-label="Close messages" className="absolute inset-0 z-[29] cursor-default" onClick={() => setInbox(false)} />
            <motion.div
              role="dialog"
              aria-label="Messages and people"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ transformOrigin: 'top right' }}
              className={cn('absolute top-[64px] right-3 z-30 flex max-h-[min(70dvh,560px)] w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-[22px] p-3', PAPER, INK)}
            >
              <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain">
                <section>
                  <p className="mb-1.5 text-[11px] font-extrabold tracking-wide uppercase opacity-60">Messages</p>
                  <HallInbox tone="paper" withAsks={false} />
                </section>
                <section>
                  <p className="mb-1.5 text-[11px] font-extrabold tracking-wide uppercase opacity-60">People here · {list.length}</p>
                  <HallPeople
                    tone="paper"
                    onPick={(p) => {
                      setInbox(false);
                      setPick(p.uid);
                    }}
                  />
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* person menu */}
      <AnimatePresence>
        {pickSeat && (
          <motion.div className="absolute inset-0 z-30 grid place-items-end justify-items-center bg-black/10 p-3 pb-24 sm:place-items-center sm:pb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPick(null)}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, scale: 0.94 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className={cn('w-full max-w-[380px] rounded-[26px] p-4', PAPER, INK)}
              role="dialog"
              aria-label={`Say something to ${pickSeat.n}`}
            >
              <PersonMenu seat={pickSeat} tone="paper" onDone={() => setPick(null)} />
              <button onClick={() => setPick(null)} className="pressable mt-2 w-full rounded-xl py-1.5 text-sm font-extrabold opacity-60 hover:opacity-100">
                close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GroupPanel open={panel} onClose={() => setPanel(false)} />
      <AnimatePresence>{burst && <Burst key={burst.id} emoji={burst.emoji} from={burst.from} said={burst.said} onDone={() => setBurst(null)} />}</AnimatePresence>
    </div>
  );
}
