/**
 * Study Hall: a shared, real-time cozy room. Loaded only when the mode opens; Firebase Realtime Database is
 * imported dynamically in rt.ts and everything is torn down (listeners, onDisconnect, connection) on unmount.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DoorOpen, Pause, Play, Sprout, Volume2, VolumeX, Users } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { cn, haptic, prefersReducedMotion } from '@/lib/utils';
import { formatClock } from '@/lib/time';
import { updateFeatureData, useFeatureData } from '@/lib/featureData';
import { toggle } from '../timer/engine';
import { useTimerView } from '../timer/TimerOrb';
import { ANIMALS, KUDOS, SEATS, animalImg, animalOf, type KudosKind } from './animals';
import { AuthNeeded, cleanCode, isStale, joinHall, openConn, type Conn, type Hall, type KudosRec, type Seat } from './rt';
import { useGroup } from './useGroup';
import { GroupPanel } from './GroupPanel';
import { EMPTY_DATA, type TogetherData } from './data';
import { hallSound, setHallMuted } from './sound';

const INK = 'text-[#3b2a20]';
const PAPER = 'bg-[#fffaf1] border-2 border-[#5b3f2c]/70 shadow-[0_30px_80px_-30px_rgb(60_30_10/0.6)]';
const BTN = 'pressable inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold disabled:opacity-40';
const DARK = cn(BTN, 'h-12 bg-[#3b2a20] px-6 text-[#fff6ea] hover:bg-[#4a3529]');
const LIGHT = cn(BTN, 'h-10 border-2 border-[#5b3f2c]/60 bg-[#fffaf1] px-3.5 text-sm text-[#3b2a20] hover:bg-[#fff1e0]');
const RING = { f: '#e07a5f', b: '#7fa66a', p: '#b9a89a', i: 'transparent' } as const;

type Phase = 'enter' | 'connecting' | 'hall' | 'error';

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, ms);
    const vis = () => !document.hidden && setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ms]);
  return now;
}

function useWide() {
  const [w, setW] = useState(() => matchMedia('(min-width: 820px) and (min-aspect-ratio: 5/4)').matches);
  useEffect(() => {
    const q = matchMedia('(min-width: 820px) and (min-aspect-ratio: 5/4)');
    const f = () => setW(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return w;
}

/* ------------------------------------------------------------------ */
/* One person                                                          */
/* ------------------------------------------------------------------ */
function seatProgress(s: Seat, serverNow: number) {
  if (s.s === 'f' || s.s === 'b') return s.d > 0 ? Math.min(1, Math.max(0, 1 - (s.e - serverNow) / s.d)) : 0;
  if (s.s === 'p') return s.d > 0 ? Math.min(1, Math.max(0, 1 - s.e / s.d)) : 0;
  return 0;
}
const seatLeft = (s: Seat, serverNow: number) => (s.s === 'p' ? s.e : Math.max(0, s.e - serverNow));
const STATUS = { f: 'focusing', b: 'on a break', p: 'paused', i: 'relaxing' } as const;
const BADGE = { f: '🎯', b: '☕', p: '⏸️', i: '' } as const;

function Avatar({
  seat,
  serverNow,
  mine,
  total,
  inMyGroup,
  flies,
  onTap,
  index,
  big,
}: {
  seat: Seat;
  serverNow: number;
  mine: boolean;
  total: number;
  inMyGroup: boolean;
  flies: { id: number; emoji: string }[];
  onTap: () => void;
  index: number;
  big?: boolean;
}) {
  const a = animalOf(seat.a);
  const p = seatProgress(seat, serverNow);
  const left = seatLeft(seat, serverNow);
  const calm = useMemo(() => prefersReducedMotion(), []);
  return (
    <motion.button
      type="button"
      onClick={onTap}
      aria-label={mine ? `You, ${seat.n}, ${STATUS[seat.s]}` : `${seat.n}, ${STATUS[seat.s]}. Tap to cheer them on`}
      className="group relative flex w-full flex-col items-center outline-none"
      initial={{ opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, y: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileTap={{ scale: 0.94 }}
    >
      <motion.div
        className="relative aspect-square w-full"
        animate={calm || seat.s === 'i' ? undefined : { y: [0, -2.5, 0] }}
        transition={{ duration: 3.2 + (index % 4) * 0.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-[7%] rounded-full shadow-[0_8px_14px_-6px_rgb(60_30_10/0.55)] ring-0 transition-shadow group-hover:shadow-[0_10px_18px_-4px_rgb(60_30_10/0.6)]" style={{ background: `radial-gradient(circle at 50% 35%, #fffaf1, ${a.tint})` }} />
        <img src={animalImg(seat.a)} alt="" draggable={false} decoding="async" className="absolute inset-[11%] size-[78%] object-contain select-none" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#5b3f2c" strokeOpacity={seat.s === 'i' ? 0.12 : 0.2} strokeWidth="3.4" strokeDasharray={seat.s === 'i' ? '2 4' : undefined} />
          {seat.s !== 'i' && <circle cx="50" cy="50" r="46" fill="none" stroke={RING[seat.s]} strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0.012, p)} 1`} style={{ transition: 'stroke-dasharray 1s linear' }} />}
        </svg>
        {seat.s !== 'i' && (
          <span className="absolute -right-[4%] -bottom-[2%] rounded-full border border-[#5b3f2c]/40 bg-[#fffaf1] px-[6%] py-[1.5%] text-[0.62em] leading-tight font-extrabold text-[#3b2a20] shadow-sm" style={{ fontSize: big ? 12 : 'clamp(8px,1.05cqw,13px)' }}>
            {BADGE[seat.s]} {seat.s === 'p' ? 'paused' : `${Math.ceil(left / 60000)}m`}
          </span>
        )}
        {total > 0 && (
          <span className="absolute -top-[2%] -left-[2%] rounded-full bg-[#e07a5f] px-[7%] py-[1%] font-extrabold text-white shadow-sm" style={{ fontSize: big ? 12 : 'clamp(8px,1.05cqw,13px)' }}>
            🙌 {total}
          </span>
        )}
        {inMyGroup && <span className="absolute -top-[3%] -right-[2%] text-[1.1em]" title="In your focus group">🌱</span>}
        <AnimatePresence>
          {flies.map((f) => (
            <motion.span key={f.id} className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 text-[2em]" initial={{ y: 0, opacity: 0, scale: 0.4 }} animate={{ y: -70, opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1, 1] }} transition={{ duration: 1.8, ease: 'easeOut' }}>
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </motion.div>
      <span className={cn('mt-[3%] max-w-full truncate rounded-full border border-[#5b3f2c]/40 bg-[#fffaf1]/95 px-[9%] py-[0.5%] font-extrabold shadow-sm', INK, mine && 'bg-[#ffe6d2]')} style={{ fontSize: big ? 13 : 'clamp(9px,1.2cqw,15px)', lineHeight: 1.5 }}>
        {seat.n}
        {mine && ' (you)'}
      </span>
      {seat.w && (
        <span className="mt-[1.5%] max-w-[170%] truncate rounded-full bg-[#3b2a20]/80 px-[8%] py-[0.5%] font-bold text-[#fff6ea]" style={{ fontSize: big ? 11 : 'clamp(8px,1cqw,13px)' }}>
          {seat.w}
        </span>
      )}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */
function Enter({
  name,
  setName,
  animal,
  setAnimal,
  working,
  setWorking,
  onGo,
  onLeave,
  invite,
}: {
  name: string;
  setName: (s: string) => void;
  animal: number;
  setAnimal: (n: number) => void;
  working: string;
  setWorking: (s: string) => void;
  onGo: () => void;
  onLeave: () => void;
  invite: string | null;
}) {
  return (
    <motion.div className="absolute inset-0 grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        onSubmit={(e) => {
          e.preventDefault();
          onGo();
        }}
        initial={{ y: 24, opacity: 0, rotate: -1 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className={cn('relative w-full max-w-[520px] rounded-[28px] p-5 sm:p-7', PAPER, INK)}
      >
        <div className="text-center">
          <p className="text-3xl">🫶</p>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Welcome to the Study Hall</h2>
          <p className="text-sm font-bold opacity-70">Study quietly beside real people. Pick who you will be today.</p>
          {invite && <p className="mt-2 rounded-xl bg-[#dcebd0] px-3 py-1.5 text-sm font-extrabold text-[#3f5a2d]">🌱 You were invited to focus group {invite}. Take a seat to join.</p>}
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
            <input value={working} onChange={(e) => setWorking(e.target.value.slice(0, 40))} maxLength={40} placeholder="Organic chemistry" className="mt-1 h-11 w-full rounded-2xl border-2 border-[#5b3f2c]/40 bg-white px-4 text-base font-bold normal-case outline-none focus:border-[#e07a5f]" />
          </label>
        </div>
        <button type="submit" className={cn(DARK, 'mt-5 w-full')} disabled={!name.trim()}>
          Take a seat 🪑
        </button>
        <button type="button" onClick={onLeave} className="pressable mt-2 w-full rounded-xl py-2 text-sm font-extrabold opacity-60 hover:opacity-100">
          ← back to YouFloww
        </button>
      </motion.form>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Receiving kudos                                                     */
/* ------------------------------------------------------------------ */
function Burst({ emoji, from, said, onDone }: { emoji: string; from: string; said: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3400);
    return () => clearTimeout(id);
  }, [onDone]);
  const bits = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ a: (i / 18) * Math.PI * 2 + Math.random() * 0.3, d: 130 + Math.random() * 150, e: ['✨', '💖', emoji, '⭐', '🌸'][i % 5], s: 0.8 + Math.random() * 0.8, r: (Math.random() - 0.5) * 220 })),
    [emoji],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
      {[0, 0.14, 0.3].map((d) => (
        <motion.span key={d} className="absolute size-40 rounded-full border-4 border-[#e07a5f]" initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 1.3, delay: d, ease: [0.2, 0.7, 0.3, 1] }} />
      ))}
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: [0, 1.5, 1.1], rotate: [-20, 8, 0] }} transition={{ duration: 0.7, ease: 'easeOut' }} className="text-[110px] leading-none drop-shadow-[0_10px_20px_rgb(60_30_10/0.35)]">
        {emoji}
      </motion.div>
      {bits.map((b, i) => (
        <motion.span key={i} className="absolute text-3xl" initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }} animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d, opacity: [0, 1, 0], scale: b.s, rotate: b.r }} transition={{ duration: 1.5, ease: 'easeOut' }}>
          {b.e}
        </motion.span>
      ))}
      <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 20 }} className={cn('absolute bottom-[28%] rounded-full px-5 py-2.5 font-display text-lg font-semibold shadow-lg', PAPER, INK)}>
        {from} {said}
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The hall                                                            */
/* ------------------------------------------------------------------ */
export default function Together() {
  const close = () => useUI.getState().set({ mode: null });
  const saved = useFeatureData<TogetherData>('together', EMPTY_DATA);
  const authUser = useData((s) => s.user);
  const profileName = useData((s) => s.data.profileName);
  const fallbackName = authUser?.name?.split(' ')[0] || (profileName && profileName !== 'Floww User' ? profileName : '');

  const [phase, setPhase] = useState<Phase>('enter');
  const [err, setErr] = useState<{ kind: string; msg: string } | null>(null);
  const [name, setName] = useState(saved.name || fallbackName);
  const [animal, setAnimal] = useState(saved.animal || 0);
  const [working, setWorking] = useState(saved.working || '');
  const [conn, setConn] = useState<Conn | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [kudos, setKudos] = useState<KudosRec[]>([]);
  const [room, setRoom] = useState('');
  const [panel, setPanel] = useState(false);
  const [cheer, setCheer] = useState<string | null>(null);
  const [flies, setFlies] = useState<{ id: number; to: string; emoji: string }[]>([]);
  const [burst, setBurst] = useState<{ id: number; emoji: string; from: string; said: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const wide = useWide();
  const now = useNow(1000);
  const tv = useTimerView();

  const hall = useRef<Hall | null>(null);
  const connRef = useRef<Conn | null>(null);
  const seatsRef = useRef<Seat[]>([]);
  const seen = useRef<Map<string, number> | null>(null);
  const nextId = useRef(1);
  const invite = useRef<string | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    let stored = '';
    try {
      stored = sessionStorage.getItem('together:invite') ?? '';
      sessionStorage.removeItem('together:invite');
    } catch {
      /* private mode */
    }
    const p = cleanCode(new URLSearchParams(location.search).get('together') || stored);
    if (p.length === 5) {
      invite.current = p;
      try {
        const u = new URL(location.href);
        u.searchParams.delete('together');
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch {
        /* ignore */
      }
    }
    return () => {
      live.current = false;
      const h = hall.current;
      const c = connRef.current;
      hall.current = null;
      connRef.current = null;
      void (async () => {
        try {
          await h?.leave();
        } finally {
          await c?.close();
        }
      })();
    };
  }, []);

  const onCode = useCallback((code: string) => {
    hall.current?.patch({ g: code });
    setPanel(true);
  }, []);
  const session = useGroup(conn, { name: name.trim() || 'Friend', animal }, now, onCode);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const groupCode = session.group?.code ?? '';
  useEffect(() => {
    hall.current?.patch({ g: session.phase === 'none' || session.phase === 'closed' ? '' : groupCode });
  }, [groupCode, session.phase]);

  const onKudos = useCallback((recs: KudosRec[]) => {
    setKudos(recs);
    const c = connRef.current;
    if (!c) return;
    if (!seen.current) {
      seen.current = new Map(recs.map((r) => [`${r.from}>${r.to}`, r.t]));
      return;
    }
    for (const r of recs) {
      const key = `${r.from}>${r.to}`;
      if (r.t <= (seen.current.get(key) ?? 0)) continue;
      seen.current.set(key, r.t);
      const k = KUDOS[r.k] ?? KUDOS.hf;
      const id = nextId.current++;
      setFlies((f) => [...f, { id, to: r.to, emoji: k.emoji }]);
      setTimeout(() => setFlies((f) => f.filter((x) => x.id !== id)), 2000);
      if (r.to === c.uid) {
        const from = seatsRef.current.find((s) => s.uid === r.from)?.n ?? 'Someone';
        setBurst({ id, emoji: k.emoji, from, said: k.said });
        hallSound('kudos');
        haptic([12, 40, 12]);
        updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => void (d.got += 1));
      }
    }
  }, []);

  const connect = useCallback(
    async (google = false) => {
      setPhase('connecting');
      setErr(null);
      updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => {
        d.name = name.trim().slice(0, 20);
        d.animal = animal;
        d.working = working.trim().slice(0, 40);
      });
      let c: Conn | null = null;
      try {
        c = await openConn(google);
        if (!live.current) return void c.close();
        connRef.current = c;
        seen.current = null;
        const t = useTimer.getState();
        const h = await joinHall(
          c,
          { name: name.trim() || 'Friend', animal, working },
          timerSeat(t, c),
          (s) => {
            seatsRef.current = s;
            setSeats(s);
          },
          onKudos,
        );
        if (!live.current) return void (await h.leave(), await c.close());
        hall.current = h;
        setRoom(h.room);
        setConn(c);
        setPhase('hall');
        hallSound('join');
        if (invite.current) {
          const code = invite.current;
          invite.current = null;
          void sessionRef.current.join(code);
        }
      } catch (e) {
        console.warn('[together]', e);
        connRef.current = null;
        await c?.close();
        if (!live.current) return;
        if (e instanceof AuthNeeded) {
          setErr(e.reason === 'anon-disabled' ? { kind: 'signin', msg: 'The hall needs a quick sign-in so everyone has their own seat.' } : e.reason === 'popup-blocked' ? { kind: 'signin', msg: 'The sign-in window was blocked. Allow pop-ups and try again.' } : { kind: 'retry', msg: 'No connection. Check your internet and try again.' });
        } else if ((e as Error).message === 'hall-full') setErr({ kind: 'retry', msg: 'Every hall is full right now (that is 600 people!). Try again soon.' });
        else if (/permission|PERMISSION/.test(String((e as Error)?.message))) setErr({ kind: 'retry', msg: 'The hall is not open yet (the owner still has to switch it on). Try again later.' });
        else setErr({ kind: 'retry', msg: 'Could not reach the hall. Try again in a moment.' });
        setPhase('error');
      }
    },
    [name, animal, working, onKudos],
  );

  // keep my seat in step with my own timer
  useEffect(() => {
    if (phase !== 'hall' || !conn) return;
    let last = '';
    const push = () => {
      const t = useTimer.getState();
      const s = timerSeat(t, conn);
      const key = `${s.s}|${s.e}|${s.d}`;
      if (key === last) return;
      last = key;
      hall.current?.patch(s);
    };
    push();
    return useTimer.subscribe(push);
  }, [phase, conn]);

  // "working on" edits are sent after a short pause
  useEffect(() => {
    if (phase !== 'hall') return;
    const id = setTimeout(() => {
      hall.current?.patch({ w: working.trim() });
      updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => void (d.working = working.trim().slice(0, 40)));
    }, 700);
    return () => clearTimeout(id);
  }, [working, phase]);

  const serverNow = now + (conn?.offset() ?? 0);
  const people = useMemo(() => seats.filter((s) => !isStale(s.h, serverNow) || s.uid === conn?.uid), [seats, serverNow, conn]);
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    kudos.forEach((k) => m.set(k.to, (m.get(k.to) ?? 0) + k.c));
    return m;
  }, [kudos]);
  const mySeat = people.find((s) => s.uid === conn?.uid);
  const cheerSeat = people.find((s) => s.uid === cheer);

  const cooldown = (to: string) => {
    const r = kudos.find((k) => k.from === conn?.uid && k.to === to);
    return r ? Math.max(0, Math.ceil((r.t + 120_000 - serverNow) / 1000)) : 0;
  };
  const send = async (k: KudosKind) => {
    if (!cheerSeat || !hall.current) return;
    const to = cheerSeat;
    haptic(10);
    const ok = await hall.current.sendKudos(to.uid, k);
    if (ok) {
      updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => void (d.given += 1));
      toast({ emoji: KUDOS[k].emoji, title: `Sent to ${to.n}`, body: 'Lovely. They will see it right now.' });
      setCheer(null);
    } else toast({ emoji: '🍵', title: 'Give them a minute', body: 'You can cheer for the same friend once every 2 minutes.' });
  };

  const toggleMute = () => {
    setMuted((m) => {
      setHallMuted(!m);
      return !m;
    });
  };
  useEffect(() => () => setHallMuted(false), []);

  const leave = () => close();

  const flyFor = (uid: string) => flies.filter((f) => f.to === uid);
  const groupSeatCode = session.group?.code;

  const avatar = (s: Seat, i: number, big?: boolean) => (
    <Avatar
      key={s.uid}
      seat={s}
      index={i}
      big={big}
      serverNow={serverNow}
      mine={s.uid === conn?.uid}
      total={totals.get(s.uid) ?? 0}
      inMyGroup={!!groupSeatCode && s.g === groupSeatCode}
      flies={flyFor(s.uid)}
      onTap={() => (s.uid === conn?.uid ? (document.getElementById('tg-working') as HTMLInputElement | null)?.focus() : setCheer(s.uid))}
    />
  );

  const groupChip =
    session.phase === 'running' ? `🌱 ${formatClock(session.remaining)}` : session.phase === 'lobby' ? `🌱 ${session.group?.code}` : session.phase === 'bloom' ? '🌸 Bloomed' : '🌱 Focus together';

  return (
    <div className="fixed inset-0 z-[45] overflow-hidden bg-[#2a1b14]">
      <AnimatePresence mode="wait">
        {phase !== 'hall' && (
          <motion.div key="pre" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <img src="/img/together/hall.webp" alt="" className="absolute inset-0 size-full object-cover blur-[3px] brightness-90" draggable={false} />
            {phase === 'enter' && <Enter name={name} setName={setName} animal={animal} setAnimal={setAnimal} working={working} setWorking={setWorking} onGo={() => void connect()} onLeave={leave} invite={invite.current} />}
            {phase === 'connecting' && (
              <div className="absolute inset-0 grid place-items-center">
                <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} className={cn('rounded-[26px] px-8 py-6 text-center', PAPER, INK)}>
                  <img src={animalImg(animal)} alt="" className="mx-auto size-20 object-contain" />
                  <p className="mt-2 font-display text-xl font-semibold">Finding you a seat…</p>
                </motion.div>
              </div>
            )}
            {phase === 'error' && err && (
              <div className="absolute inset-0 grid place-items-center p-4">
                <div className={cn('w-full max-w-[420px] rounded-[26px] p-6 text-center', PAPER, INK)}>
                  <p className="text-4xl">🍵</p>
                  <p className="mt-2 font-display text-xl font-semibold">The hall is not reachable</p>
                  <p className="mt-1 text-sm font-bold opacity-75">{err.msg}</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {err.kind === 'signin' ? (
                      <button className={DARK} onClick={() => void connect(true)}>
                        Continue with Google
                      </button>
                    ) : (
                      <button className={DARK} onClick={() => void connect()}>
                        Try again
                      </button>
                    )}
                    <button className={LIGHT} onClick={() => setPhase('enter')}>
                      Change my seat
                    </button>
                    <button className="pressable py-1.5 text-sm font-extrabold opacity-60" onClick={leave}>
                      ← back to YouFloww
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'hall' && (
        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          {wide ? (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 'max(100vw, calc(100dvh * 1.7778))', aspectRatio: '16 / 9', containerType: 'inline-size' }}>
                <img src="/img/together/hall.webp" alt="A cozy library hall" decoding="async" draggable={false} className="size-full object-cover select-none" />
                {SEATS.map(([x, y, sc], i) => {
                  const s = people.find((p) => p.i === i);
                  return (
                    <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${9 * sc}cqw`, transform: 'translate(-50%,-62%)', zIndex: Math.round(y) }}>
                      {s ? <AnimatePresence>{avatar(s, i)}</AnimatePresence> : <div className="aspect-square w-full rounded-full border-2 border-dashed border-[#5b3f2c]/20" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-[#f4dcc4] to-[#fbeedd] pb-40">
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <img src="/img/together/hall.webp" alt="A cozy library hall" decoding="async" draggable={false} className="size-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#f4dcc4] to-transparent" />
              </div>
              <div className="mx-auto -mt-3 grid max-w-[560px] grid-cols-3 gap-x-3 gap-y-5 px-5 pt-2">
                <AnimatePresence>{people.map((s, i) => <div key={s.uid} className="mx-auto w-full max-w-[104px]">{avatar(s, i, true)}</div>)}</AnimatePresence>
              </div>
              <div className={cn('mx-auto mt-7 max-w-[340px] rounded-3xl p-4 text-center', PAPER, INK)}>
                <p className="text-sm font-bold opacity-75">{people.length <= 1 ? 'It is quiet right now. Others will drift in.' : 'Tap a friend to send a high-five.'}</p>
                <button onClick={() => setPanel(true)} className={cn(DARK, 'mt-3 h-11 w-full')}>
                  <Sprout size={18} /> Focus together with friends
                </button>
              </div>
            </div>
          )}

          {/* top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
            <button onClick={leave} aria-label="Leave the hall" className={cn(LIGHT, 'pointer-events-auto')}>
              <DoorOpen size={16} /> <span className="max-[420px]:hidden">Leave hall</span>
            </button>
            <div className={cn('pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold whitespace-nowrap', PAPER, INK)}>
              <Users size={15} /> {people.length} here <span className="opacity-50 max-[480px]:hidden">· Hall {room.slice(1)}</span>
            </div>
            <div className="pointer-events-auto flex gap-1.5">
              <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className={cn(LIGHT, 'px-3')}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button onClick={() => setPanel((p) => !p)} className={cn(LIGHT, session.phase === 'running' && 'bg-[#dcebd0]')}>
                <Sprout size={16} /> <span className="tabular-nums whitespace-nowrap max-[480px]:hidden">{groupChip}</span>{session.phase === 'running' && <span className="tabular-nums min-[481px]:hidden">{formatClock(session.remaining)}</span>}
              </button>
            </div>
          </div>

          {/* bottom bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className={cn('pointer-events-auto flex w-full max-w-[640px] items-center gap-2 rounded-[24px] p-2 pl-2.5', PAPER, INK)}>
              {mySeat && <img src={animalImg(mySeat.a)} alt="" className="size-10 shrink-0 object-contain" />}
              <input id="tg-working" value={working} onChange={(e) => setWorking(e.target.value.slice(0, 40))} maxLength={40} placeholder="What are you working on?" aria-label="What are you working on?" className="h-10 min-w-0 flex-1 rounded-xl bg-[#fff1e0] px-3 text-sm font-bold outline-none placeholder:opacity-50 focus:ring-2 focus:ring-[#e07a5f]" />
              <span className="font-display text-lg font-semibold tabular-nums">{tv.clock}</span>
              <button onClick={toggle} aria-label={tv.status === 'running' ? 'Pause' : 'Start'} className={cn(BTN, 'size-10 bg-[#3b2a20] text-[#fff6ea]')}>
                {tv.status === 'running' ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          </div>

          {/* cheer card */}
          <AnimatePresence>
            {cheerSeat && (
              <motion.div className="absolute inset-0 z-30 grid place-items-end justify-items-center p-3 pb-24 sm:place-items-center sm:pb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCheer(null)}>
                <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 40, scale: 0.92 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className={cn('w-full max-w-[380px] rounded-[26px] p-5 text-center', PAPER, INK)} role="dialog" aria-label={`Cheer on ${cheerSeat.n}`}>
                  <img src={animalImg(cheerSeat.a)} alt="" className="mx-auto size-20 object-contain" />
                  <p className="font-display text-xl font-semibold">{cheerSeat.n}</p>
                  <p className="text-sm font-bold opacity-70">
                    {STATUS[cheerSeat.s]}
                    {cheerSeat.w ? ` · ${cheerSeat.w}` : ''}
                  </p>
                  {(() => {
                    const cd = cooldown(cheerSeat.uid);
                    return (
                      <>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {(Object.keys(KUDOS) as KudosKind[]).map((k) => (
                            <button key={k} disabled={cd > 0} onClick={() => void send(k)} className="pressable flex flex-col items-center gap-1 rounded-2xl bg-[#fff1e0] p-3 hover:bg-[#ffe6d2] disabled:opacity-40">
                              <motion.span className="text-3xl" whileHover={{ scale: 1.2, rotate: -8 }}>
                                {KUDOS[k].emoji}
                              </motion.span>
                              <span className="text-[11px] leading-tight font-extrabold">{KUDOS[k].label}</span>
                            </button>
                          ))}
                        </div>
                        {cd > 0 && <p className="mt-3 text-xs font-bold opacity-70">You cheered {cheerSeat.n} just now. Again in {Math.floor(cd / 60)}:{String(cd % 60).padStart(2, '0')} 🍵</p>}
                      </>
                    );
                  })()}
                  <button onClick={() => setCheer(null)} className="pressable mt-3 w-full rounded-xl py-1.5 text-sm font-extrabold opacity-60 hover:opacity-100">
                    close
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <GroupPanel s={session} uid={conn?.uid ?? ''} open={panel} onClose={() => setPanel(false)} canWrite={!!conn} />
          <AnimatePresence>{burst && <Burst key={burst.id} emoji={burst.emoji} from={burst.from} said={burst.said} onDone={() => setBurst(null)} />}</AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function timerSeat(t: ReturnType<typeof useTimer.getState>, c: Conn): Partial<Seat> {
  if (t.status === 'running') return { s: t.mode === 'focus' ? 'f' : 'b', e: Math.round((t.endAt ?? 0) + c.offset()), d: Math.round(t.durationMs) };
  if (t.status === 'paused') return { s: 'p', e: Math.round(t.remainingMs), d: Math.round(t.durationMs) };
  return { s: 'i', e: 0, d: 0 };
}
