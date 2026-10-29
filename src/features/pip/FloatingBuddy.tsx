/** The floating buddy window's contents: the cat, the timer, play/pause and the current task (see PipTimer.tsx). */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { usePrefs } from '@/store/prefs';
import { useTimer, MODE_META } from '@/store/timer';
import { useData } from '@/store/data';
import { bus } from '@/lib/bus';
import { useCat } from '../cat/brain';
import { useStripUrl, type StripFile } from '../cat/skins';
import { endEarly, toggle } from '../timer/engine';
import { useTimerView } from '../timer/TimerOrb';

/* ------------------------------------------------------------------ */
/* The cat, animated on the PiP window's own clock                      */
/* ------------------------------------------------------------------ */
type Pose = 'sit' | 'watch' | 'sleep' | 'jump' | 'star' | 'love' | 'happy' | 'sad' | 'mad';
const POSES: Record<Pose, { file: StripFile; frames: number; hold?: number; fps?: number; once?: boolean }> = {
  sit: { file: 'slide', frames: 10, hold: 9 },
  watch: { file: 'idle', frames: 10, fps: 9 },
  sleep: { file: 'idle-blink', frames: 10, hold: 0 },
  jump: { file: 'jump', frames: 8, fps: 14, once: true },
  star: { file: 'idle-star', frames: 10, fps: 11 },
  love: { file: 'idle-love', frames: 10, fps: 11 },
  happy: { file: 'idle-happy', frames: 10, fps: 11 },
  sad: { file: 'idle-sad', frames: 10, fps: 9 },
  mad: { file: 'idle-mad', frames: 10, fps: 12 },
};

function BuddyCat({ win, pose, onPet }: { win: Window; pose: Pose; onPet: () => void }) {
  const skin = useCat((s) => s.skin);
  const p = POSES[pose];
  const [blink, setBlink] = useState(false);
  const file: StripFile = pose === 'watch' && blink ? 'idle-blink' : p.file;
  const url = useStripUrl(skin, file);
  const plain = useStripUrl(skin, p.file);
  const el = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const still = win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // explicit frame-by-frame positions (no stepped easing), on the PiP window's timers
  useEffect(() => {
    const set = (f: number) => {
      frame.current = f;
      if (el.current) el.current.style.backgroundPosition = `${(f / (p.frames - 1)) * 100}% 0%`;
    };
    if (p.hold !== undefined || still) return set(p.hold ?? 0);
    set(0);
    const id = win.setInterval(() => {
      const next = frame.current + 1;
      if (next < p.frames) set(next);
      else if (!p.once) set(0);
    }, 1000 / (p.fps ?? 10));
    return () => win.clearInterval(id);
  }, [win, pose, p, still]);

  // she blinks now and then while she watches you work
  useEffect(() => {
    if (pose !== 'watch' || still) return;
    let t = 0;
    const loop = () => {
      t = win.setTimeout(() => {
        setBlink(true);
        t = win.setTimeout(() => {
          setBlink(false);
          loop();
        }, 150 + (Math.random() < 0.2 ? 220 : 0));
      }, 2400 + Math.random() * 3800);
    };
    loop();
    return () => {
      win.clearTimeout(t);
      setBlink(false);
    };
  }, [win, pose, still]);

  return (
    <button type="button" className={`fb-cat fb-pose-${pose}`} onClick={onPet} aria-label="Pet your buddy">
      <div
        ref={el}
        className="fb-sprite"
        style={{
          backgroundImage: url || plain ? `url(${url ?? plain})` : undefined,
          backgroundSize: `${p.frames * 100}% 100%`,
          backgroundPosition: `${(Math.min(frame.current, p.frames - 1) / (p.frames - 1)) * 100}% 0%`,
        }}
      />
      {pose === 'sleep' && (
        <span className="fb-zzz" aria-hidden>
          <i>z</i>
          <i>z</i>
          <i>Z</i>
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The floating window's contents                                       */
/* ------------------------------------------------------------------ */
type Step = [Pose, number, string?];

export default function FloatingBuddy({ win }: { win: Window }) {
  // its own little stylesheet, in the PiP document
  useEffect(() => {
    const st = win.document.createElement('style');
    st.textContent = BUDDY_CSS;
    win.document.head.append(st);
    return () => st.remove();
  }, [win]);

  const v = useTimerView();
  const mode = useTimer((s) => s.mode);
  const activeId = useTimer((s) => s.activeTodoId);
  const task = useData((s) => (activeId ? s.data.todos.find((t) => t.id === activeId && !t.completed)?.text : undefined));
  const catName = useCat((s) => s.name);
  const running = v.status === 'running';
  const onBreak = mode !== 'focus';

  const base: Pose = onBreak ? 'sleep' : running ? 'watch' : 'sit';
  const [reaction, setReaction] = useState<{ pose: Pose; say?: string; k: number } | null>(null);
  const [burst, setBurst] = useState<{ kind: 'heart' | 'star'; k: number } | null>(null);
  const timers = useRef<number[]>([]);

  const play = (steps: Step[], fx?: 'heart' | 'star') => {
    timers.current.forEach((t) => win.clearTimeout(t));
    timers.current = [];
    let at = 0;
    for (const [pose, ms, say] of steps) {
      timers.current.push(win.setTimeout(() => setReaction({ pose, say, k: Date.now() }), at));
      at += ms;
    }
    timers.current.push(win.setTimeout(() => setReaction(null), at));
    if (fx) setBurst({ kind: fx, k: Date.now() });
  };

  useEffect(() => {
    const offs = [
      bus.on('session:start', () => play([['jump', 620, 'Let’s go!'], ['star', 1700, 'Let’s go!']], 'star')),
      bus.on('session:complete', () => play([['jump', 620, 'You did it!'], ['love', 2600, 'You did it! 🎉']], 'heart')),
      bus.on('session:early', () => play([['sad', 2200, 'Every minute counts 💛']])),
      bus.on('break:complete', () => play([['jump', 620, 'Back to it?'], ['happy', 1600, 'Back to it?']])),
    ];
    return () => {
      offs.forEach((f) => f());
      timers.current.forEach((t) => win.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win]);

  const pet = () => {
    const how = useCat.getState().pet();
    if (how === 'annoyed') play([['mad', 1400, 'Hey! I’m busy 😾']]);
    else play([['love', 1500, 'purr…']], 'heart');
  };

  // ending from here takes two taps: the app's "are you sure?" dialog isn't visible
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = win.setTimeout(() => setArm(false), 3000);
    return () => win.clearTimeout(t);
  }, [arm, win]);
  const onEnd = () => {
    if (v.status === 'idle' || !usePrefs.getState().confirmEnd || arm) {
      setArm(false);
      endEarly();
    } else setArm(true);
  };

  const line =
    reaction?.say ??
    (onBreak
      ? running
        ? `${catName} is napping 💤 Stretch and sip some water`
        : 'Break time ☕ Press ▶ to rest'
      : task
        ? task
        : running
          ? 'Focusing together…'
          : v.status === 'paused'
            ? 'Paused. Press ▶ when ready'
            : 'Ready when you are');

  return (
    <div className={`fb ${onBreak ? 'fb-break' : ''}`}>
      <div className="fb-glow" aria-hidden />
      <div className="fb-cat-wrap">
        <BuddyCat win={win} pose={reaction?.pose ?? base} onPet={pet} />
        {burst && (
          <span key={burst.k} className="fb-burst" aria-hidden>
            {(burst.kind === 'heart' ? ['💖', '💗', '💕'] : ['⭐', '✨', '💫']).map((e, i) => (
              <i key={i} style={{ '--i': i } as CSSProperties}>
                {e}
              </i>
            ))}
          </span>
        )}
      </div>
      <div className="fb-main">
        <span className="fb-label">
          {MODE_META[mode].emoji} {v.status === 'paused' ? 'Paused' : MODE_META[mode].label}
        </span>
        <span className="fb-clock" aria-live="off">
          {v.clock}
        </span>
        <span className={`fb-task ${task && !reaction?.say ? 'fb-task-on' : ''}`} title={line}>
          {task && !reaction?.say && !onBreak ? '🎯 ' : ''}
          {line}
        </span>
        <div className="fb-ctrls">
          <button type="button" onClick={toggle} aria-label={running ? 'Pause' : 'Start'} className="fb-btn fb-play">
            {running ? <Pause size={20} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} />}
          </button>
          <button type="button" onClick={onEnd} aria-label={arm ? 'Tap again to end' : onBreak ? 'Skip break' : 'End session'} className={`fb-btn ${arm ? 'fb-arm' : 'fb-end'}`}>
            {arm ? 'Sure?' : <SkipForward size={16} strokeWidth={2.6} />}
          </button>
        </div>
      </div>
      <div className="fb-bar" style={{ width: `${v.progress * 100}%` }} aria-hidden />
    </div>
  );
}

const BUDDY_CSS = `
html,body{height:100%;margin:0;overflow:hidden;background:var(--bg)}
.fb{position:fixed;inset:0;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:8px;padding:8px 14px 12px 12px;color:var(--ink);font-family:var(--font-sans);user-select:none;-webkit-user-select:none;overflow:hidden}
.fb-glow{position:absolute;inset:0;pointer-events:none;opacity:.9;background:radial-gradient(70% 70% at 15% 20%,var(--a1),transparent),radial-gradient(60% 70% at 95% 10%,var(--a2),transparent),radial-gradient(80% 70% at 60% 120%,var(--a3),transparent)}
.fb-bar{position:absolute;left:0;bottom:0;height:4px;border-radius:0 4px 4px 0;background:var(--accent);transition:width 1s linear}
.fb-cat-wrap{position:relative;align-self:end;z-index:1}
.fb-cat{display:block;position:relative;padding:0;margin:0;border:0;background:none;cursor:pointer;border-radius:16px}
.fb-sprite{height:clamp(64px,64vh,150px);aspect-ratio:336/288;background-repeat:no-repeat;transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
.fb-cat:active .fb-sprite{transform:scale(.94)}
.fb-pose-sleep .fb-sprite{transform-origin:50% 100%;animation:fb-breathe 3.2s ease-in-out infinite}
@keyframes fb-breathe{0%,100%{transform:scale(1,1) rotate(-4deg)}50%{transform:scale(1.02,.975) rotate(-4deg)}}
.fb-zzz{position:absolute;left:6%;top:4%;pointer-events:none;font:700 15px/1 var(--font-display);color:var(--muted)}
.fb-zzz i{position:absolute;font-style:normal;opacity:0;animation:fb-z 3s ease-out infinite}
.fb-zzz i:nth-child(2){animation-delay:1s;font-size:12px}
.fb-zzz i:nth-child(3){animation-delay:2s;font-size:18px}
@keyframes fb-z{0%{opacity:0;transform:translate(0,6px) scale(.6)}25%{opacity:.9}100%{opacity:0;transform:translate(-12px,-24px) scale(1.1)}}
.fb-burst{position:absolute;left:50%;top:20%;pointer-events:none}
.fb-burst i{position:absolute;font-style:normal;font-size:16px;opacity:0;animation:fb-pop 1.3s ease-out forwards;animation-delay:calc(var(--i)*.12s)}
.fb-burst i:nth-child(1){--dx:-22px}.fb-burst i:nth-child(2){--dx:4px}.fb-burst i:nth-child(3){--dx:24px}
@keyframes fb-pop{0%{opacity:0;transform:translate(-50%,8px) scale(.4)}20%{opacity:1;transform:translate(calc(-50% + var(--dx)*.4),-6px) scale(1.1)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),-40px) scale(.9)}}
.fb-main{position:relative;z-index:1;display:flex;flex-direction:column;min-width:0;gap:1px}
.fb-label{font-size:10.5px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-clock{font-family:var(--font-display);font-weight:600;font-variant-numeric:tabular-nums;line-height:1;letter-spacing:-.01em;font-size:clamp(30px,min(15vw,30vh),84px)}
.fb-task{margin-top:3px;font-size:12px;line-height:1.25;font-weight:800;color:var(--muted);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.fb-task-on{color:var(--ink)}
.fb-ctrls{display:flex;align-items:center;gap:8px;margin-top:8px}
.fb-btn{display:grid;place-items:center;border:0;cursor:pointer;font:900 12px var(--font-sans);transition:transform .2s cubic-bezier(.34,1.56,.64,1),filter .2s}
.fb-btn:hover{filter:brightness(1.05)}.fb-btn:active{transform:scale(.92)}
.fb-play{width:44px;height:44px;border-radius:999px;background:var(--accent);color:var(--accent-ink);box-shadow:0 8px 18px -8px color-mix(in oklab,var(--accent) 80%,black)}
.fb-play svg{transform:translateX(1px)}
.fb-end{width:36px;height:36px;border-radius:999px;background:var(--surface-strong);color:var(--ink)}
.fb-arm{height:36px;padding:0 12px;border-radius:999px;background:#ff5d73;color:#fff}
.fb :focus-visible{outline:3px solid color-mix(in oklab,var(--accent) 70%,white);outline-offset:2px}
@media (max-aspect-ratio:1/1) and (min-height:230px){
  .fb{grid-template-columns:1fr;grid-template-rows:auto auto;justify-items:center;align-content:center;text-align:center;padding:10px 12px 14px;row-gap:4px}
  .fb-main{align-items:center;max-width:100%}
  .fb-sprite{height:clamp(70px,36vh,170px)}
  .fb-clock{font-size:clamp(34px,min(20vw,16vh),96px)}
}
@media (max-height:132px){.fb-label,.fb-task{display:none}.fb-ctrls{margin-top:4px}.fb-sprite{height:clamp(52px,80vh,110px)}}
@media (max-width:250px) and (min-aspect-ratio:1/1){.fb-cat-wrap{display:none}.fb{grid-template-columns:1fr;padding-left:14px}}
@media (prefers-reduced-motion:reduce){.fb *,.fb *::before{animation:none!important;transition:none!important}.fb-zzz,.fb-burst{display:none}}
`;

