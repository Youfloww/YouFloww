/**
 * The cat on your desk: she sits on the bottom corner of the page, strolls along its edge now and then,
 * cheers page turns and sessions, naps on breaks, and can be picked up and put anywhere (double-click
 * sends her back to her corner). While the floating buddy is popped out she's away in that window.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useTimer } from '@/store/timer';
import { bus } from '@/lib/bus';
import { pick, prefersReducedMotion } from '@/lib/utils';
import { getFeatureData, updateFeatureData } from '@/lib/featureData';
import { CatSprite, SPRITE_ASPECT, type CatAnim, type CatFace } from '../cat/CatSprite';
import { useCat } from '../cat/brain';
import { toggleBuddy } from '../pip/PipTimer';
import { DESK_DEFAULT, DESK_KEY, type DeskPrefs } from './prefs';

interface View {
  anim: CatAnim;
  face?: CatFace;
  frame?: number;
  loop?: boolean;
}
const SIT: View = { anim: 'slide', frame: 9 };
const SLEEP: View = { anim: 'idle', face: 'blink', frame: 0 };
const LOOK: View = { anim: 'idle', face: 'normal' };
const HAPPY: View = { anim: 'idle', face: 'happy' };
const JUMP: View = { anim: 'jump', loop: false };
const WALK: View = { anim: 'walk' };
const HANG: View = { anim: 'fall' };

type Step = [View, number];
const SPEED = 70; // px per second

interface Geo {
  w: number;
  h: number;
  left: number;
  right: number;
}

type PlacedPos = { fx: number; fy: number } | null;

export function DeskBuddy({ scroller, page, pages, ground, floating }: { scroller: HTMLElement; page: number; pages: number; ground: number; floating: boolean }) {
  const narrow = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches;
  const H = narrow ? 60 : 78;
  const W = Math.round(H * SPRITE_ASPECT);
  const mode = useTimer((s) => s.mode);
  const status = useTimer((s) => s.status);
  const onBreak = mode !== 'focus';
  const still = prefersReducedMotion();

  const [geo, setGeo] = useState<Geo | null>(null);
  const [view, setView] = useState<View | null>(null); // null = the resting pose for the timer state
  const [x, setX] = useState<number | null>(null); // null = home
  const [walkMs, setWalkMs] = useState(0);
  const [flip, setFlip] = useState(true);
  const [placed, setPlaced] = useState<PlacedPos>(() => (getFeatureData<DeskPrefs & { pos?: PlacedPos }>(DESK_KEY, DESK_DEFAULT).pos ?? null));
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [bubble, setBubble] = useState<{ text: string; k: number } | null>(null);
  const [hearts, setHearts] = useState(0);
  const el = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);

  /* ---------------- where the page is ---------------- */
  useEffect(() => {
    const box = scroller.parentElement;
    if (!box) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const b = box.getBoundingClientRect();
      const line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.5;
      const pagesEls = scroller.querySelectorAll<HTMLElement>('[data-sd-page]');
      let r: DOMRect | null = null;
      for (const p of pagesEls) {
        const pr = p.getBoundingClientRect();
        r = pr;
        if (pr.bottom >= line) break;
      }
      const s = scroller.getBoundingClientRect();
      const left = Math.max(s.left, r ? r.left : s.left) - b.left;
      const right = Math.min(s.right - 14, r ? r.right : s.right) - b.left;
      const next = { w: b.width, h: b.height, left, right };
      setGeo((g) => (g && Math.abs(g.w - next.w) < 2 && Math.abs(g.h - next.h) < 2 && Math.abs(g.left - next.left) < 2 && Math.abs(g.right - next.right) < 2 ? g : next));
    };
    const on = () => (raf ||= requestAnimationFrame(measure));
    const ro = new ResizeObserver(on);
    ro.observe(box);
    scroller.addEventListener('scroll', on, { passive: true });
    measure();
    const t = setTimeout(measure, 600); // pages settle after the first render
    return () => {
      ro.disconnect();
      scroller.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [scroller, page]);

  const home = geo ? Math.max(8, Math.min(geo.w - W - 8, geo.right - W * 0.62)) : 0;
  const groundY = geo ? geo.h - ground - H : 0;
  const curX = drag ? drag.x : placed && geo ? placed.fx * geo.w : x ?? home;
  const curY = drag ? drag.y : placed && geo ? Math.min(groundY, placed.fy * geo.h) : groundY;

  /* ---------------- little routines ---------------- */
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  /** stop mid-walk where she is */
  const halt = useCallback(() => {
    if (!walkMs || !el.current || !el.current.parentElement) return;
    const r = el.current.getBoundingClientRect();
    const b = el.current.parentElement.getBoundingClientRect();
    setWalkMs(0);
    setX(r.left - b.left);
  }, [walkMs]);

  const play = useCallback(
    (steps: Step[], say?: string) => {
      clear();
      halt();
      busy.current = true;
      let at = 0;
      for (const [v, ms] of steps) {
        later(() => setView(v), at);
        at += ms;
      }
      later(() => {
        setView(null);
        busy.current = false;
      }, at);
      if (say) setBubble({ text: say, k: Date.now() });
    },
    [halt],
  );

  // bubbles fade on their own
  useEffect(() => {
    if (!bubble) return;
    const t = setTimeout(() => setBubble(null), Math.max(2600, bubble.text.length * 70));
    return () => clearTimeout(t);
  }, [bubble]);

  // sessions and the cat's own lines
  useEffect(() => {
    const offs = [
      bus.on('session:start', () => play([[JUMP, 650], [{ anim: 'idle', face: 'star' }, 1600]], pick(['Let’s study! 📚', 'Focus time, I’ll keep watch 👀', 'You’ve got this ✨']))),
      bus.on('session:complete', () => {
        setHearts((h) => h + 1);
        play([[JUMP, 650], [{ anim: 'idle', face: 'love' }, 2400]], pick(['Great session! Break time ☕', 'So proud of you 💖', 'Look at you go! 🎉']));
      }),
      bus.on('session:early', () => play([[{ anim: 'idle', face: 'sad' }, 2000]], 'Every minute counts 💛')),
      bus.on('break:complete', () => play([[JUMP, 650], [HAPPY, 1200]], 'Nap’s over, back to the page?')),
      bus.on('mascot:say', ({ text }) => setBubble({ text, k: Date.now() })),
    ];
    return () => offs.forEach((f) => f());
  }, [play]);

  // page turns
  const lastPage = useRef(page);
  const turns = useRef(0);
  const lastReact = useRef(0);
  useEffect(() => {
    if (page === lastPage.current) return;
    const forward = page > lastPage.current;
    lastPage.current = page;
    if (floating || onBreak || drag) return;
    const now = Date.now();
    if (forward) turns.current++;
    if (page === pages && pages > 1) return play([[JUMP, 650], [{ anim: 'idle', face: 'star' }, 1800]], 'You reached the end! 🎉');
    if (now - lastReact.current < 1800 || busy.current) return;
    lastReact.current = now;
    const say = forward && turns.current % 6 === 0 ? pick([`Page ${page} already!`, 'Nice pace 🐾', 'Keep going, I’m reading too 📖', 'Ooh, what happens next?']) : undefined;
    play(Math.random() < 0.25 && !still ? [[JUMP, 650]] : [[HAPPY, 1000]], say);
  }, [page, pages, floating, onBreak, drag, play, still]);

  // now and then she strolls along the bottom of the page and comes back
  useEffect(() => {
    if (still || floating || placed || onBreak || !geo) return;
    let alive = true;
    const focusing = status === 'running';
    const loop = () => {
      later(
        () => {
          if (!alive || busy.current || document.hidden) return loop();
          busy.current = true;
          const minX = Math.max(8, geo.left + 6);
          const target = minX + Math.random() * Math.max(0, home - minX);
          const dist = Math.abs(target - home);
          if (dist < 40) {
            setView(LOOK);
            later(() => {
              setView(null);
              busy.current = false;
              loop();
            }, 2200);
            return;
          }
          const ms = (dist / SPEED) * 1000;
          setFlip(true);
          setView(WALK);
          setWalkMs(ms);
          setX(target);
          later(() => {
            setView(LOOK);
            later(() => {
              setFlip(false);
              setView(WALK);
              setX(home);
              later(() => {
                setWalkMs(0);
                setX(null);
                setFlip(true);
                setView(null);
                busy.current = false;
                loop();
              }, ms);
            }, 2600);
          }, ms);
        },
        (focusing ? 70 : 28) * 1000 + Math.random() * 30_000,
      );
    };
    loop();
    return () => {
      alive = false;
      clear();
      busy.current = false;
      setWalkMs(0);
      setX(null);
      setView(null);
    };
    // geo changes while scrolling must not restart her stroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, floating, placed, onBreak, status, !!geo]);

  /* ---------------- pick her up ---------------- */
  const down = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    down.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent) => {
    const d = down.current;
    const box = el.current?.parentElement?.getBoundingClientRect();
    if (!d || !box) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      clear();
      busy.current = true;
      setWalkMs(0);
      setView(HANG);
    }
    setDrag({ x: e.clientX - box.left - W / 2, y: e.clientY - box.top - H * 0.22 });
  };
  const onPointerUp = () => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    if (!d.moved) return pet();
    if (drag && geo) {
      const nx = Math.max(0, Math.min(geo.w - W, drag.x));
      const ny = Math.max(0, Math.min(groundY, drag.y));
      const pos = { fx: nx / geo.w, fy: ny / geo.h };
      setPlaced(pos);
      updateFeatureData<DeskPrefs & { pos?: PlacedPos }>(DESK_KEY, DESK_DEFAULT, (p) => {
        p.pos = pos;
      });
    }
    setDrag(null);
    busy.current = false;
    play([[JUMP, 600]], placed ? undefined : 'I’ll sit here then 🐾');
  };
  const sendHome = () => {
    setPlaced(null);
    setX(null);
    updateFeatureData<DeskPrefs & { pos?: PlacedPos }>(DESK_KEY, DESK_DEFAULT, (p) => {
      p.pos = null;
    });
    play([[JUMP, 600]], 'Back to my corner!');
  };
  const pet = () => {
    const how = useCat.getState().pet();
    if (how === 'annoyed') return play([[{ anim: 'idle', face: 'mad' }, 1300]], 'Hey! Let me read 😾');
    setHearts((h) => h + 1);
    play([[{ anim: 'idle', face: 'love' }, 1400]], onBreak ? 'purr… zz' : pick(['purr…', 'Mrrp! 💕', 'Hehe 💗']));
  };

  if (!geo) return null;
  const rest = onBreak ? SLEEP : SIT;
  const v = view ?? rest;
  const sleeping = !view && onBreak;

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      <div
        ref={el}
        className="absolute top-0 left-0"
        style={{
          width: W,
          height: H,
          transform: `translate3d(${curX}px, ${curY}px, 0)`,
          transition: drag ? 'none' : walkMs ? `transform ${walkMs}ms linear` : 'transform .45s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <AnimatePresence>
          {!floating && (
            <motion.div
              key="cat"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -40 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="pointer-events-auto relative size-full cursor-grab touch-none select-none active:cursor-grabbing"
              style={{ transformOrigin: '50% 100%' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                down.current = null;
                setDrag(null);
                busy.current = false;
                setView(null);
              }}
              onDoubleClick={() => placed && sendHome()}
              role="button"
              tabIndex={0}
              aria-label="Your study buddy. Tap to pet, drag to move, double-click to send her back to the corner"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), e.stopPropagation(), pet())}
            >
              <div className={sleeping ? 'sd-breathe' : undefined}>
                <CatSprite anim={v.anim} face={v.face} frame={v.frame} loop={v.loop ?? true} height={H} flip={v.anim === 'slide' ? !flip : flip} fps={v.anim === 'walk' ? 11 : 12} />
              </div>
              {sleeping && (
                <span className="sd-zzz" aria-hidden>
                  <i>z</i>
                  <i>z</i>
                  <i>Z</i>
                </span>
              )}
              {hearts > 0 && (
                <span key={hearts} className="sd-hearts" aria-hidden>
                  <i>💖</i>
                  <i>💗</i>
                  <i>💕</i>
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute" style={{ left: Math.max(8, Math.min(geo.w - 12, home + W)), top: groundY + H - 44, transform: 'translateX(-100%)' }}>
        <AnimatePresence>
          {floating && (
            <motion.button
              key="away"
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              onClick={() => void toggleBuddy()}
              className="glass-strong pressable pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold whitespace-nowrap"
              title="Bring your buddy back from the floating window"
            >
              🐱 Floating on top <span className="text-muted">· bring back</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {bubble && !floating && (
          <motion.div
            key={bubble.k}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="glass-strong absolute max-w-[220px] rounded-2xl px-3 py-2 text-[13px] leading-snug font-extrabold"
            style={{ left: Math.max(8, Math.min(geo.w - 228, curX + W / 2 - 110)), top: Math.max(8, curY - 52), width: 'max-content' }}
            role="status"
          >
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
