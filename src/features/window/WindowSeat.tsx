/**
 * Window Seat: a real window to sit by while you work. Live and looping window views stream from YouTube (pick
 * one; it's remembered); the painted window works offline and turns the focus session's progress into the time
 * of day: dawn → morning → golden hour → dusk → night (or the rainy afternoon, if you like rain).
 * Only the current painting and the next one are ever loaded.
 */
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ChevronDown, CloudRain, DoorOpen, Pause, Play, Square, Sun, Volume2, VolumeX } from 'lucide-react';
import { updateFeatureData, useFeatureData } from '@/lib/featureData';
import { DEFAULT_SCENE, SCENES, sceneOf, thumbOf, type Scene } from './scenes';

const YouTubeView = lazy(() => import('./YouTubeView'));
interface SeatSave {
  scene: string;
  /** the video's own sound (rain, waves…) */
  sound: boolean;
}
const SAVE_KEY = 'windowseat';
const SAVE0: SeatSave = { scene: DEFAULT_SCENE, sound: false };
import { useUI, toast } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { cn, prefersReducedMotion } from '@/lib/utils';
import { useTimerView } from '../timer/TimerOrb';
import { requestEnd, requestFocusFor, skipBreak, toggle } from '../timer/engine';

interface Phase {
  id: string;
  label: string;
  emoji: string;
  src: string;
  /** used on the rainy painting (and if a painting is missing): a wash of light over the original */
  wash: string;
  filter: string;
}

const RAIN_SRC = '/img/cafe/window.webp';
const PHASES: Phase[] = [
  { id: 'dawn', label: 'Dawn', emoji: '🌅', src: '/img/window/dawn.webp', wash: 'rgb(255 190 170 / 0.30)', filter: 'saturate(0.9) brightness(1.02) sepia(0.15)' },
  { id: 'morning', label: 'Morning', emoji: '☀️', src: '/img/window/morning.webp', wash: 'rgb(255 250 235 / 0.06)', filter: 'saturate(1.1) brightness(1.06)' },
  { id: 'golden', label: 'Golden hour', emoji: '🌇', src: '/img/window/golden.webp', wash: 'rgb(255 185 100 / 0.32)', filter: 'saturate(1.15) sepia(0.25) brightness(1.02)' },
  { id: 'dusk', label: 'Dusk', emoji: '🌆', src: '/img/window/dusk.webp', wash: 'rgb(140 110 200 / 0.40)', filter: 'saturate(0.9) hue-rotate(-12deg) brightness(0.85)' },
  { id: 'night', label: 'Night', emoji: '🌙', src: '/img/window/night.webp', wash: 'rgb(30 45 110 / 0.62)', filter: 'saturate(0.7) brightness(0.62)' },
];
const RATIO = 1536 / 858;
const LENGTHS = [15, 25, 45, 60];

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function useViewport() {
  const [s, set] = useState(() => ({ w: innerWidth, h: innerHeight }));
  useEffect(() => {
    const on = () => set({ w: innerWidth, h: innerHeight });
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return s;
}

/** Which painting is showing and how far the next one has faded in. */
function phaseAt(p: number) {
  const x = Math.min(0.9999, Math.max(0, p)) * (PHASES.length - 1);
  const i = Math.floor(x);
  return { i, mix: smooth(0.6, 1, x - i) };
}

/** Remember which paintings are missing so we can fall back to a tinted original. */
const missing = new Set<string>();

function Painting({ phase, rain, opacity, pan }: { phase: Phase; rain: boolean; opacity: number; pan: number }) {
  const [broken, setBroken] = useState(() => missing.has(phase.src));
  const fallback = rain || broken;
  return (
    <div className="absolute inset-0" style={{ opacity, transition: 'opacity 1.2s linear' }}>
      <div className="absolute top-1/2 -translate-y-1/2" style={{ width: `max(100vw, ${RATIO * 100}dvh)`, aspectRatio: RATIO, left: pan, transition: 'left 2s linear' }}>
        <img
          src={fallback ? RAIN_SRC : phase.src}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => {
            missing.add(phase.src);
            setBroken(true);
          }}
          className="size-full object-cover select-none"
          style={broken && !rain ? { filter: phase.filter } : undefined}
        />
        {fallback && <div className="absolute inset-0 mix-blend-multiply" style={{ background: phase.wash }} />}
        {rain && (
          <div className="pointer-events-none absolute overflow-hidden" style={{ left: '9%', top: '3%', width: '83%', height: '78%' }}>
            <div className="cafe-rain absolute -inset-[20%] rotate-[8deg]" />
          </div>
        )}
      </div>
    </div>
  );
}

function Stars({ show }: { show: number }) {
  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: 8 + ((i * 37) % 84), y: 4 + ((i * 53) % 30), d: (i % 5) * 0.7, s: 1.5 + (i % 3) })), []);
  if (show < 0.05 || prefersReducedMotion()) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity: show }}>
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-[#fff7d6]"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, boxShadow: '0 0 6px #fff3c0' }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 3.2, delay: s.d, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

export default function WindowSeat() {
  const setUI = useUI((s) => s.set);
  const t = useTimerView();
  const theme = usePrefs((s) => s.theme);
  const dark = theme === 'midnight' || theme === 'nebula';
  const mixer = usePrefs((s) => s.mixer.on);
  const toggleTrack = usePrefs((s) => s.toggleTrack);
  const workMin = useData((s) => Math.round(s.data.settings.workDuration / 60));
  const [rain, setRain] = useState(false);
  const [min, setMin] = useState(() => (LENGTHS.includes(workMin) ? workMin : 25));
  const { w, h } = useViewport();
  const save = { ...SAVE0, ...useFeatureData<SeatSave>(SAVE_KEY, SAVE0) };
  const patch = (p: Partial<SeatSave>) => updateFeatureData<SeatSave>(SAVE_KEY, SAVE0, (d) => void Object.assign(d, p));
  const chosen = sceneOf(save.scene);
  const [failed, setFailed] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    addEventListener('online', on);
    addEventListener('offline', on);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', on);
    };
  }, []);
  const video = chosen.yt && failed !== chosen.id && online ? chosen : null;
  const pick = (sc: Scene) => {
    setFailed(null);
    setPicking(false);
    patch({ scene: sc.id });
  };

  const focusing = t.mode === 'focus' && t.status !== 'idle';
  const onBreak = t.mode !== 'focus';
  const [doneDay, setDoneDay] = useState(false);
  // a finished session leaves the scene at night until the next one starts
  useEffect(() => {
    if (focusing) setDoneDay(false);
  }, [focusing]);
  useEffect(() => {
    const unsub = useTimer.subscribe((s, prev) => {
      if (prev.mode === 'focus' && prev.status === 'running' && s.mode !== 'focus') setDoneDay(true);
    });
    return unsub;
  }, []);

  const p = focusing ? t.progress : doneDay || onBreak ? 1 : 0;
  const { i, mix } = phaseAt(p);
  const cur = PHASES[i];
  const next = PHASES[Math.min(PHASES.length - 1, i + 1)];
  const nightness = i === PHASES.length - 2 ? mix : i === PHASES.length - 1 ? 1 : 0;

  // phones see a slice of the painting: drift slowly across it as the day goes on
  const artW = Math.max(w, RATIO * h);
  const pan = (w - artW) * (0.36 + 0.28 * p);

  const sound = rain ? 'storm' : nightness > 0.5 ? 'night' : 'forest';
  const soundOn = video ? save.sound : !!mixer[sound];

  const leave = () => {
    if (useTimer.getState().status === 'running') toast({ emoji: '🪟', title: 'The window will wait for you', body: 'The timer keeps going.' });
    setUI({ mode: null });
  };

  const ink = dark ? 'text-[#f5ecdf]' : 'text-[#3b2a20]';
  const card = dark ? 'bg-[#2b2130]/92 border-white/10' : 'bg-[#fffaf1]/92 border-[#5b3f2c]/30';
  const round = cn('pressable grid size-12 place-items-center rounded-full border-2 backdrop-blur-md shadow-[0_8px_20px_-10px_rgb(40_20_10/0.6)]', card, ink);

  return (
    <div className="fixed inset-0 z-[45] overflow-hidden bg-[#2b1a10]" role="dialog" aria-modal="true" aria-label="Window Seat">
      {video ? (
        <Suspense fallback={<img src={thumbOf(video, 'maxres')} alt="" className="absolute inset-0 size-full object-cover" />}>
          <YouTubeView
            scene={video}
            sound={save.sound}
            onFail={() => {
              setFailed(video.id);
              toast({ emoji: '🎨', title: `${video.label} won’t load right now`, body: 'Showing the painted window instead. Try another view any time.', ms: 5000 });
            }}
          />
        </Suspense>
      ) : (
        <>
          <Painting key={`a-${cur.id}-${rain}`} phase={cur} rain={rain} opacity={1} pan={pan} />
          {next !== cur && <Painting key={`b-${next.id}-${rain}`} phase={next} rain={rain} opacity={mix} pan={pan} />}
          <Stars show={rain ? 0 : nightness} />
        </>
      )}
      {/* soft vignette so the clock and buttons always read */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,transparent_45%,rgb(30_15_5/0.35))]" />

      <div className="absolute inset-x-0 top-[max(16px,env(safe-area-inset-top))] flex items-center justify-between px-4">
        <button onClick={leave} className={cn('pressable inline-flex h-10 items-center gap-2 rounded-2xl border-2 px-3 text-sm font-extrabold backdrop-blur-md', card, ink)}>
          <DoorOpen size={16} /> <span className="hidden sm:inline">Leave</span>
        </button>
        <button
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          aria-label="Change the view"
          className={cn('pressable inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-extrabold backdrop-blur-md', card, ink)}
        >
          {video ? (
            <>
              {video.emoji} {video.label}
              {video.live && <span className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-[#e5484d] px-1.5 py-px text-[10px] font-black tracking-wide text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" />LIVE</span>}
            </>
          ) : (
            <>
              {rain ? '🌧️' : (mix > 0.5 ? next : cur).emoji} {rain ? 'Rainy ' : ''}
              {(mix > 0.5 ? next : cur).label.toLowerCase()}
            </>
          )}
          <ChevronDown size={15} className={cn('transition-transform', picking && 'rotate-180')} />
        </button>
        <span className="w-10 sm:w-[92px]" aria-hidden />
      </div>

      <AnimatePresence>
        {picking && (
          <ScenePicker
            current={video?.id ?? 'painted'}
            online={online}
            dark={dark}
            onPick={pick}
            onClose={() => setPicking(false)}
          />
        )}
      </AnimatePresence>

      {/* the timer, softly */}
      <AnimatePresence>
        {(focusing || (onBreak && t.status !== 'idle')) && (
          <motion.div
            key="clock"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-[12dvh] flex flex-col items-center text-center text-[#fffaf1]"
          >
            <span className="tabular font-display leading-none font-semibold opacity-90 [text-shadow:0_2px_30px_rgb(40_20_10/0.55)]" style={{ fontSize: 'clamp(60px, 12vmin + 18px, 140px)' }}>
              {t.clock}
            </span>
            <span className="mt-2 rounded-full bg-black/20 px-3 py-1 text-sm font-extrabold backdrop-blur-sm">{onBreak ? 'Break: rest your eyes on the view' : t.status === 'paused' ? 'Paused' : 'Watching the day go by'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* start / day done */}
      <AnimatePresence>
        {!focusing && !(onBreak && t.status !== 'idle') && (
          <motion.div
            key="start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            className={cn('absolute bottom-[calc(max(20px,env(safe-area-inset-bottom))+76px)] left-1/2 w-[min(92vw,420px)] -translate-x-1/2 rounded-[26px] border-2 p-5 text-center backdrop-blur-md', card, ink)}
          >
            <p className="font-display text-2xl font-semibold">{doneDay ? (video ? 'Lovely session ✨' : 'The day is done ✨') : 'Take a window seat 🪟'}</p>
            <p className="mt-1 text-sm font-bold opacity-70">
              {video
                ? doneDay
                  ? 'Rest your eyes on the view, then start another.'
                  : `${video.label} outside${video.live ? ', live right now' : ''}. Settle in and focus.`
                : doneDay
                  ? 'Lovely work. Rest a little, then start a new day.'
                  : 'Focus while the day passes outside: dawn to night in one session.'}
            </p>
            <div className="mt-4 flex justify-center gap-2" role="radiogroup" aria-label="Session length">
              {LENGTHS.map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={min === m}
                  onClick={() => setMin(m)}
                  className={cn('pressable h-10 min-w-[60px] rounded-xl border-2 px-2 text-sm font-black', min === m ? 'border-transparent bg-[#e07a5f] text-white' : 'border-current/20 hover:bg-black/5')}
                >
                  {m} min
                </button>
              ))}
            </div>
            <button
              onClick={() => requestFocusFor(min, 'Window seat', undefined, '🪟', 'window')}
              className={cn('pressable mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl text-base font-extrabold', dark ? 'bg-[#f5ecdf] text-[#2b2130]' : 'bg-[#3b2a20] text-[#fff6ea]')}
            >
              {video ? 'Start focusing 🪟' : doneDay ? 'Start a new day 🌅' : 'Start focusing 🌅'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] flex items-center justify-center gap-3">
        {(focusing || (onBreak && t.status !== 'idle')) && (
          <>
            <button onClick={toggle} aria-label={t.status === 'running' ? 'Pause' : 'Resume'} title={t.status === 'running' ? 'Pause' : 'Resume'} className={round}>
              {t.status === 'running' ? <Pause size={20} /> : <Play size={20} className="translate-x-px" />}
            </button>
            <button onClick={onBreak && t.status === 'idle' ? skipBreak : requestEnd} aria-label={onBreak ? 'Skip break' : 'End session'} title={onBreak ? 'Skip break' : 'End session'} className={round}>
              <Square size={17} />
            </button>
          </>
        )}
        {!video && (
          <button onClick={() => setRain((r) => !r)} aria-pressed={rain} aria-label={rain ? 'Clear skies' : 'Make it rain'} title={rain ? 'Clear skies' : 'Make it rain'} className={round}>
            {rain ? <Sun size={19} /> : <CloudRain size={19} />}
          </button>
        )}
        <button
          onClick={() => {
            if (video) return patch({ sound: !save.sound });
            // one ambience at a time: rain, birds by day, crickets at night
            for (const k of ['storm', 'forest', 'night']) if (k !== sound && mixer[k]) toggleTrack(k, false);
            toggleTrack(sound, !soundOn);
          }}
          aria-label={soundOn ? 'Mute the outside' : 'Hear the outside'}
          title={soundOn ? 'Mute' : video ? 'Hear the view' : rain ? 'Rain sounds' : nightness > 0.5 ? 'Crickets' : 'Birdsong'}
          className={round}
        >
          {soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      </div>
    </div>
  );
}

/** The view picker: live streams and loops from YouTube, plus the painted window (offline). */
function ScenePicker({ current, online, dark, onPick, onClose }: { current: string; online: boolean; dark: boolean; onPick: (s: Scene) => void; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <>
      <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-black/30" onClick={onClose} />
      <motion.div
        key="picker"
        role="dialog"
        aria-label="Pick a view"
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className={cn(
          'absolute top-[calc(max(16px,env(safe-area-inset-top))+52px)] left-1/2 z-20 max-h-[calc(100dvh-180px)] w-[min(94vw,640px)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[24px] border-2 p-3 shadow-2xl backdrop-blur-xl',
          dark ? 'border-white/10 bg-[#2b2130]/95 text-[#f5ecdf]' : 'border-[#5b3f2c]/25 bg-[#fffaf1]/95 text-[#3b2a20]',
        )}
      >
        <p className="px-1 pb-2 text-xs font-extrabold opacity-70">{online ? 'Live streams and long loops from YouTube. Sound is off until you turn it on.' : 'You’re offline: the painted window still works.'}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCENES.map((sc) => {
            const off = !!sc.yt && !online;
            return (
              <button
                key={sc.id}
                disabled={off}
                onClick={() => onPick(sc)}
                aria-pressed={current === sc.id}
                className={cn(
                  'pressable group relative overflow-hidden rounded-2xl text-left ring-2 transition-shadow disabled:opacity-40',
                  current === sc.id ? 'ring-[#e07a5f]' : 'ring-transparent hover:ring-current/20',
                )}
              >
                <img src={thumbOf(sc)} alt="" loading="lazy" decoding="async" draggable={false} className="aspect-video w-full object-cover" />
                {sc.live && <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-[#e5484d] px-1.5 py-px text-[10px] font-black text-white"><span className="size-1.5 rounded-full bg-white" />LIVE</span>}
                <span className="block px-2 pt-1.5 text-[13px] leading-tight font-black">
                  {sc.emoji} {sc.label}
                </span>
                <span className="block px-2 pb-2 text-[11px] leading-snug font-bold opacity-65">{sc.note}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
