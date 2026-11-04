/**
 * The progress strip: the floating window's wide, thin layout (see PipTimer.tsx). It shows how far the session has
 * come while you work in another tab or app: the cat running along a track to the finish flag, or, on a train
 * ride, the painted steam train rolling through the countryside toward the next station.
 *
 * Like the buddy, everything animates on the PiP window's own clock (its animation frames and timers), because
 * the app's tab is usually hidden while the strip floats.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { Cat, Pause, Play } from 'lucide-react';
import { useTimer, MODE_META } from '@/store/timer';
import { THEMES } from '@/store/prefs';
import { useCat } from '../cat/brain';
import { useStripUrl, type StripFile } from '../cat/skins';
import { toggle } from '../timer/engine';
import { useTimerView } from '../timer/TimerOrb';
import { drawTrainScene, newMem, type SceneAssets } from './stripScene';
import { rideNow, useTrainNow, type TrainNow } from './trainNow';

let assets: SceneAssets | null = null;
const image = (src: string) => {
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
  return i;
};
const sceneAssets = () => (assets ??= { train: image('/img/strip/train.webp'), scenery: image('/img/strip/scenery.webp') });

const isDark = () => !!THEMES.find((t) => t.id === document.documentElement.getAttribute('data-theme'))?.dark;
const etaText = (ms: number) => (ms < 60_000 ? 'under a minute' : `${Math.round(ms / 60_000)} min`);

/* ------------------------------------------------------------------ */
/* The train ride, on a canvas                                          */
/* ------------------------------------------------------------------ */
function TrainScene({ win, train }: { win: Window; train: TrainNow }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(train);
  live.current = train;

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const a = sceneAssets();
    const m = newMem();
    const still = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stations: number[] = [];
    let stationsOf: TrainNow['geo'] | null = null;
    let last = win.performance.now();
    let raf = 0;

    const frame = () => {
      const now = win.performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = live.current;
      if (stationsOf !== t.geo) {
        stationsOf = t.geo;
        stations = t.geo.stations.map((s) => s.km / t.geo.km);
      }
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const dpr = win.devicePixelRatio || 1;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const moving = useTimer.getState().status === 'running';
      drawTrainScene(ctx, w, h, dt, { progress: rideNow(t).p, moving, dark: isDark(), still, color: t.color, stations }, a, m);
    };
    const loop = () => {
      frame();
      raf = win.requestAnimationFrame(loop);
    };
    raf = win.requestAnimationFrame(loop);
    // should this window's animation frames ever stall, keep the picture going on a timer
    const dog = win.setInterval(() => {
      if (win.performance.now() - last > 300) frame();
    }, 120);
    return () => {
      win.cancelAnimationFrame(raf);
      win.clearInterval(dog);
    };
  }, [win]);

  return <canvas ref={ref} className="ps-canvas" aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* The cat, running along the track                                     */
/* ------------------------------------------------------------------ */
function CatScene({ win, progress }: { win: Window; progress: number }) {
  const status = useTimer((s) => s.status);
  const onBreak = useTimer((s) => s.mode !== 'focus');
  const skin = useCat((s) => s.skin);
  const running = status === 'running';
  // running in focus, napping on a break, sitting and looking around while paused
  const file: StripFile = onBreak ? 'idle-blink' : running ? 'run' : 'idle';
  const frames = file === 'run' ? 8 : 10;
  const url = useStripUrl(skin, file);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const set = (f: number) => {
      if (el.current) el.current.style.backgroundPosition = `${(f / (frames - 1)) * 100}% 0%`;
    };
    set(0);
    if (onBreak || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let f = 0;
    const id = win.setInterval(() => set((f = (f + 1) % frames)), 1000 / (running ? 13 : 9));
    return () => win.clearInterval(id);
  }, [win, frames, running, onBreak]);

  return (
    <div className={`ps-cat-scene ${running && !onBreak ? 'ps-running' : ''}`} style={{ '--p': progress } as CSSProperties}>
      <div className="ps-glow" aria-hidden />
      <div className="ps-track" aria-hidden>
        <div className="ps-fill" />
      </div>
      <span className="ps-goal" aria-hidden>
        🏁
      </span>
      <div className="ps-cat" aria-hidden>
        <span className="ps-dust">
          <i />
          <i />
          <i />
        </span>
        <div ref={el} className="ps-sprite" style={{ backgroundImage: url ? `url(${url})` : undefined, backgroundSize: `${frames * 100}% 100%` }} />
        {onBreak && (
          <span className="ps-zzz">
            <i>z</i>
            <i>Z</i>
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The strip                                                            */
/* ------------------------------------------------------------------ */
export default function ProgressStrip({ win, onBuddy }: { win: Window; onBuddy: () => void }) {
  useEffect(() => {
    const st = win.document.createElement('style');
    st.textContent = STRIP_CSS;
    win.document.head.append(st);
    return () => st.remove();
  }, [win]);

  const v = useTimerView();
  const mode = useTimer((s) => s.mode);
  const train = useTrainNow();
  const running = v.status === 'running';
  const paused = v.status === 'paused';

  let line: string;
  if (train) {
    const { next, etaMs } = rideNow(train);
    const last = train.geo.stations[train.geo.stations.length - 1];
    line = paused ? 'Stopped at a signal' : next ? `Next: ${next.name} · ${etaText(etaMs)}` : `Arriving at ${last?.name ?? train.name}`;
  } else if (v.status === 'idle') line = 'Ready when you are';
  else line = `${MODE_META[mode].emoji} ${paused ? 'Paused' : MODE_META[mode].label}`;

  return (
    <div className={`ps ${train ? 'ps-train' : ''}`}>
      {train ? <TrainScene win={win} train={train} /> : <CatScene win={win} progress={v.status === 'idle' ? 0 : v.progress} />}
      <div className="ps-hud">
        <div className="ps-pill" title={train ? `${train.name}: ${line}` : line}>
          <span className="ps-clock" aria-live="off">
            {train && '🚂 '}
            {v.clock}
          </span>
          <span className="ps-line">{line}</span>
        </div>
        <div className="ps-btns">
          <button type="button" className="ps-btn ps-play" onClick={toggle} aria-label={running ? 'Pause' : 'Start'}>
            {running ? <Pause size={15} fill="currentColor" strokeWidth={0} /> : <Play size={15} fill="currentColor" strokeWidth={0} />}
          </button>
          <button type="button" className="ps-btn" onClick={onBuddy} aria-label="Switch to the floating buddy" title="Floating buddy">
            <Cat size={15} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

const STRIP_CSS = `
html,body{height:100%;margin:0;overflow:hidden;background:var(--bg)}
.ps{position:fixed;inset:0;color:var(--ink);font-family:var(--font-sans);user-select:none;-webkit-user-select:none;overflow:hidden}
.ps-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ps-hud{position:absolute;left:8px;right:8px;top:7px;display:flex;align-items:flex-start;gap:8px;z-index:2;pointer-events:none}
.ps-pill{pointer-events:auto;display:flex;align-items:baseline;gap:9px;min-width:0;padding:5px 12px 6px;border-radius:999px;background:color-mix(in oklab,var(--bg) 76%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 16px -10px rgba(0,0,0,.5)}
.ps-clock{flex:none;font-family:var(--font-display);font-weight:700;font-variant-numeric:tabular-nums;font-size:19px;line-height:1;letter-spacing:-.01em}
.ps-line{min-width:0;font-size:11.5px;font-weight:800;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ps-train .ps-pill{background:rgba(255,250,240,.84);color:#3b2a1e}
.ps-train .ps-line{color:#7a5a43}
.ps-btns{margin-left:auto;display:flex;gap:6px;pointer-events:auto}
.ps-btn{display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:999px;cursor:pointer;color:var(--ink);background:color-mix(in oklab,var(--bg) 76%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:transform .2s cubic-bezier(.34,1.56,.64,1),filter .2s}
.ps-train .ps-btn{background:rgba(255,250,240,.84);color:#3b2a1e}
.ps .ps-play{background:var(--accent);color:var(--accent-ink)}
.ps-play svg{transform:translateX(1px)}
.ps-btn:hover{filter:brightness(1.05)}.ps-btn:active{transform:scale(.9)}
.ps :focus-visible{outline:3px solid color-mix(in oklab,var(--accent) 70%,white);outline-offset:2px}

.ps-cat-scene{position:absolute;inset:0;--ch:clamp(38px,58vh,120px);--cw:calc(var(--ch)*336/288);--pad:14px}
.ps-glow{position:absolute;inset:0;opacity:.9;background:radial-gradient(60% 90% at 10% 10%,var(--a1),transparent),radial-gradient(50% 90% at 90% 0%,var(--a2),transparent),radial-gradient(80% 80% at 55% 130%,var(--a3),transparent)}
.ps-track{position:absolute;left:var(--pad);right:var(--pad);bottom:9px;height:7px;border-radius:99px;background:color-mix(in oklab,var(--ink) 13%,transparent);overflow:hidden}
.ps-fill{height:100%;width:calc(var(--p)*100%);border-radius:inherit;background:linear-gradient(90deg,var(--a2),var(--accent));transition:width 1s linear}
.ps-goal{position:absolute;right:calc(var(--pad) - 6px);bottom:13px;font-size:17px;line-height:1}
.ps-cat{position:absolute;bottom:11px;width:var(--cw);height:var(--ch);left:calc(var(--pad) - var(--cw)*.18 + (100% - var(--pad)*2 - var(--cw)*.64)*var(--p));transition:left 1s linear}
.ps-sprite{position:absolute;inset:0;background-repeat:no-repeat}
.ps-running .ps-sprite{animation:ps-bob .3s ease-in-out infinite alternate}
@keyframes ps-bob{to{transform:translateY(-4%)}}
.ps-dust{position:absolute;left:12%;bottom:4%;opacity:0}
.ps-running .ps-dust{opacity:1}
.ps-dust i{position:absolute;bottom:0;width:9px;height:9px;border-radius:50%;background:color-mix(in oklab,var(--ink) 18%,transparent);animation:ps-dust .9s ease-out infinite}
.ps-dust i:nth-child(2){animation-delay:.3s}.ps-dust i:nth-child(3){animation-delay:.6s}
@keyframes ps-dust{0%{opacity:.8;transform:translate(0,0) scale(.5)}100%{opacity:0;transform:translate(-26px,-10px) scale(1.5)}}
.ps-zzz{position:absolute;right:8%;top:0;font:700 13px/1 var(--font-display);color:var(--muted)}
.ps-zzz i{position:absolute;font-style:normal;opacity:0;animation:ps-z 2.6s ease-out infinite}
.ps-zzz i:nth-child(2){animation-delay:1.3s;font-size:16px}
@keyframes ps-z{0%{opacity:0;transform:translate(0,4px) scale(.6)}30%{opacity:.9}100%{opacity:0;transform:translate(10px,-20px) scale(1.1)}}
@media (max-height:84px){.ps-line{display:none}}
@media (max-width:300px){.ps-line{display:none}}
@media (prefers-reduced-motion:reduce){.ps *{animation:none!important;transition:none!important}.ps-dust{display:none}}
`;
